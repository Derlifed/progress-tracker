export interface LogEntry {
  id: string;
  timestamp: number;
  action: 'created' | 'increment' | 'decrement' | 'completed' | 'archived';
  detail: string;
}

export interface Tracker {
  id: string;
  label: string;
  target: number;
  current: number;
  createdAt: number;
  completedAt: number | null;
  archivedAt: number | null;
  logs: LogEntry[];
}

export interface AppData {
  version: number;
  activeTracker: Tracker | null;
  history: Tracker[];
}
