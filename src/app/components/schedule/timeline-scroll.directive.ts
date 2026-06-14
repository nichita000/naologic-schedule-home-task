import {
  AfterViewInit,
  Directive,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { InteractionLayerService } from '../../services/interaction-layer.service';

/** Pixel target for a focus scroll, plus the order to pulse once it settles. */
export interface FocusTarget {
  left: number;
  orderId: string | null;
}

/**
 * Owns the horizontal scroll mechanics of the timeline scrollport: it tracks
 * scroll position (with a momentum rAF that survives fast flings), measures the
 * viewport, requests range extensions near either edge, preserves position when
 * the range is prepended, and runs the teleport-then-glide focus scroll. The
 * host component reads `scrollLeft`/`viewportWidth` to drive virtualisation and
 * `visibleFocusedOrderId` to pulse the focused bar.
 */
@Directive({
  selector: '[naoTimelineScroll]',
  standalone: true,
  host: {
    '(scroll)': 'onScroll()',
  },
})
export class TimelineScrollDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly interactionLayer = inject(InteractionLayerService, { optional: true });

  /** One ruler cell wide; feeds the edge-extension threshold. */
  readonly cellWidth = input.required<number>();
  readonly timelineWidth = input.required<number>();
  readonly timelineStartDate = input.required<string>();
  readonly timelineEndDate = input.required<string>();
  readonly loadingSide = input<'start' | 'end' | null>(null);
  /** Where to focus-scroll, recomputed by the host; null means "no focus". */
  readonly focusTarget = input<FocusTarget | null>(null);
  /** Dedupe key: a focus scroll runs only when this changes. */
  readonly focusKey = input<string>('');
  /** Lead-in position (current period) used when there is no focus target. */
  readonly leadInTarget = input<number | null>(null);
  readonly leadInKey = input<string>('');

  readonly edgeReached = output<'start' | 'end'>();

  readonly scrollLeft = signal(0);
  readonly viewportWidth = signal(0);
  readonly visibleFocusedOrderId = signal<string | null>(null);

  private readonly viewReady = signal(false);
  private resizeObserver?: ResizeObserver;
  private momentumRafId: number | null = null;
  private lastTrackedScrollLeft = 0;
  private lastEdgeRequestKey: string | null = null;
  private lastFocusKey: string | null = null;
  private lastLeadInKey: string | null = null;
  private previousTimelineStartDate: string | null = null;
  private previousTimelineWidth: number | null = null;
  private focusSettleTimer: ReturnType<typeof setTimeout> | null = null;
  private cleanupFocusScroll: (() => void) | null = null;
  /**
   * Set for one microtask after a focus scroll starts. A range prepend in the
   * same tick must not apply scroll preservation then: the focus target is
   * already in the new coordinate space, and an instant write would abort the
   * in-flight smooth scroll.
   */
  private suppressScrollPreservation = false;

  /**
   * Focus targets farther than this many viewports teleport to the approach
   * side and smooth-scroll only the final stretch. Viewports, not years: two
   * screens of glide feels identical at any zoom and stays inside the rendered
   * window.
   */
  private static readonly FOCUS_GLIDE_VIEWPORTS = 2;

  constructor() {
    // Scroll to the focus target (or the current-period lead-in) once ready.
    effect(() => {
      const focusTarget = this.focusTarget();
      const focusKey = this.focusKey();
      const leadInTarget = this.leadInTarget();
      const leadInKey = this.leadInKey();

      if (!this.viewReady()) {
        return;
      }

      queueMicrotask(() => {
        if (focusTarget) {
          if (focusKey !== this.lastFocusKey) {
            this.lastFocusKey = focusKey;
            this.scrollToFocus(focusTarget);
          }
          return;
        }

        if (leadInTarget !== null && leadInKey !== this.lastLeadInKey) {
          this.lastLeadInKey = leadInKey;
          this.scrollToLeadIn(leadInTarget);
        }
      });
    });

    // Preserve the scroll position when the range grows at the start.
    effect(() => {
      const startDate = this.timelineStartDate();
      const width = this.timelineWidth();
      const ready = this.viewReady();

      const previousStartDate = this.previousTimelineStartDate;
      const previousWidth = this.previousTimelineWidth;
      this.previousTimelineStartDate = startDate;
      this.previousTimelineWidth = width;

      if (!ready || !previousStartDate || previousWidth === null || startDate >= previousStartDate) {
        return;
      }

      // Width delta of the actual cell grid, not a date conversion: week cells
      // align to startOfWeek, so a date conversion can be off by one cell.
      const addedWidth = width - previousWidth;
      queueMicrotask(() => this.preserveScrollAfterPrependedRange(addedWidth));
    });

    // Re-arm edge requests when a load cycle ends without changing the range.
    effect(() => {
      if (!this.loadingSide()) {
        this.lastEdgeRequestKey = null;
      }
    });
  }

  ngAfterViewInit(): void {
    const element = this.host.nativeElement;
    this.viewportWidth.set(element.clientWidth);
    this.viewReady.set(true);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(([entry]) => this.viewportWidth.set(entry.contentRect.width));
      this.resizeObserver.observe(element);
    }
  }

  ngOnDestroy(): void {
    this.cancelPendingFocusAnimation();
    this.resizeObserver?.disconnect();
    if (this.momentumRafId !== null) {
      cancelAnimationFrame(this.momentumRafId);
      this.momentumRafId = null;
    }
  }

  onScroll(): void {
    const element = this.host.nativeElement;
    this.interactionLayer?.suppressTooltipsForScroll();
    this.syncScrollLeft(element);
    this.requestRangeExtensionIfNeeded(element);
    this.trackMomentum(element);
  }

  private syncScrollLeft(element: HTMLElement): void {
    this.lastTrackedScrollLeft = element.scrollLeft;
    this.scrollLeft.set(element.scrollLeft);
  }

  /**
   * Scroll events lag behind the compositor during a fast fling (and can be
   * starved while the main thread is busy), letting the visual position outrun
   * the render window. This per-frame tracker reads the real scrollLeft until
   * it stops changing, so the window stays glued to what the user sees.
   */
  private trackMomentum(element: HTMLElement): void {
    if (this.momentumRafId !== null || typeof requestAnimationFrame === 'undefined') {
      return;
    }

    let idleFrames = 0;

    const tick = () => {
      if (element.scrollLeft !== this.lastTrackedScrollLeft) {
        idleFrames = 0;
        this.syncScrollLeft(element);
      } else if (++idleFrames >= 3) {
        this.momentumRafId = null;
        return;
      }

      this.momentumRafId = requestAnimationFrame(tick);
    };

    this.momentumRafId = requestAnimationFrame(tick);
  }

  private requestRangeExtensionIfNeeded(element: HTMLElement): void {
    if (this.loadingSide()) {
      return;
    }

    const maxScrollLeft = Math.max(element.scrollWidth - element.clientWidth, 0);
    const distanceToEnd = maxScrollLeft - element.scrollLeft;
    const threshold = Math.max(element.clientWidth * 1.5, this.cellWidth() * 4);

    const side =
      element.scrollLeft <= threshold ? 'start' :
        distanceToEnd <= threshold ? 'end' :
          null;

    if (!side) {
      return;
    }

    const requestKey = `${side}:${this.timelineStartDate()}:${this.timelineEndDate()}`;
    if (requestKey === this.lastEdgeRequestKey) {
      return;
    }

    this.lastEdgeRequestKey = requestKey;
    this.edgeReached.emit(side);
  }

  private preserveScrollAfterPrependedRange(addedWidth: number): void {
    if (addedWidth <= 0 || this.suppressScrollPreservation) {
      return;
    }

    const element = this.host.nativeElement;
    element.scrollLeft += addedWidth;
    this.syncScrollLeft(element);
  }

  private scrollToLeadIn(target: number): void {
    const element = this.host.nativeElement;
    element.scrollLeft = target;
    // Programmatic jumps move the render window immediately; waiting for the
    // scroll event would leave the landing area unrendered for a frame.
    this.scrollLeft.set(target);
  }

  private scrollToFocus(focus: FocusTarget): void {
    const element = this.host.nativeElement;
    this.visibleFocusedOrderId.set(null);
    this.cancelPendingFocusAnimation();

    const target = focus.left;
    const glideDistance = element.clientWidth * TimelineScrollDirective.FOCUS_GLIDE_VIEWPORTS;
    const offset = target - element.scrollLeft;

    if (Math.abs(offset) > glideDistance) {
      // Distant target: teleport to the approach side first, then glide the
      // final stretch — a smooth scroll across years gets compressed into an
      // unreadable blur, while a short glide reads as "arriving at the order".
      element.scrollLeft = target - Math.sign(offset) * glideDistance;
      this.syncScrollLeft(element);
    }

    element.scrollTo({ left: target, behavior: 'smooth' });
    // Render the destination right away so the glide lands on painted content.
    this.scrollLeft.set(target);

    this.suppressScrollPreservation = true;
    queueMicrotask(() => {
      this.suppressScrollPreservation = false;
    });

    if (focus.orderId) {
      const orderId = focus.orderId;
      this.runAfterScrollSettles(element, () => this.visibleFocusedOrderId.set(orderId));
    }
  }

  private runAfterScrollSettles(element: HTMLElement, callback: () => void): void {
    const finish = () => {
      this.cancelPendingFocusAnimation();
      callback();
    };

    const scheduleFinish = () => {
      if (this.focusSettleTimer) {
        clearTimeout(this.focusSettleTimer);
      }
      this.focusSettleTimer = setTimeout(finish, 120);
    };

    element.addEventListener('scroll', scheduleFinish, { passive: true });
    this.cleanupFocusScroll = () => element.removeEventListener('scroll', scheduleFinish);

    // If the target is already visible and no scroll event fires, still replay
    // the focus pulse after a short beat.
    scheduleFinish();
  }

  private cancelPendingFocusAnimation(): void {
    if (this.focusSettleTimer) {
      clearTimeout(this.focusSettleTimer);
      this.focusSettleTimer = null;
    }
    this.cleanupFocusScroll?.();
    this.cleanupFocusScroll = null;
  }
}
