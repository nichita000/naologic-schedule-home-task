import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { BadgeStatus } from '../components/badge/badge.component';
import { WORK_ORDERS } from '../data/schedule-seed';
import { REMOTE_LOAD_DELAY_MS, ScheduleStore } from './schedule.store';

const STORAGE_KEY = 'naologic.schedule.workOrders.v1';

describe('ScheduleStore', () => {
  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    TestBed.resetTestingModule();
  });

  it('loads persisted work orders instead of seed data', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      {
        id: 'wo-persisted',
        name: 'Persisted Order',
        workCenterId: 'wc-1',
        status: BadgeStatus.Open,
        startDate: '2026-07-01',
        endDate: '2026-07-03',
      },
    ]));

    const store = createStore();

    expect(store.workOrders()).toEqual([
      {
        id: 'wo-persisted',
        name: 'Persisted Order',
        workCenterId: 'wc-1',
        status: BadgeStatus.Open,
        startDate: '2026-07-01',
        endDate: '2026-07-03',
      },
    ]);
  });

  it('persists created, updated and deleted work orders', () => {
    spyOn(Date, 'now').and.returnValue(123);
    const store = createStore();

    const created = store.createWorkOrder({
      name: 'Night Shift Audit',
      workCenterId: 'wc-4',
      status: BadgeStatus.Blocked,
      startDate: '2026-08-01',
      endDate: '2026-08-02',
    });

    expect(readStoredOrders().some(order => order.id === 'wo-123')).toBeTrue();

    store.updateWorkOrder({
      ...created,
      name: 'Updated Night Shift Audit',
      status: BadgeStatus.Complete,
    });

    expect(readStoredOrders().find(order => order.id === 'wo-123')).toEqual({
      ...created,
      name: 'Updated Night Shift Audit',
      status: BadgeStatus.Complete,
    });

    store.deleteWorkOrder('wo-123');

    expect(readStoredOrders().some(order => order.id === 'wo-123')).toBeFalse();
  });

  it('falls back to seed data when persisted data is invalid', () => {
    localStorage.setItem(STORAGE_KEY, '{nope');

    const store = createStore();

    expect(store.workOrders().length).toBe(WORK_ORDERS.length);
  });

  it('loads remote future work orders with a fake delay', fakeAsync(() => {
    const currentYear = new Date().getFullYear();
    const store = createStore();
    const initialCount = store.workOrders().length;
    let loaded = false;

    store.loadWorkOrdersForYear(currentYear + 3).then(() => {
      loaded = true;
    });

    tick(REMOTE_LOAD_DELAY_MS - 1);

    expect(loaded).toBeFalse();
    expect(store.workOrders().length).toBe(initialCount);

    tick(1);

    expect(loaded).toBeTrue();
    expect(store.workOrders().some(order => order.id === `remote-${currentYear + 3}-extrusion-run`)).toBeTrue();
    expect(readStoredOrders().some(order => order.id === `remote-${currentYear + 3}-extrusion-run`)).toBeTrue();
  }));

  function createStore(): ScheduleStore {
    TestBed.configureTestingModule({});
    return TestBed.inject(ScheduleStore);
  }

  function readStoredOrders(): ReturnType<ScheduleStore['workOrders']> {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  }
});
