import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimescaleComponent, Timescale } from './timescale.component';

describe('TimescaleComponent', () => {
  let fixture: ComponentFixture<TimescaleComponent>;
  let component: TimescaleComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimescaleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TimescaleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('toggle() flips the open signal', () => {
    expect(component.open()).toBe(false);
    component.toggle();
    expect(component.open()).toBe(true);
    component.toggle();
    expect(component.open()).toBe(false);
  });

  it('close() sets open to false', () => {
    component.toggle();
    expect(component.open()).toBe(true);
    component.close();
    expect(component.open()).toBe(false);
  });

  it('select() emits valueChange and closes the menu', () => {
    component.toggle();
    let emitted: Timescale | undefined;
    component.valueChange.subscribe((v) => (emitted = v));

    component.select(Timescale.Week);

    expect(emitted).toBe(Timescale.Week);
    expect(component.open()).toBe(false);
  });

  it('activeLabel returns the correct label for each Timescale value', () => {
    const cases: ReadonlyArray<[Timescale, string]> = [
      [Timescale.Day, 'Day'],
      [Timescale.Week, 'Week'],
      [Timescale.Month, 'Month'],
    ];

    for (const [value, label] of cases) {
      fixture.componentRef.setInput('value', value);
      expect(component.activeLabel()).toBe(label);
    }
  });

  it('does not expose the hour option', () => {
    expect(component.options.map(option => option.value)).toEqual([
      Timescale.Day,
      Timescale.Week,
      Timescale.Month,
    ]);
  });

  it('activeLabel falls back to "Month" for an unknown value', () => {
    fixture.componentRef.setInput('value', 'year' as unknown as Timescale);
    expect(component.activeLabel()).toBe('Month');
  });
});
