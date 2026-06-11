import type { Meta, StoryObj } from '@storybook/angular';
import { Timescale } from '../timescale/timescale.component';
import { ScheduleRulerComponent, ScheduleRulerScale } from './schedule-ruler.component';

const scaleOptions: ScheduleRulerScale[] = [Timescale.Month, Timescale.Week, Timescale.Day];

const meta: Meta<ScheduleRulerComponent> = {
  title: 'Naologic/Schedule/Ruler',
  component: ScheduleRulerComponent,
  tags: ['autodocs'],
  argTypes: {
    scale: { control: 'select', options: scaleOptions },
    startDate: { control: 'text' },
    endDate: { control: 'text' },
    viewportWidth: { control: { type: 'range', min: 320, max: 1200, step: 1 } },
  },
};

export default meta;
type Story = StoryObj<ScheduleRulerComponent>;

export const Default: Story = {
  args: {
    scale: Timescale.Month,
    startDate: '2024-08-01',
    endDate: '2027-12-31',
    viewportWidth: 914,
  },
  render: (args) => ({
    props: args,
    template: `
      <div [style.width.px]="viewportWidth" style="max-width: 94vw; padding: 40px;">
        <nao-schedule-ruler
          [scale]="scale"
          [startDate]="startDate"
          [endDate]="endDate"
          [viewportWidth]="viewportWidth"
        />
      </div>
    `,
  }),
};
