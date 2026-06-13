import { Injectable, computed, signal } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: number;
  message: string;
  type: NotificationType;
}

export interface NotificationOptions {
  durationMs?: number;
}

const DEFAULT_NOTIFICATION_DURATION_MS = 2200;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly notificationsState = signal<Notification[]>([]);
  private nextId = 1;

  readonly notifications = this.notificationsState.asReadonly();
  readonly hasNotifications = computed(() => this.notificationsState().length > 0);

  open(message: string, type: NotificationType = 'info', options: NotificationOptions = {}): number {
    const trimmed = message.trim();
    if (!trimmed) {
      return -1;
    }

    const id = this.nextId++;
    const notification: Notification = { id, message: trimmed, type };

    this.notificationsState.update(current => [...current, notification]);

    const durationMs = options.durationMs ?? DEFAULT_NOTIFICATION_DURATION_MS;
    if (durationMs > 0) {
      window.setTimeout(() => this.dismiss(id), durationMs);
    }

    return id;
  }

  dismiss(id: number): void {
    this.notificationsState.update(current => current.filter(notification => notification.id !== id));
  }

  clear(): void {
    this.notificationsState.set([]);
  }
}
