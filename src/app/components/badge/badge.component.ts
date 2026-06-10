import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export enum BadgeStatus {
  Complete = 'complete',
  InProgress = 'in-progress',
  Blocked = 'blocked',
  Open = 'open',
}

const BADGE_LABELS: Record<BadgeStatus, string> = {
  [BadgeStatus.Complete]: 'Complete',
  [BadgeStatus.InProgress]: 'In progress',
  [BadgeStatus.Blocked]: 'Blocked',
  [BadgeStatus.Open]: 'Open',
};

@Component({
  selector: 'nao-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './badge.component.html',
  styleUrl: './badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeComponent {
  readonly status = input.required<BadgeStatus>();
  readonly label = input<string | null>(null);

  get displayLabel(): string {
    return this.label() ?? BADGE_LABELS[this.status()];
  }
}
