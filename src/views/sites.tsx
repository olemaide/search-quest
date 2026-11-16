import * as React from 'react';
import { toast } from 'sonner';
import {
  ChevronDownIcon, DownloadIcon, ExternalLinkIcon, GlobeIcon, MailIcon, PhoneIcon, PlusIcon, RefreshCwIcon,
  ScanSearchIcon, SearchIcon, Trash2Icon, TriangleAlertIcon, XIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PageHeader, ScoreBadge, safeHref, scanText } from '@/components/common';
import { confirmDialog } from '@/components/confirm';
import { bg, copyText, download, openSearch, store, today } from '@/lib/ext';
import { useNav } from '@/lib/nav';
import { useExtData } from '@/hooks/use-ext-data';
import { cn } from '@/lib/utils';
import { STATUSES } from '@ext/defaults.js';
import { fmtDate, lines, timeAgo, toCsv, toUrl, uniq } from '@ext/util.js';
import type { Quest, Site } from '@/types';

const STATUS_LIST = STATUSES as [string, string][];
const STATUS_TONE: Record<string, string> = {
  new: '',
  qualified: 'text-sky-700 dark:text-sky-300',
  contacted: 'text-amber-700 dark:text-amber-300',
  replied: 'text-violet-700 dark:text-violet-300',
  won: 'text-emerald-700 dark:text-emerald-300',
  rejected: 'text-muted-foreground line-through',
};

const SORTS: [string, string][] = [
  ['new', 'Newest first'], ['old', 'Oldest first'], ['score', 'Old-site score'],
  ['year', 'Copyright year (oldest)'], ['domain', 'Domain A–Z'], ['status', 'Status'],
];

interface Filters { text: string; status: string; questId: string; email: string; scan: string; minScore: string; sort: string }
const ALL = 'all';
let saved: Filters = { text: '', status: ALL, questId: ALL, email: ALL, scan: ALL, minScore: '0', sort: 'new' };

function applyFilters(sites: Site[], F: Filters) {
  const t = F.text.trim().toLowerCase();
  const out = sites.filter((s) => {
    if (F.status !== ALL && s.status !== F.status) return false;
    if (F.questId === 'none' ? !!s.questId : F.questId !== ALL && s.questId !== F.questId) return false;
    if (F.email === 'yes' && !s.emails?.length) return false;
    if (F.email === 'no' && s.emails?.length) return false;
    if (F.scan === 'none' && s.scanState && s.scanState !== 'none') return false;
    if (F.scan === 'error' && s.scanState !== 'error') return false;
    if (+F.minScore && (s.scan?.score ?? -1) < +F.minScore) return false;
    if (t) {
      const hay = [s.title, s.domain, s.notes, s.location, ...(s.emails || []), ...(s.tags || []), s.scan?.builder].join(' ').toLowerCase();
      if (!hay.includes(t)) return false;
    }
    return true;
  });
  const idx = (st: string) => STATUS_LIST.findIndex((x) => x[0] === st);
  const by: Record<string, (a: Site, b: Site) => number> = {
    new: (a, b) => b.createdAt - a.createdAt,
    old: (a, b) => a.createdAt - b.createdAt,
    score: (a, b) => (b.scan?.score ?? -1) - (a.scan?.score ?? -1),
    year: (a, b) => (a.scan?.copyrightYear ?? 9999) - (b.scan?.copyrightYear ?? 9999),
    domain: (a, b) => a.domain.localeCompare(b.domain),
    status: (a, b) => idx(a.status) - idx(b.status),
  };
  return out.sort(by[F.sort] || by.new);
}

export function sitesCsv(list: Site[], qmap: Map<string, Quest>) {
  const rows: unknown[][] = [['domain', 'url', 'title', 'emails', 'phones', 'status', 'old_site_score', 'copyright_year', 'builder', 'https', 'mobile_friendly', 'signals', 'quest', 'location', 'tags', 'notes', 'query', 'saved_at', 'scanned_at']];
  for (const s of list) {
    rows.push([
      s.domain, s.url, s.title, s.emails || [], s.phones || [], s.status, s.scan?.score ?? '', s.scan?.copyrightYear ?? '',
      s.scan?.builder ?? '', s.scan ? (s.scan.https ? 'yes' : 'no') : '', s.scan ? (s.scan.mobile ? 'yes' : 'no') : '',
      s.scan?.signals || [], (s.questId && qmap.get(s.questId)?.name) || '', s.location || '', s.tags || [], s.notes || '', s.query || '',
      s.createdAt ? new Date(s.createdAt).toISOString() : '', s.scannedAt ? new Date(s.scannedAt).toISOString() : '',
    ]);
  }
  return '﻿' + toCsv(rows);
}

const patchSites = (ids: string[], patch: Partial<Site>) => bg('sites:patch', { ids, patch });
const scanSites = (ids: string[]) => bg<number>('sites:scan', { ids });

function StatusSelect({ site, className }: { site: Site; className?: string }) {
  return (
    <Select value={site.status} onValueChange={(v) => patchSites([site.id], { status: v })}>
      <SelectTrigger size="sm" aria-label="Status" className={cn('w-[7.5rem]', STATUS_TONE[site.status], className)}><SelectValue /></SelectTrigger>
      <SelectContent>
        {STATUS_LIST.map(([v, l]) => <SelectItem key={v} value={v} className={STATUS_TONE[v]}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function EmailCell({ site }: { site: Site }) {
  if (site.emails?.length) {
    return (
      <span className="flex min-w-0 items-center gap-1">
        <button type="button" className="truncate text-left text-primary underline-offset-4 hover:underline" title={`Copy ${site.emails[0]}`} onClick={(e) => { e.stopPropagation(); copyText(site.emails[0]); }}>
          {site.emails[0]}
        </button>
        {site.emails.length > 1 ? <Badge variant="secondary" className="h-5 px-1.5">+{site.emails.length - 1}</Badge> : null}
      </span>
    );
  }
  const busy = site.scanState === 'queued' || site.scanState === 'scanning';
  return (
    <span className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', site.scanState === 'error' && 'text-destructive')} title={site.scanError || undefined}>
      {busy ? <Spinner className="size-3" /> : null}
      {scanText(site)}
    </span>
  );
}

export function SitesView() {
  const { params } = useNav();
  const [F, setF] = React.useState<Filters>(() => (params.questId ? { ...saved, questId: params.questId } : saved));
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [limit, setLimit] = React.useState(150);
  const [data] = useExtData(
    async () => ({ sites: (await store.sites.list()) as Site[], quests: (await store.quests.list()) as Quest[] }),
    (k) => k.startsWith('site:') || k.startsWith('quest:'),
  );

  React.useEffect(() => { saved = F; }, [F]);
  const set = (p: Partial<Filters>) => { setF((f) => ({ ...f, ...p })); setLimit(150); };

  if (!data) return null;
  const { sites, quests } = data;
  const qmap = new Map(quests.map((q) => [q.id, q]));
  const ids = new Set(sites.map((s) => s.id));
  const sel = new Set([...selected].filter((id) => ids.has(id)));
  const list = applyFilters(sites, F);
  const target = sel.size ? sites.filter((s) => sel.has(s.id)) : list;
  const targetLabel = sel.size ? `${sel.size} selected` : `${list.length} shown`;
  const unscanned = sites.filter((s) => !s.scanState || s.scanState === 'none' || s.scanState === 'error');
  const busy = sites.filter((s) => s.scanState === 'queued' || s.scanState === 'scanning').length;
  const allShown = list.length > 0 && list.every((s) => sel.has(s.id));
  const someShown = list.some((s) => sel.has(s.id));
  const toggle = (id: string, on: boolean) => setSelected((cur) => { const n = new Set(cur); if (on) n.add(id); else n.delete(id); return n; });
  const toggleAll = (on: boolean) => setSelected((cur) => { const n = new Set(cur); list.forEach((s) => (on ? n.add(s.id) : n.delete(s.id))); return n; });

  const copyEmails = () => {
    const emails = uniq(target.flatMap((s) => s.emails || [])) as string[];
    if (!emails.length) return toast.info('No emails in these sites yet.');
    copyText(emails.join('\n'), `Copied ${emails.length} emails`);
  };
  const exportCsv = () => download(`searchquest-sites-${today()}.csv`, sitesCsv(target, qmap), 'text/csv;charset=utf-8');
  const deleteSelected = async () => {
    if (!(await confirmDialog({ title: `Delete ${sel.size} sites?`, description: 'This can’t be undone.', confirmLabel: 'Delete', destructive: true }))) return;
    await bg('sites:delete', { ids: [...sel] });
    setSelected(new Set());
  };
  const filtersActive = F.text || F.status !== ALL || F.questId !== ALL || F.email !== ALL || F.scan !== ALL || F.minScore !== '0';

  return (
    <>
      <PageHeader
        title="Sites"
        description={`${sites.length} saved · ${sites.filter((s) => s.emails?.length).length} with email${busy ? ` · scanning ${busy}…` : ''}`}
        actions={
          <>
            {unscanned.length ? (
              <Button variant="outline" size="sm" onClick={async () => { const n = await scanSites(unscanned.map((s) => s.id)); toast.success(`Scanning ${n} sites`); }}>
                <ScanSearchIcon data-icon="inline-start" />Scan {unscanned.length} unscanned
              </Button>
            ) : null}
            <Button size="sm" onClick={() => setAddOpen(true)}><PlusIcon data-icon="inline-start" />Add URLs</Button>
          </>
        }
      />

      <div className="flex flex-col gap-2">
        <InputGroup>
          <InputGroupAddon><SearchIcon /></InputGroupAddon>
          <InputGroupInput placeholder="Search title, domain, email, notes…" value={F.text} onChange={(e) => set({ text: e.target.value })} />
          {F.text ? <InputGroupAddon align="inline-end"><InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => set({ text: '' })}><XIcon /></InputGroupButton></InputGroupAddon> : null}
        </InputGroup>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="Status" value={F.status} onChange={(v) => set({ status: v })} options={[[ALL, 'Any status'], ...STATUS_LIST]} />
          <FilterSelect label="Quest" value={F.questId} onChange={(v) => set({ questId: v })} options={[[ALL, 'All quests'], ['none', 'No quest'], ...quests.map((q) => [q.id, q.name] as [string, string])]} />
          <FilterSelect label="Email" value={F.email} onChange={(v) => set({ email: v })} options={[[ALL, 'Email: any'], ['yes', 'Has email'], ['no', 'No email']]} />
          <FilterSelect label="Scan" value={F.scan} onChange={(v) => set({ scan: v })} options={[[ALL, 'Scan: any'], ['none', 'Not scanned'], ['error', 'Scan failed']]} />
          <FilterSelect label="Score" value={F.minScore} onChange={(v) => set({ minScore: v })} options={[['0', 'Any score'], ['30', 'Score ≥ 30'], ['50', 'Score ≥ 50'], ['70', 'Score ≥ 70']]} />
          <FilterSelect label="Sort" value={F.sort} onChange={(v) => set({ sort: v })} options={SORTS} />
          {filtersActive ? <Button variant="ghost" size="sm" onClick={() => set({ text: '', status: ALL, questId: ALL, email: ALL, scan: ALL, minScore: '0' })}>Reset</Button> : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{list.length} of {sites.length} shown{sel.size ? ` · ${sel.size} selected` : ''}</span>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={!target.length} onClick={copyEmails}><MailIcon data-icon="inline-start" />Copy emails</Button>
          <Button variant="outline" size="sm" disabled={!target.length} onClick={exportCsv}><DownloadIcon data-icon="inline-start" />Export CSV</Button>
          {sel.size ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button size="sm" variant="secondary">{sel.size} selected<ChevronDownIcon data-icon="inline-end" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={async () => { await scanSites([...sel]); toast.success('Scan queued'); }}><RefreshCwIcon />Scan again</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Set status</DropdownMenuLabel>
                {STATUS_LIST.map(([v, l]) => (
                  <DropdownMenuItem key={v} className={STATUS_TONE[v]} onSelect={async () => { await patchSites([...sel], { status: v }); toast.success(`Marked ${sel.size} as ${l}`); }}>{l}</DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setSelected(new Set())}><XIcon />Clear selection</DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={deleteSelected}><Trash2Icon />Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
      <span className="sr-only" aria-live="polite">{`Actions apply to ${targetLabel}`}</span>

      {!sites.length ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><GlobeIcon /></EmptyMedia>
            <EmptyTitle>No saved sites yet</EmptyTitle>
            <EmptyDescription>Run a search, then click “+ Save” next to a Google result or “Save all new” in the floating bar. You can also save the current tab, right-click a link, or paste URLs.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : !list.length ? (
        <Empty className="border"><EmptyHeader><EmptyTitle>No sites match these filters</EmptyTitle></EmptyHeader></Empty>
      ) : (
        <>
          {/* Wide: table */}
          <div className="hidden overflow-hidden rounded-lg border @3xl/main:block">
            <Table className="table-fixed">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox aria-label="Select all shown" checked={allShown ? true : someShown ? 'indeterminate' : false} onCheckedChange={(v) => toggleAll(!!v)} />
                  </TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead className="w-[26%]">Email</TableHead>
                  <TableHead className="w-16">Score</TableHead>
                  <TableHead className="w-14">©</TableHead>
                  <TableHead className="w-[14%]">Builder</TableHead>
                  <TableHead className="w-36">Status</TableHead>
                  <TableHead className="w-10"><span className="sr-only">Scan</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.slice(0, limit).map((s) => {
                  const quest = s.questId ? qmap.get(s.questId) : undefined;
                  const scanning = s.scanState === 'queued' || s.scanState === 'scanning';
                  return (
                    <TableRow key={s.id} data-state={sel.has(s.id) ? 'selected' : undefined} className="cursor-pointer" onClick={() => setOpenId(s.id)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox aria-label={`Select ${s.domain}`} checked={sel.has(s.id)} onCheckedChange={(v) => toggle(s.id, !!v)} />
                      </TableCell>
                      <TableCell className="max-w-0">
                        <div className="truncate font-medium">{s.title || s.domain}</div>
                        <div className="truncate text-xs text-muted-foreground">{s.domain}{quest ? ` · ${quest.name}` : ''}{s.location ? ` · ${s.location}` : ''}</div>
                      </TableCell>
                      <TableCell className="max-w-0"><EmailCell site={s} /></TableCell>
                      <TableCell><ScoreBadge score={s.scan?.score} /></TableCell>
                      <TableCell className="tabular-nums">{s.scan?.copyrightYear ?? '–'}</TableCell>
                      <TableCell className="max-w-0 truncate text-xs text-muted-foreground" title={s.scan?.builders?.join(', ')}>{s.scan?.builder || ''}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}><StatusSelect site={s} /></TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon-xs" aria-label="Scan again" onClick={() => scanSites([s.id])}>
                              <RefreshCwIcon className={cn(scanning && 'animate-spin')} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Scan again</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Narrow (side panel): items */}
          <ItemGroup className="gap-2 @3xl/main:hidden">
            {list.slice(0, limit).map((s) => (
              <Item key={s.id} variant="outline" size="sm" className={cn('items-start', sel.has(s.id) && 'bg-muted/60')}>
                <Checkbox className="mt-0.5" aria-label={`Select ${s.domain}`} checked={sel.has(s.id)} onCheckedChange={(v) => toggle(s.id, !!v)} />
                <ItemContent className="min-w-0 gap-1.5">
                  <button type="button" className="min-w-0 text-left" onClick={() => setOpenId(s.id)}>
                    <ItemTitle className="w-full truncate">{s.title || s.domain}</ItemTitle>
                    <ItemDescription className="truncate text-xs">{s.domain}{s.location ? ` · ${s.location}` : ''}</ItemDescription>
                  </button>
                  <EmailCell site={s} />
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {s.scan?.copyrightYear ? <Badge variant="outline">© {s.scan.copyrightYear}</Badge> : null}
                    {s.scan?.builder ? <Badge variant="outline" className="max-w-40 truncate">{s.scan.builder}</Badge> : null}
                  </div>
                </ItemContent>
                <ItemActions className="flex-col items-end gap-2">
                  <ScoreBadge score={s.scan?.score} />
                  <StatusSelect site={s} className="w-[6.75rem]" />
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>

          {list.length > limit ? (
            <Button variant="outline" className="self-center" onClick={() => setLimit((l) => l + 300)}>Show more ({list.length - limit} hidden)</Button>
          ) : null}
        </>
      )}

      <SiteSheet id={openId} qmap={qmap} onOpenChange={(o) => !o && setOpenId(null)} />
      <AddUrlsDialog open={addOpen} onOpenChange={setAddOpen} quests={quests} />
    </>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label={label} className="w-auto max-w-56"><SelectValue /></SelectTrigger>
      <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );
}

// ----------------------------------------------------------------- detail sheet

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  if (children == null || children === '') return null;
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words">{children}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

function SiteSheet({ id, qmap, onOpenChange }: { id: string | null; qmap: Map<string, Quest>; onOpenChange: (o: boolean) => void }) {
  const [site] = useExtData(
    async () => (id ? ((await store.sites.get(id)) as Site | null) : null),
    (k) => !!id && k === 'site:' + id,
    [id],
  );
  const s = site && site.id === id ? site : null;
  return (
    <Sheet open={!!id} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        {s ? <SiteDetail key={s.id} s={s} qmap={qmap} onClose={() => onOpenChange(false)} /> : <SheetHeader><SheetTitle>Loading…</SheetTitle></SheetHeader>}
      </SheetContent>
    </Sheet>
  );
}

function SiteDetail({ s, qmap, onClose }: { s: Site; qmap: Map<string, Quest>; onClose: () => void }) {
  const [notes, setNotes] = React.useState(s.notes || '');
  const [tags, setTags] = React.useState((s.tags || []).join(', '));
  const [newEmail, setNewEmail] = React.useState('');
  const patch = (p: Partial<Site>) => patchSites([s.id], p);
  const sc = s.scan;
  const quest = s.questId ? qmap.get(s.questId) : undefined;
  const scanning = s.scanState === 'queued' || s.scanState === 'scanning';

  const addEmail = () => {
    const e = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return toast.error('That doesn’t look like an email address.');
    patch({ emails: uniq([...(s.emails || []), e]) as string[] });
    setNewEmail('');
  };

  return (
    <>
      <SheetHeader className="border-b pr-12">
        <SheetTitle className="truncate">{s.title || s.domain}</SheetTitle>
        <SheetDescription asChild>
          <a href={safeHref(s.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 truncate text-primary hover:underline">
            {s.url}<ExternalLinkIcon className="size-3 shrink-0" />
          </a>
        </SheetDescription>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <StatusSelect site={s} />
          <Button size="sm" variant="outline" disabled={scanning} onClick={() => scanSites([s.id])}>
            {scanning ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
            {scanning ? 'Scanning…' : sc ? 'Rescan' : 'Scan'}
          </Button>
          <Button
            size="sm" variant="ghost" className="ml-auto text-destructive hover:text-destructive"
            onClick={async () => {
              if (!(await confirmDialog({ title: 'Delete this site?', description: s.domain, confirmLabel: 'Delete', destructive: true }))) return;
              await bg('sites:delete', { ids: [s.id] });
              onClose();
            }}
          >
            <Trash2Icon data-icon="inline-start" />Delete
          </Button>
        </div>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
        {s.scanState === 'error' ? (
          <p className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            Last scan failed: {s.scanError || 'unknown error'}. The site may be down, slow, or blocking bots.
          </p>
        ) : null}

        <Section title="Contact">
          {s.emails?.length ? (
            <ItemGroup className="gap-1">
              {s.emails.map((e) => (
                <Item key={e} size="xs" variant="muted" className="py-1.5">
                  <MailIcon className="size-4 text-muted-foreground" />
                  <ItemContent className="min-w-0"><ItemTitle className="w-full truncate font-normal">{e}</ItemTitle></ItemContent>
                  <ItemActions className="gap-0.5">
                    <Button size="xs" variant="ghost" onClick={() => copyText(e)}>Copy</Button>
                    <Button size="xs" variant="ghost" asChild><a href={'mailto:' + e}>Mail</a></Button>
                    <Button size="icon-xs" variant="ghost" aria-label={`Remove ${e}`} onClick={() => patch({ emails: s.emails.filter((x) => x !== e) })}><XIcon /></Button>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          ) : (
            <p className="text-sm text-muted-foreground">{s.scanState === 'done' ? 'No email found on the scanned pages. Try the contact form or call.' : scanText(s)}</p>
          )}
          <InputGroup>
            <InputGroupInput type="email" placeholder="Add an email manually" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addEmail()} />
            <InputGroupAddon align="inline-end"><InputGroupButton onClick={addEmail}>Add</InputGroupButton></InputGroupAddon>
          </InputGroup>
          {s.phones?.length || (sc?.socials && Object.keys(sc.socials).length) ? (
            <div className="flex flex-wrap gap-1.5">
              {(s.phones || []).map((p) => (
                <Badge key={p} variant="outline" asChild><a href={'tel:' + p.replace(/[^\d+]/g, '')}><PhoneIcon />{p}</a></Badge>
              ))}
              {Object.entries(sc?.socials || {}).map(([k, u]) => (
                <Badge key={k} variant="secondary" asChild><a href={safeHref(u)} target="_blank" rel="noopener noreferrer" className="capitalize">{k}</a></Badge>
              ))}
            </div>
          ) : null}
        </Section>

        <Separator />

        <Section title="Old-site signals">
          {sc ? (
            <>
              <div className="flex items-center gap-2 text-sm"><ScoreBadge score={sc.score} /><span className="text-muted-foreground">Old-site score (0–100)</span></div>
              <div>
                <Row label="Copyright year">{sc.copyrightYear}</Row>
                <Row label="Last updated">{sc.lastUpdated}</Row>
                <Row label="Builder / CMS">{sc.builders?.join(', ')}</Row>
                <Row label="Generator tag">{sc.generator}</Row>
                <Row label="Outdated CMS">{sc.oldCms}</Row>
                <Row label="HTTPS">{sc.https ? 'Yes' : <span className="text-amber-700 dark:text-amber-300">No</span>}</Row>
                <Row label="Mobile viewport">{sc.mobile ? 'Yes' : <span className="text-amber-700 dark:text-amber-300">No</span>}</Row>
              </div>
              {sc.signals?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {sc.signals.map((x) => <Badge key={x} variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200">{x}</Badge>)}
                </div>
              ) : null}
            </>
          ) : <p className="text-sm text-muted-foreground">{scanText(s)}</p>}
        </Section>

        <Separator />

        <Section title="Notes">
          <Textarea rows={3} value={notes} placeholder="What to pitch, who you talked to…" onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (s.notes || '') && patch({ notes })} />
          <Field className="gap-1.5">
            <FieldLabel htmlFor="tags">Tags</FieldLabel>
            <Input id="tags" value={tags} placeholder="comma separated" onChange={(e) => setTags(e.target.value)}
              onBlur={() => patch({ tags: uniq(tags.split(',').map((t) => t.trim()).filter(Boolean)) as string[] })} />
          </Field>
        </Section>

        <Separator />

        <Section title="Source">
          <div>
            <Row label="Quest">{quest ? quest.name + (s.location ? ' · ' + s.location : '') : s.location}</Row>
            {s.query ? (
              <Row label="Query">
                <code className="font-mono text-xs">{s.query}</code>{' '}
                <span className="inline-flex gap-1">
                  <Button variant="link" size="xs" className="h-auto p-0" onClick={() => copyText(s.query)}>copy</Button>
                  <Button variant="link" size="xs" className="h-auto p-0" onClick={() => openSearch(s.query, s.questId ? { questId: s.questId, location: s.location } : {})}>re-run</Button>
                </span>
              </Row>
            ) : null}
            <Row label="Google snippet">{s.snippet}</Row>
            <Row label="Description">{sc?.description}</Row>
            <Row label="Saved">{fmtDate(s.createdAt)}</Row>
            <Row label="Scanned">{s.scannedAt ? `${fmtDate(s.scannedAt)} (${timeAgo(s.scannedAt)})` : null}</Row>
          </div>
          {sc?.pages?.length ? (
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              {sc.pages.map((p) => (
                <li key={p.url} className="truncate">
                  <a href={safeHref(p.url)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{p.url}</a> · {p.status} · {p.emails} email{p.emails === 1 ? '' : 's'}
                </li>
              ))}
            </ul>
          ) : null}
        </Section>
      </div>
    </>
  );
}

// ----------------------------------------------------------------- add urls

function AddUrlsDialog({ open, onOpenChange, quests }: { open: boolean; onOpenChange: (o: boolean) => void; quests: Quest[] }) {
  const [text, setText] = React.useState('');
  const [questId, setQuestId] = React.useState('none');
  const [scan, setScan] = React.useState(true);
  const valid = (lines(text).map(toUrl).filter(Boolean) as string[]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid.length) return toast.error('No valid URLs found.');
    const r = await bg<{ added: string[]; dupes: string[] }>('sites:add', { items: valid.map((url) => ({ url })), questId: questId === 'none' ? null : questId, scan });
    toast.success(`Added ${r.added.length} site${r.added.length === 1 ? '' : 's'}`, { description: r.dupes.length ? `${r.dupes.length} were already saved` : undefined });
    setText('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Add sites</DialogTitle>
            <DialogDescription>Paste URLs or bare domains, one per line.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="urls">URLs</FieldLabel>
              <Textarea id="urls" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={'mueller-dach.de\nhttps://www.smith-funeral-home.com'} className="font-mono text-xs" />
              <FieldDescription>{valid.length} valid URL{valid.length === 1 ? '' : 's'}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Add to quest</FieldLabel>
              <Select value={questId} onValueChange={setQuestId}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No quest</SelectItem>
                  {quests.map((q) => <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <FieldSeparator />
            <Field orientation="horizontal">
              <Switch id="scan-now" checked={scan} onCheckedChange={setScan} />
              <FieldLabel htmlFor="scan-now" className="font-normal">Scan them for emails right away</FieldLabel>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!valid.length}>Add {valid.length || ''}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
