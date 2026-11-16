import * as React from 'react';
import { XIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Site } from '@/types';

export function Logo({ className }: { className?: string }) {
  return <img src="/icons/icon32.png" alt="" width={20} height={20} className={cn('size-5 rounded-[5px]', className)} />;
}

export function PageHeader({ title, description, actions }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h1 className="font-heading text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="max-w-prose text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Tag-style input in shadcn's input look: Enter adds, Backspace removes, multi-line paste adds many. */
export function ChipInput({
  value, onChange, placeholder, format = (s) => s, id, 'aria-invalid': invalid,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  format?: (s: string) => string;
  id?: string;
  'aria-invalid'?: boolean;
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
      aria-invalid={invalid}
      onClick={(e) => { if (e.target === e.currentTarget) inputRef.current?.focus(); }}
      className="flex min-h-9 w-full cursor-text flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-1.5 py-1 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30"
    >
      {value.map((v, i) => (
        <Badge key={v + i} variant="secondary" className="h-6 max-w-full gap-0.5 pr-0.5 font-normal">
          <span className="truncate" title={v}>{v}</span>
          <button
            type="button"
            aria-label={`Remove ${v}`}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="rounded-sm p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
          >
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
        className="h-6 min-w-32 flex-1 bg-transparent px-1 outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

export function ScoreBadge({ score }: { score: number | null | undefined }) {
  const badge = score == null
    ? <Badge variant="outline" className="tabular-nums text-muted-foreground">–</Badge>
    : (
      <Badge
        variant={score >= 60 ? 'default' : score >= 30 ? 'secondary' : 'outline'}
        className={cn('min-w-9 justify-center tabular-nums', score >= 60 && 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950')}
      >
        {score}
      </Badge>
    );
  return (
    <Tooltip>
      <TooltipTrigger asChild><span className="inline-flex">{badge}</span></TooltipTrigger>
      <TooltipContent>{score == null ? 'Not scanned yet' : 'Old-site score: higher = older-looking site'}</TooltipContent>
    </Tooltip>
  );
}

export function scanText(s: Site) {
  switch (s.scanState) {
    case 'queued': return 'Queued…';
    case 'scanning': return 'Scanning…';
    case 'error': return 'Scan failed';
    case 'done': return 'No email found';
    default: return 'Not scanned';
  }
}

export const safeHref = (u?: string | null) => (u && /^https?:\/\//i.test(u) ? u : undefined);
