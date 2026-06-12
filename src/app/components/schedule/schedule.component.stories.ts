import type { Meta, StoryObj } from '@storybook/angular';
import { Timescale } from '../timescale/timescale.component';
import { ScheduleComponent, WorkCenter } from './schedule.component';

const workCenters: WorkCenter[] = [
  { id: '1', name: 'Genesis Hardware' },
  { id: '2', name: 'Rodriques Electrics' },
  { id: '3', name: 'Konsulting Inc' },
  { id: '4', name: 'McMarrow Distribution' },
  { id: '5', name: 'Spartan Manufacturing' },
];

const meta: Meta<ScheduleComponent> = {
  title: 'Naologic/Schedule/Overview',
  component: ScheduleComponent,
  tags: ['autodocs'],
  args: {
    workCenters,
    scale: Timescale.Month,
    timelineStartDate: '2024-01-01',
    timelineEndDate: '2028-12-31',
    currentDate: '2026-06-09',
  },
};

export default meta;
type Story = StoryObj<ScheduleComponent>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    workCenters: [],
  },
};
