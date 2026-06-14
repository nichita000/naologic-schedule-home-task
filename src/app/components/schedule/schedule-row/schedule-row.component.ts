import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TooltipDirective } from '../../tooltip/tooltip.directive';
import { WorkOrderComponent } from '../../work-order/work-order.component';
import { formatDateRangeShort } from '../../../utils/format-date-range';
import { ScheduleCompactGroupComponent } from '../schedule-compact-group/schedule-compact-group.component';
import type { HoverPlacement } from '../schedule-placement';
import type {
  CompactOrderGroup,
  PlacedOrder,
  ScheduleOrder,
  WorkCenter,
  WorkOrderAction,
} from '../schedule.component';

@Component({
  selector: 'nao-schedule-row',
  standalone: true,
  imports: [ScheduleCompactGroupComponent, TooltipDirective, WorkOrderComponent],
  templateUrl: './schedule-row.component.html',
  styleUrl: './schedule-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'schedule__gantt-row',
    '[class.schedule__gantt-row--hovered]': 'hovered()',
    '[class.is-locked]': 'locked()',
    '(mousemove)': 'rowMove.emit($event)',
    '(mouseleave)': 'rowLeave.emit()',
  },
})
export class ScheduleRowComponent {
  readonly workCenter = input.required<WorkCenter>();
  readonly bars = input<PlacedOrder[]>([]);
  readonly compactGroups = input<CompactOrderGroup[]>([]);
  readonly hoverPlacement = input<HoverPlacement | null>(null);
  readonly focusedOrderId = input<string | null>(null);
  readonly activeGroupId = input<string | null>(null);
  readonly compactPopoverFlip = input<{ horizontal: boolean; vertical: boolean }>({ horizontal: false, vertical: false });
  readonly compactPopoverMaxWidth = input<number>(520);
  readonly hovered = input<boolean>(false);
  readonly locked = input<boolean>(false);
  readonly showAddPill = input<boolean>(false);

  readonly rowMove = output<MouseEvent>();
  readonly rowLeave = output<void>();
  readonly orderAction = output<{ order: ScheduleOrder; action: WorkOrderAction }>();
  readonly addWorkOrder = output<void>();
  readonly compactToggle = output<{ trigger: HTMLElement; group: CompactOrderGroup }>();
  readonly compactFocus = output<ScheduleOrder>();

  orderTooltip(order: ScheduleOrder): string {
    return `${order.name} · ${formatDateRangeShort(order.startDate, order.endDate)}`;
  }

  compactGroupHasFocusedOrder(group: CompactOrderGroup): boolean {
    const focusedOrderId = this.focusedOrderId();
    return !!focusedOrderId && group.orders.some(order => order.id === focusedOrderId);
  }
}
