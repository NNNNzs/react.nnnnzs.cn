export type DeployStatusValue = 'deploying' | 'success' | 'failure';

export interface DeployRecord {
  status: DeployStatusValue;
  timestamp: string;
  commit: string;
  message: string;
  version: string;
  runId?: number;
  url?: string;
}

export interface BookshelfCollection {
  id: number;
  title: string;
  slug: string;
  articleCount: number;
  color?: string | null;
}

export interface ScreenTextLine {
  text: string;
  color?: string;
  highlight?: boolean;
}

export interface ScreenTextureData {
  variant: 'commit-log' | 'deploy-status' | 'post-feed';
  headerColor: string;
  headerText: string;
  lines: ScreenTextLine[];
}

export interface CommitEntry {
  hash: string;
  message: string;
  date: string;
  url: string;
}
