import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { IconButtonComponent, IconButtonVariant } from './icon-button.component';

describe('IconButtonComponent', () => {
  let fixture: ComponentFixture<IconButtonComponent>;
  let component: IconButtonComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IconButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(IconButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function button(): HTMLButtonElement {
    return fixture.debugElement.query(By.css('button')).nativeElement;
  }

  it('renders the matching variant class', () => {
    for (const variant of [IconButtonVariant.Dismiss, IconButtonVariant.Subtle]) {
      fixture.componentRef.setInput('variant', variant);
      fixture.detectChanges();
      expect(button().classList).toContain(`nao-icon-btn--${variant}`);
    }
  });

  it('reflects the label as aria-label', () => {
    fixture.componentRef.setInput('label', 'Close');
    fixture.detectChanges();
    expect(button().getAttribute('aria-label')).toBe('Close');
  });

  it('emits clicked when clicked', () => {
    let count = 0;
    component.clicked.subscribe(() => count++);
    button().click();
    expect(count).toBe(1);
  });
});
