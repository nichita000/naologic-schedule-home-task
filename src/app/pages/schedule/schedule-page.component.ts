import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TimescaleComponent, Timescale } from '../../components/timescale/timescale.component';

@Component({
  selector: 'app-schedule-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TimescaleComponent],
  templateUrl: './schedule-page.component.html',
  styleUrl: './schedule-page.component.scss',
})
export class SchedulePageComponent {
  readonly timescale = signal<Timescale>(Timescale.Day);

  setTimescale(value: Timescale): void {
    this.timescale.set(value);
  }
}
