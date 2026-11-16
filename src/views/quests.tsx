import * as React from 'react';
import { toast } from 'sonner';
import {
  ArrowLeftIcon, CheckIcon, CopyIcon, CopyPlusIcon, GlobeIcon, MapIcon, MoreHorizontalIcon, PencilIcon, PlusIcon,
  RotateCcwIcon, SearchIcon, Trash2Icon, XIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PageHeader } from '@/components/common';
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
  if (quest) return <QuestDetail quest={quest} sites={data.sites} onBack={() => setOpenId(null)} onOpen={setOpenId} />;
  return <QuestList quests={data.quests} sites={data.sites} onOpen={setOpenId} />;
}

function QuestList({ quests, sites, onOpen }: { quests: Quest[]; sites: Site[]; onOpen: (id: string) => void }) {
  const { go } = useNav();
  const sorted = [...quests].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return (
    <>
      <PageHeader
        title="Search quests"
        description="A saved query plus a list of locations. Run one location at a time, save results straight from Google, and pick up where you stopped."
        actions={<Button onClick={() => go('builder')}><PlusIcon data-icon="inline-start" />New quest</Button>}
      />
      {!sorted.length ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><MapIcon /></EmptyMedia>
            <EmptyTitle>No quests yet</EmptyTitle>
            <EmptyDescription>Build a query in the Builder or load a template, then click “Save as quest” and add some cities.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent><Button onClick={() => go('builder')}>Open the Builder</Button></EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-3 @2xl/main:grid-cols-2 @5xl/main:grid-cols-3">
          {sorted.map((q) => {
            const total = q.locations.length;
            const done = q.locations.filter((l) => l.status === 'done').length;
            const mine = sites.filter((s) => s.questId === q.id);
            const withEmail = mine.filter((s) => s.emails?.length).length;
            return (
              <Card
                key={q.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpen(q.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(q.id); } }}
                className="cursor-pointer gap-3 py-4 transition-colors hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <CardHeader className="px-4">
                  <CardTitle className="truncate">{q.name}</CardTitle>
                  <CardDescription className="truncate font-mono text-xs">{baseQuery(q)}</CardDescription>
                  <CardAction className="text-xs text-muted-foreground">{timeAgo(q.updatedAt)}</CardAction>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 px-4">
                  {total ? <Progress value={(done / total) * 100} className="h-1.5" /> : null}
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{total ? `${done}/${total} searched` : q.lastRunAt ? 'Searched' : 'Not searched yet'}</Badge>
                    <Badge variant="outline">{mine.length} sites</Badge>
                    <Badge variant="outline">{withEmail} with email</Badge>
                  </div>
                </CardContent>
              </Card>
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
  const [addText, setAddText] = React.useState('');
  React.useEffect(() => { setName(q.name); setNotes(q.notes || ''); }, [q.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (patch: Partial<Quest>) => store.quests.put({ ...q, ...patch, updatedAt: Date.now() });
  const mine = sites.filter((s) => s.questId === q.id);
  const total = q.locations.length;
  const done = q.locations.filter((l) => l.status === 'done').length;
  const next = q.locations.find((l) => l.status !== 'done') || null;

  const run = async (loc: QuestLocation | null) => {
    const ok = await openSearch(variantQuery(q, loc), { questId: q.id, locId: loc?.id, location: loc?.value || null });
    if (!ok) return;
    if (loc) await save({ locations: q.locations.map((l) => (l.id === loc.id ? { ...l, status: 'done', runAt: Date.now(), runs: (l.runs || 0) + 1 } : l)) });
    else await save({ lastRunAt: Date.now() });
  };

  const setLoc = (id: string, patch: Partial<QuestLocation>) => save({ locations: q.locations.map((l) => (l.id === id ? { ...l, ...patch } : l)) });

  const addLocs = async (vals: string[]) => {
    const have = new Set(q.locations.map((l) => l.value.toLowerCase()));
    const fresh = (uniq(vals) as string[]).filter((v) => !have.has(v.toLowerCase()));
    await save({ locations: [...q.locations, ...fresh.map((value) => ({ id: uid(), value, status: 'pending' as const, runAt: null, runs: 0 }))] });
    toast(fresh.length ? `Added ${fresh.length} location${fresh.length > 1 ? 's' : ''}` : 'Nothing new to add');
  };

  const duplicate = async () => {
    const copy: Quest = {
      ...structuredClone(q), id: uid(), name: q.name + ' (copy)', createdAt: Date.now(), updatedAt: Date.now(), lastRunAt: null,
      locations: q.locations.map((l) => ({ ...l, id: uid(), status: 'pending', runAt: null, runs: 0 })),
    };
    await store.quests.put(copy);
    toast.success('Quest duplicated');
    onOpen(copy.id);
  };

  const remove = async () => {
    const ok = await confirmDialog({
      title: 'Delete this quest?',
      description: `“${q.name}” will be deleted. Its ${mine.length} saved sites stay in your Sites list.`,
      confirmLabel: 'Delete quest', destructive: true,
    });
    if (!ok) return;
    await store.quests.del(q.id);
    onBack();
  };

  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-2 self-start" onClick={onBack}><ArrowLeftIcon data-icon="inline-start" />All quests</Button>

      <Card className="gap-4">
        <CardHeader>
          <Input
            aria-label="Quest name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== q.name && save({ name: name.trim() })}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="-ml-2.5 h-auto border-transparent bg-transparent px-2.5 py-1 font-heading text-lg font-semibold shadow-none hover:border-input dark:bg-transparent"
          />
          <CardDescription>
            {total ? `${done} of ${total} locations searched · ` : ''}{mine.length} sites saved · {mine.filter((s) => s.emails?.length).length} with email
          </CardDescription>
          <CardAction>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="More actions"><MoreHorizontalIcon /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => { loadDraft(q.state, { questId: q.id, questName: q.name }); go('builder'); }}><PencilIcon />Edit query</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => copyText(baseQuery(q))}><CopyIcon />Copy query</DropdownMenuItem>
                <DropdownMenuItem onSelect={duplicate}><CopyPlusIcon />Duplicate</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={remove}><Trash2Icon />Delete quest</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <pre className="rounded-md bg-muted px-3 py-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">{baseQuery(q)}</pre>
          {total ? <Progress value={(done / total) * 100} className="h-1.5" /> : null}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          {total ? (
            <Button disabled={!next} onClick={() => run(next)}>
              <SearchIcon data-icon="inline-start" />{next ? `Search next: ${next.value}` : 'All locations searched'}
            </Button>
          ) : (
            <Button onClick={() => run(null)}><SearchIcon data-icon="inline-start" />Search Google</Button>
          )}
          <Button variant="outline" disabled={!mine.length} onClick={() => go('sites', { questId: q.id })}>
            <GlobeIcon data-icon="inline-start" />View sites ({mine.length})
          </Button>
        </CardFooter>
      </Card>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Locations ({total})</CardTitle>
          <CardDescription>{total ? 'Each location replaces the Location slot for one search.' : 'No locations: the query runs exactly as built. Add cities, ZIP codes or regions to get one search each.'}</CardDescription>
          {total ? (
            <CardAction>
              <Button variant="ghost" size="sm" onClick={() => save({ locations: q.locations.map((l) => ({ ...l, status: 'pending' })) })}>
                <RotateCcwIcon data-icon="inline-start" />Reset
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {total ? (
            <ItemGroup className="gap-0 overflow-hidden rounded-lg border">
              {q.locations.map((l, i) => {
                const n = mine.filter((s) => s.location === l.value).length;
                const isDone = l.status === 'done';
                return (
                  <Item key={l.id} size="sm" className={cn('rounded-none', i > 0 && 'border-t border-t-border')}>
                    <ItemContent className="min-w-0">
                      <ItemTitle className={cn('w-full truncate', isDone && 'text-muted-foreground')} title={variantQuery(q, l)}>
                        {isDone ? <CheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" /> : null}
                        {l.value}
                      </ItemTitle>
                      <ItemDescription className="text-xs">
                        {isDone ? 'Searched' : 'Pending'} · {n} site{n === 1 ? '' : 's'}{l.runAt ? ` · ${timeAgo(l.runAt)}` : ''}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <ButtonGroup>
                        <Button size="xs" variant={isDone ? 'outline' : 'default'} onClick={() => run(l)}>Search</Button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon-xs" variant="outline" aria-label={isDone ? 'Mark as pending' : 'Mark as searched'} onClick={() => setLoc(l.id, { status: isDone ? 'pending' : 'done' })}>
                              {isDone ? <RotateCcwIcon /> : <CheckIcon />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{isDone ? 'Mark as pending' : 'Mark as searched'}</TooltipContent>
                        </Tooltip>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button size="icon-xs" variant="outline" aria-label="More"><MoreHorizontalIcon /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => copyText(variantQuery(q, l))}><CopyIcon />Copy query</DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onSelect={() => save({ locations: q.locations.filter((x) => x.id !== l.id) })}><XIcon />Remove</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </ButtonGroup>
                    </ItemActions>
                  </Item>
                );
              })}
            </ItemGroup>
          ) : null}
          <Field className="gap-2">
            <FieldLabel htmlFor="add-locs">Add locations</FieldLabel>
            <Textarea id="add-locs" rows={3} value={addText} onChange={(e) => setAddText(e.target.value)} placeholder={'One per line: Dayton, OH · 45402 · Montgomery County'} />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" disabled={!addText.trim()} onClick={async () => { const v = lines(addText); setAddText(''); await addLocs(v); }}>
                <PlusIcon data-icon="inline-start" />Add
              </Button>
              <Select value="" onValueChange={(k) => addLocs((CITY_LISTS as Record<string, string[]>)[k] || [])}>
                <SelectTrigger size="sm" className="w-auto"><SelectValue placeholder="Add a city list…" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CITY_LISTS as Record<string, string[]>).map(([k, v]) => <SelectItem key={k} value={k}>{k} ({v.length})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </Field>
        </CardContent>
      </Card>

      <Card className="gap-3">
        <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={3} value={notes} placeholder="Pitch angle, what worked, what to skip…" onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (q.notes || '') && save({ notes })} />
        </CardContent>
      </Card>
    </>
  );
}
