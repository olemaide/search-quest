import * as React from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';

interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
}
type Request = ConfirmOptions & { resolve: (ok: boolean) => void };

let push: ((r: Request) => void) | null = null;

/** Imperative confirm backed by shadcn's AlertDialog (never the browser's blocking confirm()). */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (push) push({ ...opts, resolve });
    else resolve(false);
  });
}

export function ConfirmHost() {
  const [req, setReq] = React.useState<Request | null>(null);
  const settled = React.useRef(false);

  React.useEffect(() => {
    push = (r) => { settled.current = false; setReq(r); };
    return () => { push = null; };
  }, []);

  const finish = (ok: boolean) => {
    if (req && !settled.current) { settled.current = true; req.resolve(ok); }
    setReq(null);
  };

  return (
    <AlertDialog open={!!req} onOpenChange={(open) => { if (!open) finish(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{req?.title}</AlertDialogTitle>
          {req?.description ? <AlertDialogDescription>{req.description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={req?.destructive ? buttonVariants({ variant: 'destructive' }) : undefined}
            onClick={() => finish(true)}
          >
            {req?.confirmLabel || 'Continue'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
