import * as React from 'react';
import { toast } from 'sonner';
import {
  ArrowLeftIcon, CheckIcon, ChevronRightIcon, CircleCheckIcon, CircleIcon, CopyIcon, CopyPlusIcon, GlobeIcon, MailIcon,
  MapIcon, MapPinIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, RotateCcwIcon, SearchIcon, Trash2Icon, XIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { IconAction, PageHeader, Stat } from '@/components/common';
import { CityPicker } from '@/components/city-picker';
import { confirmDialog } from '@/components/confirm';
import { copyText, openSearch, store } from '@/lib/ext';
import { useNav } from '@/lib/nav';
import { useExtData } from '@/hooks/use-ext-data';
import { cn } from '@/lib/utils';
import { loadDraft } from '@/views/builder';
import { buildQuery } from '@ext/query.js';
import { CITY_LISTS } from '@ext/defaults.js';
import { lines, timeAgo, uid, uniq } from '@ext/util.js';
import type { Quest, QuestLocation, Site } from '@/types';

const CITIES = CITY_LISTS as Record<string, string[]>;
const variantQuery = (q: Quest, loc: QuestLocation | null) => buildQuery(q.state, loc ? { location: [loc.value] } : {});
const baseQuery = (q: Quest) => buildQuery(q.state, q.locations.length ? { location: ['{location}'] } : {});

export function QuestsView() {
  const { params } = useNav();
  const [openId, setOpenId] = React.useState<string | null>(params.questId || null);
  const [data] = useExtData(
    async () => ({ quests: (await store.quests.list()) as Quest[], sites: (await store.sites.list()) as Site[] }),
    (k) => k.startsWith('quest:') || k.startsWith('site:'),
  );
  React.useEffect(() => { if (params.questId) setOpenId(params.questId); }, [params.questId]);
  if (!data) return null;

  const quest = openId ? data.quests.find((q) => q.id === openId) : null;
  if (quest) return <QuestDetail key={quest.id} quest={quest} sites={data.sites} onBack={() => setOpenId(null)} onOpen={setOpenId} />;
  return <QuestList quests={data.quests} sites={data.sites} onOpen={setOpenId} />;
}

function Metric({ icon: Icon, value, label }: { icon: React.ElementType; value: React.ReactNode; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex items-center gap-1 tabular-nums"><Icon className="size-3.5" />{value}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function QuestList({ quests, sites, onOpen }: { quests: Quest[]; sites: Site[]; onOpen: (id: string) => void }) {
  const { go } = useNav();
  const sorted = [...quests].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return (
    <>
      <PageHeader
        title="Quests"
        count={quests.length}
        info="A saved query plus a list of locations. Search one location at a time and pick up where you stopped."
        actions={<Button size="sm" onClick={() => go('builder')}><PlusIcon data-icon="inline-start" />New</Button>}
      />
      {!sorted.length ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon"><MapIcon /></EmptyMedia>
            <EmptyTitle>No quests yet</EmptyTitle>
          </EmptyHeader>
          <EmptyContent><Button size="sm" onClick={() => go('builder')}>Build a query</Button></EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-3 @2xl/main:grid-cols-2 @5xl/main:grid-cols-3">
          {sorted.map((q) => {
            const total = q.locations.length;
            const done = q.locations.filter((l) => l.status === 'done').length;
            const mine = sites.filter((s) => s.questId === q.id);
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => onOpen(q.id)}
                className="group flex flex-col gap-3 rounded-xl border bg-card p-4 text-left shadow-xs transition-colors hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <div className="flex w-full items-center gap-2">
                  <span className="truncate font-medium">{q.name}</span>
                  <ChevronRightIcon className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <Progress value={total ? (done / total) * 100 : q.lastRunAt ? 100 : 0} className="h-1" />
                <div className="flex w-full items-center gap-4 text-xs text-muted-foreground">
                  <Metric icon={SearchIcon} value={total ? `${done}/${total}` : q.lastRunAt ? '1/1' : '0/1'} label="Locations searched" />
                  <Metric icon={GlobeIcon} value={mine.length} label="Sites saved" />
                  <Metric icon={MailIcon} value={mine.filter((s) => s.emails?.length).length} label="Sites with email" />
                  <span className="ml-auto">{timeAgo(q.updatedAt)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

function QuestDetail({ quest: q, sites, onBack, onOpen }: { quest: Quest; sites: Site[]; onBack: () => void; onOpen: (id: string) => void }) {
  const { go } = useNav();
  const [name, setName] = React.useState(q.name);
  const [notes, setNotes] = React.useState(q.notes || '');

  const save = (patch: Partial<Quest>) => store.quests.put({ ...q, ...patch, updatedAt: Date.now() });
  const mine = sites.filter((s) => s.questId === q.id);
  const withEmail = mine.filter((s) => s.emails?.length).length;
  const total = q.locations.length;
  const done = q.locations.filter((l) => l.status === 'done').length;
  const next = q.locations.find((l) => l.status !== 'done') || null;

  const run = async (loc: QuestLocation | null) => {
    const ok = await openSearch(variantQuery(q, loc), { questId: q.id, locId: loc?.id, location: loc?.value || null });
    if (!ok) return;
    if (loc) await save({ locations: q.locations.map((l) => (l.id === loc.id ? { ...l, status: 'done', runAt: Date.now(), runs: (l.runs || 0) + 1 } : l)) });
    else await save({ lastRunAt: Date.now() });
  };
  const setLoc = (id: string, p: Partial<QuestLocation>) => save({ locations: q.locations.map((l) => (l.id === id ? { ...l, ...p } : l)) });
  const addLocs = async (vals: string[]) => {
    const have = new Set(q.locations.map((l) => l.value.toLowerCase()));
    const fresh = (uniq(vals) as string[]).filter((v) => !have.has(v.toLowerCase()));
    await save({ locations: [...q.locations, ...fresh.map((value) => ({ id: uid(), value, status: 'pending' as const, runAt: null, runs: 0 }))] });
    toast(fresh.length ? `Added ${fresh.length}` : 'Nothing new to add');
  };
  const duplicate = async () => {
    const copy: Quest = {
      ...structuredClone(q), id: uid(), name: q.name + ' (copy)', createdAt: Date.now(), updatedAt: Date.now(), lastRunAt: null,
      locations: q.locations.map((l) => ({ ...l, id: uid(), status: 'pending', runAt: null, runs: 0 })),
    };
    await store.quests.put(copy);
    toast.success('Duplicated');
    onOpen(copy.id);
  };
  const remove = async () => {
    if (!(await confirmDialog({ title: `Delete “${q.name}”?`, description: `Its ${mine.length} sites stay in Sites.`, confirmLabel: 'Delete', destructive: true }))) return;
    await store.quests.del(q.id);
    onBack();
  };

  return (
    <>
      {/* Title row */}
      <div className="flex min-h-9 items-center gap-1">
        <IconAction label="All quests" icon={ArrowLeftIcon} className="-ml-2" onClick={onBack} />
        <Input
          aria-label="Quest name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== q.name && save({ name: name.trim() })}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className="h-9 min-w-0 flex-1 border-transparent bg-transparent px-2 font-heading text-xl font-semibold tracking-tight shadow-none hover:border-input focus-visible:border-ring dark:bg-transparent md:text-xl"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Quest actions"><MoreHorizontalIcon /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => { loadDraft(q.state, { questId: q.id, questName: q.name }); go('builder'); }}><PencilIcon />Edit query</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => copyText(baseQuery(q))}><CopyIcon />Copy query</DropdownMenuItem>
            <DropdownMenuItem onSelect={duplicate}><CopyPlusIcon />Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={remove}><Trash2Icon />Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Key figures */}
      <div className="grid grid-cols-3 gap-2 @2xl/main:gap-3">
        <Stat label="Searched" icon={SearchIcon} value={total ? `${done}/${total}` : q.lastRunAt ? '1/1' : '0/1'}>
          <Progress value={total ? (done / total) * 100 : q.lastRunAt ? 100 : 0} className="h-1" />
        </Stat>
        <Stat label="Sites" icon={GlobeIcon} value={mine.length} hint="View these sites" onClick={mine.length ? () => go('sites', { questId: q.id }) : undefined} />
        <Stat label="Emails" icon={MailIcon} value={withEmail} hint="Sites with at least one email" />
      </div>

      {/* Primary action */}
      {total ? (
        <Button size="lg" disabled={!next} onClick={() => run(next)} className="w-full @2xl/main:w-auto @2xl/main:self-start">
          {next ? <><SearchIcon data-icon="inline-start" />Search {next.value}</> : <><CheckIcon data-icon="inline-start" />All searched</>}
        </Button>
      ) : (
        <Button size="lg" onClick={() => run(null)} className="w-full @2xl/main:w-auto @2xl/main:self-start"><SearchIcon data-icon="inline-start" />Search Google</Button>
      )}

      {/* Locations */}
      <Card className="gap-2 py-3">
        <CardHeader className="flex items-center gap-2 px-4">
          <CardTitle className="font-heading text-base">Locations</CardTitle>
          <Badge variant="secondary" className="tabular-nums">{total}</Badge>
          <div className="ml-auto flex items-center gap-0.5">
            {total ? <IconAction label="Reset all to pending" icon={RotateCcwIcon} onClick={() => save({ locations: q.locations.map((l) => ({ ...l, status: 'pending' })) })} /> : null}
            <CityPicker existing={q.locations.map((l) => l.value)} onAdd={addLocs}>
              <Button size="sm" variant="ghost"><MapPinIcon data-icon="inline-start" />US cities</Button>
            </CityPicker>
            <AddLocations onAdd={addLocs} />
          </div>
        </CardHeader>
        <CardContent className="px-2">
          {total ? (
            <ul className="flex flex-col">
              {q.locations.map((l) => {
                const n = mine.filter((s) => s.location === l.value).length;
                const isDone = l.status === 'done';
                const isNext = next?.id === l.id;
                return (
                  <li key={l.id} className={cn('group flex h-10 items-center gap-2.5 rounded-md px-2 hover:bg-muted/50', isNext && 'bg-muted/50')}>
                    {isDone
                      ? <CircleCheckIcon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Searched" />
                      : <CircleIcon className="size-4 shrink-0 text-muted-foreground/50" aria-label="Pending" />}
                    <span className={cn('min-w-0 flex-1 truncate text-sm', isDone ? 'text-muted-foreground' : 'font-medium')} title={variantQuery(q, l)}>{l.value}</span>
                    {n ? (
                      <Tooltip>
                        <TooltipTrigger asChild><Badge variant="outline" className="tabular-nums"><GlobeIcon />{n}</Badge></TooltipTrigger>
                        <TooltipContent>Sites saved from this search</TooltipContent>
                      </Tooltip>
                    ) : null}
                    {l.runAt ? <span className="hidden w-16 text-right text-xs text-muted-foreground @md/main:inline">{timeAgo(l.runAt)}</span> : null}
                    <Button size="xs" variant={isNext ? 'default' : 'ghost'} className={cn(!isNext && 'opacity-60 group-hover:opacity-100 focus-visible:opacity-100')} onClick={() => run(l)}>Search</Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="icon-xs" variant="ghost" aria-label={`More for ${l.value}`}><MoreHorizontalIcon /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setLoc(l.id, { status: isDone ? 'pending' : 'done' })}>
                          {isDone ? <><RotateCcwIcon />Mark pending</> : <><CheckIcon />Mark searched</>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => copyText(variantQuery(q, l))}><CopyIcon />Copy query</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => save({ locations: q.locations.filter((x) => x.id !== l.id) })}><XIcon />Remove</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-2 py-3 text-sm text-muted-foreground">Add cities to search them one by one.</p>
          )}
        </CardContent>
      </Card>

      {/* Secondary detail, collapsed */}
      <Disclosure title="Query">
        <pre className="rounded-md bg-muted/70 px-3 py-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">{baseQuery(q)}</pre>
      </Disclosure>
      <Disclosure title="Notes" defaultOpen={!!q.notes} badge={q.notes ? '1' : undefined}>
        <Textarea rows={3} value={notes} placeholder="Pitch angle, what worked…" onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (q.notes || '') && save({ notes })} />
      </Disclosure>
    </>
  );
}

function Disclosure({ title, children, defaultOpen = false, badge }: { title: string; children: React.ReactNode; defaultOpen?: boolean; badge?: string }) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="flex flex-col gap-2">
      <CollapsibleTrigger className="group -ml-1 flex h-7 items-center gap-1.5 self-start rounded-md px-1 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
        <ChevronRightIcon className="size-4 transition-transform group-data-[state=open]:rotate-90" />
        {title}
        {badge ? <span className="size-1.5 rounded-full bg-primary" /> : null}
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

function AddLocations({ onAdd }: { onAdd: (v: string[]) => Promise<void> }) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState('');
  const n = lines(text).length;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button size="sm" variant="outline"><PlusIcon data-icon="inline-start" />Add</Button></PopoverTrigger>
      <PopoverContent align="end" className="flex w-72 flex-col gap-2">
        <Textarea autoFocus rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={'One per line\nDayton, OH\n45402'} />
        <Button size="sm" disabled={!n} onClick={async () => { await onAdd(lines(text)); setText(''); setOpen(false); }}>Add {n || ''}</Button>
        <Select value="" onValueChange={async (k) => { await onAdd(CITIES[k] || []); setOpen(false); }}>
          <SelectTrigger size="sm" className="w-full"><SelectValue placeholder="Or add a city list" /></SelectTrigger>
          <SelectContent>{Object.entries(CITIES).map(([k, v]) => <SelectItem key={k} value={k}>{k} ({v.length})</SelectItem>)}</SelectContent>
        </Select>
      </PopoverContent>
    </Popover>
  );
}
