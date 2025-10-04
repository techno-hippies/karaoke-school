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
    { label: 'YouTube', url: 'https://www.youtube.com/watch?v=GHe8kKO8uds' },
    { label: 'Spotify', url: 'https://open.spotify.com/track/5M4yti0QxgqJieUYaEXcpw' },
    { label: 'Apple Music', url: 'https://music.apple.com/us/song/989492311' },
    { label: 'SoundCloud', url: 'https://soundcloud.com/tameimpala/the-less-i-know-the-better' },
    { label: 'Maid.zone', url: 'https://sc.maid.zone/tameimpala/the-less-i-know-the-better' }
  ];

  const lyricsLinks = [
    { label: 'Genius', url: 'https://genius.com/Tame-impala-the-less-i-know-the-better-lyrics' },
    { label: 'Intellectual', url: 'https://intellectual.insprill.net/Tame-impala-the-less-i-know-the-better-lyrics' },
    { label: 'Dumb', url: 'https://dm.vern.cc/Tame-impala-the-less-i-know-the-better-lyrics' }
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
    { label: 'YouTube', url: 'https://www.youtube.com/watch?v=GHe8kKO8uds' },
    { label: 'Spotify', url: 'https://open.spotify.com/track/5M4yti0QxgqJieUYaEXcpw' },
    { label: 'Apple Music', url: 'https://music.apple.com/us/song/989492311' },
    { label: 'SoundCloud', url: 'https://soundcloud.com/tameimpala/the-less-i-know-the-better' },
    { label: 'Maid.zone', url: 'https://sc.maid.zone/tameimpala/the-less-i-know-the-better' }
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
