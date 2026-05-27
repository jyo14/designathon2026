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
}

export interface SkeletonSection {
  name: string;
  mapped_captures: string[];
  gap_suggestion: string | null;
}

export interface CaseStudySkeleton {
  sections: SkeletonSection[];
}

export interface MissingCaseStudy {
  theme: string;
  evidence: string;
  relevant_capture_ids: string[];
  suggested_title: string;
  skeleton: CaseStudySkeleton;
}

export interface StaleCaseStudy {
  portfolio_title: string;
  staleness_reason: string;
  relevant_capture_ids: string[];
}

export interface PortfolioGapResult {
  generated_at: string;
  missing_case_studies: MissingCaseStudy[];
  stale_case_studies: StaleCaseStudy[];
}
