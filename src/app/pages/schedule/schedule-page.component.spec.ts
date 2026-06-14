import { NO_ERRORS_SCHEMA } from '@angular/core';
import { signal } from '@angular/core';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { SchedulePageComponent } from './schedule-page.component';
import { ScheduleDataService } from '../../services/schedule-data.service';
import { Timescale } from '../../components/timescale/timescale.component';
import { BadgeStatus } from '../../components/badge/badge.component';
import { WorkOrderDrawerValue } from '../../components/work-order-drawer/work-order-drawer.component';
import { ScheduleOrder, WorkCenter } from '../../components/schedule/schedule.component';
import { NotificationService } from '../../services/notification.service';

function makeStore(orders: ScheduleOrder[] = []) {
  const workOrdersSignal = signal<ScheduleOrder[]>(orders);
  const createWorkOrder = jasmine.createSpy('createWorkOrder').and.callFake((value: Omit<ScheduleOrder, 'id'>) => ({
    ...value,
    id: 'wo-created',
  }));

  return {
    workOrders: workOrdersSignal.asReadonly(),
    workCenters: signal<WorkCenter[]>([{ id: 'wc-1', name: 'Test WC' }]).asReadonly(),
    workOrdersById: signal(new Map()).asReadonly(),
    createWorkOrder,
    updateWorkOrder: jasmine.createSpy('updateWorkOrder'),
    deleteWorkOrder: jasmine.createSpy('deleteWorkOrder'),
    loadWorkOrdersForYear: jasmine.createSpy('loadWorkOrdersForYear').and.returnValue(Promise.resolve()),
    _ordersSignal: workOrdersSignal,
  };
}

describe('SchedulePageComponent', () => {
  function createComponent(orders: ScheduleOrder[] = []) {
    const mockStore = makeStore(orders);
    const mockNotifications = {
      open: jasmine.createSpy('open'),
      dismiss: jasmine.createSpy('dismiss'),
      notifications: signal([]).asReadonly(),
    };
    TestBed.configureTestingModule({
      imports: [SchedulePageComponent],
      providers: [
        { provide: NotificationService, useValue: mockNotifications },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).overrideComponent(SchedulePageComponent, {
      set: { providers: [{ provide: ScheduleDataService, useValue: mockStore }] },
    });
    const fixture = TestBed.createComponent(SchedulePageComponent);
    return { component: fixture.componentInstance, store: mockStore, notifications: mockNotifications };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('dismisses toolbar notifications', () => {
    const { component, notifications } = createComponent();

    component.dismissNotification(12);

    expect(notifications.dismiss).toHaveBeenCalledWith(12);
  });

  describe('status filter', () => {
    const orders: ScheduleOrder[] = [
      { id: 'wo-open', name: 'Open Order', workCenterId: 'wc-1', status: BadgeStatus.Open, startDate: '2026-01-01', endDate: '2026-01-02' },
      { id: 'wo-complete', name: 'Complete Order', workCenterId: 'wc-1', status: BadgeStatus.Complete, startDate: '2026-01-03', endDate: '2026-01-04' },
      { id: 'wo-blocked', name: 'Blocked Order', workCenterId: 'wc-1', status: BadgeStatus.Blocked, startDate: '2026-01-05', endDate: '2026-01-06' },
    ];

    it('shows all work orders by default', () => {
      const { component } = createComponent(orders);

      expect(component.visibleWorkOrders().map(order => order.id)).toEqual(['wo-open', 'wo-complete', 'wo-blocked']);
    });

    it('shows only matching work orders when a status is selected', () => {
      const { component } = createComponent(orders);

      component.setStatusFilter(BadgeStatus.Complete);

      expect(component.visibleWorkOrders().map(order => order.id)).toEqual(['wo-complete']);
    });

    it('keeps all orders available for overlap checks while the visible list is filtered', () => {
      const { component } = createComponent(orders);
      component.setStatusFilter(BadgeStatus.Open);

      component.openCreate({ workCenterId: 'wc-1', startDate: '2026-01-03', endDate: '2026-01-04', left: 0, width: 200 });

      expect(component.visibleWorkOrders().map(order => order.id)).toEqual(['wo-open']);
      expect(component.drawerValue()?.startDate).toBe('2026-01-07');
    });
  });

  describe('focusToday', () => {
    it('focuses the schedule on today and increments the request id for repeated clicks', () => {
      const { component } = createComponent();
      const today = new Date();
      const expectedToday = [
        today.getFullYear(),
        `${today.getMonth() + 1}`.padStart(2, '0'),
        `${today.getDate()}`.padStart(2, '0'),
      ].join('-');

      component.focusedOrderId.set('wo-focused');
      component.focusToday();
      component.focusToday();

      expect(component.focusDate()).toBe(expectedToday);
      expect(component.focusedOrderId()).toBeNull();
      expect(component.focusRequestId()).toBe(2);
    });
  });

  describe('timeline range', () => {
    it('loads a five-year chunk before extending the timeline near either edge', fakeAsync(() => {
      const { component, store } = createComponent();
      component.timelineStartDate.set('2026-01-01');
      component.timelineEndDate.set('2026-12-31');

      component.extendTimeline('start');
      tick();
      component.extendTimeline('end');
      tick();

      expect(component.timelineStartDate()).toBe('2021-01-01');
      expect(component.timelineEndDate()).toBe('2031-12-31');
      // Every year of both chunks is requested, not just the nearest one.
      for (const year of [2021, 2022, 2023, 2024, 2025, 2027, 2028, 2029, 2030, 2031]) {
        expect(store.loadWorkOrdersForYear).toHaveBeenCalledWith(year);
      }
    }));

    it('shows a loading side and ignores duplicate edge requests while loading', fakeAsync(() => {
      const { component, store } = createComponent();
      let resolveLoad!: () => void;
      store.loadWorkOrdersForYear.and.returnValue(new Promise<void>(resolve => {
        resolveLoad = resolve;
      }));

      component.extendTimeline('end');
      component.extendTimeline('start');

      expect(component.timelineLoadingSide()).toBe('end');
      const endYear = new Date().getFullYear() + 2;
      expect(store.loadWorkOrdersForYear).toHaveBeenCalledTimes(5);
      expect(store.loadWorkOrdersForYear).toHaveBeenCalledWith(endYear + 1);
      expect(store.loadWorkOrdersForYear).toHaveBeenCalledWith(endYear + 5);

      resolveLoad();
      tick();

      expect(component.timelineLoadingSide()).toBeNull();
    }));

    it('expands the timeline before focusing a saved future order', () => {
      const { component } = createComponent();
      component.timelineEndDate.set('2028-12-31');
      component.drawerMode.set('create');

      component.saveDrawer({
        name: 'Future Run',
        workCenterId: 'wc-1',
        status: BadgeStatus.Open,
        startDate: '2031-05-10',
        endDate: '2031-05-12',
      });

      expect(component.timelineEndDate()).toBe('2031-12-31');
      expect(component.focusDate()).toBe('2031-05-10');
      expect(component.focusedOrderId()).toBe('wo-created');
    });
  });

  describe('add preview range', () => {
    it('stores and formats the highlighted add-date range', () => {
      const { component } = createComponent();

      component.setAddPreviewRange({ startDate: '2026-06-19', endDate: '2026-06-19' });

      expect(component.addPreviewRange()).toEqual({ startDate: '2026-06-19', endDate: '2026-06-19' });
      expect(component.formatAddPreviewRange()).toBe('Jun 19, 2026');
      expect(component.addPreviewRangeKey()).toBe(1);

      component.setAddPreviewRange({ startDate: '2026-06-19', endDate: '2026-06-19' });

      expect(component.addPreviewRangeKey()).toBe(1);

      component.setAddPreviewRange({ startDate: '2026-06-20', endDate: '2026-06-20' });

      expect(component.addPreviewRangeKey()).toBe(2);

      component.setAddPreviewRange(null);

      expect(component.formatAddPreviewRange()).toBe('');
    });
  });

  describe('delete confirmation', () => {
    it('deletes the selected work order and notifies the user', () => {
      const { component, store, notifications } = createComponent();
      component.deleteTarget.set({
        id: 'wo-delete',
        name: 'Trim Batch',
        workCenterId: 'wc-1',
        status: BadgeStatus.Blocked,
        startDate: '2026-06-01',
        endDate: '2026-06-07',
      });

      component.confirmDelete();

      expect(store.deleteWorkOrder).toHaveBeenCalledWith('wo-delete');
      expect(component.deleteTarget()).toBeNull();
      expect(notifications.open).toHaveBeenCalledWith('Deleted "Trim Batch"', 'success');
    });
  });

  // ── Bug 1: saveDrawer silent duplicate ─────────────────────────────────

  describe('saveDrawer — edit mode with missing id', () => {
    it('should not call createWorkOrder and should not close the drawer', () => {
      const { component, store, notifications } = createComponent();

      component.drawerMode.set('edit');
      component.drawerOpen.set(true);

      const valueWithoutId: WorkOrderDrawerValue = {
        name: 'Orphan Order',
        workCenterId: 'wc-1',
        status: BadgeStatus.Open,
        startDate: '2026-01-01',
        endDate: '2026-01-07',
      };

      component.saveDrawer(valueWithoutId);

      expect(store.createWorkOrder).not.toHaveBeenCalled();
      expect(store.updateWorkOrder).not.toHaveBeenCalled();
      expect(component.drawerOpen()).toBeTrue();
      expect(notifications.open).toHaveBeenCalledWith(
        'Unable to update this work order. Please reopen it and try again.',
        'error',
      );
    });

    it('edit mode with a valid id should update, not create', () => {
      const { component, store, notifications } = createComponent();
      component.drawerMode.set('edit');

      component.saveDrawer({
        id: 'wo-test-123',
        name: 'Valid Edit',
        workCenterId: 'wc-1',
        status: BadgeStatus.Open,
        startDate: '2026-01-01',
        endDate: '2026-01-07',
      });

      expect(store.updateWorkOrder).toHaveBeenCalledWith(jasmine.objectContaining({ id: 'wo-test-123' }));
      expect(store.createWorkOrder).not.toHaveBeenCalled();
      expect(notifications.open).toHaveBeenCalledWith('Updated "Valid Edit"', 'success');
    });

    it('focuses the updated work order after saving an edit', () => {
      const { component } = createComponent();
      component.drawerMode.set('edit');

      component.saveDrawer({
        id: 'wo-test-123',
        name: 'Valid Edit',
        workCenterId: 'wc-1',
        status: BadgeStatus.Open,
        startDate: '2027-03-10',
        endDate: '2027-03-17',
      });

      expect(component.focusDate()).toBe('2027-03-10');
      expect(component.focusedOrderId()).toBe('wo-test-123');
      expect(component.focusRequestId()).toBe(1);
    });

    it('create mode should call createWorkOrder regardless of id', () => {
      const { component, store, notifications } = createComponent();
      component.drawerMode.set('create');

      component.saveDrawer({
        name: 'New Order',
        workCenterId: 'wc-1',
        status: BadgeStatus.Open,
        startDate: '2026-01-01',
        endDate: '2026-01-07',
      });

      expect(store.createWorkOrder).toHaveBeenCalled();
      expect(store.updateWorkOrder).not.toHaveBeenCalled();
      expect(notifications.open).toHaveBeenCalledWith('Created "New Order"', 'success');
    });

    it('focuses the created work order returned by the store', () => {
      const { component } = createComponent();
      component.drawerMode.set('create');

      component.saveDrawer({
        name: 'New Future Order',
        workCenterId: 'wc-1',
        status: BadgeStatus.Open,
        startDate: '2027-08-01',
        endDate: '2027-08-07',
      });

      expect(component.focusDate()).toBe('2027-08-01');
      expect(component.focusedOrderId()).toBe('wo-created');
      expect(component.focusRequestId()).toBe(1);
    });
  });

  // ── Bug 3: getFirstAvailableStartDate checks range, not just a point ───

  describe('openCreate — getFirstAvailableStartDate range check', () => {
    it('keeps a one-day day-scale request as a single-day work order', () => {
      const { component } = createComponent();
      component.timescale.set(Timescale.Day);

      component.openCreate({ workCenterId: 'wc-1', startDate: '2026-01-07', endDate: '2026-01-07', left: 0, width: 200 });

      expect(component.drawerValue()?.startDate).toBe('2026-01-07');
      expect(component.drawerValue()?.endDate).toBe('2026-01-07');
    });

    it('shifts start past an existing order when proposed start lands inside it', () => {
      const { component } = createComponent([
        { id: 'wo-1', name: 'Existing', workCenterId: 'wc-1', status: BadgeStatus.Open, startDate: '2026-01-01', endDate: '2026-01-07' },
      ]);

      // Day timescale (default), proposed start Jan 3 is inside Jan 1–7.
      component.openCreate({ workCenterId: 'wc-1', startDate: '2026-01-03', endDate: '2026-01-04', left: 0, width: 64 });

      expect(component.drawerValue()?.startDate).toBe('2026-01-08');
    });

    it('shifts start when the full new range (not just start point) overlaps a later order', () => {
      // Without the fix: only checks if startDate is inside an order.
      // Proposed start Jan 4 is NOT inside any order, so the old code returns Jan 4.
      // But with Week timescale, the new order would span Jan 4–10, overlapping B (Jan 6–10).
      // Fixed code: checks [Jan 4, Jan 10] → overlaps B → shifts to Jan 11.
      const { component } = createComponent([
        { id: 'wo-a', name: 'A', workCenterId: 'wc-1', status: BadgeStatus.Open, startDate: '2026-01-01', endDate: '2026-01-03' },
        { id: 'wo-b', name: 'B', workCenterId: 'wc-1', status: BadgeStatus.Open, startDate: '2026-01-06', endDate: '2026-01-10' },
      ]);
      component.timescale.set(Timescale.Week);

      component.openCreate({ workCenterId: 'wc-1', startDate: '2026-01-04', endDate: '2026-01-10', left: 0, width: 150 });

      expect(component.drawerValue()?.startDate).toBe('2026-01-11');
      expect(component.drawerValue()?.endDate).toBe('2026-01-17');
    });

    it('returns original start when no existing orders overlap the full new range', () => {
      const { component } = createComponent([
        { id: 'wo-a', name: 'A', workCenterId: 'wc-1', status: BadgeStatus.Open, startDate: '2026-01-01', endDate: '2026-01-05' },
      ]);

      // Day timescale: [Jan 7, Jan 8] does not overlap [Jan 1, Jan 5].
      component.openCreate({ workCenterId: 'wc-1', startDate: '2026-01-07', endDate: '2026-01-08', left: 0, width: 64 });

      expect(component.drawerValue()?.startDate).toBe('2026-01-07');
    });
  });

  // ── focusCompactOrder: zoom to the coarsest scale that shows a full bar ─

  describe('focusCompactOrder', () => {
    const order = (startDate: string, endDate: string): ScheduleOrder => ({
      id: 'wo-x',
      name: 'X',
      workCenterId: 'wc-1',
      status: BadgeStatus.Open,
      startDate,
      endDate,
    });

    it('zooms a 6-day order to Day scale (still compact at Week)', () => {
      const { component } = createComponent();
      component.timescale.set(Timescale.Month);

      component.focusCompactOrder(order('2026-09-22', '2026-09-27'));

      expect(component.timescale()).toBe(Timescale.Day);
      expect(component.focusDate()).toBe('2026-09-22');
      expect(component.focusedOrderId()).toBe('wo-x');
    });

    it('zooms a 2-day order to Day scale (still compact at Week)', () => {
      const { component } = createComponent();
      component.timescale.set(Timescale.Week);

      component.focusCompactOrder(order('2026-10-08', '2026-10-09'));

      expect(component.timescale()).toBe(Timescale.Day);
      expect(component.focusDate()).toBe('2026-10-08');
    });

    it('zooms a 14-day order (Month threshold edge) to Week scale', () => {
      const { component } = createComponent();
      component.timescale.set(Timescale.Month);

      component.focusCompactOrder(order('2026-11-02', '2026-11-15'));

      expect(component.timescale()).toBe(Timescale.Week);
      expect(component.focusDate()).toBe('2026-11-02');
    });

    it('zooms a 4-day month-boundary order to Day scale', () => {
      const { component } = createComponent();
      component.timescale.set(Timescale.Month);

      component.focusCompactOrder(order('2026-09-29', '2026-10-02'));

      expect(component.timescale()).toBe(Timescale.Day);
      expect(component.focusDate()).toBe('2026-09-29');
    });

    it('setTimescale clears the focus state', () => {
      const { component } = createComponent();
      component.focusCompactOrder(order('2026-09-22', '2026-09-27'));

      component.setTimescale(Timescale.Month);

      expect(component.focusDate()).toBeNull();
      expect(component.focusedOrderId()).toBeNull();
    });
  });
});
