import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { BadgeStatus } from '../components/badge/badge.component';
import { ScheduleOrder } from '../components/schedule/schedule.component';
import { WORK_ORDERS } from '../data/schedule-seed';
import { ScheduleDataService } from './schedule-data.service';
import { LocalScheduleDataService, REMOTE_LOAD_DELAY_MS } from './local-schedule-data.service';

const STORAGE_KEY = 'naologic.schedule.workOrders.v1';

describe('LocalScheduleDataService', () => {
  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    TestBed.resetTestingModule();
  });

  it('seeds localStorage on first load when empty', () => {
    const service = createService();

    expect(service.workOrders().length).toBe(WORK_ORDERS.length);
    expect(readStoredOrders().length).toBe(WORK_ORDERS.length);
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

    const service = createService();

    expect(service.workOrders()).toEqual([
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
    const service = createService();

    const created = service.createWorkOrder({
      name: 'Night Shift Audit',
      workCenterId: 'wc-4',
      status: BadgeStatus.Blocked,
      startDate: '2026-08-01',
      endDate: '2026-08-02',
    });

    expect(readStoredOrders().some(order => order.id === 'wo-123')).toBeTrue();

    service.updateWorkOrder({
      ...created,
      name: 'Updated Night Shift Audit',
      status: BadgeStatus.Complete,
    });

    expect(readStoredOrders().find(order => order.id === 'wo-123')).toEqual({
      ...created,
      name: 'Updated Night Shift Audit',
      status: BadgeStatus.Complete,
    });

    service.deleteWorkOrder('wo-123');

    expect(readStoredOrders().some(order => order.id === 'wo-123')).toBeFalse();
  });

  it('falls back to seed data when persisted data is invalid', () => {
    localStorage.setItem(STORAGE_KEY, '{nope');

    const service = createService();

    expect(service.workOrders().length).toBe(WORK_ORDERS.length);
  });

  it('loads remote future work orders with a fake delay', fakeAsync(() => {
    const currentYear = new Date().getFullYear();
    const service = createService();
    const initialCount = service.workOrders().length;
    let loaded = false;

    service.loadWorkOrdersForYear(currentYear + 3).then(() => {
      loaded = true;
    });

    tick(REMOTE_LOAD_DELAY_MS - 1);

    expect(loaded).toBeFalse();
    expect(service.workOrders().length).toBe(initialCount);

    tick(1);

    expect(loaded).toBeTrue();
    expect(service.workOrders().some(order => order.id === `remote-${currentYear + 3}-extrusion-run`)).toBeTrue();
    expect(readStoredOrders().some(order => order.id === `remote-${currentYear + 3}-extrusion-run`)).toBeTrue();
  }));

  function createService(): ScheduleDataService {
    TestBed.configureTestingModule({
      providers: [{ provide: ScheduleDataService, useClass: LocalScheduleDataService }],
    });
    return TestBed.inject(ScheduleDataService);
  }

  function readStoredOrders(): ScheduleOrder[] {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  }
});
