import * as React from 'react';
import { toast } from 'sonner';
import { ChevronRightIcon, DownloadIcon, FileJsonIcon, RotateCcwIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { InfoTip, PageHeader } from '@/components/common';
import { confirmDialog } from '@/components/confirm';
import { bg, download, getSettings, store, today } from '@/lib/ext';
import { useExtData } from '@/hooks/use-ext-data';
import { sitesCsv } from '@/views/sites';
import { GOOGLE_DOMAINS } from '@ext/defaults.js';
import type { Quest, Settings, Site } from '@/types';

/** One settings row: label + optional ⓘ on the left, control right-aligned. */
function SettingRow({ label, info, htmlFor, children }: { label: string; info?: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center gap-3 py-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
      {info ? <InfoTip>{info}</InfoTip> : null}
      <div className="ml-auto flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <Card className="gap-1 py-3">
      <CardHeader className="px-4"><CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</CardTitle></CardHeader>
      <CardContent className="px-4">
        {rows.map((r, i) => <React.Fragment key={i}>{i > 0 ? <Separator /> : null}{r}</React.Fragment>)}
      </CardContent>
    </Card>
  );
}

export function SettingsView() {
  const [s] = useExtData(getSettings, (k) => k === 'settings');
  const fileRef = React.useRef<HTMLInputElement>(null);
  if (!s) return null;

  const set = async (patch: Partial<Settings>) => {
    await store.setSettings(patch);
    toast.success('Saved', { duration: 1000 });
  };
  const num = (k: keyof Settings, min: number, max: number, id: string) => (
    <Input
      id={id} type="number" min={min} max={max} defaultValue={s[k] as number} className="h-8 w-20 text-right tabular-nums"
      onBlur={(e) => { const v = Math.max(min, Math.min(max, +e.target.value || 0)); e.target.value = String(v); if (v !== s[k]) set({ [k]: v }); }}
    />
  );
  const text = (k: 'hl' | 'gl', placeholder: string) => (
    <Input aria-label={k} defaultValue={s[k]} placeholder={placeholder} className="h-8 w-16 text-center" onBlur={(e) => { const v = e.target.value.trim(); if (v !== s[k]) set({ [k]: v }); }} />
  );

  const importFile = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const n = Object.keys(data?.data || {}).length;
      if (!(await confirmDialog({ title: `Import ${n} records?`, description: 'Records with the same id are overwritten.', confirmLabel: 'Import' }))) return;
      toast.success(`Imported ${await store.importAll(data)}`);
    } catch (err) {
      toast.error('Import failed', { description: String((err as Error).message) });
    }
  };

  return (
    <>
      <PageHeader title="Settings" />

      <Group title="Search">
        <SettingRow label="Google domain" info="Use your market’s Google for local results.">
          <Select value={s.googleDomain} onValueChange={(v) => set({ googleDomain: v })}>
            <SelectTrigger size="sm" className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{(GOOGLE_DOMAINS as string[]).map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Language · country" info="Optional hl and gl parameters, e.g. en · us or de · de.">
          {text('hl', 'hl')}{text('gl', 'gl')}
        </SettingRow>
        <SettingRow label="Open searches in">
          <Select value={s.openIn} onValueChange={(v) => set({ openIn: v as Settings['openIn'] })}>
            <SelectTrigger size="sm" className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="tab">New tab</SelectItem><SelectItem value="current">Current tab</SelectItem></SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Pause between searches" htmlFor="gap" info="Seconds. Asks before searching again sooner, to avoid Google CAPTCHAs. 0 turns it off.">
          {num('minGapSec', 0, 600, 'gap')}
        </SettingRow>
      </Group>

      <Group title="Saving & scanning">
        <SettingRow label="One entry per domain" htmlFor="dedupe" info="Skip results from a domain you already saved.">
          <Switch id="dedupe" checked={s.dedupeByDomain} onCheckedChange={(v) => set({ dedupeByDomain: v })} />
        </SettingRow>
        <SettingRow label="Scan on save" htmlFor="autoscan" info="Look for emails and old-site signals as soon as a site is saved.">
          <Switch id="autoscan" checked={s.autoScan} onCheckedChange={(v) => set({ autoScan: v })} />
        </SettingRow>
        <SettingRow label="Pages per site" htmlFor="pages" info="1–10. Homepage first, then imprint, contact and about pages.">
          {num('scanMaxPages', 1, 10, 'pages')}
        </SettingRow>
        <SettingRow label="Parallel scans" htmlFor="par">{num('scanConcurrency', 1, 6, 'par')}</SettingRow>
      </Group>

      <Group title="Data">
        <SettingRow label="Backup" info="Everything is stored locally in this browser profile.">
          <Button size="sm" variant="outline" onClick={async () => download(`searchquest-backup-${today()}.json`, JSON.stringify(await store.exportAll(), null, 1), 'application/json')}>
            <FileJsonIcon data-icon="inline-start" />Export
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><UploadIcon data-icon="inline-start" />Import</Button>
        </SettingRow>
        <SettingRow label="All sites as CSV">
          <Button
            size="sm" variant="outline"
            onClick={async () => {
              const [sites, quests] = await Promise.all([store.sites.list() as Promise<Site[]>, store.quests.list() as Promise<Quest[]>]);
              download(`searchquest-sites-${today()}.csv`, sitesCsv(sites, new Map(quests.map((q) => [q.id, q]))), 'text/csv;charset=utf-8');
            }}
          >
            <DownloadIcon data-icon="inline-start" />Export
          </Button>
        </SettingRow>
      </Group>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importFile(f); }} />

      <Collapsible className="flex flex-col gap-3">
        <CollapsibleTrigger className="group -ml-1 flex h-7 items-center gap-1.5 self-start rounded-md px-1 text-sm font-medium text-muted-foreground outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/50">
          <ChevronRightIcon className="size-4 transition-transform group-data-[state=open]:rotate-90" />Danger zone
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-wrap gap-2">
          <Button
            size="sm" variant="destructive"
            onClick={async () => {
              const sites = (await store.sites.list()) as Site[];
              if (!(await confirmDialog({ title: `Delete all ${sites.length} sites?`, description: 'Quests, templates and blocks stay.', confirmLabel: 'Delete all', destructive: true }))) return;
              await bg('sites:delete', { ids: sites.map((x) => x.id) });
              toast.success('All sites deleted');
            }}
          >
            <Trash2Icon data-icon="inline-start" />Delete all sites
          </Button>
          <Button
            size="sm" variant="outline" className="text-destructive hover:text-destructive"
            onClick={async () => {
              if (!(await confirmDialog({ title: 'Reset everything?', description: 'Deletes all data and restores the defaults.', confirmLabel: 'Reset', destructive: true }))) return;
              await chrome.storage.local.clear();
              await store.seedDefaults();
              location.reload();
            }}
          >
            <RotateCcwIcon data-icon="inline-start" />Reset everything
          </Button>
        </CollapsibleContent>
      </Collapsible>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Outreach rules differ by country
        <InfoTip>US cold email (CAN-SPAM) needs a real sender address and an opt-out. Germany (UWG §7) generally requires prior consent for advertising email, B2B included. Not legal advice.</InfoTip>
      </p>
    </>
  );
}
