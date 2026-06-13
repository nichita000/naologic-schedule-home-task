import { Injectable, OnDestroy, computed, signal } from '@angular/core';

/**
 * Scoped interaction coordinator for overlay-heavy UI sections.
 *
 * The schedule has several hover-driven affordances: row highlight, add-date
 * previews, compact-marker tooltips, and work-order menu reveals. When a
 * popover/dialog is open, those background interactions should pause so the
 * user's attention stays inside the active overlay.
 *
 * Provide this service at the feature/component level (not root) when a local
 * subtree needs that coordination. Consumers can inject it optionally, so
 * reusable directives like `TooltipDirective` keep working normally outside a
 * coordinated subtree.
 */
@Injectable()
export class InteractionLayerService implements OnDestroy {
  private readonly activeOverlayId = signal<string | null>(null);
  private readonly scrolling = signal(false);
  private scrollTimer: ReturnType<typeof setTimeout> | null = null;

  readonly hasActiveOverlay = computed(() => this.activeOverlayId() !== null);
  readonly isScrolling = computed(() => this.scrolling());
  readonly suppressBackgroundHover = this.hasActiveOverlay;
  readonly suppressTooltips = computed(() => this.hasActiveOverlay() || this.isScrolling());

  openOverlay(id: string): void {
    this.activeOverlayId.set(id);
  }

  closeOverlay(id?: string): void {
    if (!id || this.activeOverlayId() === id) {
      this.activeOverlayId.set(null);
    }
  }

  /**
   * Temporarily hides tooltips while a scrollable surface is moving. Tooltip
   * anchors can be hundreds of pixels wide or virtualized during schedule
   * scrolling; cancelling them for a short idle window avoids stale floating
   * labels that appear detached from the cursor.
   */
  suppressTooltipsForScroll(durationMs = 160): void {
    this.scrolling.set(true);

    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
    }

    this.scrollTimer = setTimeout(() => {
      this.scrollTimer = null;
      this.scrolling.set(false);
    }, durationMs);
  }

  ngOnDestroy(): void {
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
      this.scrollTimer = null;
    }
  }
}
