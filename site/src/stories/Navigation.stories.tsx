import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useState } from 'react';
import { MobileFooter } from '../components/navigation/MobileFooter';
import { DesktopSidebar } from '../components/navigation/DesktopSidebar';

// MobileFooter Stories
const mobileMeta: Meta<typeof MobileFooter> = {
  title: 'Navigation/MobileFooter',
  component: MobileFooter,
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'iphone12',
    },
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
};

export default mobileMeta;

export const MobileDefault: StoryObj<typeof MobileFooter> = {
  render: () => {
    const [activeTab, setActiveTab] = useState<'home' | 'study' | 'post' | 'inbox' | 'profile'>('home');
    return (
      <div className="relative h-screen bg-black">
        <div className="flex flex-col items-center justify-center h-full text-white">
          <h2 className="text-2xl mb-4">Mobile Footer Navigation</h2>
          <p className="text-neutral-400">Active Tab: {activeTab}</p>
        </div>
        <MobileFooter
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>
    );
  },
};

export const MobileHomeActive: StoryObj<typeof MobileFooter> = {
  args: {
    activeTab: 'home',
    onTabChange: (tab) => console.log('Tab changed to:', tab),
  },
  render: (args) => (
    <div className="relative h-screen bg-black">
      <MobileFooter {...args} />
    </div>
  ),
};

export const MobileStudyActive: StoryObj<typeof MobileFooter> = {
  args: {
    activeTab: 'study',
    onTabChange: (tab) => console.log('Tab changed to:', tab),
  },
  render: (args) => (
    <div className="relative h-screen bg-black">
      <MobileFooter {...args} />
    </div>
  ),
};

export const MobileInboxActive: StoryObj<typeof MobileFooter> = {
  args: {
    activeTab: 'inbox',
    onTabChange: (tab) => console.log('Tab changed to:', tab),
  },
  render: (args) => (
    <div className="relative h-screen bg-black">
      <MobileFooter {...args} />
    </div>
  ),
};

export const MobileProfileActive: StoryObj<typeof MobileFooter> = {
  args: {
    activeTab: 'profile',
    onTabChange: (tab) => console.log('Tab changed to:', tab),
  },
  render: (args) => (
    <div className="relative h-screen bg-black">
      <MobileFooter {...args} />
    </div>
  ),
};

// DesktopSidebar Stories
export const DesktopSidebarDefault: StoryObj<typeof DesktopSidebar> = {
  render: () => {
    const [activeTab, setActiveTab] = useState<'home' | 'study' | 'profile'>('home');
    return (
      <div className="h-screen bg-black flex">
        <DesktopSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onCreatePost={() => console.log('Create post clicked')}
        />
        <div className="flex-1 flex flex-col items-center justify-center text-white">
          <h2 className="text-2xl mb-4">Desktop Sidebar Navigation</h2>
          <p className="text-neutral-400">Active Tab: {activeTab}</p>
          <p className="text-neutral-500 text-sm mt-4">Resize window to see collapsed/expanded states</p>
        </div>
      </div>
    );
  },
  parameters: {
    viewport: {
      defaultViewport: 'responsive',
    },
  },
};

export const DesktopSidebarCollapsed: StoryObj<typeof DesktopSidebar> = {
  args: {
    activeTab: 'home',
    onTabChange: (tab) => console.log('Tab changed to:', tab),
    onCreatePost: () => console.log('Create post clicked'),
  },
  render: (args) => (
    <div className="h-screen bg-black flex">
      <DesktopSidebar {...args} />
      <div className="flex-1 flex items-center justify-center text-white">
        <p>Collapsed view (tablet size)</p>
      </div>
    </div>
  ),
  parameters: {
    viewport: {
      defaultViewport: 'ipad',
    },
  },
};

export const DesktopSidebarExpanded: StoryObj<typeof DesktopSidebar> = {
  args: {
    activeTab: 'study',
    onTabChange: (tab) => console.log('Tab changed to:', tab),
    onCreatePost: () => console.log('Create post clicked'),
  },
  render: (args) => (
    <div className="h-screen bg-black flex">
      <DesktopSidebar {...args} />
      <div className="flex-1 flex items-center justify-center text-white">
        <p>Expanded view (desktop size)</p>
      </div>
    </div>
  ),
  parameters: {
    viewport: {
      defaultViewport: 'responsive',
    },
  },
};