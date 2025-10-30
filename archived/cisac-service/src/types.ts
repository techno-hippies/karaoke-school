export interface CISACSearchResult {
  iswc: string;
  title: string;
  creators: string;
  status: string;
}

export interface CISACSearchParams {
  title: string;
  artist?: string;
}

export interface CISACServiceConfig {
  apiKey: string;
  headless?: boolean;
  slowMo?: number;
  timeout?: number;
}
