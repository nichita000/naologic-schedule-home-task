import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export enum Timescale { Hour = 'hour', Day = 'day', Week = 'week', Month = 'month' }

@Component({
  selector: 'nao-timescale',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './timescale.component.html',
  styleUrl: './timescale.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimescaleComponent {
  readonly value = input<Timescale>(Timescale.Month);
  readonly valueChange = output<Timescale>();

  readonly open = signal(false);

  readonly options: { value: Timescale; label: string }[] = [
    { value: Timescale.Day, label: 'Day' },
    { value: Timescale.Week, label: 'Week' },
    { value: Timescale.Month, label: 'Month' },
  ];

  readonly activeLabel = computed(
    () => this.options.find(o => o.value === this.value())?.label ?? 'Month'
  );

  toggle(): void { this.open.update(v => !v); }
  close(): void  { this.open.set(false); }

  select(v: Timescale): void {
    this.valueChange.emit(v);
    this.close();
  }
}
