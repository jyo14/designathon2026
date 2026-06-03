export type CaptureType = 'text' | 'url' | 'image' | 'mixed';

export type CaptureLabel =
  | 'UI Pattern'
  | 'Portfolio Notes'
  | 'Study Material'
  | 'Design Inspiration'
  | 'Design Decisions'
  | 'Interview Prep';

export interface Capture {
  id: string;
  type: CaptureType;
  content: string;
  source_url?: string;
  image_data_url?: string;
  captured_at: string; // ISO timestamp
  label?: CaptureLabel;
  themes?: string[];
  summary?: string;
  project_link?: string;
  is_opened: boolean;
}

export interface DailyBriefItem {
  title: string;
  reasoning: string;
  capture_ids: string[];
}

export interface DailyBriefConnection {
  description: string;
  capture_ids: string[];
}

export interface DailyBrief {
  generated_at: string;
  top_3: DailyBriefItem[];
  connections: DailyBriefConnection[];
  nudge: string;
  context_line?: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  why_relevant: string;
  score: number;
}
