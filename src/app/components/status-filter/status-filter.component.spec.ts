import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BadgeStatus } from '../badge/badge.component';
import { StatusFilterComponent, StatusFilterValue } from './status-filter.component';

@Component({
  standalone: true,
  imports: [StatusFilterComponent],
  template: `<nao-status-filter [value]="value" (valueChange)="value = $event" />`,
})
class HostComponent {
  value: StatusFilterValue = 'all';
}

describe('StatusFilterComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('renders the active status label', () => {
    fixture.componentInstance.value = BadgeStatus.InProgress;
    fixture.detectChanges();

    const trigger = fixture.debugElement.query(By.css('.nao-status-filter__trigger')).nativeElement as HTMLButtonElement;

    expect(trigger.textContent).toContain('In progress');
  });

  it('emits selected status and closes the menu', () => {
    const trigger = fixture.debugElement.query(By.css('.nao-status-filter__trigger')).nativeElement as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const complete = fixture.debugElement
      .queryAll(By.css('.nao-status-filter__item'))
      .find(item => item.nativeElement.textContent.includes('Complete'))?.nativeElement as HTMLButtonElement;
    complete.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.value).toBe(BadgeStatus.Complete);
    expect(fixture.debugElement.query(By.css('.nao-status-filter__menu'))).toBeNull();
  });
});
