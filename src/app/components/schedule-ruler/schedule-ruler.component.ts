import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Timescale } from '../timescale/timescale.component';

export type ScheduleRulerScale = Exclude<Timescale, Timescale.Hour>;

interface RulerCell {
  key: string;
  label: string;
  width: number;
  left: number;
}

@Component({
  selector: 'nao-schedule-ruler',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './schedule-ruler.component.html',
  styleUrl: './schedule-ruler.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleRulerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('scrollport') private readonly scrollport?: ElementRef<HTMLElement>;

  readonly scale = input<ScheduleRulerScale>(Timescale.Month);
  readonly startDate = input<string>('2024-08-01');
  readonly endDate = input<string>('2027-12-31');
  readonly scrollable = input<boolean>(true);
  readonly viewportWidth = input<number>(914);

  readonly cells = computed(() => buildRulerCells(this.scale(), this.startDate(), this.endDate()));
  readonly totalWidth = computed(() => this.cells().reduce((sum, cell) => sum + cell.width, 0));
  readonly scrollLeft = signal(0);
  readonly measuredViewportWidth = signal(0);
  private resizeObserver?: ResizeObserver;

  readonly visibleCells = computed(() => {
    if (!this.scrollable()) {
      return this.cells();
    }

    const overscan = 2;
    const left = this.scrollLeft();
    const right = left + (this.measuredViewportWidth() || this.viewportWidth());

    return this.cells().filter(cell => {
      const cellRight = cell.left + cell.width;
      return cellRight >= left - cell.width * overscan && cell.left <= right + cell.width * overscan;
    });
  });

  onScroll(event: Event): void {
    this.scrollLeft.set((event.target as HTMLElement).scrollLeft);
  }

  ngAfterViewInit(): void {
    const element = this.scrollport?.nativeElement;

    if (!element) {
      return;
    }

    this.measuredViewportWidth.set(element.clientWidth);

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver = new ResizeObserver(([entry]) => {
      this.measuredViewportWidth.set(entry.contentRect.width);
    });
    this.resizeObserver.observe(element);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }
}

export function buildRulerCells(scale: ScheduleRulerScale, startDate: string, endDate: string): RulerCell[] {
  const start = startOfDay(parseDate(startDate));
  const end = startOfDay(parseDate(endDate));

  if (end < start) {
    return [];
  }

  switch (scale) {
    case Timescale.Day:
      return buildDayCells(start, end);
    case Timescale.Week:
      return buildWeekCells(start, end);
    case Timescale.Month:
    default:
      return buildMonthCells(start, end);
  }
}

/** Pixel offset of the cell that contains `current`, or null if out of range. */
export function findCurrentCellLeft(
  scale: ScheduleRulerScale,
  startDate: string,
  endDate: string,
  current: Date,
): number | null {
  const start = startOfDay(parseDate(startDate));
  const end = startOfDay(parseDate(endDate));
  const now = startOfDay(current);

  if (now < start || now > end) {
    return null;
  }

  const DAY_MS = 86_400_000;

  switch (scale) {
    case Timescale.Day:
      return Math.round((now.getTime() - start.getTime()) / DAY_MS) * 64;
    case Timescale.Week:
      return Math.round((startOfWeek(now).getTime() - startOfWeek(start).getTime()) / (7 * DAY_MS)) * 150;
    case Timescale.Month:
    default:
      return ((now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth()) * 114;
  }
}

/** ISO date one slot before the period containing `current` (for the timeline start). */
export function timelineStartBefore(scale: ScheduleRulerScale, current: Date): string {
  const now = startOfDay(current);

  switch (scale) {
    case Timescale.Day:
      return toIsoDate(addDays(now, -1));
    case Timescale.Week:
      return toIsoDate(addDays(startOfWeek(now), -7));
    case Timescale.Month:
    default:
      return toIsoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  }
}

/** Each month is divided into this many equal placement sections ("weeks"). */
const MONTH_SECTIONS = 4;
const MONTH_SECTION_WIDTH = 114 / MONTH_SECTIONS;

/** Pixel width of one placement slot for the given scale. */
export function placementSlotWidthFor(scale: ScheduleRulerScale): number {
  switch (scale) {
    case Timescale.Day:
      return 64;
    case Timescale.Week:
      return 150;
    case Timescale.Month:
    default:
      return MONTH_SECTION_WIDTH;
  }
}

/**
 * Snaps a free pixel offset to a valid placement slot for the given scale:
 * Month → one of 4 equal sections inside the month, Week / Day → the whole cell.
 */
export function snapPlacementLeft(scale: ScheduleRulerScale, _startDate: string, left: number): number {
  const slot = placementSlotWidthFor(scale);
  return Math.floor(Math.max(0, left) / slot) * slot;
}

/** Snaps to the nearest placement slot; better for hover previews around a cursor. */
export function snapPreviewLeft(scale: ScheduleRulerScale, left: number): number {
  const slot = placementSlotWidthFor(scale);
  return Math.round(Math.max(0, left) / slot) * slot;
}

/** Pixel offset of the slot that contains `date` (Month → section, Week/Day → cell). */
export function dateToOffset(scale: ScheduleRulerScale, startDate: string, dateIso: string): number {
  const start = startOfDay(parseDate(startDate));
  const date = startOfDay(parseDate(dateIso));
  const DAY_MS = 86_400_000;

  switch (scale) {
    case Timescale.Day:
      return Math.floor((date.getTime() - start.getTime()) / DAY_MS) * 64;

    case Timescale.Week:
      return Math.floor((date.getTime() - startOfWeek(start).getTime()) / (7 * DAY_MS)) * 150;

    case Timescale.Month:
    default: {
      const months = (date.getFullYear() - start.getFullYear()) * 12 + date.getMonth() - start.getMonth();
      // Day 1-7 → section 0, 8-14 → 1, 15-21 → 2, 22+ → 3.
      const section = Math.min(Math.floor((date.getDate() - 1) / 7), MONTH_SECTIONS - 1);
      return months * 114 + section * MONTH_SECTION_WIDTH;
    }
  }
}

/** Inclusive date range represented by a placement slot at `left`. */
export function offsetToDateRange(
  scale: ScheduleRulerScale,
  startDate: string,
  left: number,
): { startDate: string; endDate: string } {
  return slotToDateRange(scale, startDate, Math.max(0, Math.floor(left / slotWidthFor(scale))));
}

/** Inclusive date range represented by a visual placement span. */
export function offsetRangeToDateRange(
  scale: ScheduleRulerScale,
  startDate: string,
  left: number,
  width: number,
): { startDate: string; endDate: string } {
  const slotWidth = slotWidthFor(scale);
  const startSlot = Math.max(0, Math.floor(left / slotWidth));
  const endSlot = Math.max(startSlot, Math.floor((left + width - 0.001) / slotWidth));
  const startRange = slotToDateRange(scale, startDate, startSlot);
  const endRange = slotToDateRange(scale, startDate, endSlot);

  return { startDate: startRange.startDate, endDate: endRange.endDate };
}

function slotToDateRange(
  scale: ScheduleRulerScale,
  startDate: string,
  slot: number,
): { startDate: string; endDate: string } {
  const start = startOfDay(parseDate(startDate));

  switch (scale) {
    case Timescale.Day: {
      const date = addDays(start, slot);
      return { startDate: toIsoDate(date), endDate: toIsoDate(date) };
    }

    case Timescale.Week: {
      const date = addDays(startOfWeek(start), slot * 7);
      return { startDate: toIsoDate(date), endDate: toIsoDate(addDays(date, 6)) };
    }

    case Timescale.Month:
    default: {
      const monthIndex = Math.floor(slot / MONTH_SECTIONS);
      const section = slot % MONTH_SECTIONS;
      const date = new Date(start.getFullYear(), start.getMonth() + monthIndex, section * 7 + 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      const end = section === MONTH_SECTIONS - 1 ? monthEnd : addDays(date, 6);
      return { startDate: toIsoDate(date), endDate: toIsoDate(end) };
    }
  }
}

/**
 * Left/width of a work-order bar. Both ends snap to whole slots, and the end
 * date is inclusive — the bar covers the slot its end date falls in.
 */
export function placeBar(
  scale: ScheduleRulerScale,
  startDate: string,
  orderStart: string,
  orderEnd: string,
): { left: number; width: number } {
  const left = dateToOffset(scale, startDate, orderStart);
  const endLeft = dateToOffset(scale, startDate, orderEnd);
  const slot = slotWidthFor(scale);
  return { left, width: Math.max(endLeft - left + slot, slot) };
}

function slotWidthFor(scale: ScheduleRulerScale): number {
  return placementSlotWidthFor(scale);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildMonthCells(start: Date, end: Date): RulerCell[] {
  const cells: RulerCell[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  let left = 0;

  while (cursor <= end) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();

    cells.push({
      key: `${year}-${month}`,
      label: `${cursor.toLocaleString('en-US', { month: 'short' })} ${year}`,
      width: 114,
      left,
    });

    left += 114;
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return cells;
}

function buildWeekCells(start: Date, end: Date): RulerCell[] {
  const cells: RulerCell[] = [];
  const cursor = startOfWeek(start);
  let left = 0;

  while (cursor <= end) {
    const weekEnd = addDays(cursor, 6);

    cells.push({
      key: cursor.toISOString(),
      label: formatWeekRange(cursor, weekEnd),
      width: 150,
      left,
    });

    left += 150;
    cursor.setDate(cursor.getDate() + 7);
  }

  return cells;
}

function buildDayCells(start: Date, end: Date): RulerCell[] {
  const cells: RulerCell[] = [];
  const cursor = new Date(start);
  let left = 0;

  while (cursor <= end) {
    cells.push({
      key: cursor.toISOString(),
      label: `${cursor.toLocaleString('en-US', { month: 'short' })} ${cursor.getDate()}`,
      width: 64,
      left,
    });

    left += 64;
    cursor.setDate(cursor.getDate() + 1);
  }

  return cells;
}

function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  const result = startOfDay(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatWeekRange(start: Date, end: Date): string {
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = start.toLocaleString('en-US', { month: 'short' });
  const endMonth = end.toLocaleString('en-US', { month: 'short' });
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  if (startMonth === endMonth && startYear === endYear) {
    return `${startDay}-${endDay} ${startMonth} ${startYear}`;
  }

  if (startYear === endYear) {
    return `${startDay} ${startMonth}-${endDay} ${endMonth} ${startYear}`;
  }

  return `${startDay} ${startMonth} ${startYear}-${endDay} ${endMonth} ${endYear}`;
}
