import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimescaleComponent, Timescale } from '../../components/timescale/timescale.component';
import {
  AddWorkOrderRequest,
  ScheduleComponent,
  ScheduleOrder,
  WorkOrderAction,
} from '../../components/schedule/schedule.component';
import { BadgeStatus } from '../../components/badge/badge.component';
import {
  WorkOrderDrawerComponent,
  WorkOrderDrawerMode,
  WorkOrderDrawerValue,
} from '../../components/work-order-drawer/work-order-drawer.component';
import { WorkOrderDeleteDialogComponent } from '../../components/work-order-delete-dialog/work-order-delete-dialog.component';
import { ScheduleStore } from '../../services/schedule.store';
import { addDays, addMonths, durationInDays, parseIsoDate, toIsoDate } from '../../utils/date-utils';
import { formatDateRangeShort } from '../../utils/format-date-range';

@Component({
  selector: 'app-schedule-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TimescaleComponent, ScheduleComponent, WorkOrderDrawerComponent, WorkOrderDeleteDialogComponent],
  templateUrl: './schedule-page.component.html',
  styleUrl: './schedule-page.component.scss',
})
export class SchedulePageComponent {
  private readonly scheduleStore = inject(ScheduleStore);

  readonly timescale = signal<Timescale>(Timescale.Day);
  readonly drawerMode = signal<WorkOrderDrawerMode>('create');
  readonly drawerValue = signal<WorkOrderDrawerValue | null>(null);
  readonly drawerOpen = signal(false);
  /** Order awaiting delete confirmation; the dialog is open while non-null. */
  readonly deleteTarget = signal<ScheduleOrder | null>(null);
  readonly focusDate = signal<string | null>(null);
  readonly focusRequestId = signal(0);
  readonly focusedOrderId = signal<string | null>(null);
  readonly addPreviewRange = signal<{ startDate: string; endDate: string } | null>(null);
  readonly addPreviewRangeKey = signal(0);
  readonly timelineLoadingSide = signal<'start' | 'end' | null>(null);
  readonly workCenters = this.scheduleStore.workCenters;
  readonly workOrders = this.scheduleStore.workOrders;
  readonly timelineStartDate = signal(`${new Date().getFullYear() - 2}-01-01`);
  readonly timelineEndDate = signal(`${new Date().getFullYear() + 2}-12-31`);

  setTimescale(v: Timescale): void {
    this.timescale.set(v);
    this.focusDate.set(null);
    this.focusedOrderId.set(null);
  }

  focusCompactOrder(order: ScheduleOrder): void {
    // Zoom to the coarsest scale that still renders this order as a full bar:
    // orders over 3 days fit the Week view; anything shorter needs Day.
    const duration = durationInDays(order.startDate, order.endDate);
    this.timescale.set(duration <= 3 ? Timescale.Day : Timescale.Week);
    this.focusDate.set(order.startDate);
    this.focusedOrderId.set(order.id);
  }

  focusToday(): void {
    this.expandTimelineToInclude(toIsoDate(new Date()));
    this.focusDate.set(toIsoDate(new Date()));
    this.focusedOrderId.set(null);
    this.focusRequestId.update(value => value + 1);
  }

  /**
   * Years appended per edge load. Must comfortably exceed the scroll-trigger
   * threshold at the densest scale (Month: a year is only ~1.4k px), so one
   * extension never lands inside the next trigger zone and loads cannot chain.
   */
  private static readonly TIMELINE_CHUNK_YEARS = 5;

  async extendTimeline(side: 'start' | 'end'): Promise<void> {
    if (this.timelineLoadingSide()) {
      return;
    }

    this.timelineLoadingSide.set(side);

    try {
      const chunk = SchedulePageComponent.TIMELINE_CHUNK_YEARS;
      const edgeYear = side === 'start'
        ? parseIsoDate(this.timelineStartDate()).getFullYear()
        : parseIsoDate(this.timelineEndDate()).getFullYear();
      const years = Array.from({ length: chunk }, (_, index) =>
        side === 'start' ? edgeYear - 1 - index : edgeYear + 1 + index);

      await Promise.all(years.map(year => this.scheduleStore.loadWorkOrdersForYear(year)));

      if (this.timelineLoadingSide() !== side) {
        return;
      }

      this.extendTimelineRange(side);
    } catch (error) {
      // The range stays put on failure; the schedule re-arms its edge request
      // when the loading flag clears, so the user can retry by scrolling.
      console.error('[extendTimeline] failed to load work orders', error);
    } finally {
      if (this.timelineLoadingSide() === side) {
        this.timelineLoadingSide.set(null);
      }
    }
  }

  private extendTimelineRange(side: 'start' | 'end'): void {
    const months = SchedulePageComponent.TIMELINE_CHUNK_YEARS * 12;

    if (side === 'start') {
      this.timelineStartDate.update(value => toIsoDate(addMonths(parseIsoDate(value), -months)));
      return;
    }

    this.timelineEndDate.update(value => toIsoDate(addMonths(parseIsoDate(value), months)));
  }

  setAddPreviewRange(range: { startDate: string; endDate: string } | null): void {
    const current = this.addPreviewRange();
    const nextKey = range ? `${range.startDate}-${range.endDate}` : null;
    const currentKey = current ? `${current.startDate}-${current.endDate}` : null;
    this.addPreviewRange.set(range);
    if (nextKey && nextKey !== currentKey) {
      this.addPreviewRangeKey.update(value => value + 1);
    }
  }

  formatAddPreviewRange(): string {
    const range = this.addPreviewRange();
    return range ? formatDateRangeShort(range.startDate, range.endDate) : '';
  }

  openCreate(request: AddWorkOrderRequest): void {
    const duration = durationInDays(request.startDate, request.endDate);
    const startDate = this.getFirstAvailableStartDate(request.workCenterId, request.startDate, duration);
    const endDate = this.getEndDateForDuration(startDate, duration);

    this.drawerMode.set('create');
    this.drawerValue.set({
      name: '',
      workCenterId: request.workCenterId,
      status: BadgeStatus.Open,
      startDate,
      endDate,
    });
    this.drawerOpen.set(true);
  }

  handleOrderAction(event: { order: ScheduleOrder; action: WorkOrderAction }): void {
    if (event.action === 'delete') {
      this.deleteTarget.set(event.order);
      return;
    }

    this.drawerMode.set('edit');
    this.drawerValue.set({ ...event.order });
    this.drawerOpen.set(true);
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (target) {
      this.scheduleStore.deleteWorkOrder(target.id);
    }
    this.deleteTarget.set(null);
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  saveDrawer(value: WorkOrderDrawerValue): void {
    if (this.drawerMode() === 'edit') {
      if (!value.id) {
        console.error('[saveDrawer] edit mode received value without id — cannot update, aborting to prevent duplicate');
        return;
      }
      const updated = { ...value, id: value.id };
      this.scheduleStore.updateWorkOrder(updated);
      this.focusSavedOrder(updated);
    } else {
      const created = this.scheduleStore.createWorkOrder(value);
      this.focusSavedOrder(created);
    }

    this.closeDrawer();
  }

  private focusSavedOrder(order: ScheduleOrder): void {
    this.expandTimelineToInclude(order.startDate);
    this.expandTimelineToInclude(order.endDate);
    this.focusDate.set(order.startDate);
    this.focusedOrderId.set(order.id);
    this.focusRequestId.update(value => value + 1);
  }

  private expandTimelineToInclude(dateIso: string): void {
    // A malformed date would never satisfy the loop conditions' lexicographic
    // comparisons and could loop forever.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
      return;
    }

    const previousStartYear = parseIsoDate(this.timelineStartDate()).getFullYear();
    const previousEndYear = parseIsoDate(this.timelineEndDate()).getFullYear();

    while (dateIso < this.timelineStartDate()) {
      this.timelineStartDate.update(value => toIsoDate(addMonths(parseIsoDate(value), -12)));
    }

    while (dateIso > this.timelineEndDate()) {
      this.timelineEndDate.update(value => toIsoDate(addMonths(parseIsoDate(value), 12)));
    }

    // Backfill orders for the years this expansion pulled into range —
    // otherwise edge preloads (which start from the new edge) would skip them
    // forever. Fire-and-forget: the store merges idempotently as data lands.
    const startYear = parseIsoDate(this.timelineStartDate()).getFullYear();
    const endYear = parseIsoDate(this.timelineEndDate()).getFullYear();

    for (let year = startYear; year < previousStartYear; year += 1) {
      this.scheduleStore.loadWorkOrdersForYear(year).catch(() => undefined);
    }

    for (let year = previousEndYear + 1; year <= endYear; year += 1) {
      this.scheduleStore.loadWorkOrdersForYear(year).catch(() => undefined);
    }
  }

  private getEndDateForDuration(startDate: string, duration: number): string {
    const start = parseIsoDate(startDate);
    return toIsoDate(addDays(start, Math.max(duration - 1, 0)));
  }

  private getFirstAvailableStartDate(workCenterId: string, startDate: string, duration: number): string {
    let nextStart = startDate;
    let shifted = true;

    while (shifted) {
      shifted = false;
      const nextEnd = this.getEndDateForDuration(nextStart, duration);
      const overlap = this.workOrders()
        .filter(order => order.workCenterId === workCenterId)
        .find(order => nextStart <= order.endDate && nextEnd >= order.startDate);

      if (overlap) {
        nextStart = toIsoDate(addDays(parseIsoDate(overlap.endDate), 1));
        shifted = true;
      }
    }

    return nextStart;
  }

}
