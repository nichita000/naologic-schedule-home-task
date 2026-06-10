import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DropdownOption {
  value: string;
  label: string;
}

@Component({
  selector: 'nao-dropdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dropdown.component.html',
  styleUrl: './dropdown.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropdownComponent {
  readonly options = input<DropdownOption[]>([]);
  readonly placeholder = input<string>('Select…');
  readonly selected = input<DropdownOption | null>(null);
  readonly selectedChange = output<DropdownOption>();

  readonly open = signal(false);

  toggle(): void { this.open.update(v => !v); }
  close(): void  { this.open.set(false); }

  select(opt: DropdownOption): void {
    this.selectedChange.emit(opt);
    this.close();
  }
}
