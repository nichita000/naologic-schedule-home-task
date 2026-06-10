import type { Meta, StoryObj } from '@storybook/angular';
import { IconButtonComponent, IconButtonVariant } from './icon-button.component';

const meta: Meta<IconButtonComponent> = {
  title: 'Naologic/Controls/IconButton',
  component: IconButtonComponent,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<IconButtonComponent>;

export const Default: Story = {
  render: () => ({
    props: {
      dismiss: IconButtonVariant.Dismiss,
      subtle: IconButtonVariant.Subtle,
    },
    template: `
      <div style="display: grid; grid-template-columns: repeat(2, 120px); gap: 24px; padding: 32px; align-items: start;">
        <div style="display: grid; gap: 10px; justify-items: start;">
          <span style="font: 500 13px var(--font-family); color: var(--color-gray-600);">dismiss</span>
          <nao-icon-button [variant]="dismiss" label="Close" />
        </div>

        <div style="display: grid; gap: 10px; justify-items: start;">
          <span style="font: 500 13px var(--font-family); color: var(--color-gray-600);">subtle</span>
          <nao-icon-button [variant]="subtle" label="More options" />
        </div>
      </div>
    `,
  }),
};
