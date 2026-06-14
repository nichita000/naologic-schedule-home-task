import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Notification } from '../../services/notification.service';

/**
 * Toolbar chip for a transient notification: a status-coloured dot, the
 * message, and a dismiss button. The type→colour mapping lives here so the
 * page doesn't have to spread it across template classes.
 */
@Component({
  selector: 'nao-toolbar-alert',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="nao-toolbar-alert"
      [class]="'nao-toolbar-alert--' + notification().type"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      @for (_ of [notification().id]; track _) {
        <span class="nao-toolbar-alert__message">
          <span class="nao-toolbar-alert__dot" aria-hidden="true"></span>
          {{ notification().message }}
        </span>
      }
      <button
        class="nao-toolbar-alert__dismiss"
        type="button"
        aria-label="Dismiss notification"
        (click)="dismiss.emit(notification().id)"
      >
        ×
      </button>
    </span>
  `,
  styleUrl: './toolbar-alert.component.scss',
})
export class ToolbarAlertComponent {
  readonly notification = input.required<Notification>();
  readonly dismiss = output<number>();
}
