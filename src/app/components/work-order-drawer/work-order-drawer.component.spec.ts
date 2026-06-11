import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { WorkOrderDrawerComponent } from './work-order-drawer.component';

describe('WorkOrderDrawerComponent', () => {
  let fixture: ComponentFixture<WorkOrderDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkOrderDrawerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkOrderDrawerComponent);
    fixture.componentRef.setInput('workCenters', [{ id: 'wc-1', name: 'Genesis Hardware' }]);
    fixture.componentRef.setInput('value', {
      name: 'Frame Profile Run',
      workCenterId: 'wc-1',
      status: 'in-progress',
      startDate: '2026-06-28',
      endDate: '2026-09-12',
    });
    fixture.detectChanges();
  });

  it('renders the work order details drawer', () => {
    expect(fixture.nativeElement.textContent).toContain('Work Order Details');
    expect(fixture.nativeElement.textContent).toContain('Specify the dates, name and status for this order');
  });

  it('emits the edited value on submit', () => {
    const component = fixture.componentInstance;
    let savedName = '';
    component.saved.subscribe(value => savedName = value.name);

    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');

    expect(savedName).toBe('Frame Profile Run');
  });
});
