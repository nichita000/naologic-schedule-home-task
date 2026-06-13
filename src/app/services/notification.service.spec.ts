import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    service.clear();
    TestBed.resetTestingModule();
  });

  it('opens notifications with a message and type', () => {
    const id = service.open(' Work order created ', 'success', { durationMs: 0 });

    expect(id).toBeGreaterThan(0);
    expect(service.notifications()).toEqual([
      jasmine.objectContaining({ id, message: 'Work order created', type: 'success' }),
    ]);
    expect(service.hasNotifications()).toBeTrue();
  });

  it('ignores empty messages', () => {
    const id = service.open('   ', 'error');

    expect(id).toBe(-1);
    expect(service.notifications()).toEqual([]);
  });

  it('dismisses notifications manually', () => {
    const id = service.open('Saved', 'success', { durationMs: 0 });

    service.dismiss(id);

    expect(service.notifications()).toEqual([]);
    expect(service.hasNotifications()).toBeFalse();
  });

  it('auto-dismisses notifications after the configured duration', fakeAsync(() => {
    service.open('Saved', 'success', { durationMs: 500 });

    tick(499);
    expect(service.notifications().length).toBe(1);

    tick(1);
    expect(service.notifications()).toEqual([]);
  }));
});
