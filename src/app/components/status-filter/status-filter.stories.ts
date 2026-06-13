import type { Meta, StoryObj } from '@storybook/angular';
import { BadgeStatus } from '../badge/badge.component';
import { StatusFilterComponent, StatusFilterValue } from './status-filter.component';

const statusOptions: StatusFilterValue[] = [
  'all',
  BadgeStatus.Open,
  BadgeStatus.InProgress,
  BadgeStatus.Complete,
  BadgeStatus.Blocked,
];

const meta: Meta<StatusFilterComponent> = {
  title: 'Naologic/Schedule/StatusFilter',
  component: StatusFilterComponent,
  tags: ['autodocs'],
  argTypes: {
    value: { control: 'select', options: statusOptions },
  },
};
export default meta;
type Story = StoryObj<StatusFilterComponent>;

export const Default: Story = {
  args: { value: 'all' },
  parameters: {
    docs: {
      canvas: {
        sourceState: 'shown',
      },
    },
  },
  render: (args) => ({
    props: {
      ...args,
      setValue(value: StatusFilterValue): void {
        this['value'] = value;
      },
    },
    template: `
      <div style="min-width: 360px; min-height: 240px; padding: 48px;">
        <nao-status-filter [value]="value" (valueChange)="setValue($event)" />
      </div>
    `,
  }),
};
