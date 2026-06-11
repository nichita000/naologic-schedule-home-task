import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AddWorkOrderRequest,
  ScheduleComponent,
  ScheduleOrder,
  WorkOrderAction,
} from '../../components/schedule/schedule.component';
import { BadgeStatus } from '../../components/badge/badge.component';
import { TimescaleComponent, Timescale } from '../../components/timescale/timescale.component';
import {
  WorkOrderDrawerComponent,
  WorkOrderDrawerMode,
  WorkOrderDrawerValue,
} from '../../components/work-order-drawer/work-order-drawer.component';
import { WorkOrderDeleteDialogComponent } from '../../components/work-order-delete-dialog/work-order-delete-dialog.component';
import { ScheduleStore } from '../../services/schedule.store';
import { formatDateRange } from '../../utils/format-date-range';

@Component({
  selector: 'app-schedule-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScheduleComponent, TimescaleComponent, WorkOrderDrawerComponent, WorkOrderDeleteDialogComponent],
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

  setTimescale(value: Timescale): void {
    this.timescale.set(value);
    this.focusDate.set(null);
    this.focusedOrderId.set(null);
  }

  focusCompactOrder(order: ScheduleOrder): void {
    const duration = this.durationInDays(order.startDate, order.endDate);

    this.timescale.set(duration <= 3 ? Timescale.Day : Timescale.Week);
    this.focusDate.set(order.startDate);
    this.focusedOrderId.set(order.id);
    this.focusRequestId.update(value => value + 1);
  }

  focusToday(): void {
    this.focusDate.set(this.toIsoDate(new Date()));
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
    return range ? formatDateRange(range.startDate, range.endDate) : '';
  }

  openCreate(request: AddWorkOrderRequest): void {
    const startDate = this.getFirstAvailableStartDate(request.workCenterId, request.startDate);
    const endDate = this.getDefaultEndDate(startDate);

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
    if (this.drawerMode() === 'edit' && value.id) {
      this.scheduleStore.updateWorkOrder({ ...value, id: value.id });
    } else {
      this.scheduleStore.createWorkOrder(value);
    }

    this.closeDrawer();
  }

  private getDefaultEndDate(startDate: string): string {
    const start = this.parseIsoDate(startDate);

    switch (this.timescale()) {
      case Timescale.Week:
        return this.toIsoDate(this.addDays(start, 7));
      case Timescale.Month:
        return this.toIsoDate(this.addMonths(start, 1));
      case Timescale.Day:
      default:
        return this.toIsoDate(this.addDays(start, 1));
    }
  }

  private getFirstAvailableStartDate(workCenterId: string, startDate: string): string {
    let nextStart = startDate;
    let shifted = true;

    while (shifted) {
      shifted = false;
      const overlap = this.workOrders()
        .filter(order => order.workCenterId === workCenterId)
        .find(order => nextStart >= order.startDate && nextStart <= order.endDate);

      if (overlap) {
        nextStart = this.toIsoDate(this.addDays(this.parseIsoDate(overlap.endDate), 1));
        shifted = true;
      }
    }

    return nextStart;
  }

  private parseIsoDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    const targetMonth = result.getMonth() + months;
    const originalDay = result.getDate();
    result.setDate(1);
    result.setMonth(targetMonth);
    const lastDayOfTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(originalDay, lastDayOfTargetMonth));
    return result;
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private durationInDays(startDate: string, endDate: string): number {
    const DAY_MS = 86_400_000;
    const start = this.parseIsoDate(startDate);
    const end = this.parseIsoDate(endDate);
    const utcStart = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const utcEnd = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.round((utcEnd - utcStart) / DAY_MS) + 1;
  }
}
