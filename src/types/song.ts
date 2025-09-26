export interface Song {
  id: string;
  title: string;
  artist: string;
  duration: number; // in seconds
  thumbnailUrl?: string;
  audioUrl?: string;
}

export interface SongMetadata extends Song {
  lineTimestamps: any[];
  totalLines: number;
}