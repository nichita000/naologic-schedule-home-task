import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TextFieldComponent } from './text-field.component';

describe('TextFieldComponent', () => {
  let fixture: ComponentFixture<TextFieldComponent>;
  let component: TextFieldComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextFieldComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TextFieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function input(): HTMLInputElement {
    return fixture.debugElement.query(By.css('.nao-field__input')).nativeElement;
  }

  it('updates the value model when the input changes (two-way binding)', () => {
    const el = input();
    el.value = 'Acme Inc.';
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.value()).toBe('Acme Inc.');
  });

  it('shows the error message when error is set', () => {
    fixture.componentRef.setInput('error', 'This field is required');
    fixture.detectChanges();

    const error = fixture.debugElement.query(By.css('.nao-field__error'));
    expect(error).toBeTruthy();
    expect(error.nativeElement.textContent.trim()).toBe('This field is required');
  });

  it('disables the input when disabled is true', fakeAsync(() => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    // ngModel applies the disabled state to the native input asynchronously
    tick();
    fixture.detectChanges();

    expect(input().disabled).toBe(true);
  }));
});
