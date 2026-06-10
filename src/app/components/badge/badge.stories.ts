import type { Meta, StoryObj } from '@storybook/angular';
import { BadgeComponent, BadgeStatus } from './badge.component';

const meta: Meta<BadgeComponent> = {
  title: 'Naologic/Feedback/Badge',
  component: BadgeComponent,
  tags: ['autodocs'],
  argTypes: {
    status: { control: 'select', options: Object.values(BadgeStatus) },
  },
};
export default meta;
type Story = StoryObj<BadgeComponent>;

export const Default: Story = {
  args: { status: BadgeStatus.Complete },
};
