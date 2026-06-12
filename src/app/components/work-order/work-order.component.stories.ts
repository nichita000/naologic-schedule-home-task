import type { Meta, StoryObj } from '@storybook/angular';
import { WorkOrderComponent } from './work-order.component';
import { BadgeStatus } from '../badge/badge.component';

const meta: Meta<WorkOrderComponent> = {
  title: 'Naologic/Schedule/WorkOrder',
  component: WorkOrderComponent,
  tags: ['autodocs'],
  argTypes: {
    status: { control: 'select', options: Object.values(BadgeStatus) },
  },
  render: (args) => ({
    props: args,
    template: `<div style="width: 360px; min-height: 200px;"><nao-work-order [name]="name" [status]="status" /></div>`,
  }),
};
export default meta;
type Story = StoryObj<WorkOrderComponent>;

/** Use the Controls panel to change the name and status. */
export const Default: Story = {
  args: { name: 'Konsulting Inc', status: BadgeStatus.InProgress },
};

/** Narrow bar example: hover the name to reveal the full label tooltip. */
export const TruncatedName: Story = {
  args: {
    name: 'Konsulting International Manufacturing Group',
    status: BadgeStatus.InProgress,
  },
  render: (args) => ({
    props: args,
    template: `<div style="width: 210px; min-height: 120px; padding-top: 36px;"><nao-work-order [name]="name" [status]="status" /></div>`,
  }),
};

/**
 * Externally controlled: each bar's width and status is set by the parent.
 * The schedule uses this to place work orders of different lengths across the timeline.
 */
export const Grid: Story = {
  parameters: { controls: { disable: true } },
  render: () => ({
    props: {
      // `w` is a flex weight — rows stretch to fill the full container width.
      rows: [
        [
          { name: 'Genesis Hardware', status: 'open', w: 2 },
          { name: 'Apex Logistics', status: 'open', w: 3 },
          { name: 'Spartan Manufacturing', status: 'blocked', w: 5 },
        ],
        [
          { name: 'Rodriques Electrics', status: 'in-progress', w: 4 },
          { name: 'Centrix Ltd', status: 'complete', w: 3 },
          { name: 'McMarrow', status: 'blocked', w: 3 },
        ],
        [
          { name: 'Konsulting Inc', status: 'complete', w: 9 },
          { name: 'Delta Assembly', status: 'in-progress', w: 3 },
        ],
        [
          { name: 'Northwind Forge', status: 'blocked', w: 3 },
          { name: 'Pioneer Tooling', status: 'in-progress', w: 6 },
          { name: 'Orbit Systems', status: 'complete', w: 3 },
        ],
      ],
    },
    template: `
      <div style="display:flex; flex-direction:column; gap:10px; width:100%;">
        @for (row of rows; track $index) {
          <div style="display:flex; gap:10px;">
            @for (wo of row; track wo.name) {
              <div [style.flex]="wo.w" style="min-width:0;">
                <nao-work-order [name]="wo.name" [status]="wo.status" />
              </div>
            }
          </div>
        }
      </div>
    `,
  }),
};
