import { Injectable, computed, signal } from '@angular/core';
import { BadgeStatus } from '../components/badge/badge.component';
import { ScheduleOrder, WorkCenter } from '../components/schedule/schedule.component';
import { WORK_CENTERS, WORK_ORDERS } from '../data/schedule-seed';

@Injectable({ providedIn: 'root' })
export class ScheduleStore {
  private readonly workCentersState = signal<WorkCenter[]>(
    WORK_CENTERS.map(doc => ({
      id: doc.docId,
      name: doc.data.name,
    }))
  );

  private readonly workOrdersState = signal<ScheduleOrder[]>(
    WORK_ORDERS.map(doc => ({
      id: doc.docId,
      name: doc.data.name,
      workCenterId: doc.data.workCenterId,
      status: doc.data.status as BadgeStatus,
      startDate: doc.data.startDate,
      endDate: doc.data.endDate,
    }))
  );

  readonly workCenters = this.workCentersState.asReadonly();
  readonly workOrders = this.workOrdersState.asReadonly();

  readonly workOrdersById = computed(() => {
    const map = new Map<string, ScheduleOrder>();
    for (const order of this.workOrdersState()) {
      map.set(order.id, order);
    }
    return map;
  });

  createWorkOrder(order: Omit<ScheduleOrder, 'id'>): ScheduleOrder {
    const created: ScheduleOrder = {
      ...order,
      id: `wo-${Date.now()}`,
    };
    this.workOrdersState.update(orders => [...orders, created]);
    return created;
  }

  updateWorkOrder(order: ScheduleOrder): void {
    this.workOrdersState.update(orders => orders.map(item => item.id === order.id ? order : item));
  }

  deleteWorkOrder(id: string): void {
    this.workOrdersState.update(orders => orders.filter(order => order.id !== id));
  }
}
