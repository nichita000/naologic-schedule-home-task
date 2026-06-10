import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DropdownComponent, DropdownOption } from './dropdown.component';

describe('DropdownComponent', () => {
  let fixture: ComponentFixture<DropdownComponent>;
  let component: DropdownComponent;

  const options: DropdownOption[] = [
    { value: 'open', label: 'Open' },
    { value: 'done', label: 'Done' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DropdownComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DropdownComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('placeholder', 'Select status');
    fixture.detectChanges();
  });

  function trigger(): HTMLButtonElement {
    return fixture.debugElement.query(By.css('.nao-dropdown__trigger')).nativeElement;
  }

  it('starts closed', () => {
    expect(component.open()).toBe(false);
  });

  it('opens when the trigger is clicked', () => {
    trigger().click();
    fixture.detectChanges();
    expect(component.open()).toBe(true);
  });

  it('selecting an option emits selectedChange and closes', () => {
    component.toggle();
    fixture.detectChanges();

    let emitted: DropdownOption | undefined;
    component.selectedChange.subscribe((o) => (emitted = o));

    const items = fixture.debugElement.queryAll(By.css('.nao-dropdown__item'));
    items[1].nativeElement.click();

    expect(emitted).toEqual(options[1]);
    expect(component.open()).toBe(false);
  });

  it('shows the placeholder when nothing is selected', () => {
    const value = fixture.debugElement.query(By.css('.nao-dropdown__value')).nativeElement;
    expect(value.textContent?.trim()).toBe('Select status');
  });
});
