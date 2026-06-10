import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { DropdownComponent, DropdownOption } from './dropdown.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';

const meta: Meta<DropdownComponent> = {
  title: 'Naologic/Controls/Dropdown',
  component: DropdownComponent,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<DropdownComponent>;

export const Default: Story = {
  render: () => ({
    props: {
      selected: null as DropdownOption | null,
      options: [
        { value: 'open', label: 'Open' },
        { value: 'in-progress', label: 'In progress' },
        { value: 'complete', label: 'Complete' },
        { value: 'blocked', label: 'Blocked' },
      ],
      setSelected(option: DropdownOption): void {
        this['selected'] = option;
      },
    },
    template: `
      <div style="min-width: 260px; min-height: 220px; padding: 48px;">
        <nao-dropdown
          placeholder="Select status"
          [options]="options"
          [selected]="selected"
          (selectedChange)="setSelected($event)"
        />
      </div>
    `,
  }),
};

/**
 * A consumer can project its own trigger via `[naoDropdownTrigger]`.
 * Here a three-dot icon button opens the same menu — used by the work-order
 * context menu (Edit / Delete).
 */
export const CustomTrigger: Story = {
  decorators: [moduleMetadata({ imports: [IconButtonComponent] })],
  args: {
    options: [
      { value: 'edit', label: 'Edit' },
      { value: 'delete', label: 'Delete' },
    ],
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="min-width: 220px; min-height: 180px; padding: 48px;">
        <nao-dropdown [options]="options">
          <nao-icon-button naoDropdownTrigger variant="subtle" label="Options" />
        </nao-dropdown>
      </div>
    `,
  }),
};
