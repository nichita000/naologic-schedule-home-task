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
import { addDays, durationInDays, parseIsoDate, toIsoDate } from '../../utils/date-utils';
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
  readonly workCenters = this.scheduleStore.workCenters;
  readonly workOrders = this.scheduleStore.workOrders;
  readonly timelineStartDate = `${new Date().getFullYear() - 2}-01-01`;
  readonly timelineEndDate = `${new Date().getFullYear() + 2}-12-31`;

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
    this.focusDate.set(toIsoDate(new Date()));
    this.focusedOrderId.set(null);
    this.focusRequestId.update(value => value + 1);
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
    this.focusDate.set(order.startDate);
    this.focusedOrderId.set(order.id);
    this.focusRequestId.update(value => value + 1);
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
