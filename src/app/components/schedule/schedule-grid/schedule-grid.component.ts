import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface ScheduleGridCell {
  key: string;
  left: number;
}

export interface ScheduleCurrentMarker {
  left: number;
  label: string;
}

@Component({
  selector: 'nao-schedule-grid',
  standalone: true,
  templateUrl: './schedule-grid.component.html',
  styleUrl: './schedule-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleGridComponent {
  readonly cells = input<ScheduleGridCell[]>([]);
  readonly timelineWidth = input<number>(0);
  readonly currentMarker = input<ScheduleCurrentMarker | null>(null);
}
