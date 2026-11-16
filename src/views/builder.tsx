import * as React from 'react';
import { toast } from 'sonner';
import {
  CheckIcon, ChevronRightIcon, ChevronsUpDownIcon, CopyIcon, EraserIcon, FileStackIcon, MapPlusIcon, PencilLineIcon,
  SaveIcon, SearchIcon, XIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { ChipInput } from '@/components/common';
import { confirmDialog } from '@/components/confirm';
import { copyText, openSearch, store } from '@/lib/ext';
import { useNav } from '@/lib/nav';
import { useExtData } from '@/hooks/use-ext-data';
import { cn } from '@/lib/utils';
import {
  SLOTS, SLOT_LABEL, buildQuery, countWords, emptyState, normalizeDomain, normalizeState, yearTerms,
} from '@ext/query.js';
import { CITY_LISTS } from '@ext/defaults.js';
import { lines, uid, uniq } from '@ext/util.js';
import type { Block, BuilderState, Draft, DraftMeta, Quest, SlotKey, Template } from '@/types';

// ----------------------------------------------------------------- draft shared with other views

let pendingDraft: Draft | null = null;

/** Called by Quests/Library before navigating here, so the builder opens with that state. */
export function loadDraft(state: BuilderState, meta: DraftMeta = {}) {
  pendingDraft = { state: normalizeState(structuredClone(state)), meta };
  store.setDraft(pendingDraft);
}

function isOn(st: BuilderState, b: Block) {
  if (b.slot === 'site') return st.site === b.value;
  if (b.slot === 'extra') return st.extra.includes(b.value);
  if (b.slot === 'excludes') return st.excludes.includes(normalizeDomain(b.value));
  return st[b.slot].includes(b.value);
}

function toggled(st: BuilderState, b: Block): BuilderState {
  const s = structuredClone(st);
  if (b.slot === 'site') s.site = s.site === b.value ? '' : b.value;
  else if (b.slot === 'extra') s.extra = isOn(s, b) ? s.extra.replace(b.value, '').replace(/\s+/g, ' ').trim() : `${s.extra} ${b.value}`.trim();
  else {
    const v = b.slot === 'excludes' ? normalizeDomain(b.value) : b.value;
    s[b.slot] = s[b.slot].includes(v) ? s[b.slot].filter((x) => x !== v) : [...s[b.slot], v];
  }
  return s;
}

const defaultName = (st: BuilderState, withLocation = true) => {
  const n = st.profession[0] || 'Search';
  const where = withLocation && st.location.length === 1 ? ' · ' + st.location[0] : '';
  return n.charAt(0).toUpperCase() + n.slice(1) + where + (st.signals.length ? ' · old sites' : '');
};

const readOpenCats = (): string[] => {
  try { return JSON.parse(localStorage.getItem('sq.openCats') || '["Copyright years","Old builders · US"]'); } catch { return []; }
};

// ----------------------------------------------------------------- view

export function BuilderView() {
  const { go } = useNav();
  const [draft, setDraftState] = React.useState<Draft | null>(pendingDraft);
  const [blocks] = useExtData(() => store.getBlocks() as Promise<Block[]>, (k) => k === 'blocks');
  const [templates] = useExtData(() => store.templates.list() as Promise<Template[]>, (k) => k.startsWith('tpl:'));
  const [questOpen, setQuestOpen] = React.useState(false);
  const [tplOpen, setTplOpen] = React.useState(false);

  React.useEffect(() => {
    if (pendingDraft) { pendingDraft = null; return; }
    (store.getDraft() as Promise<Draft | null>).then((d) => setDraftState(d ? { state: normalizeState(d.state), meta: d.meta || {} } : { state: emptyState(), meta: {} }));
  }, []);

  // Persist every change (debounced) so the panel and the full view resume where you left off.
  React.useEffect(() => {
    if (!draft) return;
    const t = setTimeout(() => store.setDraft(draft), 250);
    return () => clearTimeout(t);
  }, [draft]);

  if (!draft) return null;
  const st = draft.state;
  const meta = draft.meta;
  const setSt = (next: BuilderState) => setDraftState((d) => ({ ...d!, state: next }));
  const patch = (p: Partial<BuilderState>) => setSt({ ...st, ...p });
  const query = buildQuery(st);
  const words = countWords(query);

  const clear = async () => {
    if (query && !(await confirmDialog({ title: 'Clear the builder?', description: 'This empties every slot.', confirmLabel: 'Clear', destructive: true }))) return;
    setDraftState({ state: emptyState(), meta: {} });
  };

  const saveToQuest = async () => {
    const q = (await store.quests.get(meta.questId!)) as Quest | null;
    if (!q) {
      toast.error('That quest no longer exists.');
      setDraftState({ ...draft, meta: {} });
      return;
    }
    await store.quests.put({ ...q, state: structuredClone(st), updatedAt: Date.now() });
    toast.success('Quest updated');
    go('quests', { questId: q.id });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <TemplatePicker
          templates={templates || []}
          open={tplOpen}
          onOpenChange={setTplOpen}
          onPick={(t) => {
            setDraftState({ state: normalizeState(structuredClone(t.state)), meta: { templateName: t.name } });
            setTplOpen(false);
            toast.success(`Loaded “${t.name}”`);
          }}
        />
        <Button variant="ghost" size="sm" onClick={clear}><EraserIcon data-icon="inline-start" />Clear</Button>
      </div>

      {meta.questId ? (
        <Alert>
          <PencilLineIcon />
          <AlertDescription>Editing quest “{meta.questName}”. Changes stay here until you save them.</AlertDescription>
          <AlertAction className="flex gap-2">
            <Button size="xs" onClick={saveToQuest}>Save to quest</Button>
            <Button size="xs" variant="outline" onClick={() => setDraftState({ ...draft, meta: {} })}>Stop editing</Button>
          </AlertAction>
        </Alert>
      ) : null}

      <div className="grid items-start gap-4 @4xl/main:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <QueryPreview st={st} query={query} words={words} onQuest={() => setQuestOpen(true)} />
          <SlotsCard st={st} setSt={setSt} patch={patch} />
        </div>
        <Palette blocks={blocks || []} st={st} setSt={setSt} onManage={() => go('library')} />
      </div>

      <SaveQuestDialog open={questOpen} onOpenChange={setQuestOpen} st={st} onCreated={(id) => go('quests', { questId: id })} />
    </>
  );
}

// ----------------------------------------------------------------- pieces

function TemplatePicker({ templates, open, onOpenChange, onPick }: {
  templates: Template[]; open: boolean; onOpenChange: (o: boolean) => void; onPick: (t: Template) => void;
}) {
  const groups = uniq(templates.map((t) => t.region || 'Custom')).sort() as string[];
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-label="Load a template" aria-expanded={open} className="w-64 max-w-full justify-between font-normal">
          <span className="flex items-center gap-2 truncate"><FileStackIcon className="text-muted-foreground" />Load a template…</span>
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search templates…" />
          <CommandList className="max-h-80">
            <CommandEmpty>No template found.</CommandEmpty>
            {groups.map((g) => (
              <CommandGroup key={g} heading={g}>
                {templates.filter((t) => (t.region || 'Custom') === g).sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
                  <CommandItem key={t.id} value={`${t.name} ${g} ${t.description || ''}`} onSelect={() => onPick(t)}>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{t.name}</span>
                      {t.description ? <span className="truncate text-xs text-muted-foreground">{t.description}</span> : null}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function QueryPreview({ st, query, words, onQuest }: { st: BuilderState; query: string; words: number; onQuest: () => void }) {
  const [tplOpen, setTplOpen] = React.useState(false);
  const tone = words > 32 ? 'destructive' : words > 26 ? 'warn' : 'ok';
  return (
    <Card className="sticky top-[5.75rem] z-20 gap-3 py-4 shadow-sm">
      <CardHeader className="px-4">
        <CardTitle>Query</CardTitle>
        <CardAction>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant={tone === 'destructive' ? 'destructive' : 'secondary'}
                className={cn('tabular-nums', tone === 'ok' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', tone === 'warn' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300')}
              >
                {words} / 32 words
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Google reads about 32 words per query and silently drops the rest.</TooltipContent>
          </Tooltip>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4">
        <pre className={cn('max-h-40 overflow-auto rounded-md bg-muted px-3 py-2.5 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap break-words', !query && 'font-sans text-sm text-muted-foreground')}>
          {query || 'Pick a template, or click building blocks: a niche, a location and a few old-site signals.'}
        </pre>
        {words > 32 ? (
          <p className="text-sm text-destructive">Over Google’s ~32-word limit. Trailing terms (usually the -site: exclusions) get ignored. Drop some OR terms or exclusions.</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button disabled={!query} onClick={() => openSearch(query)}><SearchIcon data-icon="inline-start" />Search Google</Button>
          <ButtonGroup>
            <Button variant="outline" disabled={!query} onClick={() => copyText(query)}><CopyIcon data-icon="inline-start" />Copy</Button>
            <Button variant="outline" disabled={!query} onClick={onQuest}><MapPlusIcon data-icon="inline-start" />Save as quest</Button>
            <Button variant="outline" disabled={!query} onClick={() => setTplOpen(true)}><SaveIcon data-icon="inline-start" />Template</Button>
          </ButtonGroup>
        </div>
      </CardContent>
      <SaveTemplateDialog open={tplOpen} onOpenChange={setTplOpen} query={query} st={st} />
    </Card>
  );
}

function SlotsCard({ st, setSt, patch }: { st: BuilderState; setSt: (s: BuilderState) => void; patch: (p: Partial<BuilderState>) => void }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Building slots</CardTitle>
        <CardDescription>Type and press Enter, paste a list, or click blocks.</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="gap-5">
          {(SLOTS as { key: SlotKey; label: string; placeholder: string; hint: string }[]).map((slot) => (
            <Field key={slot.key} className="gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor={'slot-' + slot.key}>{slot.label}</FieldLabel>
                {slot.key === 'profession' ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Switch size="sm" checked={st.intitle} onCheckedChange={(v) => patch({ intitle: v })} />
                        intitle:
                      </label>
                    </TooltipTrigger>
                    <TooltipContent>Only pages with the niche in their title, mostly company homepages</TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
              <ChipInput
                id={'slot-' + slot.key}
                value={st[slot.key]}
                placeholder={slot.placeholder}
                format={slot.key === 'excludes' ? normalizeDomain : undefined}
                onChange={(v) => patch({ [slot.key]: v })}
              />
              {slot.key === 'signals' ? <YearHelper onAdd={(terms) => setSt({ ...st, signals: uniq([...st.signals, ...terms]) })} /> : null}
              <FieldDescription className="text-xs">{slot.hint}</FieldDescription>
            </Field>
          ))}
          <div className="grid gap-5 @2xl/main:grid-cols-2">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="site">Site filter</FieldLabel>
              <Input id="site" value={st.site} placeholder=".de · weebly.com" onChange={(e) => patch({ site: e.target.value })} />
              <FieldDescription className="text-xs">Becomes site:… A free subdomain means the owner never bought a domain.</FieldDescription>
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="extra">Raw operators</FieldLabel>
              <Input id="extra" value={st.extra} placeholder='inurl:"index.php?option=com_content"' className="font-mono text-xs" onChange={(e) => patch({ extra: e.target.value })} />
              <FieldDescription className="text-xs">Inserted exactly as typed.</FieldDescription>
            </Field>
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

const yearDefaults = { prefix: 'Copyright', from: 2010, to: 2018, step: 2 };

function YearHelper({ onAdd }: { onAdd: (terms: string[]) => void }) {
  const [y, setY] = React.useState(yearDefaults);
  const set = (p: Partial<typeof y>) => setY((cur) => Object.assign(yearDefaults, { ...cur, ...p }));
  const num = (k: 'from' | 'to' | 'step', label: string, w = 'w-[4.5rem]') => (
    <Input type="number" aria-label={label} className={cn('h-7 px-2 text-xs', w)} value={y[k]} onChange={(e) => set({ [k]: +e.target.value })} />
  );
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <span>Add years</span>
      <Select value={y.prefix} onValueChange={(v) => set({ prefix: v })}>
        <SelectTrigger size="sm" className="h-7 w-auto text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {['Copyright', 'last updated', 'letzte Aktualisierung', 'Stand'].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
        </SelectContent>
      </Select>
      {num('from', 'From year')}<span>to</span>{num('to', 'To year')}<span>every</span>{num('step', 'Step', 'w-14')}
      <Button size="xs" variant="secondary" onClick={() => onAdd(yearTerms(y.from, y.to, y.step, y.prefix))}>Add</Button>
    </div>
  );
}

function Palette({ blocks, st, setSt, onManage }: { blocks: Block[]; st: BuilderState; setSt: (s: BuilderState) => void; onManage: () => void }) {
  const [filter, setFilter] = React.useState('');
  const [open, setOpen] = React.useState<string[]>(readOpenCats);
  const f = filter.trim().toLowerCase();
  const cats = new Map<string, Block[]>();
  for (const b of blocks) {
    if (!cats.has(b.cat)) cats.set(b.cat, []);
    cats.get(b.cat)!.push(b);
  }
  const toggleCat = (cat: string, on: boolean) => {
    const next = on ? uniq([...open, cat]) : open.filter((c) => c !== cat);
    setOpen(next);
    try { localStorage.setItem('sq.openCats', JSON.stringify(next)); } catch { /* storage blocked */ }
  };

  return (
    <Card className="gap-3 @4xl/main:sticky @4xl/main:top-[5.75rem]">
      <CardHeader>
        <CardTitle>Building blocks</CardTitle>
        <CardDescription>Click to add to its slot, click again to remove.</CardDescription>
        <CardAction><Button variant="link" size="sm" className="h-auto p-0" onClick={onManage}>Manage</Button></CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 @4xl/main:max-h-[calc(100svh-11rem)] @4xl/main:overflow-y-auto">
        <InputGroup className="mb-2">
          <InputGroupAddon><SearchIcon /></InputGroupAddon>
          <InputGroupInput placeholder="Filter blocks…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          {filter ? <InputGroupAddon align="inline-end"><InputGroupButton size="icon-xs" aria-label="Clear filter" onClick={() => setFilter('')}><XIcon /></InputGroupButton></InputGroupAddon> : null}
        </InputGroup>
        {[...cats.entries()].map(([cat, list]) => {
          const shown = f ? list.filter((b) => `${b.label} ${b.value} ${cat}`.toLowerCase().includes(f)) : list;
          if (!shown.length) return null;
          const active = shown.filter((b) => isOn(st, b)).length;
          return (
            <Collapsible key={cat} open={!!f || open.includes(cat)} onOpenChange={(o) => !f && toggleCat(cat, o)} className="border-t first:border-t-0">
              <CollapsibleTrigger className="group flex w-full items-center gap-2 py-2 text-left text-sm font-medium outline-none hover:text-foreground focus-visible:underline">
                <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                <span className="truncate">{cat}</span>
                <span className="text-xs font-normal text-muted-foreground">→ {SLOT_LABEL[list[0].slot] || list[0].slot}</span>
                {active ? <Badge className="ml-auto h-5 min-w-5 rounded-full px-1.5 tabular-nums">{active}</Badge> : null}
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-wrap gap-1.5 pb-3 pl-6">
                {shown.map((b) => {
                  const on = isOn(st, b);
                  return (
                    <Button
                      key={b.id}
                      size="xs"
                      variant={on ? 'default' : 'outline'}
                      aria-pressed={on}
                      title={`${b.value} → ${SLOT_LABEL[b.slot] || b.slot}`}
                      className="rounded-full font-normal"
                      onClick={() => setSt(toggled(st, b))}
                    >
                      {on ? <CheckIcon data-icon="inline-start" /> : null}
                      {b.label}
                    </Button>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------- dialogs

function SaveQuestDialog({ open, onOpenChange, st, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; st: BuilderState; onCreated: (id: string) => void }) {
  const [name, setName] = React.useState('');
  const [locs, setLocs] = React.useState('');
  const [list, setList] = React.useState('none');
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setName(defaultName(st, false));
    setLocs(st.location.join('\n'));
    setList('none');
    setNotes('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const values = uniq([...lines(locs), ...((CITY_LISTS as Record<string, string[]>)[list] || [])]) as string[];
    const quest: Quest = {
      id: uid(), name: name.trim() || 'Untitled quest', notes, state: structuredClone(st),
      locations: values.map((value) => ({ id: uid(), value, status: 'pending', runAt: null, runs: 0 })),
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    await store.quests.put(quest);
    onOpenChange(false);
    toast.success('Quest created', { description: `${quest.locations.length || 'No'} locations` });
    onCreated(quest.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={create} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Save as quest</DialogTitle>
            <DialogDescription>Run this query once per location and track which ones you’ve searched.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field><FieldLabel htmlFor="q-name">Quest name</FieldLabel><Input id="q-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field>
              <FieldLabel htmlFor="q-locs">Locations, one search per line</FieldLabel>
              <Textarea id="q-locs" rows={5} value={locs} onChange={(e) => setLocs(e.target.value)} placeholder={'Dayton, OH\n45402\nMontgomery County'} />
              <FieldDescription>Each line replaces the Location slot. Leave empty to run the query exactly as built.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Also add a city list</FieldLabel>
              <Select value={list} onValueChange={setList}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {Object.entries(CITY_LISTS as Record<string, string[]>).map(([k, v]) => <SelectItem key={k} value={k}>{k} ({v.length})</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field><FieldLabel htmlFor="q-notes">Notes</FieldLabel><Textarea id="q-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Create quest</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SaveTemplateDialog({ open, onOpenChange, query, st }: { open: boolean; onOpenChange: (o: boolean) => void; query: string; st: BuilderState }) {
  const [name, setName] = React.useState('');
  const [group, setGroup] = React.useState('Custom');
  const [desc, setDesc] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setName(defaultName(st));
    setGroup('Custom');
    setDesc('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await store.templates.put({ id: uid(), name: name.trim() || 'Untitled', region: group.trim() || 'Custom', description: desc, state: structuredClone(st) });
    onOpenChange(false);
    toast.success('Template saved');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={save} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
            <DialogDescription className="line-clamp-2 font-mono text-xs">{query}</DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field><FieldLabel htmlFor="t-name">Name</FieldLabel><Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field><FieldLabel htmlFor="t-group">Group</FieldLabel><Input id="t-group" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="US, DE, Custom…" /></Field>
            <Field><FieldLabel htmlFor="t-desc">Description</FieldLabel><Textarea id="t-desc" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Save template</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
