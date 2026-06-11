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
