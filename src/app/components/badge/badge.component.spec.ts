import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BadgeComponent, BadgeStatus } from './badge.component';

describe('BadgeComponent', () => {
  let fixture: ComponentFixture<BadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BadgeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BadgeComponent);
  });

  function badge(): HTMLElement {
    return fixture.debugElement.query(By.css('.nao-badge')).nativeElement;
  }

  it('renders the correct class and label for each status', () => {
    const cases: ReadonlyArray<[BadgeStatus, string]> = [
      [BadgeStatus.Complete, 'Complete'],
      [BadgeStatus.InProgress, 'In progress'],
      [BadgeStatus.Blocked, 'Blocked'],
      [BadgeStatus.Open, 'Open'],
    ];

    for (const [status, label] of cases) {
      fixture.componentRef.setInput('status', status);
      fixture.detectChanges();
      expect(badge().classList).toContain(`nao-badge--${status}`);
      expect(badge().textContent?.trim()).toBe(label);
    }
  });

  it('prefers an explicit label override', () => {
    fixture.componentRef.setInput('status', BadgeStatus.Open);
    fixture.componentRef.setInput('label', 'Custom');
    fixture.detectChanges();
    expect(badge().textContent?.trim()).toBe('Custom');
  });
});
