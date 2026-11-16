import * as React from 'react';
import { toast } from 'sonner';
import { DownloadIcon, FileJsonIcon, RotateCcwIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSeparator, FieldTitle,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/common';
import { confirmDialog } from '@/components/confirm';
import { bg, download, getSettings, store, today } from '@/lib/ext';
import { useExtData } from '@/hooks/use-ext-data';
import { sitesCsv } from '@/views/sites';
import { GOOGLE_DOMAINS } from '@ext/defaults.js';
import type { Quest, Settings, Site } from '@/types';

export function SettingsView() {
  const [s] = useExtData(getSettings, (k) => k === 'settings');
  const fileRef = React.useRef<HTMLInputElement>(null);
  if (!s) return null;

  const set = async (patch: Partial<Settings>) => {
    await store.setSettings(patch);
    toast.success('Saved', { duration: 1200 });
  };
  const num = (k: keyof Settings, min: number, max: number) => (
    <Input
      type="number" min={min} max={max} defaultValue={s[k] as number} className="w-24"
      onBlur={(e) => { const v = Math.max(min, Math.min(max, +e.target.value || 0)); e.target.value = String(v); if (v !== s[k]) set({ [k]: v }); }}
    />
  );
  const text = (k: 'hl' | 'gl', placeholder: string) => (
    <Input defaultValue={s[k]} placeholder={placeholder} className="w-24" onBlur={(e) => { const v = e.target.value.trim(); if (v !== s[k]) set({ [k]: v }); }} />
  );

  const importFile = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const n = Object.keys(data?.data || {}).length;
      if (!(await confirmDialog({ title: 'Import this backup?', description: `Merge ${n} records from “${file.name}”. Records with the same id are overwritten.`, confirmLabel: 'Import' }))) return;
      toast.success(`Imported ${await store.importAll(data)} records`);
    } catch (err) {
      toast.error('Import failed', { description: String((err as Error).message) });
    }
  };

  return (
    <>
      <PageHeader title="Settings" />

      <Card>
        <CardHeader>
          <CardTitle>Google searches</CardTitle>
          <CardDescription>How searches open, and how SearchQuest keeps you clear of CAPTCHAs.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field orientation="responsive">
              <FieldContent><FieldLabel>Google domain</FieldLabel><FieldDescription>Use your market’s Google for local results.</FieldDescription></FieldContent>
              <Select value={s.googleDomain} onValueChange={(v) => set({ googleDomain: v })}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>{(GOOGLE_DOMAINS as string[]).map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <FieldSeparator />
            <Field orientation="responsive">
              <FieldContent><FieldLabel>Language and country</FieldLabel><FieldDescription>Optional hl and gl parameters, e.g. en / us or de / de.</FieldDescription></FieldContent>
              <div className="flex gap-2">{text('hl', 'hl')}{text('gl', 'gl')}</div>
            </Field>
            <FieldSeparator />
            <Field orientation="responsive">
              <FieldContent><FieldLabel>Open searches in</FieldLabel></FieldContent>
              <Select value={s.openIn} onValueChange={(v) => set({ openIn: v as Settings['openIn'] })}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="tab">A new tab</SelectItem><SelectItem value="current">The current tab</SelectItem></SelectContent>
              </Select>
            </Field>
            <FieldSeparator />
            <Field orientation="responsive">
              <FieldContent>
                <FieldLabel>Seconds between searches</FieldLabel>
                <FieldDescription>Asks before searching again sooner than this. 0 turns the check off.</FieldDescription>
              </FieldContent>
              {num('minGapSec', 0, 600)}
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saving & scanning</CardTitle>
          <CardDescription>Scans fetch each saved site’s homepage plus its imprint, contact and about pages.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>One entry per domain</FieldTitle>
                <FieldDescription>Skip results from a domain you already saved.</FieldDescription>
              </FieldContent>
              <Switch checked={s.dedupeByDomain} onCheckedChange={(v) => set({ dedupeByDomain: v })} aria-label="One entry per domain" />
            </Field>
            <FieldSeparator />
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>Scan automatically</FieldTitle>
                <FieldDescription>Look for emails and old-site signals as soon as a site is saved.</FieldDescription>
              </FieldContent>
              <Switch checked={s.autoScan} onCheckedChange={(v) => set({ autoScan: v })} aria-label="Scan automatically" />
            </Field>
            <FieldSeparator />
            <Field orientation="responsive">
              <FieldContent><FieldLabel>Pages per site</FieldLabel><FieldDescription>1–10. More pages find more emails but take longer.</FieldDescription></FieldContent>
              {num('scanMaxPages', 1, 10)}
            </Field>
            <FieldSeparator />
            <Field orientation="responsive">
              <FieldContent><FieldLabel>Sites scanned in parallel</FieldLabel></FieldContent>
              {num('scanConcurrency', 1, 6)}
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data</CardTitle>
          <CardDescription>
            Everything is stored locally in this browser profile. Nothing leaves it except the Google searches you open and the fetches of the sites you save.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={async () => download(`searchquest-backup-${today()}.json`, JSON.stringify(await store.exportAll(), null, 1), 'application/json')}>
            <FileJsonIcon data-icon="inline-start" />Export backup
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}><UploadIcon data-icon="inline-start" />Import backup</Button>
          <Button
            variant="outline"
            onClick={async () => {
              const [sites, quests] = await Promise.all([store.sites.list() as Promise<Site[]>, store.quests.list() as Promise<Quest[]>]);
              download(`searchquest-sites-${today()}.csv`, sitesCsv(sites, new Map(quests.map((q) => [q.id, q]))), 'text/csv;charset=utf-8');
            }}
          >
            <DownloadIcon data-icon="inline-start" />Export all sites (CSV)
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importFile(f); }} />
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>Export a backup first if you might need the data again.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="destructive"
            onClick={async () => {
              const sites = (await store.sites.list()) as Site[];
              if (!(await confirmDialog({ title: `Delete all ${sites.length} sites?`, description: 'Quests, templates and blocks stay.', confirmLabel: 'Delete all sites', destructive: true }))) return;
              await bg('sites:delete', { ids: sites.map((x) => x.id) });
              toast.success('All sites deleted');
            }}
          >
            <Trash2Icon data-icon="inline-start" />Delete all sites
          </Button>
          <Button
            variant="outline"
            className="text-destructive"
            onClick={async () => {
              if (!(await confirmDialog({ title: 'Reset everything?', description: 'Deletes all sites, quests, templates, blocks and settings, then restores the defaults.', confirmLabel: 'Reset everything', destructive: true }))) return;
              await chrome.storage.local.clear();
              await store.seedDefaults();
              location.reload();
            }}
          >
            <RotateCcwIcon data-icon="inline-start" />Reset everything
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Outreach note: US cold email (CAN-SPAM) needs a real sender address and an opt-out. Germany (UWG §7) generally requires prior consent for advertising email, B2B included. Check the rules for your market. This is not legal advice.
      </p>
    </>
  );
}
