import { Component, effect, inject, input } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';
import { applicationConfig } from '@storybook/angular';
import { BadgeStatus } from '../../components/badge/badge.component';
import { ScheduleOrder, WorkCenter } from '../../components/schedule/schedule.component';
import { WORK_CENTERS, WORK_ORDERS } from '../../data/schedule-seed';
import { NotificationService, NotificationType } from '../../services/notification.service';
import { ScheduleStore } from '../../services/schedule.store';
import { SchedulePageComponent } from './schedule-page.component';

type NotificationStoryArgs = {
  message: string;
  type: NotificationType;
};

const workCenters: WorkCenter[] = WORK_CENTERS.map(doc => ({
  id: doc.docId,
  name: doc.data.name,
}));

const workOrders: ScheduleOrder[] = WORK_ORDERS.map(doc => ({
  id: doc.docId,
  name: doc.data.name,
  workCenterId: doc.data.workCenterId,
  status: doc.data.status as BadgeStatus,
  startDate: doc.data.startDate,
  endDate: doc.data.endDate,
}));

function createScheduleStoreStub() {
  let orders = [...workOrders];

  return {
    workCenters: () => workCenters,
    workOrders: () => orders,
    workOrdersById: () => new Map(orders.map(order => [order.id, order])),
    createWorkOrder: (value: Omit<ScheduleOrder, 'id'>) => {
      const created = { ...value, id: `story-${orders.length + 1}` };
      orders = [...orders, created];
      return created;
    },
    updateWorkOrder: (value: ScheduleOrder) => {
      orders = orders.map(order => order.id === value.id ? value : order);
    },
    deleteWorkOrder: (id: string) => {
      orders = orders.filter(order => order.id !== id);
    },
    loadWorkOrdersForYear: () => Promise.resolve(),
  };
}

@Component({
  selector: 'nao-schedule-page-notification-story',
  standalone: true,
  imports: [SchedulePageComponent],
  template: '<app-schedule-page />',
})
class SchedulePageNotificationStoryComponent {
  readonly message = input('Created "Trim Batch #4"');
  readonly type = input<NotificationType>('success');

  private readonly notifications = inject(NotificationService);

  constructor() {
    effect(() => {
      this.notifications.clear();
      this.notifications.open(this.message(), this.type(), { durationMs: 0 });
    });
  }
}

const meta: Meta<SchedulePageNotificationStoryComponent> = {
  title: 'Naologic/Schedule/Page',
  component: SchedulePageNotificationStoryComponent,
  tags: ['autodocs'],
  decorators: [
    applicationConfig({
      providers: [
        { provide: ScheduleStore, useFactory: createScheduleStoreStub },
      ],
    }),
  ],
  argTypes: {
    type: {
      control: 'select',
      options: ['success', 'error', 'info', 'warning'],
    },
  },
};

export default meta;
type Story = StoryObj<SchedulePageNotificationStoryComponent>;

export const Notification: Story = {
  args: {
    message: 'Created "Trim Batch #4"',
    type: 'success',
  },
};
