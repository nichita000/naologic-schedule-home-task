import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export enum ButtonVariant { Primary = 'primary', Secondary = 'secondary', Ghost = 'ghost' }
export enum ButtonSize    { Sm = 'sm', Md = 'md' }

@Component({
  selector: 'nao-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>(ButtonVariant.Primary);
  readonly size = input<ButtonSize>(ButtonSize.Md);
  readonly disabled = input<boolean>(false);
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly clicked = output<void>();
}
