import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Timescale } from '../timescale/timescale.component';
import { buildRulerCells, offsetRangeToDateRange, ScheduleRulerComponent } from './schedule-ruler.component';

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

  it('renders week labels as date ranges with a year', () => {
    const cells = buildRulerCells(Timescale.Week, '2024-08-01', '2024-08-14');

    expect(cells.map(cell => cell.label)).toEqual([
      '29 Jul-4 Aug 2024',
      '5-11 Aug 2024',
      '12-18 Aug 2024',
    ]);
  });

  it('converts partial month spans into matching date ranges', () => {
    const range = offsetRangeToDateRange(Timescale.Month, '2026-06-01', 57, 57);

    expect(range).toEqual({ startDate: '2026-06-15', endDate: '2026-06-30' });
  });
});
