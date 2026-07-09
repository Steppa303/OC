export interface SearchResult {
  id: string;
  title: string;
  category: string;
  media_type: string;
  size: number;
  size_formatted: string;
  language: string;
  source: string;
  pub_date: string;
  poster_url: string | null;
  rating: number | null;
  grabs: number;
  link: string;
  guid: string;
}

export interface SearchResponse {
  query: string;
  total: number;
  page: number;
  results: SearchResult[];
}

export interface QueueItem {
  nzo_id: string;
  filename: string;
  mb: number;
  mb_left: number;
  percentage: number;
  speed: string;
  eta: string;
  status: string;
}

export interface QueueResponse {
  active: QueueItem[];
  paused: QueueItem[];
  total_size: string;
  total_left: string;
  speed: string;
  eta: string;
}

export interface UserInfo {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
}

export interface AuthResponse {
  token: string;
  user: UserInfo;
}

export interface DownloadRequest {
  link: string;
  title: string;
  size?: number;
  category?: string;
}

export interface DownloadResponse {
  success: boolean;
  nzo_id: string;
  error?: string;
}

export interface UserConfig {
  media_type: string;
  language: string | null;
  source: string | null;
}

export interface WatchlistItem {
  id: string;
  title: string;
  media_type: string;
  size_formatted: string;
  language: string;
  source: string;
  added_at: string;
}