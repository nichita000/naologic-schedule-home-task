import type { Meta, StoryObj } from '@storybook/angular';
import { WorkOrderDeleteDialogComponent } from './work-order-delete-dialog.component';
import { BadgeStatus } from '../badge/badge.component';

const meta: Meta<WorkOrderDeleteDialogComponent> = {
  title: 'Naologic/Feedback/Delete Dialog',
  component: WorkOrderDeleteDialogComponent,
  tags: ['autodocs'],
  parameters: {
    // The dialog is a fixed overlay; give the canvas room to show it.
    layout: 'fullscreen',
  },
};
export default meta;
type Story = StoryObj<WorkOrderDeleteDialogComponent>;

export const Default: Story = {
  render: () => ({
    template: `
      <div style="position: relative; min-height: 420px;">
        <nao-work-order-delete-dialog [order]="order" />
      </div>
    `,
    props: {
      order: {
        id: 'wo-1',
        name: 'Casing Extrusion',
        workCenterId: 'wc-1',
        status: BadgeStatus.Complete,
        startDate: '2026-05-01',
        endDate: '2026-06-19',
      },
    },
    moduleMetadata: {
      imports: [WorkOrderDeleteDialogComponent],
    },
  }),
};
