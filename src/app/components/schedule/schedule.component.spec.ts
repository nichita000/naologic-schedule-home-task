import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Timescale } from '../timescale/timescale.component';
import { ScheduleComponent } from './schedule.component';

describe('ScheduleComponent', () => {
  let fixture: ComponentFixture<ScheduleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScheduleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ScheduleComponent);
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
});
