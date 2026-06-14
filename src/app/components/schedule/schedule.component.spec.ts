import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BadgeStatus } from '../badge/badge.component';
import { Timescale } from '../timescale/timescale.component';
import { WorkOrderComponent } from '../work-order/work-order.component';
import { ScheduleComponent } from './schedule.component';
import { TimelineScrollDirective } from './timeline-scroll.directive';

describe('ScheduleComponent', () => {
  let fixture: ComponentFixture<ScheduleComponent>;
  let component: ScheduleComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScheduleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ScheduleComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('workCenters', [{ id: 'wc-1', name: 'Extrusion Line A' }]);
    fixture.componentRef.setInput('timelineStartDate', '2026-05-01');
    fixture.componentRef.setInput('timelineEndDate', '2026-12-31');
  });

  it('renders and validates the month add preview as a full available month', () => {
    fixture.componentRef.setInput('scale', Timescale.Month);
    fixture.componentRef.setInput('workOrders', []);
    fixture.detectChanges();

    moveRowAt(114 * 4 + 70);

    const placement = component.hoverPlacement();
    expect(placement?.left).toBe(456);
    expect(placement?.width).toBeCloseTo(114, 5);
    expect(placement?.startDate).toBe('2026-09-01');
    expect(placement?.endDate).toBe('2026-09-30');
  });

  it('starts the month add preview at the first free day after an order and runs a full month', () => {
    fixture.componentRef.setInput('scale', Timescale.Month);
    fixture.componentRef.setInput('workOrders', [
      {
        id: 'wo-1',
        name: 'Spindle Bracket',
        workCenterId: 'wc-1',
        status: BadgeStatus.Blocked,
        startDate: '2026-06-15',
        endDate: '2026-09-05',
      },
    ]);
    fixture.detectChanges();

    moveRowAt(114 * 4 + 70);

    // Sep is occupied through the 5th, so the preview starts at the next free
    // week-section (Sep 8) and runs a full month on the section grid.
    const placement = component.hoverPlacement();
    expect(placement?.startDate).toBe('2026-09-08');
    expect(placement?.endDate).toBe('2026-10-07');
    expect(placement?.left).toBeCloseTo(484.5, 1);
    expect(placement?.width).toBeCloseTo(114, 1);
  });

  it('keeps the month add preview capped to one month when the next order starts after it', () => {
    fixture.componentRef.setInput('scale', Timescale.Month);
    fixture.componentRef.setInput('workOrders', [
      {
        id: 'wo-next',
        name: 'Annual Review',
        workCenterId: 'wc-1',
        status: BadgeStatus.Complete,
        startDate: '2026-10-19',
        endDate: '2026-11-18',
      },
    ]);
    fixture.detectChanges();

    moveRowAt(114 * 4 + 114);

    const placement = component.hoverPlacement();
    expect(placement?.startDate).toBe('2026-09-15');
    expect(placement?.endDate).toBe('2026-10-14');
    expect(placement?.left).toBeCloseTo(513, 1);
    expect(placement?.width).toBeCloseTo(114, 1);
  });

  it('extends the month add preview backward to a full month when the next order is under a month ahead', () => {
    fixture.componentRef.setInput('scale', Timescale.Month);
    fixture.componentRef.setInput('workOrders', [
      {
        id: 'wo-next',
        name: 'Annual Review',
        workCenterId: 'wc-1',
        status: BadgeStatus.Complete,
        startDate: '2026-10-10',
        endDate: '2026-11-18',
      },
    ]);
    fixture.detectChanges();

    moveRowAt(114 * 4 + 114);

    // A month forward from the cursor (Sep 15) would overrun the Oct 10 order's
    // section, so the preview pins its end to the last free section (Oct 1-7)
    // and backs up a full month.
    const placement = component.hoverPlacement();
    expect(placement?.startDate).toBe('2026-09-08');
    expect(placement?.endDate).toBe('2026-10-07');
  });

  it('never previews a sub-week month pill, skipping a too-small gap', () => {
    fixture.componentRef.setInput('scale', Timescale.Month);
    // Two compact orders four days apart leave only a 3-day Oct 2-4 gap — below
    // the one-week floor — so the preview backs out into the open month before
    // them instead of rendering a sliver.
    fixture.componentRef.setInput('workOrders', [
      {
        id: 'wo-a',
        name: 'Spot A',
        workCenterId: 'wc-1',
        status: BadgeStatus.Open,
        startDate: '2026-10-01',
        endDate: '2026-10-01',
      },
      {
        id: 'wo-b',
        name: 'Spot B',
        workCenterId: 'wc-1',
        status: BadgeStatus.Blocked,
        startDate: '2026-10-05',
        endDate: '2026-10-05',
      },
    ]);
    fixture.detectChanges();

    moveRowAt(625); // over early October, where only the 3-day gap sits

    const placement = component.hoverPlacement();
    expect(placement).not.toBeNull();
    const days =
      (new Date(placement!.endDate).getTime() - new Date(placement!.startDate).getTime()) / 86_400_000 + 1;
    expect(days).toBeGreaterThanOrEqual(7);
    expect(placement!.endDate < '2026-10-01').toBeTrue();
  });

  it('does not skip the first free day after an existing work order', () => {
    fixture.componentRef.setInput('scale', Timescale.Day);
    fixture.componentRef.setInput('timelineStartDate', '2026-06-16');
    fixture.componentRef.setInput('timelineEndDate', '2026-06-30');
    fixture.componentRef.setInput('workOrders', [
      {
        id: 'wo-1',
        name: 'Casing Extrusion',
        workCenterId: 'wc-1',
        status: BadgeStatus.Complete,
        startDate: '2026-06-16',
        endDate: '2026-06-18',
      },
    ]);
    fixture.detectChanges();

    moveRowAt(600);

    expect(component.hoverPlacement()).toEqual({
      left: 600,
      width: 200,
      startDate: '2026-06-19',
      endDate: '2026-06-19',
    });
  });

  it('sizes the week add preview to the free day run after a compact order', () => {
    fixture.componentRef.setInput('scale', Timescale.Week);
    fixture.componentRef.setInput('timelineStartDate', '2026-06-01');
    fixture.componentRef.setInput('timelineEndDate', '2026-07-31');
    fixture.componentRef.setInput('workOrders', [
      {
        id: 'wo-compact',
        name: 'Daily Check',
        workCenterId: 'wc-1',
        status: BadgeStatus.Open,
        startDate: '2026-06-01',
        endDate: '2026-06-03',
      },
      {
        id: 'wo-next',
        name: 'Weekly Assembly',
        workCenterId: 'wc-1',
        status: BadgeStatus.InProgress,
        startDate: '2026-06-08',
        endDate: '2026-06-14',
      },
    ]);
    fixture.detectChanges();

    moveRowAt((150 / 7) * 3.5);

    const placement = component.hoverPlacement();
    expect(placement?.startDate).toBe('2026-06-04');
    expect(placement?.endDate).toBe('2026-06-07');
    expect(placement?.left).toBeCloseTo((150 / 7) * 3, 5);
    expect(placement?.width).toBeCloseTo((150 / 7) * 4, 5);
  });

  it('extends the week add preview backward when the next order is less than a week away', () => {
    fixture.componentRef.setInput('scale', Timescale.Week);
    fixture.componentRef.setInput('timelineStartDate', '2026-06-01');
    fixture.componentRef.setInput('timelineEndDate', '2026-07-31');
    fixture.componentRef.setInput('workOrders', [
      {
        id: 'wo-next',
        name: 'Weekly Assembly',
        workCenterId: 'wc-1',
        status: BadgeStatus.InProgress,
        startDate: '2026-06-13',
        endDate: '2026-06-20',
      },
    ]);
    fixture.detectChanges();

    moveRowAt((150 / 7) * 10.5);

    const placement = component.hoverPlacement();
    expect(placement?.startDate).toBe('2026-06-06');
    expect(placement?.endDate).toBe('2026-06-12');
    expect(placement?.width).toBeCloseTo(150, 5);
  });

  it('skips one and two day week gaps when placing the add preview', () => {
    fixture.componentRef.setInput('scale', Timescale.Week);
    fixture.componentRef.setInput('timelineStartDate', '2026-06-01');
    fixture.componentRef.setInput('timelineEndDate', '2026-07-31');
    fixture.componentRef.setInput('workOrders', [
      {
        id: 'wo-before',
        name: 'Before',
        workCenterId: 'wc-1',
        status: BadgeStatus.Open,
        startDate: '2026-06-01',
        endDate: '2026-06-03',
      },
      {
        id: 'wo-after-small-gap',
        name: 'After Small Gap',
        workCenterId: 'wc-1',
        status: BadgeStatus.Blocked,
        startDate: '2026-06-06',
        endDate: '2026-06-09',
      },
    ]);
    fixture.detectChanges();

    moveRowAt((150 / 7) * 3.5);

    const placement = component.hoverPlacement();
    expect(placement?.startDate).toBe('2026-06-10');
    expect(placement?.endDate).toBe('2026-06-16');
    expect(placement?.width).toBeCloseTo(150, 5);
  });

  it('does not skip the first visible free day after an order that started before the viewport', () => {
    fixture.componentRef.setInput('scale', Timescale.Day);
    fixture.componentRef.setInput('timelineStartDate', '2026-06-09');
    fixture.componentRef.setInput('timelineEndDate', '2026-06-30');
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

    moveRowAt(200 * 10);

    expect(component.hoverPlacement()).toEqual({
      left: 2000,
      width: 200,
      startDate: '2026-06-19',
      endDate: '2026-06-19',
    });
  });

  it('groups very short week work orders behind a compact marker', () => {
    fixture.componentRef.setInput('scale', Timescale.Week);
    fixture.componentRef.setInput('timelineStartDate', '2026-06-01');
    fixture.componentRef.setInput('timelineEndDate', '2026-08-31');
    fixture.componentRef.setInput('workOrders', [
      {
        id: 'wo-short-1',
        name: 'Daily Check #1',
        workCenterId: 'wc-1',
        status: BadgeStatus.Open,
        startDate: '2026-06-01',
        endDate: '2026-06-01',
      },
      {
        id: 'wo-short-2',
        name: 'Daily Check #2',
        workCenterId: 'wc-1',
        status: BadgeStatus.Complete,
        startDate: '2026-06-02',
        endDate: '2026-06-02',
      },
      {
        id: 'wo-long',
        name: 'Weekly Assembly Run',
        workCenterId: 'wc-1',
        status: BadgeStatus.InProgress,
        startDate: '2026-06-08',
        endDate: '2026-06-18',
      },
    ]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('.schedule__compact-marker').length).toBe(1);
    expect(host.querySelectorAll('.schedule__bar').length).toBe(1);

    host.querySelector<HTMLButtonElement>('.schedule__compact-marker')?.click();
    fixture.detectChanges();

    expect(host.querySelector('.schedule__compact-header')?.textContent).toContain('Work orders');
    expect(host.querySelector('.schedule__compact-header')?.textContent).toContain('Jun 1 - 2, 2026');
    expect(host.querySelector('.schedule__compact-header')?.textContent).toContain('2 total');
    expect(host.querySelectorAll('.schedule__compact-item').length).toBe(2);
  });

  it('compacts week orders of a week or less, keeping longer ones as named bars', () => {
    fixture.componentRef.setInput('scale', Timescale.Week);
    fixture.componentRef.setInput('timelineStartDate', '2026-06-01');
    fixture.componentRef.setInput('timelineEndDate', '2026-09-30');
    fixture.componentRef.setInput('workOrders', [
      {
        id: 'wo-7d',
        name: 'Week Task',
        workCenterId: 'wc-1',
        status: BadgeStatus.Open,
        startDate: '2026-06-08',
        endDate: '2026-06-14', // 7 days -> too narrow for a name -> compact
      },
      {
        id: 'wo-8d',
        name: 'Eight Day Task',
        workCenterId: 'wc-1',
        status: BadgeStatus.InProgress,
        startDate: '2026-06-15',
        endDate: '2026-06-22', // 8 days -> spans a second cell -> full bar
      },
    ]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const bars = host.querySelectorAll<HTMLElement>('.schedule__bar');

    expect(bars.length).toBe(1);
    expect(bars[0].textContent).toContain('Eight Day Task');
    expect(host.querySelectorAll('.schedule__compact-marker').length).toBe(1);
  });

  it('renders short month work orders as compact markers instead of full bars', () => {
    fixture.componentRef.setInput('scale', Timescale.Month);
    fixture.componentRef.setInput('workOrders', [
      {
        id: 'wo-short',
        name: 'Short QA Run',
        workCenterId: 'wc-1',
        status: BadgeStatus.Open,
        startDate: '2026-06-10',
        endDate: '2026-06-14',
      },
    ]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.schedule__bar')).toBeNull();
    expect(host.querySelector('.schedule__compact-marker')).not.toBeNull();
    expect(host.querySelector('.schedule__compact-dot')).not.toBeNull();
  });

  it('opens compact order details and emits a focus request', () => {
    const emitted: string[] = [];
    fixture.componentRef.setInput('scale', Timescale.Month);
    fixture.componentRef.setInput('workOrders', [
      {
        id: 'wo-short',
        name: 'Short QA Run',
        workCenterId: 'wc-1',
        status: BadgeStatus.Open,
        startDate: '2026-06-10',
        endDate: '2026-06-14',
      },
    ]);
    fixture.componentInstance.compactOrderFocus.subscribe(order => emitted.push(order.id));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const marker = host.querySelector<HTMLButtonElement>('.schedule__compact-marker');
    marker?.click();
    fixture.detectChanges();

    const popover = host.querySelector<HTMLElement>('.schedule__compact-popover');
    const arrow = host.querySelector<HTMLButtonElement>('.schedule__compact-arrow');

    expect(popover?.textContent).not.toContain('1 total');
    expect(popover?.textContent).not.toContain('Work orders');
    expect(popover?.textContent).toContain('Short QA Run');
    expect(popover?.textContent).toContain('Jun 10 - 14, 2026');

    arrow?.click();

    expect(emitted).toEqual(['wo-short']);
  });

  it('groups compact orders by quarter-month section, one marker per occupied slot', () => {
    fixture.componentRef.setInput('scale', Timescale.Month);
    fixture.componentRef.setInput('workOrders', Array.from({ length: 30 }, (_, index) => ({
      id: `wo-short-${index + 1}`,
      name: `Short Run #${index + 1}`,
      workCenterId: 'wc-1',
      status: BadgeStatus.Open,
      startDate: `2026-06-${String(index + 1).padStart(2, '0')}`,
      endDate: `2026-06-${String(index + 1).padStart(2, '0')}`,
    })));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    // June splits into four placement sections (1-7, 8-14, 15-21, 22-30),
    // so the marker sits on the section its orders occupy — four markers.
    expect(host.querySelectorAll('.schedule__compact-marker').length).toBe(4);

    host.querySelector<HTMLButtonElement>('.schedule__compact-marker')?.click();
    fixture.detectChanges();

    expect(host.querySelector('.schedule__compact-header')?.textContent).toContain('7 total');
    expect(host.querySelector('.schedule__compact-header')?.textContent).toContain('Jun 1 - 7, 2026');
    expect(host.querySelector('.schedule__compact-date')?.textContent?.trim()).toBe('Jun 1, 2026');
    expect(host.querySelectorAll('.schedule__compact-item').length).toBe(7);
  });

  it('shows the remainder beyond the two visible dots on the count badge', () => {
    fixture.componentRef.setInput('scale', Timescale.Month);
    fixture.componentRef.setInput('workOrders', [
      { id: 'wo-a', name: 'Spot #1', workCenterId: 'wc-1', status: BadgeStatus.Complete, startDate: '2026-10-08', endDate: '2026-10-09' },
      { id: 'wo-b', name: 'Spot #2', workCenterId: 'wc-1', status: BadgeStatus.Open, startDate: '2026-10-10', endDate: '2026-10-11' },
      { id: 'wo-c', name: 'Spot #3', workCenterId: 'wc-1', status: BadgeStatus.InProgress, startDate: '2026-10-13', endDate: '2026-10-14' },
    ]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    // All three live in the Oct 8-14 section: one marker, two dots, "+1".
    expect(host.querySelectorAll('.schedule__compact-marker').length).toBe(1);
    expect(host.querySelectorAll('.schedule__compact-dot').length).toBe(2);
    expect(host.querySelector('.schedule__compact-count')?.textContent?.trim()).toBe('+1');
  });

  it('groups a month-boundary order into the section where it starts', () => {
    fixture.componentRef.setInput('scale', Timescale.Month);
    fixture.componentRef.setInput('workOrders', [
      { id: 'wo-fixture', name: 'Fixture Swap', workCenterId: 'wc-1', status: BadgeStatus.Open, startDate: '2026-09-22', endDate: '2026-09-27' },
      { id: 'wo-boundary', name: 'Month-End Cleanup', workCenterId: 'wc-1', status: BadgeStatus.InProgress, startDate: '2026-09-29', endDate: '2026-10-02' },
    ]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    // Both start inside September's last section (22+), so they share a marker
    // even though the second order ends in October.
    expect(host.querySelectorAll('.schedule__compact-marker').length).toBe(1);

    host.querySelector<HTMLButtonElement>('.schedule__compact-marker')?.click();
    fixture.detectChanges();

    expect(host.querySelector('.schedule__compact-header')?.textContent).toContain('2 total');
    expect(host.querySelector('.schedule__compact-header')?.textContent).toContain('Sep 22 - Oct 2, 2026');
  });

  it('closes the compact popover on Escape', () => {
    fixture.componentRef.setInput('scale', Timescale.Month);
    fixture.componentRef.setInput('workOrders', [
      { id: 'wo-short', name: 'Short QA Run', workCenterId: 'wc-1', status: BadgeStatus.Open, startDate: '2026-06-10', endDate: '2026-06-14' },
    ]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.schedule__compact-marker')?.click();
    fixture.detectChanges();
    expect(host.querySelector('.schedule__compact-popover')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(host.querySelector('.schedule__compact-popover')).toBeNull();
  });

  it('renders an 8-day month-boundary order as a compact pill instead of a stub bar', () => {
    fixture.componentRef.setInput('scale', Timescale.Month);
    fixture.componentRef.setInput('workOrders', [
      { id: 'wo-19', name: 'Carton Restock', workCenterId: 'wc-1', status: BadgeStatus.Open, startDate: '2026-08-28', endDate: '2026-09-04' },
    ]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const pill = host.querySelector<HTMLElement>('.schedule__compact-dot--pill');

    expect(host.querySelector('.schedule__bar')).toBeNull();
    expect(pill).not.toBeNull();
    // 8 days × (114px ÷ 31 days in August) ≈ 29.4px.
    expect(parseFloat(pill!.style.width)).toBeCloseTo(29.4, 0);
  });

  it('keeps a 44-day order compact but renders a 45-day order as a full bar', () => {
    fixture.componentRef.setInput('scale', Timescale.Month);
    fixture.componentRef.setInput('workOrders', [
      // 44 days — one under the threshold → longest pill.
      { id: 'wo-44', name: 'Cert Renewal', workCenterId: 'wc-1', status: BadgeStatus.Open, startDate: '2026-05-04', endDate: '2026-06-16' },
      // 45 days — exactly at the threshold → smallest full bar.
      { id: 'wo-45', name: 'Annual Review', workCenterId: 'wc-1', status: BadgeStatus.Complete, startDate: '2026-07-04', endDate: '2026-08-17' },
    ]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('.schedule__compact-marker').length).toBe(1);
    expect(host.querySelectorAll('.schedule__bar').length).toBe(1);
    expect(host.querySelector('.schedule__bar')?.textContent).toContain('Annual Review');
  });

  it('sizes lone-order pills proportionally to duration with a dot-sized floor', () => {
    fixture.componentRef.setInput('scale', Timescale.Month);
    fixture.componentRef.setInput('workOrders', [
      { id: 'wo-1day', name: 'Laser Alignment', workCenterId: 'wc-1', status: BadgeStatus.Blocked, startDate: '2026-06-10', endDate: '2026-06-10' },
      { id: 'wo-14day', name: 'Holiday Retool', workCenterId: 'wc-1', status: BadgeStatus.InProgress, startDate: '2026-09-01', endDate: '2026-09-14' },
    ]);
    fixture.detectChanges();

    const pills = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.schedule__compact-dot--pill'),
    );

    expect(pills.length).toBe(2);
    // 1 day stays the 16px dot; 14 days × (114 ÷ 30) ≈ 53.2px.
    expect(parseFloat(pills[0].style.width)).toBe(16);
    expect(parseFloat(pills[1].style.width)).toBeCloseTo(53.2, 0);
  });

  it('keeps the dot stack (no pill) for clusters of multiple orders', () => {
    fixture.componentRef.setInput('scale', Timescale.Month);
    fixture.componentRef.setInput('workOrders', [
      { id: 'wo-a', name: 'Fixture Swap', workCenterId: 'wc-1', status: BadgeStatus.Open, startDate: '2026-09-22', endDate: '2026-09-27' },
      { id: 'wo-b', name: 'Month-End Cleanup', workCenterId: 'wc-1', status: BadgeStatus.InProgress, startDate: '2026-09-29', endDate: '2026-10-02' },
    ]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.schedule__compact-dot--pill')).toBeNull();
    expect(host.querySelectorAll('.schedule__compact-dot').length).toBe(2);
  });

  it('builds hover tooltips: bar name+range, lone pill name+range, cluster count+range', () => {
    fixture.componentRef.setInput('scale', Timescale.Month);
    fixture.componentRef.setInput('workOrders', [
      // 45 days → full bar with an always-on tooltip.
      { id: 'wo-bar', name: 'Inventory Count', workCenterId: 'wc-1', status: BadgeStatus.Open, startDate: '2026-11-09', endDate: '2026-12-23' },
      { id: 'wo-pill', name: 'Carton Restock', workCenterId: 'wc-1', status: BadgeStatus.Open, startDate: '2026-08-28', endDate: '2026-09-04' },
      { id: 'wo-c1', name: 'Spot #1', workCenterId: 'wc-1', status: BadgeStatus.Complete, startDate: '2026-10-08', endDate: '2026-10-09' },
      { id: 'wo-c2', name: 'Spot #2', workCenterId: 'wc-1', status: BadgeStatus.Open, startDate: '2026-10-10', endDate: '2026-10-11' },
    ]);
    fixture.detectChanges();

    const markerLabels = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.schedule__compact-marker'),
      marker => marker.getAttribute('aria-label'),
    );

    expect(markerLabels).toContain('Carton Restock · Aug 28 - Sep 4, 2026');
    expect(markerLabels).toContain('2 work orders · Oct 8 - 11, 2026');

    // The full bar passes its always-on tooltip down to the work-order component.
    const bar = fixture.debugElement.query(By.directive(WorkOrderComponent));
    expect((bar.componentInstance as WorkOrderComponent).tooltip()).toBe('Inventory Count · Nov 9 - Dec 23, 2026');
  });

  it('reflects the popover state on the marker via aria-expanded', () => {
    fixture.componentRef.setInput('scale', Timescale.Month);
    fixture.componentRef.setInput('workOrders', [
      { id: 'wo-short', name: 'Short QA Run', workCenterId: 'wc-1', status: BadgeStatus.Open, startDate: '2026-06-10', endDate: '2026-06-14' },
    ]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const marker = host.querySelector<HTMLButtonElement>('.schedule__compact-marker');

    expect(marker?.getAttribute('aria-expanded')).toBe('false');

    marker?.click();
    fixture.detectChanges();

    expect(marker?.getAttribute('aria-expanded')).toBe('true');
  });

  it('hides the add-date pill while a compact order popover is open', () => {
    fixture.componentRef.setInput('scale', Timescale.Month);
    fixture.componentRef.setInput('workOrders', [
      {
        id: 'wo-short',
        name: 'Short QA Run',
        workCenterId: 'wc-1',
        status: BadgeStatus.Complete,
        startDate: '2026-06-10',
        endDate: '2026-06-14',
      },
    ]);
    fixture.detectChanges();

    moveRowAt(114 * 4);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.schedule__add')).not.toBeNull();

    host.querySelector<HTMLButtonElement>('.schedule__compact-marker')?.click();
    fixture.detectChanges();

    expect(host.querySelector('.schedule__compact-popover')).not.toBeNull();
    expect(host.querySelector('.schedule__add')).toBeNull();
  });

  it('emits the currently highlighted add-date range', () => {
    const emitted: Array<{ startDate: string; endDate: string } | null> = [];
    fixture.componentRef.setInput('scale', Timescale.Day);
    fixture.componentRef.setInput('timelineStartDate', '2026-06-16');
    fixture.componentRef.setInput('timelineEndDate', '2026-06-30');
    fixture.componentRef.setInput('workOrders', []);
    fixture.componentInstance.addPreviewRangeChange.subscribe(range => emitted.push(range));
    fixture.detectChanges();

    moveRowAt(600);
    component.clearHover();

    expect(emitted).toEqual([
      { startDate: '2026-06-19', endDate: '2026-06-19' },
      null,
    ]);
  });

  it('replays the focus pulse after focus scrolling settles', fakeAsync(() => {
    fixture.componentRef.setInput('scale', Timescale.Day);
    fixture.componentRef.setInput('timelineStartDate', '2026-06-16');
    fixture.componentRef.setInput('timelineEndDate', '2026-06-30');
    fixture.componentRef.setInput('workOrders', [
      {
        id: 'wo-focus',
        name: 'Focused Run',
        workCenterId: 'wc-1',
        status: BadgeStatus.Open,
        startDate: '2026-06-20',
        endDate: '2026-06-20',
      },
    ]);
    fixture.componentRef.setInput('focusDate', '2026-06-20');
    fixture.componentRef.setInput('focusedOrderId', 'wo-focus');
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const bar = host.querySelector<HTMLElement>('.schedule__bar');

    expect(bar?.classList.contains('schedule__bar--focused')).toBeFalse();

    tick(120);
    fixture.detectChanges();

    expect(bar?.classList.contains('schedule__bar--focused')).toBeTrue();
  }));

  it('virtualizes timeline cells and bars outside the horizontal render window', () => {
    fixture.componentRef.setInput('scale', Timescale.Day);
    fixture.componentRef.setInput('timelineStartDate', '2026-01-01');
    fixture.componentRef.setInput('timelineEndDate', '2026-01-31');
    fixture.componentRef.setInput('workOrders', [
      {
        id: 'wo-visible',
        name: 'Visible Order',
        workCenterId: 'wc-1',
        status: BadgeStatus.Open,
        startDate: '2026-01-12',
        endDate: '2026-01-12',
      },
      {
        id: 'wo-hidden',
        name: 'Hidden Order',
        workCenterId: 'wc-1',
        status: BadgeStatus.Complete,
        startDate: '2026-01-31',
        endDate: '2026-01-31',
      },
    ]);
    fixture.detectChanges();

    const dir = scrollDirective();
    dir.viewportWidth.set(400);
    dir.scrollLeft.set(2000);
    fixture.detectChanges();

    expect(component.visibleTimelineCells().length).toBeLessThan(component.timelineCells().length);
    expect(component.normalPlacedByCenter()['wc-1'].map(order => order.id)).toEqual(['wo-visible']);
  });

  it('teleports near a distant focus target instead of smooth-scrolling the whole way', fakeAsync(() => {
    fixture.componentRef.setInput('scale', Timescale.Day);
    fixture.componentRef.setInput('timelineStartDate', '2026-01-01');
    fixture.componentRef.setInput('timelineEndDate', '2027-12-31');
    fixture.componentRef.setInput('workOrders', []);
    fixture.detectChanges();
    tick();

    const element = fixture.nativeElement.querySelector('.schedule__timeline-scroll') as HTMLElement;
    element.scrollLeft = 0;

    fixture.componentRef.setInput('focusDate', '2027-06-01');
    fixture.componentRef.setInput('focusRequestId', 1);
    fixture.detectChanges();
    tick();

    // Day scale: 2027-06-01 is 516 days from range start → target is
    // 516 × 200 − one cell of lead-in = 103 000px. The instant jump lands two
    // viewports before it; only that final stretch is animated.
    const target = 516 * 200 - 200;
    expect(element.scrollLeft).toBe(Math.max(target - element.clientWidth * 2, 0));
  }));

  it('culls orders outside the timeline range and clips bars at the track edge', () => {
    fixture.componentRef.setInput('scale', Timescale.Day);
    fixture.componentRef.setInput('timelineStartDate', '2026-01-01');
    fixture.componentRef.setInput('timelineEndDate', '2026-01-31');
    fixture.componentRef.setInput('workOrders', [
      {
        id: 'wo-straddling',
        name: 'Straddles Range End',
        workCenterId: 'wc-1',
        status: BadgeStatus.Open,
        startDate: '2026-01-25',
        endDate: '2026-02-10',
      },
      {
        id: 'wo-outside',
        name: 'Beyond Range',
        workCenterId: 'wc-1',
        status: BadgeStatus.Open,
        startDate: '2026-03-01',
        endDate: '2026-03-05',
      },
    ]);
    fixture.detectChanges();

    // Window wide enough to reach both orders, so any exclusion below is the
    // range cull, not the virtualisation window.
    const dir = scrollDirective();
    dir.viewportWidth.set(4000);
    dir.scrollLeft.set(0);
    fixture.detectChanges();

    const bars = component.normalPlacedByCenter()['wc-1'];
    const trackWidth = component.timelineWidth();

    expect(bars.map(order => order.id)).toEqual(['wo-straddling']);
    expect(bars[0].left + bars[0].width).toBe(trackWidth);
  });

  it('emits an edge request once per timeline range when scrolling near an edge', () => {
    const emitted: Array<'start' | 'end'> = [];
    fixture.componentInstance.timelineEdgeReached.subscribe(side => emitted.push(side));
    fixture.componentRef.setInput('scale', Timescale.Day);
    fixture.componentRef.setInput('timelineStartDate', '2026-01-01');
    fixture.componentRef.setInput('timelineEndDate', '2026-01-31');
    fixture.detectChanges();

    const dir = scrollDirective();
    const element = fixture.nativeElement.querySelector('.schedule__timeline-scroll') as HTMLElement;
    const scrollTo = (scrollLeft: number, scrollWidth: number, clientWidth: number) => {
      Object.defineProperty(element, 'scrollWidth', { value: scrollWidth, configurable: true });
      Object.defineProperty(element, 'clientWidth', { value: clientWidth, configurable: true });
      element.scrollLeft = scrollLeft;
      dir.onScroll();
    };

    scrollTo(100, 6200, 1000);
    scrollTo(120, 6200, 1000);

    expect(emitted).toEqual(['start']);

    fixture.componentRef.setInput('timelineStartDate', '2025-01-01');
    fixture.detectChanges();
    scrollTo(100, 79_200, 1000);

    expect(emitted).toEqual(['start', 'start']);
  });

  function moveRowAt(x: number): void {
    component.onRowMove({
      clientX: x,
      currentTarget: {
        getBoundingClientRect: () => ({ left: 0 }),
      },
    } as unknown as MouseEvent, 'wc-1');
  }

  function scrollDirective(): TimelineScrollDirective {
    return fixture.debugElement
      .query(By.directive(TimelineScrollDirective))
      .injector.get(TimelineScrollDirective);
  }
});
