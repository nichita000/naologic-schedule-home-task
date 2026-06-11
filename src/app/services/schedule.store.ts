import { Injectable, computed, inject, signal } from '@angular/core';
import { BadgeStatus } from '../components/badge/badge.component';
import { ScheduleOrder, WorkCenter } from '../components/schedule/schedule.component';
import { WORK_CENTERS, WORK_ORDERS } from '../data/schedule-seed';
import { LocalScheduleStorageService } from './local-schedule-storage.service';

@Injectable({ providedIn: 'root' })
export class ScheduleStore {
  private readonly storage = inject(LocalScheduleStorageService);

  private readonly workCentersState = signal<WorkCenter[]>(
    WORK_CENTERS.map(doc => ({
      id: doc.docId,
      name: doc.data.name,
    }))
  );

  private readonly workOrdersState = signal<ScheduleOrder[]>(this.loadInitialWorkOrders());

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
    this.setWorkOrders([...this.workOrdersState(), created]);
    return created;
  }

  updateWorkOrder(order: ScheduleOrder): void {
    this.setWorkOrders(this.workOrdersState().map(item => item.id === order.id ? order : item));
  }

  deleteWorkOrder(id: string): void {
    this.setWorkOrders(this.workOrdersState().filter(order => order.id !== id));
  }

  private setWorkOrders(workOrders: ScheduleOrder[]): void {
    this.workOrdersState.set(workOrders);
    this.storage.saveWorkOrders(workOrders);
  }

  private loadInitialWorkOrders(): ScheduleOrder[] {
    return this.storage.loadWorkOrders() ?? WORK_ORDERS.map(doc => ({
      id: doc.docId,
      name: doc.data.name,
      workCenterId: doc.data.workCenterId,
      status: doc.data.status as BadgeStatus,
      startDate: doc.data.startDate,
      endDate: doc.data.endDate,
    }));
  }
}
