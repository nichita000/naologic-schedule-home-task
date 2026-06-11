import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { WorkOrderDeleteDialogComponent } from './work-order-delete-dialog.component';
import { ScheduleOrder } from '../schedule/schedule.component';
import { BadgeStatus } from '../badge/badge.component';

describe('WorkOrderDeleteDialogComponent', () => {
  let fixture: ComponentFixture<WorkOrderDeleteDialogComponent>;

  const order: ScheduleOrder = {
    id: 'wo-1',
    name: 'Casing Extrusion',
    workCenterId: 'wc-1',
    status: BadgeStatus.Complete,
    startDate: '2026-05-01',
    endDate: '2026-06-19',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkOrderDeleteDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkOrderDeleteDialogComponent);
    fixture.componentRef.setInput('order', order);
    fixture.detectChanges();
  });

  function el(selector: string): HTMLElement {
    return fixture.debugElement.query(By.css(selector)).nativeElement;
  }

  function actionButton(label: string): HTMLButtonElement {
    const buttons = fixture.debugElement.queryAll(By.css('.delete-dialog__actions button'));
    return buttons.find(b => b.nativeElement.textContent.trim() === label)?.nativeElement;
  }

  it('shows the work order being deleted as a bar without the context menu', () => {
    expect(el('.nao-wo__name').textContent?.trim()).toBe('Casing Extrusion');
    expect(el('.nao-wo__status').textContent?.trim()).toBe('Complete');
    expect(fixture.debugElement.query(By.css('.nao-wo__menu'))).toBeNull();
  });

  it('shows the scheduled period of the work order', () => {
    expect(el('.delete-dialog__preview-date').textContent?.trim())
      .toBe('May 1, 2026 – Jun 19, 2026');
  });

  it('emits confirmed when Delete is clicked', () => {
    const confirmed = jasmine.createSpy('confirmed');
    fixture.componentInstance.confirmed.subscribe(confirmed);

    actionButton('Delete').click();

    expect(confirmed).toHaveBeenCalledTimes(1);
  });

  it('emits cancelled when Cancel is clicked', () => {
    const cancelled = jasmine.createSpy('cancelled');
    fixture.componentInstance.cancelled.subscribe(cancelled);

    actionButton('Cancel').click();

    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('emits cancelled when the backdrop is clicked', () => {
    const cancelled = jasmine.createSpy('cancelled');
    fixture.componentInstance.cancelled.subscribe(cancelled);

    el('.delete-dialog').click();

    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('does not cancel when clicking inside the panel', () => {
    const cancelled = jasmine.createSpy('cancelled');
    fixture.componentInstance.cancelled.subscribe(cancelled);

    el('.delete-dialog__panel').click();

    expect(cancelled).not.toHaveBeenCalled();
  });
});
