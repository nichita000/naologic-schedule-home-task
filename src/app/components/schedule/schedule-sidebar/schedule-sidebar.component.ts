import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { WorkCenter } from '../schedule.component';

@Component({
  selector: 'nao-schedule-sidebar',
  standalone: true,
  templateUrl: './schedule-sidebar.component.html',
  styleUrl: './schedule-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'schedule__sidebar',
    '[class.is-locked]': 'locked()',
  },
})
export class ScheduleSidebarComponent {
  readonly workCenters = input<WorkCenter[]>([]);
  readonly hoveredRowId = input<string | null>(null);
  readonly locked = input<boolean>(false);

  readonly rowHover = output<string | null>();
}
