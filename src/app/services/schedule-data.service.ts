import { Signal } from '@angular/core';
import { ScheduleOrder, WorkCenter } from '../components/schedule/schedule.component';

export abstract class ScheduleDataService {
  abstract readonly workCenters: Signal<WorkCenter[]>;
  abstract readonly workOrders: Signal<ScheduleOrder[]>;
  abstract readonly workOrdersById: Signal<Map<string, ScheduleOrder>>;

  abstract createWorkOrder(order: Omit<ScheduleOrder, 'id'>): ScheduleOrder;
  abstract updateWorkOrder(order: ScheduleOrder): void;
  abstract deleteWorkOrder(id: string): void;
  abstract loadWorkOrdersForYear(year: number): Promise<void>;
}
