import { Directive, ElementRef, OnDestroy, OnInit, Renderer2, effect, inject, input } from '@angular/core';
import { InteractionLayerService } from '../../services/interaction-layer.service';

export type TooltipPosition =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left';

interface TooltipRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

interface TooltipViewport {
  width: number;
  height: number;
}

interface TooltipPadding {
  left: number;
  right: number;
}

const TOOLTIP_MARGIN = 8;
const TOOLTIP_OFFSET = 8;

export function calculateTooltipPosition(
  position: TooltipPosition,
  host: TooltipRect,
  tip: TooltipRect,
  viewport: TooltipViewport,
  padding: TooltipPadding,
): { left: number; top: number } {
  let left = host.left;
  let top = host.top;

  switch (position) {
    case 'top-left':
      left = host.left - padding.left;
      top = host.top - tip.height - TOOLTIP_OFFSET;
      break;
    case 'top':
      left = host.left + host.width / 2 - tip.width / 2;
      top = host.top - tip.height - TOOLTIP_OFFSET;
      break;
    case 'top-right':
      left = host.right - tip.width + padding.right;
      top = host.top - tip.height - TOOLTIP_OFFSET;
      break;
    case 'right':
      left = host.right + TOOLTIP_OFFSET;
      top = host.top + host.height / 2 - tip.height / 2;
      break;
    case 'bottom-right':
      left = host.right - tip.width + padding.right;
      top = host.bottom + TOOLTIP_OFFSET;
      break;
    case 'bottom':
      left = host.left + host.width / 2 - tip.width / 2;
      top = host.bottom + TOOLTIP_OFFSET;
      break;
    case 'bottom-left':
      left = host.left - padding.left;
      top = host.bottom + TOOLTIP_OFFSET;
      break;
    case 'left':
      left = host.left - tip.width - TOOLTIP_OFFSET;
      top = host.top + host.height / 2 - tip.height / 2;
      break;
  }

  const maxLeft = viewport.width - tip.width - TOOLTIP_MARGIN;
  const maxTop = viewport.height - tip.height - TOOLTIP_MARGIN;

  return {
    left: Math.round(Math.max(TOOLTIP_MARGIN, Math.min(left, maxLeft))),
    top: Math.round(Math.max(TOOLTIP_MARGIN, Math.min(top, maxTop))),
  };
}

/**
 * Shows a styled tooltip (the design-system `.nao-tooltip`) on hover.
 *
 * Usage: `<span class="..." [naoTooltip]="name()">{{ name() }}</span>`
 */
@Directive({
  selector: '[naoTooltip]',
  standalone: true,
})
export class TooltipDirective implements OnInit, OnDestroy {
  /** Tooltip text. */
  readonly text = input<string>('', { alias: 'naoTooltip' });
  /** Tooltip placement relative to the host. */
  readonly position = input<TooltipPosition>('top-left', { alias: 'naoTooltipPosition' });
  /** Delay in ms before the tooltip appears on hover (default 0 = instant). */
  readonly debounceMs = input<number>(0, { alias: 'naoTooltipDebounce' });

  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly interactionLayer = inject(InteractionLayerService, { optional: true });

  private tip: HTMLElement | null = null;
  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private cleanup: Array<() => void> = [];

  constructor() {
    effect(() => {
      if (this.interactionLayer?.suppressTooltips()) {
        this.cancel();
      }
    });
  }

  ngOnInit(): void {
    const el = this.hostRef.nativeElement;
    this.cleanup.push(this.renderer.listen(el, 'mouseenter', () => this.scheduleShow()));
    this.cleanup.push(this.renderer.listen(el, 'focusin', () => this.scheduleShow()));
    this.cleanup.push(this.renderer.listen(el, 'mouseleave', () => this.cancel()));
    this.cleanup.push(this.renderer.listen(el, 'focusout', () => this.cancel()));
  }

  ngOnDestroy(): void {
    this.cleanup.forEach((fn) => fn());
    this.cancel();
  }

  /** Show after the configured debounce; a 0 delay shows immediately. */
  private scheduleShow(): void {
    if (this.interactionLayer?.suppressTooltips()) {
      return;
    }

    const delay = this.debounceMs();
    if (delay <= 0) {
      this.show();
      return;
    }
    this.clearTimer();
    this.showTimer = setTimeout(() => {
      this.showTimer = null;
      this.show();
    }, delay);
  }

  private cancel(): void {
    this.clearTimer();
    this.hide();
  }

  private clearTimer(): void {
    if (this.showTimer !== null) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
  }

  private show(): void {
    const el = this.hostRef.nativeElement;
    const label = this.text();
    if (this.interactionLayer?.suppressTooltips()) return;
    if (!label || this.tip) return;

    const tip = this.renderer.createElement('div') as HTMLElement;
    tip.className = 'nao-tooltip';
    tip.textContent = label;
    this.renderer.setAttribute(tip, 'role', 'tooltip');
    this.renderer.setStyle(tip, 'position', 'fixed');
    this.renderer.setStyle(tip, 'opacity', '0');
    this.renderer.appendChild(document.body, tip);

    const host = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const tipStyles = window.getComputedStyle(tip);
    const { left, top } = calculateTooltipPosition(
      this.position(),
      host,
      t,
      { width: window.innerWidth, height: window.innerHeight },
      {
        left: parseFloat(tipStyles.paddingLeft) || 0,
        right: parseFloat(tipStyles.paddingRight) || 0,
      },
    );

    this.renderer.setStyle(tip, 'left', `${left}px`);
    this.renderer.setStyle(tip, 'top', `${top}px`);
    this.renderer.setStyle(tip, 'opacity', '1');

    this.tip = tip;
  }

  private hide(): void {
    if (this.tip) {
      this.tip.remove();
      this.tip = null;
    }
  }
}
