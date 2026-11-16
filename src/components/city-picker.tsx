import * as React from 'react';
import { CheckIcon, StarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { InfoTip } from '@/components/common';
import { cn } from '@/lib/utils';
import { SIZE_BANDS, US_CITIES } from '@ext/cities.js';

interface City { label: string; name: string; st: string; k: number; region: string; top: boolean }
const CITIES = US_CITIES as City[];
const BANDS = SIZE_BANDS as [string, string, number, number][];
const REGION_TABS: [string, string, string][] = [
  ['all', 'All', 'All regions'], ['Midwest', 'MW', 'Midwest'], ['South', 'S', 'South'], ['Northeast', 'NE', 'Northeast'], ['West', 'W', 'West'],
];

/**
 * Multi-select picker for ~215 small and mid-sized US cities (25k–250k).
 * `children` is the trigger; `existing` greys out cities already added.
 */
export function CityPicker({ onAdd, existing = [], children, align = 'end' }: {
  onAdd: (labels: string[]) => void;
  existing?: string[];
  children: React.ReactElement;
  align?: 'start' | 'center' | 'end';
}) {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [region, setRegion] = React.useState('all');
  const [size, setSize] = React.useState('all');
  const [topOnly, setTopOnly] = React.useState(false);
  const have = new Set(existing.map((e) => e.toLowerCase()));

  const band = BANDS.find((b) => b[0] === size);
  const shown = CITIES.filter((c) =>
    (region === 'all' || c.region === region)
    && (!band || (c.k >= band[2] && c.k < band[3] + (band[3] === 250 ? 1 : 0)))
    && (!topOnly || c.top));
  const states = [...new Set(shown.map((c) => c.st))];
  const selectable = shown.filter((c) => !have.has(c.label.toLowerCase()));

  const toggle = (label: string) => setSelected((s) => (s.includes(label) ? s.filter((x) => x !== label) : [...s, label]));
  const reset = () => { setSelected([]); };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-0 p-0">
        {/* Filters */}
        <div className="flex flex-col gap-2 border-b p-2">
          <div className="flex items-center gap-1.5">
            <ToggleGroup type="single" size="sm" variant="outline" spacing={0} value={region} onValueChange={(v) => v && setRegion(v)}>
              {REGION_TABS.map(([v, short, long]) => (
                <Tooltip key={v}>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem value={v} aria-label={long} className="px-2 text-xs">{short}</ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent>{long}</TooltipContent>
                </Tooltip>
              ))}
            </ToggleGroup>
            <Select value={size} onValueChange={setSize}>
              <SelectTrigger size="sm" aria-label="Population" className="ml-auto w-[6.5rem] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any size</SelectItem>
                {BANDS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <Toggle size="sm" variant="outline" pressed={topOnly} onPressedChange={setTopOnly} className="text-xs data-[state=on]:border-amber-500/40 data-[state=on]:bg-amber-500/10 data-[state=on]:text-amber-700 dark:data-[state=on]:text-amber-300">
              <StarIcon className={cn(topOnly && 'fill-current')} />Top 20
            </Toggle>
            <InfoTip>
              Suggested starting points: independent regional hubs of about 60k–250k people in the Midwest and South. Lots of long-established local businesses, less local-SEO competition than big metros. A heuristic, so test a few searches first.
            </InfoTip>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">{shown.length} cities</span>
          </div>
        </div>

        {/* List */}
        <Command>
          <CommandInput placeholder="Search city or state…" />
          <CommandList className="max-h-72">
            <CommandEmpty>No city found.</CommandEmpty>
            {states.map((st) => (
              <CommandGroup key={st} heading={st}>
                {shown.filter((c) => c.st === st).map((c) => {
                  const added = have.has(c.label.toLowerCase());
                  const on = selected.includes(c.label);
                  return (
                    <CommandItem key={c.label} value={`${c.label} ${c.region}`} disabled={added} onSelect={() => toggle(c.label)} className="gap-2 [&>svg:last-child]:hidden">
                      <span className={cn('flex size-4 shrink-0 items-center justify-center rounded-[4px] border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}>
                        {on || added ? <CheckIcon className={cn('size-3', added && !on && 'text-muted-foreground')} /> : null}
                      </span>
                      <span className="truncate">{c.name}</span>
                      {c.top ? <StarIcon className="size-3 fill-amber-400 text-amber-400" aria-label="Top pick" /> : null}
                      <span className="ml-auto text-xs text-muted-foreground tabular-nums">{added ? 'added' : `${c.k}k`}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>

        {/* Footer */}
        <div className="flex items-center gap-1 border-t p-2">
          <Button
            variant="ghost" size="xs" disabled={!selectable.length}
            onClick={() => setSelected((s) => [...new Set([...s, ...selectable.map((c) => c.label)])])}
          >
            Select all {selectable.length}
          </Button>
          {selected.length ? <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={reset}>Clear</Button> : null}
          <Button size="sm" className="ml-auto" disabled={!selected.length} onClick={() => { onAdd(selected); setOpen(false); reset(); }}>
            Add {selected.length || ''}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
