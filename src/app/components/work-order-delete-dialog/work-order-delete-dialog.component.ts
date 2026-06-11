import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent, ButtonVariant } from '../button/button.component';
import { WorkOrderComponent } from '../work-order/work-order.component';
import { ScheduleOrder } from '../schedule/schedule.component';
import { formatDateRange } from '../../utils/format-date-range';

/**
 * Confirmation dialog for deleting a work order. Shows the order as the same
 * visual bar used on the timeline plus its scheduled period, so the user can
 * verify they are deleting the right thing. Clicking the backdrop cancels.
 */
@Component({
  selector: 'nao-work-order-delete-dialog',
  standalone: true,
  imports: [CommonModule, ButtonComponent, WorkOrderComponent],
  templateUrl: './work-order-delete-dialog.component.html',
  styleUrl: './work-order-delete-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkOrderDeleteDialogComponent {
  /** The work order the user is about to delete. */
  readonly order = input.required<ScheduleOrder>();

  /** Emitted when the user confirms the deletion. */
  readonly confirmed = output<void>();
  /** Emitted when the user cancels (button or backdrop click). */
  readonly cancelled = output<void>();

  protected readonly ButtonVariant = ButtonVariant;

  protected get scheduledRange(): string {
    const order = this.order();
    return formatDateRange(order.startDate, order.endDate);
  }
}
