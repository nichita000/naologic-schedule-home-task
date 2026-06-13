import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Timescale } from '../timescale/timescale.component';
import {
  buildRulerCells,
  offsetRangeToDateRange,
  placeBar,
  slotToDateRange,
  ScheduleRulerComponent,
} from './schedule-ruler.component';

describe('ScheduleRulerComponent', () => {
  let fixture: ComponentFixture<ScheduleRulerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScheduleRulerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ScheduleRulerComponent);
  });

  it('renders month cells by default', () => {
    fixture.componentRef.setInput('startDate', '2024-01-01');
    fixture.componentRef.setInput('endDate', '2024-03-31');
    fixture.detectChanges();

    const cells = fixture.debugElement.queryAll(By.css('.nao-schedule-ruler__cell'));

    expect(cells).toHaveSize(3);
  });

  it('builds day cells without using the hour scale', () => {
    const cells = buildRulerCells(Timescale.Day, '2024-01-01', '2024-01-03');

    expect(cells.map(cell => cell.label)).toEqual(['Jan 1', 'Jan 2', 'Jan 3']);
  });

  it('assigns absolute positions for horizontal virtualization', () => {
    const cells = buildRulerCells(Timescale.Month, '2024-08-01', '2024-10-31');

    expect(cells.map(cell => cell.left)).toEqual([0, 114, 228]);
  });

  it('uses the host render window when the parent owns horizontal scroll', () => {
    fixture.componentRef.setInput('scrollable', false);
    fixture.componentRef.setInput('scale', Timescale.Day);
    fixture.componentRef.setInput('startDate', '2026-01-01');
    fixture.componentRef.setInput('endDate', '2026-01-10');
    fixture.componentRef.setInput('renderWindow', { start: 400, end: 800 });
    fixture.detectChanges();

    const cells = fixture.debugElement.queryAll(By.css('.nao-schedule-ruler__cell'));

    expect(cells.map(cell => cell.nativeElement.textContent.trim())).toEqual([
      'Jan 2',
      'Jan 3',
      'Jan 4',
      'Jan 5',
    ]);
  });

  it('renders week labels as date ranges with a year', () => {
    // Cells are anchored to startDate itself (not startOfWeek(startDate)),
    // so weeks run from whatever day startDate falls on.
    const cells = buildRulerCells(Timescale.Week, '2024-08-01', '2024-08-14');

    expect(cells.map(cell => cell.label)).toEqual([
      '1-7 Aug 2024',
      '8-14 Aug 2024',
    ]);
  });

  it('converts partial month spans into matching date ranges', () => {
    const range = offsetRangeToDateRange(Timescale.Month, '2026-06-01', 57, 57);

    expect(range).toEqual({ startDate: '2026-06-15', endDate: '2026-06-30' });
  });

  // ── Bug 4: week scale slot 0 must not step back before timelineStartDate ─

  it('week scale slot 0 should start on or after timelineStartDate', () => {
    // 2026-01-01 is a Thursday. Before the fix, startOfWeek drifted back to
    // 2025-12-29 (Monday), returning a range that starts before timelineStartDate.
    const result = slotToDateRange(Timescale.Week, '2026-01-01', 0);

    expect(result.startDate >= '2026-01-01').toBeTrue();
    expect(result.startDate).toBe('2026-01-01');
  });

  it('week scale subsequent slots advance by exactly 7 days from startDate', () => {
    const slot0 = slotToDateRange(Timescale.Week, '2026-01-01', 0);
    const slot1 = slotToDateRange(Timescale.Week, '2026-01-01', 1);
    const slot2 = slotToDateRange(Timescale.Week, '2026-01-01', 2);

    expect(slot0.startDate).toBe('2026-01-01');
    expect(slot1.startDate).toBe('2026-01-08');
    expect(slot2.startDate).toBe('2026-01-15');
  });

  it('places week work-order bars by real day boundaries to avoid false visual overlap', () => {
    const previous = placeBar(Timescale.Week, '2026-12-01', '2026-11-16', '2026-12-29');
    const next = placeBar(Timescale.Week, '2026-12-01', '2026-12-30', '2027-01-10');

    expect(previous.left + previous.width).toBeLessThanOrEqual(next.left);
  });
});
