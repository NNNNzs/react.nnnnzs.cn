export const ACTIVITY_COMMITS_KEY = 'activity:commits:github';

export interface ActivityCommit {
  hash: string;
  message: string;
  date: string;
  url: string;
}
