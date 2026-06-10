import type { Meta, StoryObj } from '@storybook/angular';
import { TimescaleComponent, Timescale } from './timescale.component';

const scaleOptions = [Timescale.Month, Timescale.Week, Timescale.Day];

const meta: Meta<TimescaleComponent> = {
  title: 'Naologic/Schedule/Timescale',
  component: TimescaleComponent,
  tags: ['autodocs'],
  argTypes: {
    value: { control: 'select', options: scaleOptions },
  },
};
export default meta;
type Story = StoryObj<TimescaleComponent>;

export const Default: Story = {
  args: { value: Timescale.Month },
  parameters: {
    docs: {
      canvas: {
        sourceState: 'shown',
      },
    },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="min-width: 420px; padding: 48px;">
        <nao-timescale [value]="value" />
      </div>
    `,
  }),
};
