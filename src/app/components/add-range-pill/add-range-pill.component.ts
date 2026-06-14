import { ChangeDetectionStrategy, Component, ElementRef, effect, input, viewChild } from '@angular/core';

/**
 * Toolbar chip that previews the date range an add-date drag would create.
 * Replays its entry animation whenever `animationKey` changes so each new
 * highlighted range reads as a fresh value — restarting the CSS animation in
 * place rather than recreating the node.
 */
@Component({
  selector: 'nao-add-range-pill',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="nao-add-range-pill">
      <span #label class="nao-add-range-pill__text">{{ text() }}</span>
    </span>
  `,
  styleUrl: './add-range-pill.component.scss',
})
export class AddRangePillComponent {
  readonly text = input.required<string>();
  /** Bump to replay the text animation when the range changes. */
  readonly animationKey = input<number>(0);

  private readonly label = viewChild<ElementRef<HTMLElement>>('label');

  constructor() {
    effect(() => {
      this.animationKey();
      const el = this.label()?.nativeElement;
      if (!el) {
        return;
      }
      // Restart the entry animation without recreating the node: drop the
      // class, force a reflow, then re-add it.
      el.classList.remove('nao-add-range-pill__text--pulse');
      void el.offsetWidth;
      el.classList.add('nao-add-range-pill__text--pulse');
    });
  }
}
