import type { Meta, StoryObj } from '@storybook/angular';
import { TextFieldComponent } from './text-field.component';

const meta: Meta<TextFieldComponent> = {
  title: 'Naologic/Controls/TextField',
  component: TextFieldComponent,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<TextFieldComponent>;

export const Default: Story = { args: { label: 'Work Order Name', placeholder: 'Acme Inc.' } };
export const Filled: Story = { args: { label: 'Work Order Name', value: 'McMorrow Distribution' } };
export const WithError: Story = { args: { label: 'Work Order Name', placeholder: 'Acme Inc.', error: 'This field is required' } };
export const Disabled: Story = { args: { label: 'Work Order Name', placeholder: 'Acme Inc.', disabled: true } };
