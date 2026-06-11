import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ScheduleComponent } from '../../components/schedule/schedule.component';
import { TimescaleComponent, Timescale } from '../../components/timescale/timescale.component';
import { ScheduleStore } from '../../services/schedule.store';

@Component({
  selector: 'app-schedule-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScheduleComponent, TimescaleComponent],
  templateUrl: './schedule-page.component.html',
  styleUrl: './schedule-page.component.scss',
})
export class SchedulePageComponent {
  readonly timescale = signal<Timescale>(Timescale.Day);
  readonly workCenters = this.scheduleStore.workCenters;
  readonly workOrders = this.scheduleStore.workOrders;
  readonly timelineStartDate = `${new Date().getFullYear() - 2}-01-01`;
  readonly timelineEndDate = `${new Date().getFullYear() + 2}-12-31`;

  constructor(private readonly scheduleStore: ScheduleStore) {}

  setTimescale(value: Timescale): void {
    this.timescale.set(value);
  }
}
