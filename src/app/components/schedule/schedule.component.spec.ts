import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BadgeStatus } from '../badge/badge.component';
import { Timescale } from '../timescale/timescale.component';
import { ScheduleComponent } from './schedule.component';

describe('ScheduleComponent', () => {
  let fixture: ComponentFixture<ScheduleComponent>;
  let component: ScheduleComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScheduleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ScheduleComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('workCenters', [
      { id: 'wc-1', name: 'Extrusion Line A' },
      { id: 'wc-2', name: 'CNC Machine 1' },
    ]);
    fixture.componentRef.setInput('scale', Timescale.Month);
    fixture.componentRef.setInput('timelineStartDate', '2026-05-01');
    fixture.componentRef.setInput('timelineEndDate', '2026-12-31');
    fixture.componentRef.setInput('currentDate', '2026-06-09');
    fixture.detectChanges();
  });

  it('renders the frozen work-center column and timeline rows', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.schedule__head')?.textContent).toContain('Work Center');
    expect(host.querySelectorAll('.schedule__wc').length).toBe(2);
    expect(host.querySelectorAll('.schedule__gantt-row').length).toBe(2);
  });

  it('marks the current timeline period', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.schedule__current-pill')?.textContent).toContain('Current month');
    expect(host.querySelector('.schedule__current-line')).not.toBeNull();
  });

  it('renders work order bars on the matching work-center row', () => {
    fixture.componentRef.setInput('workOrders', [
      {
        id: 'wo-1',
        name: 'Casing Extrusion',
        workCenterId: 'wc-1',
        status: BadgeStatus.Complete,
        startDate: '2026-05-01',
        endDate: '2026-06-18',
      },
    ]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const bar = host.querySelector<HTMLElement>('.schedule__bar');

    expect(bar).not.toBeNull();
    expect(bar?.textContent).toContain('Casing Extrusion');
    expect(bar?.textContent).toContain('Complete');
  });

  it('renders short month orders as compact markers', () => {
    fixture.componentRef.setInput('workOrders', [
      {
        id: 'wo-1',
        name: 'Laser Alignment',
        workCenterId: 'wc-1',
        status: BadgeStatus.Blocked,
        startDate: '2026-10-06',
        endDate: '2026-10-06',
      },
    ]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.schedule__compact')).not.toBeNull();
    expect(host.querySelector('.schedule__compact-dot--blocked')).not.toBeNull();
    expect(host.querySelector('.schedule__bar')).toBeNull();
  });

  it('opens a compact order popover from the marker', () => {
    fixture.componentRef.setInput('workOrders', [
      {
        id: 'wo-1',
        name: 'Laser Alignment',
        workCenterId: 'wc-1',
        status: BadgeStatus.Blocked,
        startDate: '2026-10-06',
        endDate: '2026-10-06',
      },
    ]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.schedule__compact')?.click();
    fixture.detectChanges();

    expect(host.querySelector('.schedule__compact-popover')?.textContent).toContain('Laser Alignment');
    expect(host.querySelector('.schedule__compact-popover')?.textContent).not.toContain('Work orders');
    expect(component.hoverPlacement()).toBeNull();
  });

  it('summarizes compact groups with overflow counts and a grouped popover header', () => {
    fixture.componentRef.setInput('workOrders', [
      {
        id: 'wo-1',
        name: 'Spot Check #1',
        workCenterId: 'wc-1',
        status: BadgeStatus.Complete,
        startDate: '2026-10-08',
        endDate: '2026-10-08',
      },
      {
        id: 'wo-2',
        name: 'Spot Check #2',
        workCenterId: 'wc-1',
        status: BadgeStatus.Open,
        startDate: '2026-10-09',
        endDate: '2026-10-09',
      },
      {
        id: 'wo-3',
        name: 'Spot Check #3',
        workCenterId: 'wc-1',
        status: BadgeStatus.Blocked,
        startDate: '2026-10-10',
        endDate: '2026-10-10',
      },
    ]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const marker = host.querySelector<HTMLButtonElement>('.schedule__compact');

    expect(marker?.textContent).toContain('+1');

    marker?.click();
    fixture.detectChanges();

    expect(host.querySelector('.schedule__compact-popover')?.textContent).toContain('Work orders');
    expect(host.querySelector('.schedule__compact-popover')?.textContent).toContain('3 total');
  });

  it('emits a focus request from compact popover actions', () => {
    fixture.componentRef.setInput('workOrders', [
      {
        id: 'wo-1',
        name: 'Laser Alignment',
        workCenterId: 'wc-1',
        status: BadgeStatus.Blocked,
        startDate: '2026-10-06',
        endDate: '2026-10-06',
      },
    ]);
    const focused: string[] = [];
    component.compactOrderFocus.subscribe(order => focused.push(order.id));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.schedule__compact')?.click();
    fixture.detectChanges();
    host.querySelector<HTMLButtonElement>('.schedule__compact-popover-action')?.click();

    expect(focused).toEqual(['wo-1']);
  });

  it('previews an add pill on an empty timeline slot', () => {
    component.onRowMove(mockRowMove(114 * 4 + 70), 'wc-1');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(component.hoverPlacement()).toEqual({
      left: 456,
      width: 114,
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });
    expect(host.querySelector('.schedule__add')).not.toBeNull();
  });

  it('emits add requests from the preview pill', () => {
    const emitted: string[] = [];
    fixture.componentInstance.addWorkOrder.subscribe(request => {
      emitted.push(`${request.workCenterId}:${request.startDate}:${request.endDate}`);
    });

    component.onRowMove(mockRowMove(114 * 4 + 70), 'wc-1');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.schedule__add')?.click();

    expect(emitted).toEqual(['wc-1:2026-09-01:2026-09-30']);
  });

  function mockRowMove(x: number): MouseEvent {
    return {
      clientX: x,
      currentTarget: {
        getBoundingClientRect: () => ({ left: 0 }),
      },
    } as unknown as MouseEvent;
  }
});
