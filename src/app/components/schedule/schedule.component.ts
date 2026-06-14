import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
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
import { TooltipDirective } from '../tooltip/tooltip.directive';
import { BadgeStatus } from '../badge/badge.component';
import { WorkOrderComponent } from '../work-order/work-order.component';
import { formatDateRangeShort } from '../../utils/format-date-range';
import { InteractionLayerService } from '../../services/interaction-layer.service';
import { ScheduleCompactGroupComponent } from './schedule-compact-group/schedule-compact-group.component';
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
    ScheduleCompactGroupComponent,
    ScheduleRulerComponent,
    TooltipDirective,
    WorkOrderComponent,
  ],
  providers: [InteractionLayerService],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleComponent implements AfterViewInit, OnDestroy {
  private readonly interactionLayer = inject(InteractionLayerService, { optional: true });

  @ViewChild('timelineScroll') private readonly timelineScroll?: ElementRef<HTMLElement>;

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
  readonly visibleFocusedOrderId = signal<string | null>(null);
  /** Which way the open compact popover unfolds, so it stays inside the scrollport. */
  readonly compactPopoverFlip = signal<{ horizontal: boolean; vertical: boolean }>({ horizontal: false, vertical: false });
  /** Width cap for the open popover when the visible scrollport is narrower than its natural size. */
  readonly compactPopoverMaxWidth = signal<number>(ScheduleComponent.COMPACT_POPOVER_WIDTH);
  /** Marker button that opened the popover; focus returns here on Escape. */
  private compactTriggerElement: HTMLElement | null = null;
  private readonly viewReady = signal(false);
  private readonly scrollLeft = signal(0);
  private readonly viewportWidth = signal(0);
  private focusSettleTimer: ReturnType<typeof setTimeout> | null = null;
  private cleanupFocusScroll: (() => void) | null = null;
  private resizeObserver?: ResizeObserver;
  private lastEdgeRequestKey: string | null = null;
  private lastFocusScrollKey: string | null = null;
  private lastLeadInScrollKey: string | null = null;
  private previousTimelineStartDate: string | null = null;
  private previousTimelineWidth: number | null = null;
  private momentumRafId: number | null = null;
  private lastTrackedScrollLeft = 0;
  /**
   * Set for the duration of one microtask cycle when a focus scroll has just
   * been initiated. A range prepend in the same tick (saving an order dated
   * before the range) must NOT apply scroll preservation then: the focus
   * target is already in the new coordinate space, and an instant scrollLeft
   * write would abort the in-flight smooth scroll.
   */
  private suppressScrollPreservation = false;
  /**
   * Focus targets farther than this many viewports teleport to the approach
   * side of the target and smooth-scroll only the final stretch. Viewports,
   * not years: the same number of years is 2.7k px at Month scale but 146k px
   * at Day scale, while "two screens of glide" feels identical at any zoom.
   * Matches the window's trailing buffer, so the glide is fully rendered.
   */
  private static readonly FOCUS_GLIDE_VIEWPORTS = 2;
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
    const viewport = this.viewportWidth();

    if (!viewport) {
      return { start: Number.NEGATIVE_INFINITY, end: Number.POSITIVE_INFINITY };
    }

    const left = this.scrollLeft();
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

  constructor() {
    effect(() => {
      this.viewReady();
      this.rulerScale();
      this.timelineStartDate();
      this.timelineEndDate();
      this.currentDate();
      this.timelineWidth();
      this.focusDate();
      this.focusRequestId();
      this.focusedOrderId();

      if (!this.viewReady()) {
        return;
      }

      queueMicrotask(() => {
        if (this.focusDate()) {
          const focusKey = [
            this.rulerScale(),
            this.focusDate(),
            this.focusRequestId(),
            this.focusedOrderId(),
          ].join(':');

          if (focusKey !== this.lastFocusScrollKey) {
            this.lastFocusScrollKey = focusKey;
            this.scrollToFocusDate();
          }
          return;
        }

        const leadInKey = [
          this.rulerScale(),
          this.currentDate() ?? 'today',
        ].join(':');

        if (leadInKey !== this.lastLeadInScrollKey) {
          this.lastLeadInScrollKey = leadInKey;
          this.scrollToCurrentPeriodLeadIn();
        }
      });
    });

    effect(() => {
      const startDate = this.timelineStartDate();
      const width = this.timelineWidth();
      this.viewReady();

      const previousStartDate = this.previousTimelineStartDate;
      const previousWidth = this.previousTimelineWidth;
      this.previousTimelineStartDate = startDate;
      this.previousTimelineWidth = width;

      if (!this.viewReady() || !previousStartDate || previousWidth === null || startDate >= previousStartDate) {
        return;
      }

      // Width delta of the actual cell grid, not a date conversion: week cells
      // align to startOfWeek, so dateToOffset can be off by one cell at Week
      // scale, which would desync the preserved scroll position.
      const addedWidth = width - previousWidth;
      queueMicrotask(() => this.preserveScrollAfterPrependedRange(addedWidth));
    });

    effect(() => {
      // Re-arm edge requests whenever a load cycle ends. After a successful
      // extension the range (and thus the key) changes anyway — this matters
      // when a load fails and the range stays put: without it, that edge
      // could never request again.
      if (!this.timelineLoadingSide()) {
        this.lastEdgeRequestKey = null;
      }
    });
  }

  ngAfterViewInit(): void {
    this.viewReady.set(true);

    const element = this.timelineScroll?.nativeElement;

    if (!element) {
      return;
    }

    this.viewportWidth.set(element.clientWidth);

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver = new ResizeObserver(([entry]) => {
      this.viewportWidth.set(entry.contentRect.width);
    });
    this.resizeObserver.observe(element);
  }

  ngOnDestroy(): void {
    this.cancelPendingFocusAnimation();
    this.resizeObserver?.disconnect();

    if (this.momentumRafId !== null) {
      cancelAnimationFrame(this.momentumRafId);
      this.momentumRafId = null;
    }
  }

  onTimelineScroll(event: Event): void {
    const element = event.target as HTMLElement;
    this.interactionLayer?.suppressTooltipsForScroll();
    this.syncScrollLeft(element);
    this.requestRangeExtensionIfNeeded(element);
    this.trackMomentum(element);
  }

  private syncScrollLeft(element: HTMLElement): void {
    this.lastTrackedScrollLeft = element.scrollLeft;
    this.scrollLeft.set(element.scrollLeft);
  }

  /**
   * Scroll events lag behind the compositor during a fast fling (and can be
   * starved entirely while the main thread is busy), which lets the visual
   * position outrun the render window. This per-frame tracker reads the real
   * scrollLeft until it stops changing, so the window stays glued to whatever
   * the user actually sees.
   */
  private trackMomentum(element: HTMLElement): void {
    if (this.momentumRafId !== null || typeof requestAnimationFrame === 'undefined') {
      return;
    }

    let idleFrames = 0;

    const tick = () => {
      if (element.scrollLeft !== this.lastTrackedScrollLeft) {
        idleFrames = 0;
        this.syncScrollLeft(element);
      } else if (++idleFrames >= 3) {
        this.momentumRafId = null;
        return;
      }

      this.momentumRafId = requestAnimationFrame(tick);
    };

    this.momentumRafId = requestAnimationFrame(tick);
  }

  private requestRangeExtensionIfNeeded(element: HTMLElement): void {
    if (this.timelineLoadingSide()) {
      return;
    }

    const maxScrollLeft = Math.max(element.scrollWidth - element.clientWidth, 0);
    const distanceToEnd = maxScrollLeft - element.scrollLeft;
    const threshold = Math.max(element.clientWidth * 1.5, this.cellWidth() * 4);

    const side =
      element.scrollLeft <= threshold ? 'start' :
        distanceToEnd <= threshold ? 'end' :
          null;

    if (!side) {
      return;
    }

    const requestKey = `${side}:${this.timelineStartDate()}:${this.timelineEndDate()}`;
    if (requestKey === this.lastEdgeRequestKey) {
      return;
    }

    this.lastEdgeRequestKey = requestKey;
    this.timelineEdgeReached.emit(side);
  }

  private preserveScrollAfterPrependedRange(addedWidth: number): void {
    const element = this.timelineScroll?.nativeElement;

    if (!element || addedWidth <= 0 || this.suppressScrollPreservation) {
      return;
    }

    const nextScrollLeft = element.scrollLeft + addedWidth;
    element.scrollLeft = nextScrollLeft;
    this.syncScrollLeft(element);
  }

  private today(): Date {
    const value = this.currentDate();
    return value ? new Date(value) : new Date();
  }

  private scrollToCurrentPeriodLeadIn(): void {
    const element = this.timelineScroll?.nativeElement;
    const marker = this.currentMarker();

    if (!element || !marker) {
      return;
    }

    const target = Math.max(marker.left - this.cellWidth(), 0);
    element.scrollLeft = target;
    // Programmatic jumps move the render window immediately; waiting for the
    // scroll event would leave the landing area unrendered for a frame.
    this.scrollLeft.set(target);
  }

  private scrollToFocusDate(): void {
    const element = this.timelineScroll?.nativeElement;
    const focusDate = this.focusDate();
    const focusedOrderId = this.focusedOrderId();

    if (!element || !focusDate) {
      return;
    }

    this.visibleFocusedOrderId.set(null);
    this.cancelPendingFocusAnimation();

    const left = dateToOffset(this.rulerScale(), this.timelineStartDate(), focusDate);
    const target = Math.max(left - this.cellWidth(), 0);
    const glideDistance = element.clientWidth * ScheduleComponent.FOCUS_GLIDE_VIEWPORTS;
    const offset = target - element.scrollLeft;

    if (Math.abs(offset) > glideDistance) {
      // Distant target: teleport to the approach side first, then glide the
      // final stretch. A smooth scroll across years of timeline gets
      // compressed by the browser into an unreadable blur — a short glide
      // over fully rendered content reads as "arriving at the order".
      element.scrollLeft = target - Math.sign(offset) * glideDistance;
      this.syncScrollLeft(element);
    }

    element.scrollTo({
      left: target,
      behavior: 'smooth',
    });
    // Render the destination right away so the smooth scroll lands on painted
    // content instead of waiting for scroll events to move the window.
    this.scrollLeft.set(target);

    // The target is computed against the CURRENT (possibly just-prepended)
    // range, so scroll preservation queued in this same tick must stand down.
    this.suppressScrollPreservation = true;
    queueMicrotask(() => {
      this.suppressScrollPreservation = false;
    });

    if (focusedOrderId) {
      this.runAfterScrollSettles(element, () => {
        this.visibleFocusedOrderId.set(focusedOrderId);
      });
    }
  }

  private runAfterScrollSettles(element: HTMLElement, callback: () => void): void {
    const finish = () => {
      this.cancelPendingFocusAnimation();
      callback();
    };

    const scheduleFinish = () => {
      if (this.focusSettleTimer) {
        clearTimeout(this.focusSettleTimer);
      }
      this.focusSettleTimer = setTimeout(finish, 120);
    };

    element.addEventListener('scroll', scheduleFinish, { passive: true });
    this.cleanupFocusScroll = () => element.removeEventListener('scroll', scheduleFinish);

    // If the target is already visible and no scroll event fires, still replay
    // the focus pulse after a short beat.
    scheduleFinish();
  }

  private cancelPendingFocusAnimation(): void {
    if (this.focusSettleTimer) {
      clearTimeout(this.focusSettleTimer);
      this.focusSettleTimer = null;
    }
    this.cleanupFocusScroll?.();
    this.cleanupFocusScroll = null;
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

  compactGroupHasFocusedOrder(group: CompactOrderGroup): boolean {
    const focusedOrderId = this.visibleFocusedOrderId();
    return !!focusedOrderId && group.orders.some(order => order.id === focusedOrderId);
  }

  /** Hover tooltip for a full work-order bar: "Name · date range". */
  orderTooltip(order: ScheduleOrder): string {
    return `${order.name} · ${formatDateRangeShort(order.startDate, order.endDate)}`;
  }

}
