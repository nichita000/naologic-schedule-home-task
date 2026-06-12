import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { TooltipDirective, TooltipPosition } from './tooltip.directive';

const positions: TooltipPosition[] = [
  'top',
  'top-left',
  'top-right',
  'bottom',
  'bottom-left',
  'bottom-right',
  'left',
  'right',
];

const meta: Meta = {
  title: 'Naologic/Overlays/Tooltip',
  decorators: [
    moduleMetadata({
      imports: [TooltipDirective],
    }),
  ],
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => ({
    props: {
      positions,
      label: 'Tooltip label',
    },
    template: `
      <div style="display:grid; grid-template-columns: repeat(3, 180px); gap: 72px 40px; padding: 80px;">
        @for (position of positions; track position) {
          <div style="display:flex; flex-direction:column; align-items:flex-start; gap:10px;">
            <strong style="font: 13px Circular-Std, sans-serif; color:#687196;">{{ position }}</strong>
            <p
              style="margin:0; font: 14px Circular-Std, sans-serif; color:#030929;"
              [naoTooltip]="position + ' ' + label"
              [naoTooltipPosition]="position"
            >
              Hover {{ position }}
            </p>
          </div>
        }
      </div>
    `,
  }),
};
