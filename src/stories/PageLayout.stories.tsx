import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import { PageLayout, ModalPageLayout, SettingsPageLayout } from '../components/layout/PageLayout';
import { Button } from '../components/ui/button';
import { Gear, Bell } from '@phosphor-icons/react';

const meta: Meta<typeof PageLayout> = {
  title: 'Layout/PageLayout',
  component: PageLayout,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  args: {
    title: 'Page Title',
    subtitle: 'Optional subtitle text',
    children: (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Content Area</h2>
        <p className="text-neutral-400">
          This is the main content area. It can contain any content and will scroll if needed.
        </p>
      </div>
    ),
  },
};

export const WithBackButton: Story = {
  args: {
    title: 'Settings',
    showBackButton: true,
    onBack: () => console.log('Back clicked'),
    children: (
      <div className="p-6 space-y-4">
        <div className="bg-neutral-900 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Account Settings</h3>
          <p className="text-sm text-neutral-400">Manage your account preferences</p>
        </div>
        <div className="bg-neutral-900 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Privacy Settings</h3>
          <p className="text-sm text-neutral-400">Control your privacy options</p>
        </div>
      </div>
    ),
  },
};

export const WithHeaderAction: Story = {
  args: {
    title: 'Notifications',
    headerAction: (
      <Button variant="ghost" size="icon" className="text-white">
        <Gear size={20} />
      </Button>
    ),
    children: (
      <div className="p-6">
        <div className="flex items-center gap-3 p-4 bg-neutral-900 rounded-lg mb-3">
          <Bell size={24} />
          <div className="flex-1">
            <p className="font-semibold">New follower</p>
            <p className="text-sm text-neutral-400">@username started following you</p>
          </div>
        </div>
      </div>
    ),
  },
};

export const WithFooter: Story = {
  args: {
    title: 'Create Post',
    showBackButton: true,
    children: (
      <div className="p-6">
        <textarea
          className="w-full h-32 bg-neutral-900 text-white p-4 rounded-lg resize-none"
          placeholder="What's on your mind?"
        />
      </div>
    ),
    footer: (
      <div className="p-4 flex gap-3">
        <Button variant="outline" className="flex-1">
          Save Draft
        </Button>
        <Button className="flex-1 bg-red-600 hover:bg-red-700">
          Post
        </Button>
      </div>
    ),
  },
};

export const ModalPage: Story = {
  render: () => (
    <ModalPageLayout
      title="Edit Profile"
      onBack={() => console.log('Close modal')}
      footer={
        <div className="p-4">
          <Button className="w-full bg-red-600 hover:bg-red-700">
            Save Changes
          </Button>
        </div>
      }
    >
      <div className="p-6 space-y-4">
        <div>
          <label className="text-sm text-neutral-400">Username</label>
          <input
            type="text"
            className="w-full mt-1 bg-neutral-900 text-white p-3 rounded-lg"
            defaultValue="@username"
          />
        </div>
        <div>
          <label className="text-sm text-neutral-400">Bio</label>
          <textarea
            className="w-full mt-1 bg-neutral-900 text-white p-3 rounded-lg resize-none"
            rows={3}
            defaultValue="Your bio here..."
          />
        </div>
      </div>
    </ModalPageLayout>
  ),
};

export const SettingsPage: Story = {
  render: () => (
    <SettingsPageLayout
      title="Settings"
      showBackButton={true}
      onBack={() => console.log('Back')}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-3">Account</h2>
          <div className="space-y-2">
            <button className="w-full flex items-center justify-between p-3 bg-neutral-900 rounded-lg hover:bg-neutral-800">
              <span>Edit Profile</span>
              <span className="text-neutral-400">→</span>
            </button>
            <button className="w-full flex items-center justify-between p-3 bg-neutral-900 rounded-lg hover:bg-neutral-800">
              <span>Change Password</span>
              <span className="text-neutral-400">→</span>
            </button>
          </div>
        </div>
        
        <div>
          <h2 className="text-lg font-semibold mb-3">Privacy</h2>
          <div className="space-y-2">
            <button className="w-full flex items-center justify-between p-3 bg-neutral-900 rounded-lg hover:bg-neutral-800">
              <span>Blocked Users</span>
              <span className="text-neutral-400">→</span>
            </button>
            <button className="w-full flex items-center justify-between p-3 bg-neutral-900 rounded-lg hover:bg-neutral-800">
              <span>Private Account</span>
              <input type="checkbox" className="ml-auto" />
            </button>
          </div>
        </div>
      </div>
    </SettingsPageLayout>
  ),
};

export const ScrollableContent: Story = {
  args: {
    title: 'Long Content',
    subtitle: 'This page has scrollable content',
    children: (
      <div className="p-6">
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} className="bg-neutral-900 p-4 rounded-lg mb-3">
            <h3 className="font-semibold">Item {i + 1}</h3>
            <p className="text-sm text-neutral-400">
              This is item number {i + 1} in a long scrollable list
            </p>
          </div>
        ))}
      </div>
    ),
    footer: (
      <div className="p-4 bg-black">
        <Button className="w-full">Fixed Footer Button</Button>
      </div>
    ),
  },
};