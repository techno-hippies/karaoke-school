import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ExternalLinksSheet } from '../components/clips/ExternalLinksSheet';
import { Button } from '../components/ui/button';

const meta: Meta<typeof ExternalLinksSheet> = {
  title: 'Clips/ExternalLinksSheet',
  component: ExternalLinksSheet,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const ExternalLinksDemo = () => {
  const [open, setOpen] = useState(false);

  const songLinks = [
    { label: 'SoundCloud', url: 'https://soundcloud.com/example' },
    { label: 'Maid.zone', url: 'https://maid.zone/example' }
  ];

  const lyricsLinks = [
    { label: 'Genius', url: 'https://genius.com/example' },
    { label: 'Intellectual', url: 'https://intellectual.insprill.net/example' },
    { label: 'Dumb', url: 'https://dm.vern.cc/example' }
  ];

  return (
    <div className="h-screen bg-neutral-900 flex items-center justify-center">
      <Button onClick={() => setOpen(true)}>Open External Links</Button>
      <ExternalLinksSheet
        open={open}
        onOpenChange={setOpen}
        songLinks={songLinks}
        lyricsLinks={lyricsLinks}
      />
    </div>
  );
};

export const Default: Story = {
  render: () => <ExternalLinksDemo />,
};

const OnlySongLinks = () => {
  const [open, setOpen] = useState(true);

  const songLinks = [
    { label: 'SoundCloud', url: 'https://soundcloud.com/example' },
    { label: 'Maid.zone', url: 'https://maid.zone/example' }
  ];

  return (
    <div className="h-screen bg-neutral-900 flex items-center justify-center">
      <p className="text-white">Only song links (no lyrics)</p>
      <ExternalLinksSheet
        open={open}
        onOpenChange={setOpen}
        songLinks={songLinks}
      />
    </div>
  );
};

export const SongLinksOnly: Story = {
  render: () => <OnlySongLinks />,
};

const OnlyLyricsLinks = () => {
  const [open, setOpen] = useState(true);

  const lyricsLinks = [
    { label: 'Genius', url: 'https://genius.com/example' },
    { label: 'Intellectual', url: 'https://intellectual.insprill.net/example' },
    { label: 'Dumb', url: 'https://dm.vern.cc/example' }
  ];

  return (
    <div className="h-screen bg-neutral-900 flex items-center justify-center">
      <p className="text-white">Only lyrics links (no song)</p>
      <ExternalLinksSheet
        open={open}
        onOpenChange={setOpen}
        lyricsLinks={lyricsLinks}
      />
    </div>
  );
};

export const LyricsLinksOnly: Story = {
  render: () => <OnlyLyricsLinks />,
};
