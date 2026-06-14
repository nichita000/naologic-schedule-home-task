import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BadgeStatus } from '../../badge/badge.component';
import { TooltipDirective } from '../../tooltip/tooltip.directive';
import { WorkOrderComponent } from '../../work-order/work-order.component';
import { formatDateRangeShort } from '../../../utils/format-date-range';
import type { CompactOrderGroup, ScheduleOrder } from '../schedule.component';

/**
 * A cluster of short work orders rendered as a marker (dot stack or lone
 * duration pill) with a popover listing the orders. Pure presentation: the
 * parent owns which group is open and where the popover unfolds, passing those
 * in; this component renders them and emits toggle / focus intents.
 */
@Component({
  selector: 'nao-schedule-compact-group',
  standalone: true,
  imports: [TooltipDirective, WorkOrderComponent],
  templateUrl: './schedule-compact-group.component.html',
  styleUrl: './schedule-compact-group.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'schedule__compact',
    '[class.schedule__compact--open]': 'open()',
    '[class.schedule__compact--focused]': 'focused()',
    '[class.is-locked]': 'locked()',
    '[style.transform]': "'translate(' + group().markerLeft + 'px, -50%)'",
  },
})
export class ScheduleCompactGroupComponent {
  readonly group = input.required<CompactOrderGroup>();
  readonly open = input<boolean>(false);
  readonly focused = input<boolean>(false);
  readonly locked = input<boolean>(false);
  readonly flip = input<{ horizontal: boolean; vertical: boolean }>({ horizontal: false, vertical: false });
  readonly maxWidth = input<number>(520);
  readonly workCenterName = input<string>('');

  /** Emits the marker element so the parent can position the popover against it. */
  readonly toggle = output<HTMLElement>();
  readonly focusOrder = output<ScheduleOrder>();

  /** Dots shown on the marker — at most two, leaving room for the +N badge. */
  visibleDots(): ScheduleOrder[] {
    const orders = this.group().orders;
    return orders.slice(0, orders.length > 2 ? 2 : 3);
  }

  /** Marker hover tooltip: lone pill → name + range, cluster → count + range. */
  tooltip(): string {
    const orders = this.group().orders;
    if (orders.length === 1) {
      return `${orders[0].name} · ${this.range(orders[0])}`;
    }
    return `${orders.length} work orders · ${this.groupRange()}`;
  }

  groupRange(): string {
    const sorted = [...this.group().orders].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    return first && last ? formatDateRangeShort(first.startDate, last.endDate) : '';
  }

  range(order: ScheduleOrder): string {
    return formatDateRangeShort(order.startDate, order.endDate);
  }

  statusColor(status: BadgeStatus): string {
    switch (status) {
      case BadgeStatus.Complete:
        return 'var(--color-complete-text)';
      case BadgeStatus.InProgress:
        return 'var(--color-inprogress-text)';
      case BadgeStatus.Blocked:
        return 'var(--color-blocked-text)';
      case BadgeStatus.Open:
      default:
        return 'var(--color-open-text)';
    }
  }

  onMarkerClick(event: MouseEvent): void {
    event.stopPropagation();
    this.toggle.emit(event.currentTarget as HTMLElement);
  }

  onFocus(event: MouseEvent, order: ScheduleOrder): void {
    event.stopPropagation();
    this.focusOrder.emit(order);
  }
}
