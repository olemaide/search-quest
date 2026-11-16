// Shapes of the records that lib/ (plain JS, shared with the service worker) reads and writes.

export type SlotKey = 'profession' | 'location' | 'signals' | 'required' | 'excludes';
export type BlockSlot = SlotKey | 'site' | 'extra';

export interface BuilderState {
  profession: string[];
  intitle: boolean;
  location: string[];
  signals: string[];
  required: string[];
  site: string;
  excludes: string[];
  extra: string;
}

export interface DraftMeta {
  questId?: string | null;
  questName?: string;
  templateName?: string;
}

export interface Draft {
  state: BuilderState;
  meta: DraftMeta;
}

export interface Block {
  id: string;
  cat: string;
  slot: BlockSlot;
  value: string;
  label: string;
}

export interface Template {
  id: string;
  name: string;
  region?: string;
  description?: string;
  builtin?: boolean;
  state: BuilderState;
}

export interface QuestLocation {
  id: string;
  value: string;
  status: 'pending' | 'done';
  runAt: number | null;
  runs: number;
}

export interface Quest {
  id: string;
  name: string;
  notes?: string;
  state: BuilderState;
  locations: QuestLocation[];
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number | null;
}

export interface ScanResult {
  finalUrl: string;
  https: boolean;
  mobile: boolean;
  title: string;
  description: string;
  generator: string;
  builder: string | null;
  builders: string[];
  oldBuilder: string | null;
  oldCms: string | null;
  emails: string[];
  phones: string[];
  socials: Record<string, string>;
  copyrightYear: number | null;
  lastUpdated: number | null;
  signals: string[];
  score: number;
  pages: { url: string; status: number; emails: number }[];
}

export type ScanState = 'none' | 'queued' | 'scanning' | 'done' | 'error';

export interface Site {
  id: string;
  url: string;
  domain: string;
  title: string;
  snippet: string;
  query: string;
  questId: string | null;
  location: string | null;
  status: string;
  tags: string[];
  notes: string;
  emails: string[];
  phones: string[];
  scan: ScanResult | null;
  scanState?: ScanState;
  scanError?: string | null;
  createdAt: number;
  scannedAt?: number;
}

export interface Settings {
  googleDomain: string;
  hl: string;
  gl: string;
  openIn: 'tab' | 'current';
  minGapSec: number;
  dedupeByDomain: boolean;
  autoScan: boolean;
  scanMaxPages: number;
  scanConcurrency: number;
}
