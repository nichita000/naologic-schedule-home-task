import type { Meta, StoryObj } from '@storybook/angular';
import { BadgeStatus } from '../badge/badge.component';
import { Timescale } from '../timescale/timescale.component';
import { ScheduleComponent, ScheduleOrder, WorkCenter } from './schedule.component';

const workCenters: WorkCenter[] = [
  { id: '1', name: 'Genesis Hardware' },
  { id: '2', name: 'Rodriques Electrics' },
  { id: '3', name: 'Konsulting Inc' },
  { id: '4', name: 'McMarrow Distribution' },
  { id: '5', name: 'Spartan Manufacturing' },
];

const workOrders: ScheduleOrder[] = [
  {
    id: 'wo-1',
    name: 'Casing Extrusion',
    workCenterId: '1',
    status: BadgeStatus.Complete,
    startDate: '2026-05-01',
    endDate: '2026-06-18',
  },
  {
    id: 'wo-2',
    name: 'Frame Profile Run',
    workCenterId: '1',
    status: BadgeStatus.InProgress,
    startDate: '2026-06-28',
    endDate: '2026-09-12',
  },
  {
    id: 'wo-3',
    name: 'Spindle Bracket',
    workCenterId: '2',
    status: BadgeStatus.Blocked,
    startDate: '2026-06-15',
    endDate: '2026-09-05',
  },
];

const meta: Meta<ScheduleComponent> = {
  title: 'Naologic/Schedule/Overview',
  component: ScheduleComponent,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<ScheduleComponent>;

export const Default: Story = {
  args: {
    workCenters,
    workOrders,
    scale: Timescale.Month,
    timelineStartDate: '2024-01-01',
    timelineEndDate: '2028-12-31',
    currentDate: '2026-06-09',
  },
};

export const Empty: Story = {
  args: {
    workCenters: [],
    timelineStartDate: '2024-01-01',
    timelineEndDate: '2028-12-31',
  },
};
