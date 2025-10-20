export interface Artist {
  id: string;
  name: string;
  type: 'Person' | 'Group';
  nationality?: string;
  dateOfBirth?: string;
  dateOfDeath?: string;
  comments?: string;
  image?: string;
  identifiers: ArtistIdentifiers;
  alsoKnownAs?: string[];
  isMemberOf?: string[];
  nameVariants?: NameVariant[];
  releases?: Release[];
  recordings?: Recording[];
  works?: Work[];
}

export interface ArtistIdentifiers {
  isni?: string;
  ipi?: string[];
  ipn?: string;
  discogsId?: string[];
  musicbrainzId?: string;
  wikidataId?: string;
  luminateId?: string;
  gracenoteId?: string;
  tmsId?: string;
  appleId?: string;
  spotifyId?: string;
  deezerId?: string;
  amazonId?: string[];
  mergedIsni?: string;
}

export interface NameVariant {
  name: string;
  language?: string;
}

export interface Release {
  upc: string;
  title: string;
  type?: string;
  year?: string;
  visual?: string;
  trackCount?: number;
  recordings?: Recording[];
}

export interface Recording {
  isrc: string;
  title: string;
  duration?: string;
  year?: string;
  iswc?: string;
  artists?: string[];
  contributors?: Contributor[];
  releases?: string[]; // UPC codes
}

export interface Contributor {
  name: string;
  role: string;
  isni?: string;
}

export interface Work {
  iswc: string;
  title: string;
  composers?: string[];
  publishers?: string[];
}

export interface ScraperConfig {
  artistsFile?: string;
  outputDir: string;
  cookiesFile?: string;
  headless?: boolean;
  debug?: boolean;
  concurrency?: number;
  retryAttempts?: number;
  timeout?: number;
}