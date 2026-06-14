/**
 * Pure placement geometry for the schedule timeline — no DOM, no component
 * state. Given the active scale and timeline range, it maps work orders to
 * pixel coordinates (bars, compact markers, duration pills) and finds where a
 * new add-date pill can sit. Kept separate from ScheduleComponent so the maths
 * stay independently readable and unit-testable.
 */
import { Timescale } from '../timescale/timescale.component';
import {
  ScheduleRulerScale,
  dateToOffset,
  offsetRangeToDateRange,
  placeBar,
  placementSlotWidthFor,
} from '../schedule-ruler/schedule-ruler.component';
import { addDays, daysBetween, durationInDays, parseIsoDate, toIsoDate } from '../../utils/date-utils';
import type {
  CompactOrderGroup,
  CompactPlacedOrder,
  PlacedOrder,
  ScheduleOrder,
  WorkCenter,
} from './schedule.component';

/** A free span the add-date pill can occupy, in track pixels + ISO dates. */
export interface HoverPlacement {
  left: number;
  width: number;
  startDate: string;
  endDate: string;
}

/** Everything the placement maths derive from: the active scale + timeline range. */
export interface PlacementContext {
  scale: ScheduleRulerScale;
  timelineStartDate: string;
  timelineWidth: number;
}

// ── Cell widths ──────────────────────────────────────────────────────
const DAY_CELL_WIDTH = 200;
const WEEK_CELL_WIDTH = 150;
const MONTH_CELL_WIDTH = 114;

/** Pixel width of one ruler cell at the given scale. */
export function cellWidthFor(scale: ScheduleRulerScale): number {
  switch (scale) {
    case Timescale.Day:
      return DAY_CELL_WIDTH;
    case Timescale.Week:
      return WEEK_CELL_WIDTH;
    default:
      return MONTH_CELL_WIDTH;
  }
}

/** The add-date pill is always one cell wide before it snaps/fills. */
export function placementWidthFor(scale: ScheduleRulerScale): number {
  return cellWidthFor(scale);
}

// ── Bar placement ────────────────────────────────────────────────────

/** Resolve every work order to pixel coordinates, grouped by work-center id. */
export function placeOrdersByCenter(
  scale: ScheduleRulerScale,
  timelineStartDate: string,
  centers: readonly WorkCenter[],
  orders: readonly ScheduleOrder[],
): Record<string, PlacedOrder[]> {
  const map: Record<string, PlacedOrder[]> = {};
  for (const center of centers) {
    map[center.id] = [];
  }

  for (const order of orders) {
    const { left, width } = placeBar(scale, timelineStartDate, order.startDate, order.endDate);
    (map[order.workCenterId] ??= []).push({ ...order, left, width });
  }
  return map;
}

// ── Compact orders ───────────────────────────────────────────────────

/** Month-scale orders shorter than this render as pills instead of bars. */
const MONTH_COMPACT_MAX_DAYS = 45;
/** Week-scale orders this short can't fit a name beside the badge + menu. */
const WEEK_COMPACT_MAX_DAYS = 7;
/** Minimum pill width — a 1-day order stays the classic round dot. */
const COMPACT_PILL_MIN_WIDTH = 16;
const COMPACT_MARKER_SIZE = 16;

/**
 * A bar needs enough width to show its name beside the status badge and menu;
 * shorter orders become compact markers instead. The cutoff is ~1.5 cells
 * (~170px) in both scales: ~45 days at Month, and a week or less at Week,
 * where a one-cell (≤150px) bar leaves no room for the name.
 */
export function isCompactOrder(scale: ScheduleRulerScale, order: ScheduleOrder): boolean {
  const duration = durationInDays(order.startDate, order.endDate);
  return (scale === Timescale.Month && duration < MONTH_COMPACT_MAX_DAYS)
    || (scale === Timescale.Week && duration <= WEEK_COMPACT_MAX_DAYS);
}

/** Slot-centred left of a compact marker, clamped inside the track. */
export function compactMarkerLeft(scale: ScheduleRulerScale, timelineWidth: number, order: PlacedOrder): number {
  const markerLeft = order.left + placementSlotWidthFor(scale) / 2 - COMPACT_MARKER_SIZE / 2;
  return Math.min(Math.max(markerLeft, 0), Math.max(timelineWidth - COMPACT_MARKER_SIZE, 0));
}

/**
 * Duration-proportional pill for a lone compact order: a true miniature of the
 * real bar — anchored at the order's day-exact start, one day ≈ cell width ÷
 * days per cell.
 */
export function compactPillMetrics(
  scale: ScheduleRulerScale,
  timelineStartDate: string,
  timelineWidth: number,
  order: ScheduleOrder,
): { left: number; width: number } {
  const duration = durationInDays(order.startDate, order.endDate);
  const start = parseIsoDate(order.startDate);
  const timelineStart = parseIsoDate(timelineStartDate);
  const cellWidth = cellWidthFor(scale);

  let left: number;
  let dayWidth: number;

  if (scale === Timescale.Week) {
    dayWidth = cellWidth / 7;
    left = daysBetween(timelineStart, start) * dayWidth;
  } else {
    const months = (start.getFullYear() - timelineStart.getFullYear()) * 12 + start.getMonth() - timelineStart.getMonth();
    const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    dayWidth = cellWidth / daysInMonth;
    left = months * cellWidth + (start.getDate() - 1) * dayWidth;
  }

  const width = Math.max(duration * dayWidth, COMPACT_PILL_MIN_WIDTH);
  return {
    left: Math.min(Math.max(left, 0), Math.max(timelineWidth - width, 0)),
    width,
  };
}

/**
 * Group by placement slot (week cell, or quarter-month section) so the marker
 * always sits on the slot its orders actually occupy — a calendar month can
 * hold up to four separate markers.
 */
function compactGroupKey(scale: ScheduleRulerScale, order: CompactPlacedOrder): string {
  return `${Math.floor(order.left / placementSlotWidthFor(scale))}`;
}

/** Cluster compact orders by slot, producing dot stacks or lone duration pills. */
export function groupCompactOrders(
  scale: ScheduleRulerScale,
  timelineStartDate: string,
  timelineWidth: number,
  map: Record<string, CompactPlacedOrder[]>,
): Record<string, CompactOrderGroup[]> {
  const groupedByCenter: Record<string, CompactOrderGroup[]> = {};

  for (const [workCenterId, orders] of Object.entries(map)) {
    const groups = new Map<string, CompactPlacedOrder[]>();

    for (const order of orders) {
      const key = `${workCenterId}-${compactGroupKey(scale, order)}`;
      const group = groups.get(key) ?? [];
      group.push(order);
      groups.set(key, group);
    }

    groupedByCenter[workCenterId] = Array.from(groups.entries())
      .map(([id, groupOrders]) => {
        const sortedOrders = [...groupOrders].sort((a, b) => a.startDate.localeCompare(b.startDate));
        // A lone order renders as a duration pill anchored at its exact start;
        // clusters keep the slot-centred dot stack.
        const pill = sortedOrders.length === 1
          ? compactPillMetrics(scale, timelineStartDate, timelineWidth, sortedOrders[0])
          : null;
        return {
          id,
          workCenterId,
          markerLeft: pill ? pill.left : sortedOrders[0]?.markerLeft ?? 0,
          pillWidth: pill ? pill.width : null,
          orders: sortedOrders,
        };
      })
      .sort((a, b) => a.markerLeft - b.markerLeft);
  }

  return groupedByCenter;
}

// ── Add-date pill placement ──────────────────────────────────────────

/** The week add pill spans from a useful 3-day range up to one week. */
const WEEK_ADD_MIN_DAYS = 3;
const WEEK_ADD_MAX_DAYS = 7;
/** The month add pill spans at most this many week-sections (one month). */
const MONTH_ADD_MAX_SLOTS = 4;

/**
 * The nearest free span the add-date pill can occupy around cursor offset `x`,
 * or null when no usable gap exists. Day/Month snap to the cell/section grid;
 * Week works at day precision (see findAvailableWeekPlacement).
 */
export function findAvailablePlacement(
  ctx: PlacementContext,
  x: number,
  orders: PlacedOrder[],
): HoverPlacement | null {
  const { scale } = ctx;

  if (scale === Timescale.Week) {
    return findAvailableWeekPlacement(ctx, x, orders);
  }

  const width = placementWidthFor(scale);
  // The pill stays one cell wide, but its start snaps at slot granularity:
  // whole cells for Day/Week, quarter-month "week" sections for Month.
  const step = placementSlotWidthFor(scale);
  const maxLeft = Math.max(0, ctx.timelineWidth - width);
  const maxIndex = Math.floor(maxLeft / step);
  // Centre the pill on the cursor (snapped to the step grid). The candidate
  // search below shifts it sideways when a neighbouring order is in the way.
  const preferredIndex = Math.min(Math.max(0, Math.round((x - width / 2) / step)), maxIndex);
  const candidates = buildPlacementCandidateIndexes(preferredIndex, maxIndex);

  for (const index of candidates) {
    const left = index * step;
    const range = offsetRangeToDateRange(scale, ctx.timelineStartDate, left, width);
    if (scale === Timescale.Month) {
      const monthPlacement = findAvailableMonthPlacement(ctx, range.startDate, orders);
      if (monthPlacement) {
        return monthPlacement;
      }
      continue;
    }

    if (!overlapsAny(range.startDate, range.endDate, orders)) {
      return { left, width, ...range };
    }
  }

  return null;
}

/**
 * Week view renders compact orders at day precision, so the add pill must do
 * the same. It finds the nearest free day-run around the cursor, ignores tiny
 * 1-2 day gaps, then fills 3-7 days *centred on the cursor*. When a centred
 * pill would run into a neighbouring order it slides toward the free side,
 * still covering the hovered day.
 */
function findAvailableWeekPlacement(ctx: PlacementContext, x: number, orders: PlacedOrder[]): HoverPlacement | null {
  const dayWidth = cellWidthFor(ctx.scale) / 7;
  const timelineStart = parseIsoDate(ctx.timelineStartDate);
  const maxDay = Math.max(Math.ceil(ctx.timelineWidth / dayWidth) - 1, 0);
  const cursorDay = Math.min(Math.max(Math.floor(Math.max(0, x) / dayWidth), 0), maxDay);

  const occupied = new Set<number>();
  for (const order of orders) {
    const startDay = daysBetween(timelineStart, parseIsoDate(order.startDate));
    const endDay = daysBetween(timelineStart, parseIsoDate(order.endDate));
    for (let day = startDay; day <= endDay; day += 1) {
      occupied.add(day);
    }
  }

  for (const candidateDay of buildPlacementCandidateIndexes(cursorDay, maxDay)) {
    if (occupied.has(candidateDay)) {
      continue;
    }

    let runStart = candidateDay;
    while (runStart - 1 >= 0 && !occupied.has(runStart - 1)) {
      runStart -= 1;
    }

    let runEnd = candidateDay;
    while (runEnd + 1 <= maxDay && !occupied.has(runEnd + 1)) {
      runEnd += 1;
    }

    const runLength = runEnd - runStart + 1;
    if (runLength < WEEK_ADD_MIN_DAYS) {
      continue;
    }

    const span = Math.min(WEEK_ADD_MAX_DAYS, runLength);
    // Centre the pill on the cursor, then slide it inside the free run when an
    // order crowds one side.
    let startDay = candidateDay - Math.floor(span / 2);
    if (startDay + span - 1 > runEnd) {
      startDay = runEnd - span + 1;
    }
    if (startDay < runStart) {
      startDay = runStart;
    }

    const startDate = addDays(timelineStart, startDay);
    const endDate = addDays(startDate, span - 1);
    return {
      left: startDay * dayWidth,
      width: span * dayWidth,
      startDate: toIsoDate(startDate),
      endDate: toIsoDate(endDate),
    };
  }

  return null;
}

/**
 * Sizes the month "add" pill on the same week-section grid the work-order bars
 * snap to, so a pill placed in free sections can never visually overlap one. It
 * fills the contiguous free run around the cursor, capped at a full month (4
 * sections) and floored at a week (1 section); a full month is preferred,
 * pinning to the run's end and extending *backward* (still covering the cursor)
 * rather than shrinking. An occupied cursor section returns null so the
 * candidate search moves on.
 */
function findAvailableMonthPlacement(
  ctx: PlacementContext,
  preferredStartDate: string,
  orders: PlacedOrder[],
): HoverPlacement | null {
  const { scale } = ctx;
  const slot = placementSlotWidthFor(scale);
  const start = ctx.timelineStartDate;
  const slotOf = (dateIso: string) => Math.round(dateToOffset(scale, start, dateIso) / slot);

  const maxSlot = Math.round(ctx.timelineWidth / slot) - 1;
  const cursorSlot = slotOf(preferredStartDate);

  if (cursorSlot < 0 || cursorSlot > maxSlot) {
    return null;
  }

  // Sections covered by existing orders (bars span whole sections too).
  const occupied = new Set<number>();
  for (const order of orders) {
    for (let s = slotOf(order.startDate); s <= slotOf(order.endDate); s += 1) {
      occupied.add(s);
    }
  }

  if (occupied.has(cursorSlot)) {
    return null;
  }

  // Contiguous free run around the cursor's section.
  let runStart = cursorSlot;
  while (runStart - 1 >= 0 && !occupied.has(runStart - 1)) {
    runStart -= 1;
  }
  let runEnd = cursorSlot;
  while (runEnd + 1 <= maxSlot && !occupied.has(runEnd + 1)) {
    runEnd += 1;
  }

  // Prefer a full month; pin to the run end and extend backward when it can't
  // fit ahead, never spilling past the run's free start.
  const span = Math.min(MONTH_ADD_MAX_SLOTS, runEnd - runStart + 1);
  let winStart = cursorSlot;
  if (winStart + span - 1 > runEnd) {
    winStart = runEnd - span + 1;
  }
  if (winStart < runStart) {
    winStart = runStart;
  }

  const left = winStart * slot;
  const width = span * slot;
  const range = offsetRangeToDateRange(scale, start, left, width);
  return { left, width, ...range };
}

/** Slot indexes to try, fanning out from the cursor's preferred slot. */
function buildPlacementCandidateIndexes(preferredIndex: number, maxIndex: number): number[] {
  const indexes: number[] = [];
  for (let distance = 0; preferredIndex - distance >= 0 || preferredIndex + distance <= maxIndex; distance += 1) {
    const left = preferredIndex - distance;
    const right = preferredIndex + distance;
    if (left >= 0) indexes.push(left);
    if (distance > 0 && right <= maxIndex) indexes.push(right);
  }
  return indexes;
}

function overlapsAny(startDate: string, endDate: string, orders: PlacedOrder[]): boolean {
  return orders.some(order => startDate <= order.endDate && endDate >= order.startDate);
}
