import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ButtonComponent, ButtonVariant } from './button.component';

describe('ButtonComponent', () => {
  let fixture: ComponentFixture<ButtonComponent>;
  let component: ButtonComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function button(): HTMLButtonElement {
    return fixture.debugElement.query(By.css('button')).nativeElement;
  }

  it('renders the matching variant class', () => {
    const variants = [ButtonVariant.Primary, ButtonVariant.Secondary, ButtonVariant.Ghost];
    for (const variant of variants) {
      fixture.componentRef.setInput('variant', variant);
      fixture.detectChanges();
      expect(button().classList).toContain(`nao-btn--${variant}`);
    }
  });

  it('emits clicked when clicked', () => {
    let count = 0;
    component.clicked.subscribe(() => count++);

    button().click();

    expect(count).toBe(1);
  });

  it('does not emit clicked when disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    let count = 0;
    component.clicked.subscribe(() => count++);

    button().click();

    expect(count).toBe(0);
  });
});
