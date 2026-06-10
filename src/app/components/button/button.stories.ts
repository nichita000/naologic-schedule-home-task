import type { Meta, StoryObj } from '@storybook/angular';
import { ButtonComponent, ButtonVariant, ButtonSize } from './button.component';

const meta: Meta<ButtonComponent> = {
  title: 'Naologic/Controls/Button',
  component: ButtonComponent,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: Object.values(ButtonVariant) },
    size: { control: 'select', options: Object.values(ButtonSize) },
    disabled: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<ButtonComponent>;

export const Primary: Story = {
  args: { variant: ButtonVariant.Primary, size: ButtonSize.Md, disabled: false },
  render: (args) => ({
    props: args,
    template: `<nao-button [variant]="variant" [size]="size" [disabled]="disabled">Simple Button</nao-button>`,
  }),
};

export const Secondary: Story = {
  args: { variant: ButtonVariant.Secondary, size: ButtonSize.Md, disabled: false },
  render: (args) => ({
    props: args,
    template: `<nao-button [variant]="variant" [size]="size" [disabled]="disabled">Action button</nao-button>`,
  }),
};

export const Ghost: Story = {
  args: { variant: ButtonVariant.Ghost, size: ButtonSize.Md, disabled: false },
  render: (args) => ({
    props: args,
    template: `<nao-button [variant]="variant" [size]="size" [disabled]="disabled">Simple Button</nao-button>`,
  }),
};

export const Disabled: Story = {
  args: { variant: ButtonVariant.Primary, size: ButtonSize.Md, disabled: true },
  render: (args) => ({
    props: args,
    template: `<nao-button [variant]="variant" [size]="size" [disabled]="disabled">Simple Button</nao-button>`,
  }),
};
