import { Injectable } from '@angular/core';
import { BadgeStatus } from '../components/badge/badge.component';
import { ScheduleOrder } from '../components/schedule/schedule.component';

const WORK_ORDERS_STORAGE_KEY = 'naologic.schedule.workOrders.v1';

@Injectable({ providedIn: 'root' })
export class LocalScheduleStorageService {
  loadWorkOrders(): ScheduleOrder[] | null {
    const storage = this.storage();

    if (!storage) {
      return null;
    }

    try {
      const raw = storage.getItem(WORK_ORDERS_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.every(order => this.isScheduleOrder(order))) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  saveWorkOrders(workOrders: ScheduleOrder[]): void {
    const storage = this.storage();

    if (!storage) {
      return;
    }

    try {
      storage.setItem(WORK_ORDERS_STORAGE_KEY, JSON.stringify(workOrders));
    } catch {
      // Storage can be unavailable in private mode or full-quota scenarios.
      // The in-memory store still works; we just skip persistence for this write.
    }
  }

  private storage(): Storage | null {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  }

  private isScheduleOrder(value: unknown): value is ScheduleOrder {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const order = value as Partial<ScheduleOrder>;
    const statuses = Object.values(BadgeStatus);

    return (
      typeof order.id === 'string' &&
      typeof order.name === 'string' &&
      typeof order.workCenterId === 'string' &&
      typeof order.startDate === 'string' &&
      typeof order.endDate === 'string' &&
      statuses.includes(order.status as BadgeStatus)
    );
  }
}
