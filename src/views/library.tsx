import * as React from 'react';
import { toast } from 'sonner';
import {
  BlocksIcon, FileStackIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, RotateCcwIcon, SearchIcon, Trash2Icon, UploadIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/common';
import { confirmDialog } from '@/components/confirm';
import { store } from '@/lib/ext';
import { useNav } from '@/lib/nav';
import { useExtData } from '@/hooks/use-ext-data';
import { cn } from '@/lib/utils';
import { loadDraft } from '@/views/builder';
import { SLOT_LABEL, buildQuery } from '@ext/query.js';
import { uid, uniq } from '@ext/util.js';
import type { Block, BlockSlot, Template } from '@/types';

const SLOT_OPTIONS = Object.entries(SLOT_LABEL as Record<string, string>);

export function LibraryView() {
  const [tab, setTab] = React.useState(() => { try { return localStorage.getItem('sq.libTab') || 'blocks'; } catch { return 'blocks'; } });
  const [filter, setFilter] = React.useState('');
  const [blocks] = useExtData(() => store.getBlocks() as Promise<Block[]>, (k) => k === 'blocks');
  const [templates] = useExtData(() => store.templates.list() as Promise<Template[]>, (k) => k.startsWith('tpl:'));
  const [editing, setEditing] = React.useState<Block | 'new' | null>(null);
  if (!blocks || !templates) return null;

  return (
    <>
      <PageHeader title="Library" description="Reusable building blocks and complete query templates." />
      <Tabs value={tab} onValueChange={(v) => { setTab(v); try { localStorage.setItem('sq.libTab', v); } catch { /* storage blocked */ } }} className="gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <TabsList>
            <TabsTrigger value="blocks"><BlocksIcon />Blocks <Badge variant="secondary" className="h-4.5 px-1.5">{blocks.length}</Badge></TabsTrigger>
            <TabsTrigger value="templates"><FileStackIcon />Templates <Badge variant="secondary" className="h-4.5 px-1.5">{templates.length}</Badge></TabsTrigger>
          </TabsList>
          <InputGroup className="max-w-xs flex-1">
            <InputGroupAddon><SearchIcon /></InputGroupAddon>
            <InputGroupInput placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </InputGroup>
        </div>
        <TabsContent value="blocks" className="flex flex-col gap-4">
          <BlocksTab blocks={blocks} filter={filter} onEdit={setEditing} />
        </TabsContent>
        <TabsContent value="templates" className="flex flex-col gap-4">
          <TemplatesTab templates={templates} filter={filter} />
        </TabsContent>
      </Tabs>
      <BlockDialog block={editing} blocks={blocks} onClose={() => setEditing(null)} />
    </>
  );
}

function BlocksTab({ blocks, filter, onEdit }: { blocks: Block[]; filter: string; onEdit: (b: Block | 'new') => void }) {
  const f = filter.trim().toLowerCase();
  const cats = new Map<string, Block[]>();
  for (const b of blocks) {
    if (f && !`${b.cat} ${b.label} ${b.value}`.toLowerCase().includes(f)) continue;
    if (!cats.has(b.cat)) cats.set(b.cat, []);
    cats.get(b.cat)!.push(b);
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => onEdit('new')}><PlusIcon data-icon="inline-start" />New block</Button>
        <Button size="sm" variant="outline" onClick={async () => { const n = await store.restoreDefaultBlocks(); toast(n ? `Restored ${n} default blocks` : 'All default blocks are present'); }}>
          <RotateCcwIcon data-icon="inline-start" />Restore defaults
        </Button>
        <p className="basis-full text-sm text-muted-foreground">Each block targets one Builder slot. Add the footer credits you find on local sites (“Website by …”) as signals.</p>
      </div>
      <div className="grid items-start gap-3 @3xl/main:grid-cols-2">
        {[...cats.entries()].map(([cat, list]) => (
          <Card key={cat} className="gap-2 py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-sm">{cat}</CardTitle>
              <CardAction><Badge variant="outline">→ {(SLOT_LABEL as Record<string, string>)[list[0].slot] || list[0].slot}</Badge></CardAction>
            </CardHeader>
            <CardContent className="px-2">
              <ItemGroup className="gap-0">
                {list.map((b) => (
                  <Item key={b.id} size="xs" className="py-1">
                    <ItemContent className="min-w-0 flex-row items-baseline gap-2">
                      <ItemTitle className="shrink-0 font-normal">{b.label}</ItemTitle>
                      {b.label !== b.value ? <ItemDescription className="truncate font-mono text-xs">{b.value}</ItemDescription> : null}
                    </ItemContent>
                    <ItemActions>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon-xs" variant="ghost" aria-label={`Actions for ${b.label}`}><MoreHorizontalIcon /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => onEdit(b)}><PencilIcon />Edit</DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onSelect={() => store.setBlocks(blocks.filter((x) => x.id !== b.id))}><Trash2Icon />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
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
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => go('builder')}><PlusIcon data-icon="inline-start" />Build a new template</Button>
        <Button size="sm" variant="outline" onClick={async () => { const n = await store.restoreDefaultTemplates(); toast(n ? `Restored ${n} default templates` : 'All default templates are present'); }}>
          <RotateCcwIcon data-icon="inline-start" />Restore defaults
        </Button>
      </div>
      <div className="grid gap-3 @2xl/main:grid-cols-2 @5xl/main:grid-cols-3">
        {list.map((t) => (
          <Card key={t.id} className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-sm">{t.name}</CardTitle>
              {t.description ? <CardDescription className="text-xs">{t.description}</CardDescription> : null}
              <CardAction><Badge variant="secondary">{t.region || 'Custom'}</Badge></CardAction>
            </CardHeader>
            <CardContent className="flex-1 px-4">
              <pre className="line-clamp-4 rounded-md bg-muted px-2.5 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words">{buildQuery(t.state)}</pre>
            </CardContent>
            <CardFooter className="gap-2 px-4">
              <Button size="sm" onClick={() => { loadDraft(t.state, { templateName: t.name }); go('builder'); toast.success(`Loaded “${t.name}”`); }}>
                <UploadIcon data-icon="inline-start" />Load in builder
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label="More"><MoreHorizontalIcon /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setRenaming(t)}><PencilIcon />Rename</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={async () => {
                      if (await confirmDialog({ title: 'Delete template?', description: t.name, confirmLabel: 'Delete', destructive: true })) await store.templates.del(t.id);
                    }}
                  >
                    <Trash2Icon />Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardFooter>
          </Card>
        ))}
      </div>
      <RenameTemplateDialog template={renaming} onClose={() => setRenaming(null)} />
    </>
  );
}

function BlockDialog({ block, blocks, onClose }: { block: Block | 'new' | null; blocks: Block[]; onClose: () => void }) {
  const editing = block && block !== 'new' ? block : null;
  const [v, setV] = React.useState({ cat: '', value: '', label: '', slot: 'signals' as BlockSlot });
  React.useEffect(() => {
    if (!block) return;
    setV(editing
      ? { cat: editing.cat, value: editing.value, label: editing.label !== editing.value ? editing.label : '', slot: editing.slot }
      : { cat: 'My blocks', value: '', label: '', slot: 'signals' });
  }, [block]); // eslint-disable-line react-hooks/exhaustive-deps

  const cats = uniq(blocks.map((b) => b.cat)) as string[];
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.value.trim()) return;
    const next: Block = { id: editing?.id || uid(), cat: v.cat.trim() || 'My blocks', value: v.value.trim(), label: v.label.trim() || v.value.trim(), slot: v.slot };
    await store.setBlocks(editing ? blocks.map((b) => (b.id === editing.id ? next : b)) : [...blocks, next]);
    toast.success(editing ? 'Block saved' : 'Block added');
    onClose();
  };

  return (
    <Dialog open={!!block} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit block' : 'New building block'}</DialogTitle>
            <DialogDescription>Plain words get quoted. Text starting with an operator (inurl:, site:) or a quote goes in as-is.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="b-value">Value</FieldLabel>
              <Input id="b-value" required value={v.value} placeholder="Powered by Homestead" onChange={(e) => setV({ ...v, value: e.target.value })} />
            </Field>
            <Field>
              <FieldLabel htmlFor="b-label">Label</FieldLabel>
              <Input id="b-label" value={v.label} placeholder="Optional, defaults to the value" onChange={(e) => setV({ ...v, label: e.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="b-cat">Category</FieldLabel>
                <Input id="b-cat" list="b-cats" value={v.cat} onChange={(e) => setV({ ...v, cat: e.target.value })} />
                <datalist id="b-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
              <Field>
                <FieldLabel>Goes into</FieldLabel>
                <Select value={v.slot} onValueChange={(s) => setV({ ...v, slot: s as BlockSlot })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{SLOT_OPTIONS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">{editing ? 'Save' : 'Add block'}</Button>
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
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader><DialogTitle>Rename template</DialogTitle></DialogHeader>
          <FieldGroup className="gap-4">
            <Field><FieldLabel htmlFor="r-name">Name</FieldLabel><Input id="r-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
            <Field>
              <FieldLabel htmlFor="r-region">Group</FieldLabel>
              <Input id="r-region" value={v.region} onChange={(e) => setV({ ...v, region: e.target.value })} />
              <FieldDescription>Templates are grouped by this in the Builder’s picker.</FieldDescription>
            </Field>
            <Field><FieldLabel htmlFor="r-desc">Description</FieldLabel><Textarea id="r-desc" rows={2} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
          </FieldGroup>
          <DialogFooter className={cn()}>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
