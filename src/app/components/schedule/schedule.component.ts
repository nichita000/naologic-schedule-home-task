import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  buildRulerCells,
  dateToOffset,
  findCurrentCellLeft,
  ScheduleRulerComponent,
  ScheduleRulerScale,
} from '../schedule-ruler/schedule-ruler.component';
import { Timescale } from '../timescale/timescale.component';
import { BadgeStatus } from '../badge/badge.component';
import { InteractionLayerService } from '../../services/interaction-layer.service';
import { ScheduleGridComponent } from './schedule-grid/schedule-grid.component';
import {
  cellWidthFor,
  compactMarkerLeft,
  findAvailablePlacement,
  groupCompactOrders,
  HoverPlacement,
  isCompactOrder,
  placeOrdersByCenter,
  PlacementContext,
} from './schedule-placement';
import { ScheduleRowComponent } from './schedule-row/schedule-row.component';
import { ScheduleSidebarComponent } from './schedule-sidebar/schedule-sidebar.component';
import { FocusTarget, TimelineScrollDirective } from './timeline-scroll.directive';

/** Which menu action fired on a work-order bar. */
export type WorkOrderAction = 'edit' | 'delete';

export interface WorkCenter {
  id: string;
  name: string;
}

/** A work order in view-model form (the page maps documents into this shape). */
export interface ScheduleOrder {
  id: string;
  name: string;
  workCenterId: string;
  status: BadgeStatus;
  startDate: string;
  endDate: string;
}

/** A work order resolved to pixel coordinates on the timeline. */
export interface PlacedOrder extends ScheduleOrder {
  left: number;
  width: number;
}

export interface CompactPlacedOrder extends PlacedOrder {
  markerLeft: number;
}

export interface CompactOrderGroup {
  id: string;
  workCenterId: string;
  markerLeft: number;
  /** Duration-proportional pill width for single-order groups; null for clusters. */
  pillWidth: number | null;
  orders: CompactPlacedOrder[];
}

export interface AddWorkOrderRequest {
  workCenterId: string;
  left: number;
  width: number;
  startDate: string;
  endDate: string;
}

@Component({
  selector: 'nao-schedule',
  standalone: true,
  imports: [
    CommonModule,
    ScheduleGridComponent,
    ScheduleRulerComponent,
    ScheduleRowComponent,
    ScheduleSidebarComponent,
    TimelineScrollDirective,
  ],
  providers: [InteractionLayerService],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleComponent {
  private readonly interactionLayer = inject(InteractionLayerService, { optional: true });

  /** The scrollport element, used to position the compact popover. */
  @ViewChild('timelineScroll') private readonly timelineScroll?: ElementRef<HTMLElement>;
  /** Owns scroll position, virtualisation window, edge preload and focus glide. */
  private readonly scroller = viewChild(TimelineScrollDirective);

  /** Work centers shown in the frozen left column. */
  readonly workCenters = input<WorkCenter[]>([]);
  readonly workOrders = input<ScheduleOrder[]>([]);
  readonly scale = input<Timescale>(Timescale.Month);
  readonly timelineStartDate = input.required<string>();
  readonly timelineEndDate = input.required<string>();
  /** ISO date marking "today"; defaults to the real current date. */
  readonly currentDate = input<string | null>(null);
  /** Optional date to scroll into view after a parent interaction changes scale. */
  readonly focusDate = input<string | null>(null);
  /** Monotonic trigger for repeated focus requests to the same date. */
  readonly focusRequestId = input<number>(0);
  /** Optional work-order id to highlight after focusing its date. */
  readonly focusedOrderId = input<string | null>(null);
  /** Edge currently waiting for remote work orders before the range expands. */
  readonly timelineLoadingSide = input<'start' | 'end' | null>(null);

  /** Emitted when the user clicks the hover "add" pill on a row. */
  readonly addWorkOrder = output<AddWorkOrderRequest>();
  /** Emitted while the add-date preview moves across available timeline slots. */
  readonly addPreviewRangeChange = output<{ startDate: string; endDate: string } | null>();
  /** Emitted when Edit/Delete is chosen from a work-order bar's menu. */
  readonly orderAction = output<{ order: ScheduleOrder; action: WorkOrderAction }>();
  /** Emitted when a compact month marker should be opened in a more detailed scale. */
  readonly compactOrderFocus = output<ScheduleOrder>();
  /** Emitted when the scrollport approaches either horizontal edge. */
  readonly timelineEdgeReached = output<'start' | 'end'>();

  readonly hoveredRowId = signal<string | null>(null);
  /** Free placement span of the hover "add" pill, or null when the cursor is over an occupied range. */
  readonly hoverPlacement = signal<HoverPlacement | null>(null);
  readonly activeCompactGroupId = signal<string | null>(null);
  /** Order to pulse once a focus scroll settles — owned by the scroll directive. */
  readonly visibleFocusedOrderId = computed(() => this.scroller()?.visibleFocusedOrderId() ?? null);
  /** Which way the open compact popover unfolds, so it stays inside the scrollport. */
  readonly compactPopoverFlip = signal<{ horizontal: boolean; vertical: boolean }>({ horizontal: false, vertical: false });
  /** Width cap for the open popover when the visible scrollport is narrower than its natural size. */
  readonly compactPopoverMaxWidth = signal<number>(ScheduleComponent.COMPACT_POPOVER_WIDTH);
  /** Marker button that opened the popover; focus returns here on Escape. */
  private compactTriggerElement: HTMLElement | null = null;
  readonly interactionsLocked = computed(() =>
    (this.interactionLayer?.suppressBackgroundHover() ?? false) || !!this.timelineLoadingSide()
  );

  readonly rulerScale = computed<ScheduleRulerScale>(() => {
    const scale = this.scale();
    return scale === Timescale.Hour ? Timescale.Month : scale;
  });

  readonly timelineCells = computed(() =>
    buildRulerCells(this.rulerScale(), this.timelineStartDate(), this.timelineEndDate())
  );

  readonly timelineWidth = computed(() =>
    this.timelineCells().reduce((sum, cell) => sum + cell.width, 0)
  );

  /**
   * Horizontal virtualisation window, in track pixels. Two viewports of buffer
   * behind and ahead: the compositor scrolls ahead of JS scroll events during
   * a fast fling, so the window must survive a multi-frame event gap without
   * exposing unrendered cells (a rAF tracker re-syncs it every frame as a
   * second line of defence). Until the viewport is measured, everything
   * renders.
   */
  readonly renderWindow = computed<{ start: number; end: number }>(() => {
    const scroller = this.scroller();
    const viewport = scroller?.viewportWidth() ?? 0;

    if (!viewport) {
      return { start: Number.NEGATIVE_INFINITY, end: Number.POSITIVE_INFINITY };
    }

    const left = scroller!.scrollLeft();
    return { start: left - viewport * 2, end: left + viewport * 3 };
  });

  /** Timeline cells inside the render window — drives the vertical grid lines. */
  readonly visibleTimelineCells = computed(() => {
    const { start, end } = this.renderWindow();
    return this.timelineCells().filter(cell => cell.left + cell.width >= start && cell.left <= end);
  });

  /** Work orders resolved to pixel positions, grouped by work-center id. */
  readonly placedByCenter = computed<Record<string, PlacedOrder[]>>(() =>
    placeOrdersByCenter(this.rulerScale(), this.timelineStartDate(), this.workCenters(), this.workOrders())
  );

  readonly normalPlacedByCenter = computed<Record<string, PlacedOrder[]>>(() => {
    const map: Record<string, PlacedOrder[]> = {};
    const scale = this.rulerScale();
    const { start, end } = this.renderWindow();
    const trackWidth = this.timelineWidth();
    for (const center of this.workCenters()) {
      map[center.id] = (this.placedByCenter()[center.id] ?? [])
        .filter(order => !isCompactOrder(scale, order)
          // Orders outside the declared timeline range (e.g. persisted future
          // orders restored before the range is re-extended) must never reach
          // the DOM: a bar past the track's width inflates scrollWidth and
          // opens a phantom, cell-less scroll area.
          && order.left < trackWidth
          && order.left + order.width > 0
          && order.left + order.width >= start
          && order.left <= end)
        // Same reason: a bar that starts inside the range but ends past it is
        // clipped at the track edge instead of overflowing the scrollport.
        .map(order => order.left + order.width > trackWidth
          ? { ...order, width: trackWidth - order.left }
          : order);
    }
    return map;
  });

  readonly compactGroupsByCenter = computed<Record<string, CompactOrderGroup[]>>(() => {
    const map: Record<string, CompactPlacedOrder[]> = {};
    const scale = this.rulerScale();
    const trackWidth = this.timelineWidth();
    for (const center of this.workCenters()) {
      map[center.id] = (this.placedByCenter()[center.id] ?? [])
        // Same range cull as full bars: compactMarkerLeft clamps to the track
        // edge, so an out-of-range order would otherwise pin a marker there.
        .filter(order => isCompactOrder(scale, order)
          && order.left < trackWidth
          && order.left + order.width > 0)
        .map(order => ({
          ...order,
          markerLeft: compactMarkerLeft(scale, trackWidth, order),
        }));
    }

    const grouped = groupCompactOrders(scale, this.timelineStartDate(), trackWidth, map);
    const { start, end } = this.renderWindow();

    for (const workCenterId of Object.keys(grouped)) {
      grouped[workCenterId] = grouped[workCenterId].filter(group => {
        const width = group.pillWidth ?? ScheduleComponent.COMPACT_CLUSTER_MAX_WIDTH;
        return group.markerLeft + width >= start && group.markerLeft <= end;
      });
    }

    return grouped;
  });

  /** Widest a compact cluster marker can get (two dots + overflow count). */
  private static readonly COMPACT_CLUSTER_MAX_WIDTH = 60;

  /** One-cell width for the active scale, used by scroll lead-in maths. */
  readonly cellWidth = computed(() => cellWidthFor(this.rulerScale()));

  /** Position + label of the "current period" marker (pill + vertical line). */
  readonly currentMarker = computed<{ left: number; label: string } | null>(() => {
    const left = findCurrentCellLeft(
      this.rulerScale(),
      this.timelineStartDate(),
      this.timelineEndDate(),
      this.today()
    );
    if (left === null) {
      return null;
    }
    const scale = this.rulerScale();
    const label =
      scale === Timescale.Day ? 'Current day' : scale === Timescale.Week ? 'Current week' : 'Current month';
    return { left, label };
  });

  /** Pixel target the scroll directive glides to; null when nothing is focused. */
  readonly focusTarget = computed<FocusTarget | null>(() => {
    const focusDate = this.focusDate();
    if (!focusDate) {
      return null;
    }
    const left = dateToOffset(this.rulerScale(), this.timelineStartDate(), focusDate);
    return { left: Math.max(left - this.cellWidth(), 0), orderId: this.focusedOrderId() };
  });

  /** A focus scroll runs only when this key changes. */
  readonly focusKey = computed(() =>
    [this.rulerScale(), this.focusDate(), this.focusRequestId(), this.focusedOrderId()].join(':')
  );

  /** Lead-in position used when nothing is focused (one cell before "today"). */
  readonly leadInTarget = computed<number | null>(() => {
    const marker = this.currentMarker();
    return marker ? Math.max(marker.left - this.cellWidth(), 0) : null;
  });

  readonly leadInKey = computed(() => [this.rulerScale(), this.currentDate() ?? 'today'].join(':'));

  private today(): Date {
    const value = this.currentDate();
    return value ? new Date(value) : new Date();
  }

  @HostListener('document:click')
  closeCompactPopover(): void {
    this.setActiveCompactGroup(null);
  }

  @HostListener('document:keydown.escape')
  closeCompactPopoverOnEscape(): void {
    if (!this.activeCompactGroupId()) {
      return;
    }
    this.setActiveCompactGroup(null);
    this.compactTriggerElement?.focus();
  }

  setHoveredRow(id: string | null): void {
    if (this.interactionsLocked()) {
      this.clearHover();
      return;
    }

    this.hoveredRowId.set(id);
  }

  /** Track the hovered row and snap the add pill to the slot under the cursor. */
  onRowMove(event: MouseEvent, id: string): void {
    if (this.interactionsLocked()) {
      this.clearHover();
      return;
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    this.hoveredRowId.set(id);

    // No overlapping orders are allowed, so don't offer "add" over an existing bar.
    const orders = this.placedByCenter()[id] ?? [];
    if (orders.some(order => x >= order.left && x < order.left + order.width)) {
      this.setHoverPlacement(null);
      return;
    }

    this.setHoverPlacement(findAvailablePlacement(this.placementContext(), x, orders));
  }

  private placementContext(): PlacementContext {
    return {
      scale: this.rulerScale(),
      timelineStartDate: this.timelineStartDate(),
      timelineWidth: this.timelineWidth(),
    };
  }

  clearHover(): void {
    this.hoveredRowId.set(null);
    this.setHoverPlacement(null);
  }

  onAddWorkOrder(workCenterId: string): void {
    const placement = this.hoverPlacement();
    if (!placement) {
      return;
    }

    this.addWorkOrder.emit({ workCenterId, ...placement });
  }

  onOrderAction(order: ScheduleOrder, action: WorkOrderAction): void {
    this.orderAction.emit({ order, action });
  }

  onRowOrderAction(event: { order: ScheduleOrder; action: WorkOrderAction }): void {
    this.onOrderAction(event.order, event.action);
  }

  onCompactToggle(event: { trigger: HTMLElement; group: CompactOrderGroup }): void {
    this.toggleCompactGroup(event.trigger, event.group);
  }

  toggleCompactGroup(trigger: HTMLElement, group: CompactOrderGroup): void {
    const willOpen = this.activeCompactGroupId() !== group.id;

    if (willOpen) {
      this.applyCompactPopoverLayout(trigger);
      this.compactTriggerElement = trigger;
    }

    this.setActiveCompactGroup(willOpen ? group.id : null);
  }

  /** Natural popover footprint used to decide which way it unfolds. */
  private static readonly COMPACT_POPOVER_WIDTH = 520;
  private static readonly COMPACT_POPOVER_HEIGHT = 360;
  private static readonly COMPACT_POPOVER_MIN_WIDTH = 280;
  private static readonly COMPACT_POPOVER_MARGIN = 16;

  /**
   * The popover renders inside the timeline scrollport (`overflow: auto hidden`),
   * so anything past the port's edges is unreachable or clipped. Unfold towards
   * whichever side has more room, and cap the width when even that side is
   * narrower than the popover's natural size (small viewports).
   */
  private applyCompactPopoverLayout(trigger: HTMLElement): void {
    const scrollport = this.timelineScroll?.nativeElement;
    if (!scrollport) {
      this.compactPopoverFlip.set({ horizontal: false, vertical: false });
      this.compactPopoverMaxWidth.set(ScheduleComponent.COMPACT_POPOVER_WIDTH);
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const portRect = scrollport.getBoundingClientRect();
    const clipRight = Math.min(portRect.right, window.innerWidth);
    const clipBottom = Math.min(portRect.bottom, window.innerHeight);

    // Horizontal: room to the right of the marker vs room to its left.
    const roomRight = clipRight - triggerRect.left - ScheduleComponent.COMPACT_POPOVER_MARGIN;
    const roomLeft = triggerRect.right - portRect.left - ScheduleComponent.COMPACT_POPOVER_MARGIN;
    const flipHorizontal = roomRight < ScheduleComponent.COMPACT_POPOVER_WIDTH && roomLeft > roomRight;
    const maxWidth = Math.max(
      Math.min(flipHorizontal ? roomLeft : roomRight, ScheduleComponent.COMPACT_POPOVER_WIDTH),
      ScheduleComponent.COMPACT_POPOVER_MIN_WIDTH,
    );

    const fitsBelow = triggerRect.bottom + ScheduleComponent.COMPACT_POPOVER_HEIGHT <= clipBottom;
    const fitsAbove = triggerRect.top - ScheduleComponent.COMPACT_POPOVER_HEIGHT >= portRect.top;

    this.compactPopoverFlip.set({ horizontal: flipHorizontal, vertical: !fitsBelow && fitsAbove });
    this.compactPopoverMaxWidth.set(maxWidth);
  }

  focusCompactOrder(order: ScheduleOrder): void {
    this.setActiveCompactGroup(null);
    this.compactOrderFocus.emit(order);
  }

  private setActiveCompactGroup(id: string | null): void {
    this.activeCompactGroupId.set(id);
    if (id) {
      this.clearHover();
      this.interactionLayer?.openOverlay(id);
      return;
    }

    this.interactionLayer?.closeOverlay();
  }

  private setHoverPlacement(placement: HoverPlacement | null): void {
    this.hoverPlacement.set(placement);
    this.addPreviewRangeChange.emit(
      placement ? { startDate: placement.startDate, endDate: placement.endDate } : null,
    );
  }

}
