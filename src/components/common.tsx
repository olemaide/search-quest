import * as React from 'react';
import { CircleHelpIcon, XIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { BlockSlot, Site } from '@/types';

export function Logo({ className }: { className?: string }) {
  return <img src="/icons/icon32.png" alt="" width={20} height={20} className={cn('size-5 rounded-[5px]', className)} />;
}

/** Small ⓘ that holds explanatory copy, so the page itself stays quiet. */
export function InfoTip({ children, side = 'top', className }: { children: React.ReactNode; side?: 'top' | 'right' | 'bottom' | 'left'; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label="More info" className={cn('inline-flex shrink-0 rounded-full text-muted-foreground/60 outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50', className)}>
          <CircleHelpIcon className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-64 text-pretty">{children}</TooltipContent>
    </Tooltip>
  );
}

type ButtonProps = React.ComponentProps<typeof Button>;

/** Icon-only button whose label lives in a tooltip (and aria-label). */
export function IconAction({ label, icon: Icon, side = 'top', variant = 'ghost', size = 'icon-sm', className, ...props }: ButtonProps & { label: string; icon: React.ElementType; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant={variant} size={size} aria-label={label} className={className} {...props}>
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}

export function PageHeader({ title, count, info, actions }: { title: string; count?: number; info?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex min-h-9 items-center gap-2">
      <h1 className="font-heading text-xl font-semibold tracking-tight">{title}</h1>
      {count != null ? <Badge variant="secondary" className="tabular-nums">{count}</Badge> : null}
      {info ? <InfoTip side="bottom">{info}</InfoTip> : null}
      {actions ? <div className="ml-auto flex items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}

/** Compact key figure with a muted caption. */
export function Stat({ label, value, icon: Icon, hint, className, children, onClick }: {
  label: string; value: React.ReactNode; icon?: React.ElementType; hint?: string; className?: string; children?: React.ReactNode; onClick?: () => void;
}) {
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">{Icon ? <Icon className="size-3.5" /> : null}{label}</span>
      <span className="font-heading text-xl font-semibold tabular-nums leading-none">{value}</span>
      {children}
    </>
  );
  const cls = cn('flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-3 text-left', onClick && 'transition-colors hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none', className);
  const el = onClick ? <button type="button" onClick={onClick} className={cls}>{body}</button> : <div className={cls}>{body}</div>;
  if (!hint) return el;
  return <Tooltip><TooltipTrigger asChild>{el}</TooltipTrigger><TooltipContent>{hint}</TooltipContent></Tooltip>;
}

export const SLOT_COLOR: Record<BlockSlot, string> = {
  profession: 'bg-sky-500',
  location: 'bg-emerald-500',
  signals: 'bg-amber-500',
  required: 'bg-violet-500',
  excludes: 'bg-rose-500',
  site: 'bg-indigo-500',
  extra: 'bg-zinc-400',
};

/** Colour dot that ties a block category to its builder slot. */
export function SlotDot({ slot, label, className }: { slot: BlockSlot; label?: string; className?: string }) {
  const dot = <span aria-hidden className={cn('inline-block size-2 shrink-0 rounded-full', SLOT_COLOR[slot], className)} />;
  if (!label) return dot;
  return <Tooltip><TooltipTrigger asChild><span className="inline-flex p-0.5">{dot}</span></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}

/** Tag-style input in shadcn's input look: Enter adds, Backspace removes, multi-line paste adds many. */
export function ChipInput({ value, onChange, placeholder, format = (s) => s, id }: {
  value: string[]; onChange: (v: string[]) => void; placeholder?: string; format?: (s: string) => string; id?: string;
}) {
  const [text, setText] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const add = (raw: string) => {
    const vals = raw.split(/\r?\n/).map((s) => format(s.trim())).filter(Boolean);
    if (!vals.length) return;
    const next = [...value];
    for (const v of vals) if (!next.includes(v)) next.push(v);
    onChange(next);
  };
  return (
    <div
      data-slot="chip-input"
      onClick={(e) => { if (e.target === e.currentTarget) inputRef.current?.focus(); }}
      className="flex min-h-9 w-full cursor-text flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-1.5 py-1 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30"
    >
      {value.map((v, i) => (
        <Badge key={v + i} variant="secondary" className="h-6 max-w-full gap-0.5 pr-0.5 font-normal">
          <span className="truncate" title={v}>{v}</span>
          <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded-sm p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground">
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
      <input
        ref={inputRef}
        id={id}
        value={text}
        placeholder={value.length ? '' : placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); add(text); setText(''); }
          else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
        }}
        onPaste={(e) => {
          const t = e.clipboardData.getData('text');
          if (/\r?\n/.test(t)) { e.preventDefault(); add(t); }
        }}
        onBlur={() => { if (text.trim()) { add(text); setText(''); } }}
        className="h-6 min-w-24 flex-1 bg-transparent px-1 outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

export function ScoreBadge({ score, className }: { score: number | null | undefined; className?: string }) {
  const tone = score == null ? 'none' : score >= 60 ? 'hi' : score >= 30 ? 'mid' : 'lo';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex h-5 min-w-8 items-center justify-center rounded-md px-1.5 text-xs font-semibold tabular-nums',
            tone === 'hi' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
            tone === 'mid' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
            tone === 'lo' && 'bg-muted text-muted-foreground',
            tone === 'none' && 'text-muted-foreground/60',
            className,
          )}
        >
          {score ?? '–'}
        </span>
      </TooltipTrigger>
      <TooltipContent>{score == null ? 'Not scanned yet' : 'Old-site score · higher = older site'}</TooltipContent>
    </Tooltip>
  );
}

export function scanText(s: Site) {
  switch (s.scanState) {
    case 'queued': return 'Queued';
    case 'scanning': return 'Scanning';
    case 'error': return 'Scan failed';
    case 'done': return 'No email';
    default: return 'Not scanned';
  }
}

export const safeHref = (u?: string | null) => (u && /^https?:\/\//i.test(u) ? u : undefined);
