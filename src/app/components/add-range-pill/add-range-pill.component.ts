import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Toolbar chip that previews the date range an add-date drag would create.
 * Re-runs its entry animation whenever `animationKey` changes so each new
 * highlighted range reads as a fresh value.
 */
@Component({
  selector: 'nao-add-range-pill',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="nao-add-range-pill">
      @for (_ of [animationKey()]; track _) {
        <span class="nao-add-range-pill__text">{{ text() }}</span>
      }
    </span>
  `,
  styleUrl: './add-range-pill.component.scss',
})
export class AddRangePillComponent {
  readonly text = input.required<string>();
  /** Bump to replay the text animation when the range changes. */
  readonly animationKey = input<number>(0);
}
