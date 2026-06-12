import { Injectable, computed, signal } from '@angular/core';

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
export class InteractionLayerService {
  private readonly activeOverlayId = signal<string | null>(null);

  readonly hasActiveOverlay = computed(() => this.activeOverlayId() !== null);
  readonly suppressBackgroundHover = this.hasActiveOverlay;
  readonly suppressTooltips = this.hasActiveOverlay;

  openOverlay(id: string): void {
    this.activeOverlayId.set(id);
  }

  closeOverlay(id?: string): void {
    if (!id || this.activeOverlayId() === id) {
      this.activeOverlayId.set(null);
    }
  }
}
