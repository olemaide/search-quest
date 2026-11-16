import * as React from 'react';
import { toast } from 'sonner';
import { MoreHorizontalIcon, PencilIcon, PlusIcon, RotateCcwIcon, SearchIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { IconAction, InfoTip, SlotDot } from '@/components/common';
import { confirmDialog } from '@/components/confirm';
import { store } from '@/lib/ext';
import { useNav } from '@/lib/nav';
import { useExtData } from '@/hooks/use-ext-data';
import { loadDraft } from '@/views/builder';
import { SLOT_LABEL, buildQuery } from '@ext/query.js';
import { uid, uniq } from '@ext/util.js';
import type { Block, BlockSlot, Template } from '@/types';

const LABELS = SLOT_LABEL as Record<string, string>;
type Editing = { block: Block | null; cat?: string; slot?: BlockSlot } | null;

export function LibraryView() {
  const { go } = useNav();
  const [tab, setTab] = React.useState(() => { try { return localStorage.getItem('sq.libTab') || 'blocks'; } catch { return 'blocks'; } });
  const [filter, setFilter] = React.useState('');
  const [blocks] = useExtData(() => store.getBlocks() as Promise<Block[]>, (k) => k === 'blocks');
  const [templates] = useExtData(() => store.templates.list() as Promise<Template[]>, (k) => k.startsWith('tpl:'));
  const [editing, setEditing] = React.useState<Editing>(null);
  if (!blocks || !templates) return null;

  const restore = async () => {
    const n = tab === 'blocks' ? await store.restoreDefaultBlocks() : await store.restoreDefaultTemplates();
    toast(n ? `Restored ${n}` : 'Nothing missing');
  };

  return (
    <Tabs value={tab} onValueChange={(v) => { setTab(v); try { localStorage.setItem('sq.libTab', v); } catch { /* storage blocked */ } }} className="gap-4">
      <div className="flex min-h-9 items-center gap-2">
        <TabsList>
          <TabsTrigger value="blocks">Blocks <span className="text-muted-foreground tabular-nums">{blocks.length}</span></TabsTrigger>
          <TabsTrigger value="templates">Templates <span className="text-muted-foreground tabular-nums">{templates.length}</span></TabsTrigger>
        </TabsList>
        <InfoTip side="bottom">
          {tab === 'blocks'
            ? 'Reusable query pieces. The colour shows which Builder slot a block fills. Tip: add footer credits you find on local sites (“Website by …”) as signals.'
            : 'Complete Builder setups. Load one, swap the niche or city, then search or save it as a quest.'}
        </InfoTip>
        <div className="ml-auto flex items-center gap-1">
          <InputGroup className="hidden w-48 @xl/main:flex">
            <InputGroupAddon><SearchIcon /></InputGroupAddon>
            <InputGroupInput placeholder="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </InputGroup>
          <Button size="sm" onClick={() => (tab === 'blocks' ? setEditing({ block: null }) : go('builder'))}>
            <PlusIcon data-icon="inline-start" />New
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label="More"><MoreHorizontalIcon /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={restore}><RotateCcwIcon />Restore default {tab}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <InputGroup className="@xl/main:hidden">
        <InputGroupAddon><SearchIcon /></InputGroupAddon>
        <InputGroupInput placeholder="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </InputGroup>

      <TabsContent value="blocks"><BlocksTab blocks={blocks} filter={filter} onEdit={setEditing} /></TabsContent>
      <TabsContent value="templates"><TemplatesTab templates={templates} filter={filter} /></TabsContent>
      <BlockDialog editing={editing} blocks={blocks} onClose={() => setEditing(null)} />
    </Tabs>
  );
}

function BlocksTab({ blocks, filter, onEdit }: { blocks: Block[]; filter: string; onEdit: (e: Editing) => void }) {
  const f = filter.trim().toLowerCase();
  const cats = new Map<string, Block[]>();
  for (const b of blocks) {
    if (f && !`${b.cat} ${b.label} ${b.value}`.toLowerCase().includes(f)) continue;
    if (!cats.has(b.cat)) cats.set(b.cat, []);
    cats.get(b.cat)!.push(b);
  }
  return (
    <div className="columns-1 gap-3 @3xl/main:columns-2 @6xl/main:columns-3 [&>*]:mb-3 [&>*]:break-inside-avoid">
      {[...cats.entries()].map(([cat, list]) => (
        <Card key={cat} className="gap-2 py-3">
          <CardHeader className="flex items-center gap-2 px-3">
            <SlotDot slot={list[0].slot} label={LABELS[list[0].slot]} />
            <CardTitle className="truncate text-sm">{cat}</CardTitle>
            <span className="text-xs text-muted-foreground tabular-nums">{list.length}</span>
            <IconAction label={`Add to ${cat}`} icon={PlusIcon} size="icon-xs" className="ml-auto" onClick={() => onEdit({ block: null, cat, slot: list[0].slot })} />
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5 px-3">
            {list.map((b) => (
              <Tooltip key={b.id}>
                <TooltipTrigger asChild>
                  <Button size="xs" variant="outline" className="rounded-full font-normal text-foreground/80" onClick={() => onEdit({ block: b })}>{b.label}</Button>
                </TooltipTrigger>
                <TooltipContent>{b.label !== b.value ? <span className="font-mono">{b.value}</span> : 'Edit'}</TooltipContent>
              </Tooltip>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TemplatesTab({ templates, filter }: { templates: Template[]; filter: string }) {
  const { go } = useNav();
  const [renaming, setRenaming] = React.useState<Template | null>(null);
  const f = filter.trim().toLowerCase();
  const list = templates
    .filter((t) => !f || `${t.name} ${t.region} ${t.description}`.toLowerCase().includes(f))
    .sort((a, b) => (a.region || '').localeCompare(b.region || '') || a.name.localeCompare(b.name));
  return (
    <>
      <div className="grid gap-3 @2xl/main:grid-cols-2 @5xl/main:grid-cols-3">
        {list.map((t) => (
          <Card key={t.id} className="group gap-2 py-3">
            <CardHeader className="flex items-center gap-2 px-3">
              <CardTitle className="truncate text-sm">{t.name}</CardTitle>
              {t.description ? <InfoTip>{t.description}</InfoTip> : null}
              <Badge variant="secondary" className="ml-auto shrink-0">{t.region || 'Custom'}</Badge>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-2 px-3">
              <pre className="line-clamp-2 flex-1 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all text-muted-foreground">{buildQuery(t.state)}</pre>
              <div className="flex items-center gap-1">
                <Button size="xs" variant="secondary" onClick={() => { loadDraft(t.state, { templateName: t.name }); go('builder'); toast.success(`Loaded “${t.name}”`); }}>
                  <UploadIcon data-icon="inline-start" />Load
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="icon-xs" variant="ghost" className="ml-auto opacity-60 group-hover:opacity-100" aria-label={`More for ${t.name}`}><MoreHorizontalIcon /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setRenaming(t)}><PencilIcon />Rename</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={async () => { if (await confirmDialog({ title: `Delete “${t.name}”?`, confirmLabel: 'Delete', destructive: true })) await store.templates.del(t.id); }}>
                      <Trash2Icon />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <RenameTemplateDialog template={renaming} onClose={() => setRenaming(null)} />
    </>
  );
}

function BlockDialog({ editing, blocks, onClose }: { editing: Editing; blocks: Block[]; onClose: () => void }) {
  const block = editing?.block || null;
  const [v, setV] = React.useState({ cat: '', value: '', label: '', slot: 'signals' as BlockSlot });
  React.useEffect(() => {
    if (!editing) return;
    setV(block
      ? { cat: block.cat, value: block.value, label: block.label !== block.value ? block.label : '', slot: block.slot }
      : { cat: editing.cat || 'My blocks', value: '', label: '', slot: editing.slot || 'signals' });
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const cats = uniq(blocks.map((b) => b.cat)) as string[];
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.value.trim()) return;
    const next: Block = { id: block?.id || uid(), cat: v.cat.trim() || 'My blocks', value: v.value.trim(), label: v.label.trim() || v.value.trim(), slot: v.slot };
    await store.setBlocks(block ? blocks.map((b) => (b.id === block.id ? next : b)) : [...blocks, next]);
    toast.success(block ? 'Saved' : 'Added');
    onClose();
  };
  const remove = async () => {
    if (!block) return;
    await store.setBlocks(blocks.filter((b) => b.id !== block.id));
    toast('Block deleted');
    onClose();
  };

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader><DialogTitle>{block ? 'Edit block' : 'New block'}</DialogTitle></DialogHeader>
          <FieldGroup className="gap-4">
            <Field className="gap-1.5">
              <div className="flex items-center gap-2">
                <FieldLabel htmlFor="b-value">Value</FieldLabel>
                <InfoTip>Plain words get quoted. Text starting with an operator (inurl:, site:) or a quote goes in as-is.</InfoTip>
              </div>
              <Input id="b-value" autoFocus required value={v.value} placeholder="Powered by Homestead" onChange={(e) => setV({ ...v, value: e.target.value })} />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="b-label">Label</FieldLabel>
              <Input id="b-label" value={v.label} placeholder="Same as value" onChange={(e) => setV({ ...v, label: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field className="gap-1.5">
                <FieldLabel htmlFor="b-cat">Category</FieldLabel>
                <Input id="b-cat" list="b-cats" value={v.cat} onChange={(e) => setV({ ...v, cat: e.target.value })} />
                <datalist id="b-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
              <Field className="gap-1.5">
                <FieldLabel>Slot</FieldLabel>
                <Select value={v.slot} onValueChange={(s) => setV({ ...v, slot: s as BlockSlot })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LABELS).map(([k, l]) => <SelectItem key={k} value={k}><SlotDot slot={k as BlockSlot} />{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter className="sm:justify-between">
            {block ? <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={remove}><Trash2Icon data-icon="inline-start" />Delete</Button> : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit">{block ? 'Save' : 'Add'}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RenameTemplateDialog({ template, onClose }: { template: Template | null; onClose: () => void }) {
  const [v, setV] = React.useState({ name: '', region: '', description: '' });
  React.useEffect(() => {
    if (template) setV({ name: template.name, region: template.region || 'Custom', description: template.description || '' });
  }, [template]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template) return;
    await store.templates.put({ ...template, name: v.name.trim() || template.name, region: v.region.trim() || 'Custom', description: v.description });
    onClose();
  };
  return (
    <Dialog open={!!template} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader><DialogTitle>Rename template</DialogTitle></DialogHeader>
          <FieldGroup className="gap-4">
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <Field className="gap-1.5"><FieldLabel htmlFor="r-name">Name</FieldLabel><Input id="r-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
              <Field className="gap-1.5"><FieldLabel htmlFor="r-region">Group</FieldLabel><Input id="r-region" value={v.region} onChange={(e) => setV({ ...v, region: e.target.value })} /></Field>
            </div>
            <Field className="gap-1.5"><FieldLabel htmlFor="r-desc">Description</FieldLabel><Textarea id="r-desc" rows={2} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
