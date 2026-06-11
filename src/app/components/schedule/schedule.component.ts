import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  buildRulerCells,
  findCurrentCellLeft,
  offsetRangeToDateRange,
  placeBar,
  placementSlotWidthFor,
  ScheduleRulerComponent,
  ScheduleRulerScale,
} from '../schedule-ruler/schedule-ruler.component';
import { Timescale } from '../timescale/timescale.component';
import { BadgeStatus } from '../badge/badge.component';
import { TooltipDirective } from '../tooltip/tooltip.directive';
import { WorkOrderComponent } from '../work-order/work-order.component';

export interface WorkCenter {
  id: string;
  name: string;
}

export interface ScheduleOrder {
  id: string;
  name: string;
  workCenterId: string;
  status: BadgeStatus;
  startDate: string;
  endDate: string;
}

export interface PlacedOrder extends ScheduleOrder {
  left: number;
  width: number;
}

export interface AddWorkOrderRequest {
  workCenterId: string;
  left: number;
  width: number;
  startDate: string;
  endDate: string;
}

export type WorkOrderAction = 'edit' | 'delete';

interface HoverPlacement {
  left: number;
  width: number;
  startDate: string;
  endDate: string;
}

@Component({
  selector: 'nao-schedule',
  standalone: true,
  imports: [CommonModule, ScheduleRulerComponent, TooltipDirective, WorkOrderComponent],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleComponent implements AfterViewInit {
  @ViewChild('timelineScroll') private readonly timelineScroll?: ElementRef<HTMLElement>;

  readonly workCenters = input<WorkCenter[]>([]);
  readonly workOrders = input<ScheduleOrder[]>([]);
  readonly scale = input<Timescale>(Timescale.Month);
  readonly timelineStartDate = input.required<string>();
  readonly timelineEndDate = input.required<string>();
  readonly currentDate = input<string | null>(null);

  readonly addWorkOrder = output<AddWorkOrderRequest>();
  readonly orderAction = output<{ order: ScheduleOrder; action: WorkOrderAction }>();

  readonly hoveredRowId = signal<string | null>(null);
  readonly hoverPlacement = signal<HoverPlacement | null>(null);
  private readonly viewReady = signal(false);

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

  readonly placedByCenter = computed<Record<string, PlacedOrder[]>>(() => {
    const scale = this.rulerScale();
    const start = this.timelineStartDate();
    const map: Record<string, PlacedOrder[]> = {};

    for (const center of this.workCenters()) {
      map[center.id] = [];
    }

    for (const order of this.workOrders()) {
      const { left, width } = placeBar(scale, start, order.startDate, order.endDate);
      (map[order.workCenterId] ??= []).push({ ...order, left, width });
    }

    return map;
  });

  readonly placementWidth = computed(() => {
    switch (this.rulerScale()) {
      case Timescale.Day:
        return 64;
      case Timescale.Week:
        return 150;
      default:
        return 114;
    }
  });

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

      if (!this.viewReady()) {
        return;
      }

      queueMicrotask(() => this.scrollToCurrentPeriodLeadIn());
    });
  }

  ngAfterViewInit(): void {
    this.viewReady.set(true);
  }

  setHoveredRow(id: string | null): void {
    this.hoveredRowId.set(id);
  }

  onRowMove(event: MouseEvent, id: string): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    this.hoveredRowId.set(id);

    const orders = this.placedByCenter()[id] ?? [];
    if (orders.some(order => x >= order.left && x < order.left + order.width)) {
      this.hoverPlacement.set(null);
      return;
    }

    this.hoverPlacement.set(this.findAvailablePlacement(x, orders));
  }

  clearHover(): void {
    this.hoveredRowId.set(null);
    this.hoverPlacement.set(null);
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

    element.scrollLeft = Math.max(marker.left - this.cellWidth(), 0);
  }

  private cellWidth(): number {
    switch (this.rulerScale()) {
      case Timescale.Day:
        return 64;
      case Timescale.Week:
        return 150;
      default:
        return 114;
    }
  }

  private findAvailablePlacement(x: number, orders: PlacedOrder[]): HoverPlacement | null {
    const scale = this.rulerScale();
    const width = this.placementWidth();
    // The pill stays one cell wide, but its start snaps at slot granularity:
    // whole cells for Day/Week, quarter-month "week" sections for Month.
    const step = placementSlotWidthFor(scale);
    const maxLeft = Math.max(0, this.timelineWidth() - width);
    const maxIndex = Math.floor(maxLeft / step);
    // Centre the pill on the cursor (snapped to the step grid). The candidate
    // search below shifts it sideways when a neighbouring order is in the way.
    const preferredIndex = Math.min(Math.max(0, Math.round((x - width / 2) / step)), maxIndex);
    const candidates = this.buildPlacementCandidateIndexes(preferredIndex, maxIndex);

    for (const index of candidates) {
      const left = index * step;
      const range = offsetRangeToDateRange(scale, this.timelineStartDate(), left, width);

      if (!this.overlapsAny(range.startDate, range.endDate, orders)) {
        return { left, width, ...range };
      }
    }

    return null;
  }

  private buildPlacementCandidateIndexes(preferredIndex: number, maxIndex: number): number[] {
    const result: number[] = [];

    for (let distance = 0; distance <= maxIndex; distance += 1) {
      const right = preferredIndex + distance;
      const left = preferredIndex - distance;

      if (right <= maxIndex) {
        result.push(right);
      }

      if (distance > 0 && left >= 0) {
        result.push(left);
      }
    }

    return result;
  }

  private overlapsAny(startDate: string, endDate: string, orders: PlacedOrder[]): boolean {
    return orders.some(order => startDate <= order.endDate && endDate >= order.startDate);
  }
}
