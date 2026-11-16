import * as React from 'react';
import { toast } from 'sonner';
import {
  ArrowUpDownIcon, CheckIcon, ChevronRightIcon, DownloadIcon, ExternalLinkIcon, GlobeIcon, ListFilterIcon, LockIcon,
  LockOpenIcon, MailIcon, PhoneIcon, PlusIcon, RefreshCwIcon, ScanSearchIcon, SearchIcon, SmartphoneIcon, Trash2Icon,
  TriangleAlertIcon, XIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { IconAction, InfoTip, PageHeader, ScoreBadge, safeHref, scanText } from '@/components/common';
import { confirmDialog } from '@/components/confirm';
import { bg, copyText, download, openSearch, store, today } from '@/lib/ext';
import { useNav } from '@/lib/nav';
import { useExtData } from '@/hooks/use-ext-data';
import { cn } from '@/lib/utils';
import { STATUSES } from '@ext/defaults.js';
import { fmtDate, lines, timeAgo, toCsv, toUrl, uniq } from '@ext/util.js';
import type { Quest, Site } from '@/types';

const STATUS_LIST = STATUSES as [string, string][];
const STATUS_LABEL = Object.fromEntries(STATUS_LIST);
const STATUS_DOT: Record<string, string> = {
  new: 'bg-zinc-400', qualified: 'bg-sky-500', contacted: 'bg-amber-500', replied: 'bg-violet-500', won: 'bg-emerald-500', rejected: 'bg-zinc-300 dark:bg-zinc-600',
};

const SORTS: [string, string][] = [
  ['new', 'Newest'], ['old', 'Oldest'], ['score', 'Highest score'], ['year', 'Oldest ©'], ['domain', 'Domain A–Z'], ['status', 'Status'],
];

interface Filters { text: string; status: string; questId: string; email: string; scan: string; minScore: string; sort: string }
const ALL = 'all';
const NO_FILTERS = { status: ALL, questId: ALL, email: ALL, scan: ALL, minScore: '0' };
let saved: Filters = { text: '', ...NO_FILTERS, sort: 'new' };

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
const isBusy = (s: Site) => s.scanState === 'queued' || s.scanState === 'scanning';

function StatusSelect({ site, ghost = true, className }: { site: Site; ghost?: boolean; className?: string }) {
  return (
    <Select value={site.status} onValueChange={(v) => patchSites([site.id], { status: v })}>
      <SelectTrigger
        size="sm"
        aria-label="Status"
        className={cn('w-[7.75rem] gap-2', ghost && 'border-transparent bg-transparent shadow-none hover:border-input dark:bg-transparent', className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_LIST.map(([v, l]) => (
          <SelectItem key={v} value={v}><span className={cn('size-2 rounded-full', STATUS_DOT[v])} />{l}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EmailCell({ site }: { site: Site }) {
  if (site.emails?.length) {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="min-w-0 truncate text-left hover:underline" onClick={(e) => { e.stopPropagation(); copyText(site.emails[0]); }}>
              {site.emails[0]}
            </button>
          </TooltipTrigger>
          <TooltipContent>Copy</TooltipContent>
        </Tooltip>
        {site.emails.length > 1 ? <span className="shrink-0 text-xs text-muted-foreground">+{site.emails.length - 1}</span> : null}
      </span>
    );
  }
  return (
    <span className={cn('flex items-center gap-1.5 text-xs text-muted-foreground/80', site.scanState === 'error' && 'text-destructive')} title={site.scanError || undefined}>
      {isBusy(site) ? <Spinner className="size-3" /> : null}
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
  const scope = sel.size ? `${sel.size} selected` : `${list.length} shown`;
  const unscanned = sites.filter((s) => !s.scanState || s.scanState === 'none' || s.scanState === 'error');
  const busy = sites.filter(isBusy).length;
  const allShown = list.length > 0 && list.every((s) => sel.has(s.id));
  const someShown = list.some((s) => sel.has(s.id));
  const toggle = (id: string, on: boolean) => setSelected((cur) => { const n = new Set(cur); if (on) n.add(id); else n.delete(id); return n; });
  const toggleAll = (on: boolean) => setSelected((cur) => { const n = new Set(cur); list.forEach((s) => (on ? n.add(s.id) : n.delete(s.id))); return n; });

  const copyEmails = () => {
    const emails = uniq(target.flatMap((s) => s.emails || [])) as string[];
    if (!emails.length) return toast.info('No emails yet');
    copyText(emails.join('\n'), `Copied ${emails.length} emails`);
  };

  const chips: { key: keyof Filters; label: string }[] = [];
  if (F.status !== ALL) chips.push({ key: 'status', label: STATUS_LABEL[F.status] });
  if (F.questId !== ALL) chips.push({ key: 'questId', label: F.questId === 'none' ? 'No quest' : qmap.get(F.questId)?.name || 'Quest' });
  if (F.email !== ALL) chips.push({ key: 'email', label: F.email === 'yes' ? 'Has email' : 'No email' });
  if (F.scan !== ALL) chips.push({ key: 'scan', label: F.scan === 'none' ? 'Not scanned' : 'Scan failed' });
  if (F.minScore !== '0') chips.push({ key: 'minScore', label: `Score ≥ ${F.minScore}` });

  return (
    <>
      <PageHeader
        title="Sites"
        count={sites.length}
        info="Sites you saved from Google, the current tab, a right-click or pasted URLs. Each one is scanned for emails and old-site signals."
        actions={
          <>
            {busy ? (
              <Tooltip>
                <TooltipTrigger asChild><Badge variant="secondary" className="gap-1.5"><Spinner className="size-3" />{busy}</Badge></TooltipTrigger>
                <TooltipContent>Scanning {busy} sites</TooltipContent>
              </Tooltip>
            ) : null}
            {unscanned.length ? (
              <IconAction label={`Scan ${unscanned.length} unscanned`} icon={ScanSearchIcon} onClick={async () => { const n = await scanSites(unscanned.map((s) => s.id)); toast.success(`Scanning ${n} sites`); }} />
            ) : null}
            <Button size="sm" onClick={() => setAddOpen(true)}><PlusIcon data-icon="inline-start" />Add</Button>
          </>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <InputGroup className="flex-1">
            <InputGroupAddon><SearchIcon /></InputGroupAddon>
            <InputGroupInput placeholder="Search" value={F.text} onChange={(e) => set({ text: e.target.value })} />
            {F.text ? <InputGroupAddon align="inline-end"><InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => set({ text: '' })}><XIcon /></InputGroupButton></InputGroupAddon> : null}
          </InputGroup>
          <FilterPopover F={F} set={set} quests={quests} active={chips.length} />
          <Select value={F.sort} onValueChange={(v) => set({ sort: v })}>
            <Tooltip>
              <TooltipTrigger asChild>
                <SelectTrigger aria-label="Sort" className="w-auto gap-1.5 [&>svg:last-child]:hidden">
                  <ArrowUpDownIcon className="size-4 text-muted-foreground" />
                  <span className="hidden @2xl/main:inline"><SelectValue /></span>
                </SelectTrigger>
              </TooltipTrigger>
              <TooltipContent>Sort</TooltipContent>
            </Tooltip>
            <SelectContent align="end">{SORTS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <IconAction label={`Copy emails (${scope})`} icon={MailIcon} variant="outline" size="icon" disabled={!target.length} onClick={copyEmails} />
          <IconAction label={`Export CSV (${scope})`} icon={DownloadIcon} variant="outline" size="icon" disabled={!target.length} onClick={() => download(`searchquest-sites-${today()}.csv`, sitesCsv(target, qmap), 'text/csv;charset=utf-8')} />
        </div>
        {chips.length ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {chips.map((c) => (
              <Badge key={c.key} variant="secondary" className="h-6 gap-1 pr-1 font-normal">
                {c.label}
                <button type="button" aria-label={`Remove filter ${c.label}`} onClick={() => set({ [c.key]: c.key === 'minScore' ? '0' : ALL })} className="rounded-sm p-0.5 hover:bg-foreground/10"><XIcon className="size-3" /></button>
              </Badge>
            ))}
            <Button variant="link" size="xs" className="h-auto px-1 text-muted-foreground" onClick={() => set(NO_FILTERS)}>Clear</Button>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">{list.length} of {sites.length}</span>
          </div>
        ) : null}
      </div>

      {!sites.length ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon"><GlobeIcon /></EmptyMedia>
            <EmptyTitle>No sites yet</EmptyTitle>
            <EmptyDescription>Click “+ Save” next to a Google result.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : !list.length ? (
        <Empty className="border border-dashed"><EmptyHeader><EmptyTitle>Nothing matches</EmptyTitle></EmptyHeader></Empty>
      ) : (
        <>
          {/* Wide: table */}
          <div className="hidden overflow-hidden rounded-xl border @3xl/main:block">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 pl-3"><Checkbox aria-label="Select all shown" checked={allShown ? true : someShown ? 'indeterminate' : false} onCheckedChange={(v) => toggleAll(!!v)} /></TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead className="w-[28%]">Email</TableHead>
                  <TableHead className="w-16 text-center">Score</TableHead>
                  <TableHead className="w-14 text-right">©</TableHead>
                  <TableHead className="hidden w-[13%] @5xl/main:table-cell">Builder</TableHead>
                  <TableHead className="w-36">Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.slice(0, limit).map((s) => {
                  const quest = s.questId ? qmap.get(s.questId) : undefined;
                  return (
                    <TableRow key={s.id} data-state={sel.has(s.id) ? 'selected' : undefined} className="group/row h-12 cursor-pointer" onClick={() => setOpenId(s.id)}>
                      <TableCell className="pl-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox aria-label={`Select ${s.domain}`} checked={sel.has(s.id)} onCheckedChange={(v) => toggle(s.id, !!v)} />
                      </TableCell>
                      <TableCell className="max-w-0">
                        <div className="truncate font-medium">{s.title || s.domain}</div>
                        <div className="truncate text-xs text-muted-foreground">{s.domain}{s.location ? ` · ${s.location}` : quest ? ` · ${quest.name}` : ''}</div>
                      </TableCell>
                      <TableCell className="max-w-0"><EmailCell site={s} /></TableCell>
                      <TableCell className="text-center"><ScoreBadge score={s.scan?.score} /></TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{s.scan?.copyrightYear ?? '–'}</TableCell>
                      <TableCell className="hidden max-w-0 truncate text-xs text-muted-foreground @5xl/main:table-cell" title={s.scan?.builders?.join(', ')}>{s.scan?.builder || ''}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}><StatusSelect site={s} className="-ml-2.5" /></TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <IconAction
                          label="Scan again"
                          icon={RefreshCwIcon}
                          size="icon-xs"
                          className={cn(isBusy(s) ? '[&_svg]:animate-spin' : 'opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100')}
                          onClick={() => scanSites([s.id])}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Narrow (side panel): rows */}
          <ul className="flex flex-col divide-y overflow-hidden rounded-xl border @3xl/main:hidden">
            {list.slice(0, limit).map((s) => (
              <li key={s.id} className={cn('flex items-start gap-3 px-3 py-2.5', sel.has(s.id) && 'bg-muted/60')}>
                <Checkbox className="mt-1" aria-label={`Select ${s.domain}`} checked={sel.has(s.id)} onCheckedChange={(v) => toggle(s.id, !!v)} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <button type="button" className="flex min-w-0 items-center gap-2 text-left" onClick={() => setOpenId(s.id)}>
                    <span className="min-w-0 flex-1 truncate font-medium">{s.title || s.domain}</span>
                    <ScoreBadge score={s.scan?.score} />
                  </button>
                  <span className="truncate text-xs text-muted-foreground">{s.domain}{s.scan?.copyrightYear ? ` · © ${s.scan.copyrightYear}` : ''}</span>
                  <div className="flex min-w-0 items-center gap-2 text-sm">
                    <div className="min-w-0 flex-1"><EmailCell site={s} /></div>
                    <StatusSelect site={s} className="-mr-2 w-auto" />
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {list.length > limit ? <Button variant="ghost" className="self-center" onClick={() => setLimit((l) => l + 300)}>Show {list.length - limit} more</Button> : null}
        </>
      )}

      {/* Bulk actions appear only when something is selected */}
      {sel.size ? (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-3">
          <div role="toolbar" aria-label="Bulk actions" className="flex items-center gap-1 rounded-xl border bg-popover p-1.5 pl-3 text-popover-foreground shadow-lg animate-in fade-in-0 slide-in-from-bottom-2">
            <span className="mr-1 text-sm font-medium tabular-nums">{sel.size} selected</span>
            <Separator orientation="vertical" className="mx-1 h-5" />
            <IconAction label="Scan again" icon={RefreshCwIcon} onClick={async () => { await scanSites([...sel]); toast.success('Scan queued'); }} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button size="sm" variant="ghost">Status</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="center" side="top">
                <DropdownMenuLabel>Set status</DropdownMenuLabel>
                {STATUS_LIST.map(([v, l]) => (
                  <DropdownMenuItem key={v} onSelect={async () => { await patchSites([...sel], { status: v }); toast.success(`${sel.size} → ${l}`); }}>
                    <span className={cn('size-2 rounded-full', STATUS_DOT[v])} />{l}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <IconAction
              label="Delete"
              icon={Trash2Icon}
              className="text-destructive hover:text-destructive"
              onClick={async () => {
                if (!(await confirmDialog({ title: `Delete ${sel.size} sites?`, confirmLabel: 'Delete', destructive: true }))) return;
                await bg('sites:delete', { ids: [...sel] });
                setSelected(new Set());
              }}
            />
            <IconAction label="Clear selection" icon={XIcon} onClick={() => setSelected(new Set())} />
          </div>
        </div>
      ) : null}

      <SiteSheet id={openId} qmap={qmap} onOpenChange={(o) => !o && setOpenId(null)} />
      <AddUrlsDialog open={addOpen} onOpenChange={setAddOpen} quests={quests} />
    </>
  );
}

function FilterPopover({ F, set, quests, active }: { F: Filters; set: (p: Partial<Filters>) => void; quests: Quest[]; active: number }) {
  const row = (label: string, key: keyof Filters, options: [string, string][]) => (
    <Field orientation="horizontal" className="justify-between">
      <FieldLabel className="font-normal text-muted-foreground">{label}</FieldLabel>
      <Select value={F[key]} onValueChange={(v) => set({ [key]: v })}>
        <SelectTrigger size="sm" className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
      </Select>
    </Field>
  );
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="outline" size={active ? 'default' : 'icon'} aria-label="Filters">
              <ListFilterIcon />
              {active ? <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">{active}</span> : null}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Filters</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80">
        <FieldGroup className="gap-3">
          {row('Status', 'status', [[ALL, 'Any'], ...STATUS_LIST])}
          {row('Quest', 'questId', [[ALL, 'Any'], ['none', 'No quest'], ...quests.map((q) => [q.id, q.name] as [string, string])])}
          {row('Email', 'email', [[ALL, 'Any'], ['yes', 'Has email'], ['no', 'No email']])}
          {row('Scan', 'scan', [[ALL, 'Any'], ['none', 'Not scanned'], ['error', 'Failed']])}
          {row('Score', 'minScore', [['0', 'Any'], ['30', '≥ 30'], ['50', '≥ 50'], ['70', '≥ 70']])}
        </FieldGroup>
      </PopoverContent>
    </Popover>
  );
}

// ----------------------------------------------------------------- detail sheet

function SiteSheet({ id, qmap, onOpenChange }: { id: string | null; qmap: Map<string, Quest>; onOpenChange: (o: boolean) => void }) {
  const [site] = useExtData(
    async () => (id ? ((await store.sites.get(id)) as Site | null) : null),
    (k) => !!id && k === 'site:' + id,
    [id],
  );
  const s = site && site.id === id ? site : null;
  return (
    <Sheet open={!!id} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        {s ? <SiteDetail key={s.id} s={s} qmap={qmap} onClose={() => onOpenChange(false)} /> : <SheetHeader><SheetTitle className="sr-only">Site</SheetTitle><Spinner /></SheetHeader>}
      </SheetContent>
    </Sheet>
  );
}

function Fact({ icon: Icon, label, value, warn, hint }: { icon?: React.ElementType; label: string; value: React.ReactNode; warn?: boolean; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn('flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-center', warn && 'border-amber-500/30 bg-amber-500/5')}>
          <span className={cn('flex h-5 items-center gap-1 text-sm font-semibold tabular-nums', warn && 'text-amber-700 dark:text-amber-300')}>
            {Icon ? <Icon className="size-4" /> : null}{value}
          </span>
          <span className="text-[11px] text-muted-foreground">{label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex h-6 items-center gap-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
        {action ? <div className="ml-auto">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  if (children == null || children === '') return null;
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words">{children}</span>
    </div>
  );
}

function Fold({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Collapsible className="flex flex-col gap-1">
      <CollapsibleTrigger className="group -ml-1 flex h-7 items-center gap-1.5 self-start rounded-md px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
        <ChevronRightIcon className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />{title}
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

function SiteDetail({ s, qmap, onClose }: { s: Site; qmap: Map<string, Quest>; onClose: () => void }) {
  const [notes, setNotes] = React.useState(s.notes || '');
  const [tags, setTags] = React.useState((s.tags || []).join(', '));
  const [adding, setAdding] = React.useState(false);
  const [newEmail, setNewEmail] = React.useState('');
  const patch = (p: Partial<Site>) => patchSites([s.id], p);
  const sc = s.scan;
  const quest = s.questId ? qmap.get(s.questId) : undefined;
  const busy = isBusy(s);

  const addEmail = () => {
    const e = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return toast.error('Not a valid email');
    patch({ emails: uniq([...(s.emails || []), e]) as string[] });
    setNewEmail('');
    setAdding(false);
  };

  return (
    <>
      <SheetHeader className="gap-3 border-b pr-12">
        <div className="flex min-w-0 flex-col gap-0.5">
          <SheetTitle className="truncate text-base">{s.title || s.domain}</SheetTitle>
          <SheetDescription asChild>
            <a href={safeHref(s.url)} target="_blank" rel="noopener noreferrer" className="flex w-fit max-w-full items-center gap-1 truncate hover:text-foreground hover:underline">
              <span className="truncate">{s.domain}</span><ExternalLinkIcon className="size-3 shrink-0" />
            </a>
          </SheetDescription>
        </div>
        <div className="flex items-center gap-1">
          <StatusSelect site={s} ghost={false} />
          <IconAction label={sc ? 'Rescan' : 'Scan'} icon={busy ? Spinner : RefreshCwIcon} disabled={busy} onClick={() => scanSites([s.id])} />
          <IconAction
            label="Delete site"
            icon={Trash2Icon}
            className="ml-auto text-muted-foreground hover:text-destructive"
            onClick={async () => {
              if (!(await confirmDialog({ title: 'Delete this site?', description: s.domain, confirmLabel: 'Delete', destructive: true }))) return;
              await bg('sites:delete', { ids: [s.id] });
              onClose();
            }}
          />
        </div>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
        {s.scanState === 'error' ? (
          <p className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />{s.scanError || 'Scan failed'}
          </p>
        ) : null}

        {sc ? (
          <div className="grid grid-cols-4 gap-2">
            <Fact label="Score" value={<ScoreBadge score={sc.score} className="h-5 text-sm" />} hint="Old-site score · higher = older site" />
            <Fact label="©" value={sc.copyrightYear ?? '–'} warn={!!sc.copyrightYear && new Date().getFullYear() - sc.copyrightYear >= 6} hint="Most recent copyright year on the site" />
            <Fact label="HTTPS" icon={sc.https ? LockIcon : LockOpenIcon} value={null} warn={!sc.https} hint={sc.https ? 'Served over HTTPS' : 'No HTTPS'} />
            <Fact label="Mobile" icon={SmartphoneIcon} value={sc.mobile ? <CheckIcon className="size-3.5" /> : <XIcon className="size-3.5" />} warn={!sc.mobile} hint={sc.mobile ? 'Has a mobile viewport' : 'No mobile viewport'} />
          </div>
        ) : null}

        <Section
          title="Contact"
          action={<IconAction label="Add email" icon={PlusIcon} size="icon-xs" onClick={() => setAdding((a) => !a)} />}
        >
          {s.emails?.length ? (
            <ul className="flex flex-col">
              {s.emails.map((e) => (
                <li key={e} className="group flex h-9 items-center gap-2 rounded-md px-2 hover:bg-muted/60">
                  <MailIcon className="size-4 shrink-0 text-muted-foreground" />
                  <a href={'mailto:' + e} className="min-w-0 flex-1 truncate text-sm hover:underline">{e}</a>
                  <div className="flex opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                    <Button size="xs" variant="ghost" onClick={() => copyText(e)}>Copy</Button>
                    <IconAction label="Remove" icon={XIcon} size="icon-xs" onClick={() => patch({ emails: s.emails.filter((x) => x !== e) })} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">{busy ? <Spinner className="size-3.5" /> : null}{s.scanState === 'done' ? 'No email found' : scanText(s)}</p>
          )}
          {adding ? (
            <InputGroup>
              <InputGroupInput autoFocus type="email" placeholder="name@domain.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addEmail(); if (e.key === 'Escape') setAdding(false); }} />
              <InputGroupAddon align="inline-end"><InputGroupButton onClick={addEmail}>Add</InputGroupButton></InputGroupAddon>
            </InputGroup>
          ) : null}
          {s.phones?.length || (sc?.socials && Object.keys(sc.socials).length) ? (
            <div className="flex flex-wrap gap-1.5">
              {(s.phones || []).map((p) => <Badge key={p} variant="outline" asChild><a href={'tel:' + p.replace(/[^\d+]/g, '')}><PhoneIcon />{p}</a></Badge>)}
              {Object.entries(sc?.socials || {}).map(([k, u]) => (
                <Badge key={k} variant="outline" asChild><a href={safeHref(u)} target="_blank" rel="noopener noreferrer" className="capitalize">{k}<ExternalLinkIcon /></a></Badge>
              ))}
            </div>
          ) : null}
        </Section>

        {sc?.signals?.length ? (
          <Section title="Old-site signals">
            <div className="flex flex-wrap gap-1.5">
              {sc.signals.map((x) => <Badge key={x} variant="outline" className="border-amber-500/30 bg-amber-500/10 font-normal text-amber-800 dark:text-amber-200">{x}</Badge>)}
            </div>
          </Section>
        ) : null}

        <Section title="Notes">
          <Textarea rows={3} value={notes} placeholder="What to pitch…" onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (s.notes || '') && patch({ notes })} />
          <Input aria-label="Tags" value={tags} placeholder="Tags, comma separated" onChange={(e) => setTags(e.target.value)} onBlur={() => patch({ tags: uniq(tags.split(',').map((t) => t.trim()).filter(Boolean)) as string[] })} />
        </Section>

        <Separator />

        {sc ? (
          <Fold title="Technical">
            <Row label="Builder / CMS">{sc.builders?.join(', ')}</Row>
            <Row label="Generator">{sc.generator}</Row>
            <Row label="Outdated CMS">{sc.oldCms}</Row>
            <Row label="Last updated">{sc.lastUpdated}</Row>
            {sc.pages?.length ? (
              <Row label="Pages scanned">
                <ul className="flex flex-col gap-0.5 text-xs">
                  {sc.pages.map((p) => (
                    <li key={p.url} className="truncate">
                      <a href={safeHref(p.url)} target="_blank" rel="noopener noreferrer" className="hover:underline">{p.url.replace(/^https?:\/\/(www\.)?/, '')}</a>
                      <span className="text-muted-foreground"> · {p.emails}✉</span>
                    </li>
                  ))}
                </ul>
              </Row>
            ) : null}
          </Fold>
        ) : null}

        <Fold title="Source">
          <Row label="Quest">{quest ? quest.name + (s.location ? ' · ' + s.location : '') : s.location}</Row>
          {s.query ? (
            <Row label="Query">
              <code className="font-mono text-xs">{s.query}</code>
              <span className="mt-1 flex gap-3">
                <Button variant="link" size="xs" className="h-auto p-0" onClick={() => copyText(s.query)}>Copy</Button>
                <Button variant="link" size="xs" className="h-auto p-0" onClick={() => openSearch(s.query, s.questId ? { questId: s.questId, location: s.location } : {})}>Re-run</Button>
              </span>
            </Row>
          ) : null}
          <Row label="Snippet">{s.snippet}</Row>
          <Row label="Description">{sc?.description}</Row>
          <Row label="Saved">{fmtDate(s.createdAt)}</Row>
          <Row label="Scanned">{s.scannedAt ? timeAgo(s.scannedAt) : null}</Row>
        </Fold>
      </div>
    </>
  );
}

// ----------------------------------------------------------------- add urls

function AddUrlsDialog({ open, onOpenChange, quests }: { open: boolean; onOpenChange: (o: boolean) => void; quests: Quest[] }) {
  const [text, setText] = React.useState('');
  const [questId, setQuestId] = React.useState('none');
  const [scan, setScan] = React.useState(true);
  const valid = lines(text).map(toUrl).filter(Boolean) as string[];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid.length) return;
    const r = await bg<{ added: string[]; dupes: string[] }>('sites:add', { items: valid.map((url) => ({ url })), questId: questId === 'none' ? null : questId, scan });
    toast.success(`Added ${r.added.length}`, { description: r.dupes.length ? `${r.dupes.length} already saved` : undefined });
    setText('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader><DialogTitle>Add sites</DialogTitle></DialogHeader>
          <FieldGroup className="gap-4">
            <Field className="gap-1.5">
              <div className="flex items-center gap-2">
                <FieldLabel htmlFor="urls">URLs</FieldLabel>
                <InfoTip>One per line. Bare domains work too.</InfoTip>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">{valid.length} valid</span>
              </div>
              <Textarea id="urls" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={'mueller-dach.de\nsmith-funeral-home.com'} className="font-mono text-xs" />
            </Field>
            <Field orientation="horizontal" className="justify-between">
              <FieldLabel className="font-normal">Quest</FieldLabel>
              <Select value={questId} onValueChange={setQuestId}>
                <SelectTrigger size="sm" className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {quests.map((q) => <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field orientation="horizontal" className="justify-between">
              <FieldLabel htmlFor="scan-now" className="font-normal">Scan for emails now</FieldLabel>
              <Switch id="scan-now" checked={scan} onCheckedChange={setScan} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!valid.length}>Add {valid.length || ''}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
