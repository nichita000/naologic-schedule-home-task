import { computed, signal } from '@angular/core';
import { BadgeStatus } from '../components/badge/badge.component';
import { ScheduleOrder, WorkCenter } from '../components/schedule/schedule.component';
import { WORK_CENTERS, WORK_ORDERS } from '../data/schedule-seed';
import { parseIsoDate } from '../utils/date-utils';
import { ScheduleDataService } from './schedule-data.service';

export const REMOTE_LOAD_DELAY_MS = 650;

const STORAGE_KEY = 'naologic.schedule.workOrders.v1';

export class LocalScheduleDataService extends ScheduleDataService {
  private readonly loadedYears = new Set<number>();
  private readonly pendingYearLoads = new Map<number, Promise<void>>();

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

  loadWorkOrdersForYear(year: number): Promise<void> {
    if (this.loadedYears.has(year)) {
      return Promise.resolve();
    }

    const pending = this.pendingYearLoads.get(year);
    if (pending) {
      return pending;
    }

    const request = new Promise<void>(resolve => {
      setTimeout(() => {
        this.mergeLoadedWorkOrders(this.buildRemoteYearOrders(year));
        this.loadedYears.add(year);
        this.pendingYearLoads.delete(year);
        resolve();
      }, REMOTE_LOAD_DELAY_MS);
    });

    this.pendingYearLoads.set(year, request);
    return request;
  }

  // ── localStorage helpers ──────────────────────────────────────

  private setWorkOrders(workOrders: ScheduleOrder[]): void {
    this.workOrdersState.set(workOrders);
    this.saveToStorage(workOrders);
  }

  private loadInitialWorkOrders(): ScheduleOrder[] {
    const persisted = this.loadFromStorage();
    if (persisted) {
      for (const order of persisted) {
        this.loadedYears.add(parseIsoDate(order.startDate).getFullYear());
      }
      return persisted;
    }

    const seeded = WORK_ORDERS.map(doc => ({
      id: doc.docId,
      name: doc.data.name,
      workCenterId: doc.data.workCenterId,
      status: doc.data.status as BadgeStatus,
      startDate: doc.data.startDate,
      endDate: doc.data.endDate,
    }));

    for (const order of seeded) {
      this.loadedYears.add(parseIsoDate(order.startDate).getFullYear());
    }

    this.saveToStorage(seeded);
    return seeded;
  }

  private loadFromStorage(): ScheduleOrder[] | null {
    const storage = this.storage();
    if (!storage) {
      return null;
    }

    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.every(item => isScheduleOrder(item))) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  private saveToStorage(workOrders: ScheduleOrder[]): void {
    const storage = this.storage();
    if (!storage) {
      return;
    }

    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(workOrders));
    } catch {
      // Storage can be unavailable in private mode or full-quota scenarios.
    }
  }

  private storage(): Storage | null {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  }

  // ── Remote simulation ─────────────────────────────────────────

  private mergeLoadedWorkOrders(orders: ScheduleOrder[]): void {
    if (!orders.length) {
      return;
    }

    const existing = new Set(this.workOrdersState().map(order => order.id));
    const next = [
      ...this.workOrdersState(),
      ...orders.filter(order => !existing.has(order.id)),
    ].sort((a, b) => a.startDate.localeCompare(b.startDate));

    this.setWorkOrders(next);
  }

  private buildRemoteYearOrders(year: number): ScheduleOrder[] {
    const currentYear = new Date().getFullYear();
    const offset = year - currentYear;

    if (![3, 5, 7].includes(offset)) {
      return [];
    }

    const catalog: Record<number, ScheduleOrder[]> = {
      3: [
        { id: `remote-${year}-extrusion-run`, name: 'Future Extrusion Run', workCenterId: 'wc-1', status: BadgeStatus.InProgress, startDate: `${year}-03-04`, endDate: `${year}-04-18` },
        { id: `remote-${year}-spindle-tune`, name: 'Spindle Tune-Up', workCenterId: 'wc-2', status: BadgeStatus.Open, startDate: `${year}-06-09`, endDate: `${year}-06-14` },
        { id: `remote-${year}-audit-window`, name: 'Remote Audit Window', workCenterId: 'wc-4', status: BadgeStatus.Complete, startDate: `${year}-10-01`, endDate: `${year}-11-05` },
      ],
      5: [
        { id: `remote-${year}-assembly-wave`, name: 'Assembly Expansion Wave', workCenterId: 'wc-3', status: BadgeStatus.Open, startDate: `${year}-02-12`, endDate: `${year}-03-28` },
        { id: `remote-${year}-qa-sprint`, name: 'QA Sprint', workCenterId: 'wc-4', status: BadgeStatus.Blocked, startDate: `${year}-07-18`, endDate: `${year}-07-24` },
        { id: `remote-${year}-packaging-cycle`, name: 'Packaging Future Cycle', workCenterId: 'wc-5', status: BadgeStatus.InProgress, startDate: `${year}-11-03`, endDate: `${year}-12-12` },
      ],
      7: [
        { id: `remote-${year}-line-upgrade`, name: 'Line Upgrade Phase', workCenterId: 'wc-1', status: BadgeStatus.Blocked, startDate: `${year}-01-20`, endDate: `${year}-03-02` },
        { id: `remote-${year}-cnc-refresh`, name: 'CNC Refresh', workCenterId: 'wc-2', status: BadgeStatus.Complete, startDate: `${year}-05-04`, endDate: `${year}-06-01` },
        { id: `remote-${year}-final-packout`, name: 'Final Packout Trial', workCenterId: 'wc-5', status: BadgeStatus.Open, startDate: `${year}-09-15`, endDate: `${year}-10-20` },
      ],
    };

    return catalog[offset] ?? [];
  }
}

function isScheduleOrder(value: unknown): value is ScheduleOrder {
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
