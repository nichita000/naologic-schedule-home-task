import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BadgeStatus } from '../badge/badge.component';

export type StatusFilterValue = BadgeStatus | 'all';

@Component({
  selector: 'nao-status-filter',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-filter.component.html',
  styleUrl: './status-filter.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusFilterComponent {
  readonly value = input<StatusFilterValue>('all');
  readonly valueChange = output<StatusFilterValue>();

  readonly open = signal(false);

  readonly options: { value: StatusFilterValue; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: BadgeStatus.Open, label: 'Open' },
    { value: BadgeStatus.InProgress, label: 'In progress' },
    { value: BadgeStatus.Complete, label: 'Complete' },
    { value: BadgeStatus.Blocked, label: 'Blocked' },
  ];

  readonly activeLabel = computed(() => this.options.find(option => option.value === this.value())?.label ?? 'All');

  isStatus(value: StatusFilterValue): value is BadgeStatus {
    return value !== 'all';
  }

  toggle(): void {
    this.open.update(value => !value);
  }

  close(): void {
    this.open.set(false);
  }

  select(value: StatusFilterValue): void {
    this.valueChange.emit(value);
    this.close();
  }
}
