import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, effect, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  buildRulerCells,
  findCurrentCellLeft,
  ScheduleRulerComponent,
  ScheduleRulerScale,
} from '../schedule-ruler/schedule-ruler.component';
import { Timescale } from '../timescale/timescale.component';
import { BadgeStatus } from '../badge/badge.component';

export interface WorkCenter {
  id: string;
  name: string;
}

export interface ScheduleOrder {
  id: string;
  name: string;
  workCenterId: string;
  status: BadgeStatus;
  startDate: string;
  endDate: string;
}

@Component({
  selector: 'nao-schedule',
  standalone: true,
  imports: [CommonModule, ScheduleRulerComponent],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleComponent implements AfterViewInit {
  @ViewChild('timelineScroll') private readonly timelineScroll?: ElementRef<HTMLElement>;

  readonly workCenters = input<WorkCenter[]>([]);
  readonly scale = input<Timescale>(Timescale.Month);
  readonly timelineStartDate = input.required<string>();
  readonly timelineEndDate = input.required<string>();
  readonly currentDate = input<string | null>(null);

  readonly hoveredRowId = signal<string | null>(null);
  private readonly viewReady = signal(false);

  readonly rulerScale = computed<ScheduleRulerScale>(() => {
    const scale = this.scale();
    return scale === Timescale.Hour ? Timescale.Month : scale;
  });

  readonly timelineCells = computed(() =>
    buildRulerCells(this.rulerScale(), this.timelineStartDate(), this.timelineEndDate())
  );

  readonly timelineWidth = computed(() =>
    this.timelineCells().reduce((sum, cell) => sum + cell.width, 0)
  );

  readonly currentMarker = computed<{ left: number; label: string } | null>(() => {
    const left = findCurrentCellLeft(
      this.rulerScale(),
      this.timelineStartDate(),
      this.timelineEndDate(),
      this.today()
    );

    if (left === null) {
      return null;
    }

    const scale = this.rulerScale();
    const label =
      scale === Timescale.Day ? 'Current day' : scale === Timescale.Week ? 'Current week' : 'Current month';
    return { left, label };
  });

  constructor() {
    effect(() => {
      this.viewReady();
      this.rulerScale();
      this.timelineStartDate();
      this.timelineEndDate();
      this.currentDate();
      this.timelineWidth();

      if (!this.viewReady()) {
        return;
      }

      queueMicrotask(() => this.scrollToCurrentPeriodLeadIn());
    });
  }

  ngAfterViewInit(): void {
    this.viewReady.set(true);
  }

  setHoveredRow(id: string | null): void {
    this.hoveredRowId.set(id);
  }

  private today(): Date {
    const value = this.currentDate();
    return value ? new Date(value) : new Date();
  }

  private scrollToCurrentPeriodLeadIn(): void {
    const element = this.timelineScroll?.nativeElement;
    const marker = this.currentMarker();

    if (!element || !marker) {
      return;
    }

    element.scrollLeft = Math.max(marker.left - this.cellWidth(), 0);
  }

  private cellWidth(): number {
    switch (this.rulerScale()) {
      case Timescale.Day:
        return 64;
      case Timescale.Week:
        return 150;
      default:
        return 114;
    }
  }
}
