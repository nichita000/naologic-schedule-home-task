import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export enum IconButtonVariant { Dismiss = 'dismiss', Subtle = 'subtle' }

@Component({
  selector: 'nao-icon-button',
  standalone: true,
  templateUrl: './icon-button.component.html',
  styleUrl: './icon-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconButtonComponent {
  readonly variant = input<IconButtonVariant>(IconButtonVariant.Subtle);
  readonly label = input<string>('');
  readonly clicked = output<void>();
}
