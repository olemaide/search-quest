import * as React from 'react';
import { toast } from 'sonner';
import {
  CalendarRangeIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, CopyIcon, EraserIcon, FileStackIcon,
  MapPinIcon, MapPlusIcon, PencilLineIcon, SaveIcon, SearchIcon, Settings2Icon, TriangleAlertIcon, XIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertAction, AlertTitle } from '@/components/ui/alert';
import { ChipInput, IconAction, InfoTip, SlotDot } from '@/components/common';
import { CityPicker } from '@/components/city-picker';
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

type SlotDef = { key: SlotKey; label: string; placeholder: string; hint: string };
const SLOT_DEFS = SLOTS as SlotDef[];
const PRIMARY: SlotKey[] = ['profession', 'location', 'signals', 'excludes'];
const LABELS = SLOT_LABEL as Record<string, string>;
const CITIES = CITY_LISTS as Record<string, string[]>;

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
  const [dialog, setDialog] = React.useState<'quest' | 'template' | null>(null);

  React.useEffect(() => {
    if (pendingDraft) { pendingDraft = null; return; }
    (store.getDraft() as Promise<Draft | null>).then((d) => setDraftState(d ? { state: normalizeState(d.state), meta: d.meta || {} } : { state: emptyState(), meta: {} }));
  }, []);

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

  const saveToQuest = async () => {
    const q = (await store.quests.get(meta.questId!)) as Quest | null;
    if (!q) { toast.error('That quest no longer exists.'); setDraftState({ ...draft, meta: {} }); return; }
    await store.quests.put({ ...q, state: structuredClone(st), updatedAt: Date.now() });
    toast.success('Quest updated');
    go('quests', { questId: q.id });
  };

  return (
    <>
      {meta.questId ? (
        <Alert>
          <PencilLineIcon />
          <AlertTitle className="truncate">Editing “{meta.questName}”</AlertTitle>
          <AlertAction className="flex gap-1.5">
            <Button size="xs" onClick={saveToQuest}>Save</Button>
            <IconAction label="Stop editing" icon={XIcon} size="icon-xs" onClick={() => setDraftState({ ...draft, meta: {} })} />
          </AlertAction>
        </Alert>
      ) : null}

      <div className="grid items-start gap-4 @4xl/main:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <QueryCard
            st={st}
            templates={templates || []}
            onPick={(t) => { setDraftState({ state: normalizeState(structuredClone(t.state)), meta: { templateName: t.name } }); toast.success(`Loaded “${t.name}”`); }}
            onClear={async () => {
              if (buildQuery(st) && !(await confirmDialog({ title: 'Clear every slot?', confirmLabel: 'Clear', destructive: true }))) return;
              setDraftState({ state: emptyState(), meta: {} });
            }}
            onSave={setDialog}
          />
          <SlotsCard st={st} setSt={setSt} patch={patch} />
        </div>
        <Palette blocks={blocks || []} st={st} setSt={setSt} onManage={() => go('library')} />
      </div>

      <SaveQuestDialog open={dialog === 'quest'} onOpenChange={(o) => setDialog(o ? 'quest' : null)} st={st} onCreated={(id) => go('quests', { questId: id })} />
      <SaveTemplateDialog open={dialog === 'template'} onOpenChange={(o) => setDialog(o ? 'template' : null)} st={st} />
    </>
  );
}

// ----------------------------------------------------------------- query card

function QueryCard({ st, templates, onPick, onClear, onSave }: {
  st: BuilderState; templates: Template[]; onPick: (t: Template) => void; onClear: () => void; onSave: (d: 'quest' | 'template') => void;
}) {
  const query = buildQuery(st);
  const words = countWords(query);
  const over = words > 32;
  return (
    <Card className="gap-3 py-3 shadow-sm @4xl/main:sticky @4xl/main:top-[5.5rem] @4xl/main:z-20">
      <CardHeader className="flex items-center gap-2 px-3">
        <CardTitle className="font-heading text-base">Query</CardTitle>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="secondary"
              className={cn('tabular-nums', over ? 'bg-destructive/15 text-destructive' : words > 26 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300')}
            >
              {over ? <TriangleAlertIcon /> : null}{words}/32
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            {over ? 'Over Google’s ~32-word limit: the last terms (usually exclusions) get ignored.' : 'Words used of Google’s ~32-word limit'}
          </TooltipContent>
        </Tooltip>
        <div className="ml-auto flex items-center gap-0.5">
          <TemplatePicker templates={templates} onPick={onPick} />
          <IconAction label="Clear all slots" icon={EraserIcon} disabled={!query} onClick={onClear} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-3">
        <pre
          className={cn(
            'max-h-36 min-h-14 overflow-auto rounded-md bg-muted/70 px-3 py-2.5 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap break-words',
            !query && 'flex items-center font-sans text-sm text-muted-foreground',
          )}
        >
          {query || 'Load a template or click blocks'}
        </pre>
        <div className="flex items-center gap-1.5">
          <Button disabled={!query} onClick={() => openSearch(query)} className="flex-1 @md/main:flex-none">
            <SearchIcon data-icon="inline-start" />Search Google
          </Button>
          <IconAction label="Copy query" icon={CopyIcon} variant="outline" size="icon" disabled={!query} onClick={() => copyText(query)} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!query}><SaveIcon data-icon="inline-start" />Save<ChevronDownIcon data-icon="inline-end" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onSave('quest')}><MapPlusIcon />As quest…</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onSave('template')}><FileStackIcon />As template…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplatePicker({ templates, onPick }: { templates: Template[]; onPick: (t: Template) => void }) {
  const [open, setOpen] = React.useState(false);
  const groups = uniq(templates.map((t) => t.region || 'Custom')).sort() as string[];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" role="combobox" aria-label="Load a template" aria-expanded={open} className="text-muted-foreground">
          <FileStackIcon data-icon="inline-start" />Templates<ChevronDownIcon data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Command>
          <CommandInput placeholder="Search templates…" />
          <CommandList className="max-h-80">
            <CommandEmpty>No template found.</CommandEmpty>
            {groups.map((g) => (
              <CommandGroup key={g} heading={g}>
                {templates.filter((t) => (t.region || 'Custom') === g).sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
                  <CommandItem key={t.id} value={`${t.name} ${g} ${t.description || ''}`} onSelect={() => { setOpen(false); onPick(t); }} title={t.description}>
                    {t.name}
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

// ----------------------------------------------------------------- slots

function SlotLabel({ slot, htmlFor, children, hint }: { slot: SlotKey | 'site' | 'extra'; htmlFor?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex h-6 items-center gap-2">
      <SlotDot slot={slot} />
      <FieldLabel htmlFor={htmlFor}>{children}</FieldLabel>
      {hint ? <InfoTip>{hint}</InfoTip> : null}
    </div>
  );
}

function SlotsCard({ st, setSt, patch }: { st: BuilderState; setSt: (s: BuilderState) => void; patch: (p: Partial<BuilderState>) => void }) {
  const advancedCount = st.required.length + (st.site ? 1 : 0) + (st.extra ? 1 : 0);
  const [more, setMore] = React.useState(advancedCount > 0);
  React.useEffect(() => { if (advancedCount) setMore(true); }, [advancedCount]);
  const def = (k: SlotKey) => SLOT_DEFS.find((s) => s.key === k)!;

  const chipField = (k: SlotKey, extra?: React.ReactNode) => {
    const d = def(k);
    return (
      <Field key={k} className="gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <SlotLabel slot={k} htmlFor={'slot-' + k} hint={d.hint}>{d.label}</SlotLabel>
          {extra}
        </div>
        <ChipInput id={'slot-' + k} value={st[k]} placeholder={d.placeholder} format={k === 'excludes' ? normalizeDomain : undefined} onChange={(v) => patch({ [k]: v })} />
      </Field>
    );
  };

  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <FieldGroup className="gap-4">
          {PRIMARY.map((k) => chipField(k,
            k === 'profession' ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <label className="flex h-6 cursor-pointer items-center gap-1.5 font-mono text-xs text-muted-foreground">
                    intitle:<Switch size="sm" checked={st.intitle} onCheckedChange={(v) => patch({ intitle: v })} />
                  </label>
                </TooltipTrigger>
                <TooltipContent>Only pages with the niche in their title (company homepages)</TooltipContent>
              </Tooltip>
            ) : k === 'signals' ? (
              <YearPopover onAdd={(terms) => setSt({ ...st, signals: uniq([...st.signals, ...terms]) as string[] })} />
            ) : k === 'location' ? (
              <CityPicker existing={st.location} onAdd={(labels) => setSt({ ...st, location: uniq([...st.location, ...labels]) as string[] })}>
                <Button variant="ghost" size="xs" className="text-muted-foreground"><MapPinIcon data-icon="inline-start" />US cities</Button>
              </CityPicker>
            ) : null))}

          <Collapsible open={more} onOpenChange={setMore}>
            <CollapsibleTrigger className="group -ml-1 flex h-7 items-center gap-1.5 rounded-md px-1 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
              <ChevronRightIcon className="size-4 transition-transform group-data-[state=open]:rotate-90" />
              More options
              {advancedCount ? <Badge variant="secondary" className="h-4.5 px-1.5 tabular-nums">{advancedCount}</Badge> : null}
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col gap-4 pt-3">
              {chipField('required')}
              <div className="grid gap-4 @2xl/main:grid-cols-2">
                <Field className="gap-1.5">
                  <SlotLabel slot="site" htmlFor="site" hint="Becomes site:… e.g. weebly.com finds owners who never bought a domain.">Site filter</SlotLabel>
                  <Input id="site" value={st.site} placeholder=".de · weebly.com" onChange={(e) => patch({ site: e.target.value })} />
                </Field>
                <Field className="gap-1.5">
                  <SlotLabel slot="extra" htmlFor="extra" hint="Inserted exactly as typed.">Raw operators</SlotLabel>
                  <Input id="extra" value={st.extra} placeholder='inurl:"…"' className="font-mono text-xs" onChange={(e) => patch({ extra: e.target.value })} />
                </Field>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

const yearDefaults = { prefix: 'Copyright', from: 2010, to: 2018, step: 2 };

function YearPopover({ onAdd }: { onAdd: (terms: string[]) => void }) {
  const [open, setOpen] = React.useState(false);
  const [y, setY] = React.useState(yearDefaults);
  const set = (p: Partial<typeof y>) => setY((cur) => Object.assign(yearDefaults, { ...cur, ...p }));
  const preview = yearTerms(y.from, y.to, y.step, y.prefix);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="xs" className="text-muted-foreground"><CalendarRangeIcon data-icon="inline-start" />Years</Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Add a range of years</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="flex w-72 flex-col gap-3">
        <Select value={y.prefix} onValueChange={(v) => set({ prefix: v })}>
          <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{['Copyright', 'last updated', 'letzte Aktualisierung', 'Stand'].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>
        <div className="grid grid-cols-[1fr_1fr_4rem] gap-2">
          {([['from', 'From'], ['to', 'To'], ['step', 'Step']] as const).map(([k, l]) => (
            <Field key={k} className="gap-1">
              <FieldLabel className="text-xs text-muted-foreground">{l}</FieldLabel>
              <Input type="number" className="h-8" value={y[k]} onChange={(e) => set({ [k]: +e.target.value })} />
            </Field>
          ))}
        </div>
        <Button size="sm" disabled={!preview.length} onClick={() => { onAdd(preview); setOpen(false); }}>
          Add {preview.length} term{preview.length === 1 ? '' : 's'}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

// ----------------------------------------------------------------- palette

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
    const next = on ? uniq([...open, cat]) as string[] : open.filter((c) => c !== cat);
    setOpen(next);
    try { localStorage.setItem('sq.openCats', JSON.stringify(next)); } catch { /* storage blocked */ }
  };

  return (
    <Card className="gap-3 py-3 @4xl/main:sticky @4xl/main:top-[5.5rem]">
      <CardHeader className="flex items-center gap-2 px-3">
        <CardTitle className="font-heading text-base">Blocks</CardTitle>
        <InfoTip>Click a block to add it to the slot with the same colour. Click again to remove it.</InfoTip>
        <IconAction label="Manage blocks" icon={Settings2Icon} className="ml-auto" onClick={onManage} />
      </CardHeader>
      <CardContent className="flex flex-col px-3 @4xl/main:max-h-[calc(100svh-9.5rem)] @4xl/main:overflow-y-auto">
        <InputGroup className="mb-1.5">
          <InputGroupAddon><SearchIcon /></InputGroupAddon>
          <InputGroupInput placeholder="Filter blocks" value={filter} onChange={(e) => setFilter(e.target.value)} />
          {filter ? <InputGroupAddon align="inline-end"><InputGroupButton size="icon-xs" aria-label="Clear filter" onClick={() => setFilter('')}><XIcon /></InputGroupButton></InputGroupAddon> : null}
        </InputGroup>
        {[...cats.entries()].map(([cat, list]) => {
          const shown = f ? list.filter((b) => `${b.label} ${b.value} ${cat}`.toLowerCase().includes(f)) : list;
          if (!shown.length) return null;
          const active = shown.filter((b) => isOn(st, b)).length;
          return (
            <Collapsible key={cat} open={!!f || open.includes(cat)} onOpenChange={(o) => !f && toggleCat(cat, o)}>
              <CollapsibleTrigger className="group flex h-9 w-full items-center gap-2 rounded-md px-1 text-left text-sm outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50">
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                <SlotDot slot={list[0].slot} label={LABELS[list[0].slot]} />
                <span className="truncate font-medium">{cat}</span>
                <span className={cn('ml-auto min-w-5 text-center text-xs tabular-nums', active ? 'rounded-full bg-primary px-1.5 font-medium text-primary-foreground' : 'text-muted-foreground')}>
                  {active || shown.length}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-wrap gap-1.5 pt-1 pb-3 pl-7">
                {shown.map((b) => {
                  const on = isOn(st, b);
                  return (
                    <Button
                      key={b.id}
                      size="xs"
                      variant={on ? 'default' : 'outline'}
                      aria-pressed={on}
                      title={b.label !== b.value ? b.value : undefined}
                      className={cn('rounded-full font-normal', !on && 'text-foreground/80')}
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

  React.useEffect(() => {
    if (!open) return;
    setName(defaultName(st, false));
    setLocs(st.location.join('\n'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const values = uniq(lines(locs)) as string[];
  const append = (more: string[]) => setLocs((cur) => (uniq([...lines(cur), ...more]) as string[]).join('\n'));

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const quest: Quest = {
      id: uid(), name: name.trim() || 'Untitled quest', notes: '', state: structuredClone(st),
      locations: values.map((value) => ({ id: uid(), value, status: 'pending', runAt: null, runs: 0 })),
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    await store.quests.put(quest);
    onOpenChange(false);
    toast.success('Quest created');
    onCreated(quest.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={create} className="flex flex-col gap-5">
          <DialogHeader><DialogTitle>New quest</DialogTitle></DialogHeader>
          <FieldGroup className="gap-4">
            <Field className="gap-1.5"><FieldLabel htmlFor="q-name">Name</FieldLabel><Input id="q-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field className="gap-1.5">
              <div className="flex items-center gap-2">
                <FieldLabel htmlFor="q-locs">Locations</FieldLabel>
                <InfoTip>One search per line: each replaces the Location slot. Leave empty to run the query as built.</InfoTip>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">{values.length}</span>
              </div>
              <Textarea id="q-locs" rows={6} value={locs} onChange={(e) => setLocs(e.target.value)} placeholder={'Dayton, OH\n45402\nMontgomery County'} />
              <div className="grid grid-cols-2 gap-2">
                <CityPicker existing={values} align="start" onAdd={append}>
                  <Button type="button" variant="outline" size="sm"><MapPinIcon data-icon="inline-start" />Pick US cities</Button>
                </CityPicker>
                <Select value="" onValueChange={(k) => append(CITIES[k] || [])}>
                  <SelectTrigger size="sm" className="w-full" aria-label="Add a city list"><SelectValue placeholder="+ City list" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CITIES).map(([k, v]) => <SelectItem key={k} value={k}>{k} ({v.length})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Create quest</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SaveTemplateDialog({ open, onOpenChange, st }: { open: boolean; onOpenChange: (o: boolean) => void; st: BuilderState }) {
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
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save} className="flex flex-col gap-5">
          <DialogHeader><DialogTitle>New template</DialogTitle></DialogHeader>
          <FieldGroup className="gap-4">
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <Field className="gap-1.5"><FieldLabel htmlFor="t-name">Name</FieldLabel><Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field className="gap-1.5"><FieldLabel htmlFor="t-group">Group</FieldLabel><Input id="t-group" value={group} onChange={(e) => setGroup(e.target.value)} /></Field>
            </div>
            <Field className="gap-1.5"><FieldLabel htmlFor="t-desc">Description</FieldLabel><Textarea id="t-desc" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional" /></Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Save template</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
