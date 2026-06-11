import { booleanAttribute, ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BadgeStatus } from '../badge/badge.component';
import { IconButtonComponent, IconButtonVariant } from '../icon-button/icon-button.component';
import { DropdownComponent, DropdownOption } from '../dropdown/dropdown.component';
import { TooltipDirective } from '../tooltip/tooltip.directive';

const STATUS_LABELS: Record<BadgeStatus, string> = {
  [BadgeStatus.Complete]: 'Complete',
  [BadgeStatus.InProgress]: 'In progress',
  [BadgeStatus.Blocked]: 'Blocked',
  [BadgeStatus.Open]: 'Open',
};

@Component({
  selector: 'nao-work-order',
  standalone: true,
  imports: [CommonModule, IconButtonComponent, DropdownComponent, TooltipDirective],
  templateUrl: './work-order.component.html',
  styleUrl: './work-order.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkOrderComponent {
  readonly name = input.required<string>();
  readonly status = input<BadgeStatus>(BadgeStatus.Open);
  /**
   * Hide the kebab menu. Use as a presence attribute (`<nao-work-order hideMenu />`)
   * for read-only previews — e.g. the overlap-conflict bar inside form errors.
   */
  readonly hideMenu = input<boolean, unknown>(false, { transform: booleanAttribute });

  /** Emitted when Edit is chosen from the context menu. */
  readonly edit = output<void>();
  /** Emitted when Delete is chosen from the context menu. */
  readonly delete = output<void>();

  protected readonly IconButtonVariant = IconButtonVariant;
  protected readonly menuOptions: DropdownOption[] = [
    { value: 'edit', label: 'Edit' },
    { value: 'delete', label: 'Delete' },
  ];

  get statusLabel(): string {
    return STATUS_LABELS[this.status()];
  }

  onAction(opt: DropdownOption): void {
    if (opt.value === 'edit') {
      this.edit.emit();
    } else if (opt.value === 'delete') {
      this.delete.emit();
    }
  }
}
