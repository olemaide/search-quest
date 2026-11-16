import * as React from 'react';
import {
  BlocksIcon, BookmarkPlusIcon, GlobeIcon, LibraryIcon, MapIcon, PanelRightOpenIcon, SettingsIcon, ShieldAlertIcon, XIcon,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertAction, AlertTitle } from '@/components/ui/alert';
import { IconAction, Logo } from '@/components/common';
import { ThemeMenu } from '@/components/theme';
import { NavContext, initialView, type View } from '@/lib/nav';
import { saveCurrentTab } from '@/lib/ext';
import { useExtData } from '@/hooks/use-ext-data';
import { timeAgo } from '@ext/util.js';
import { BuilderView } from '@/views/builder';
import { QuestsView } from '@/views/quests';
import { SitesView } from '@/views/sites';
import { LibraryView } from '@/views/library';
import { SettingsView } from '@/views/settings';

const TABS: { id: View; label: string; icon: React.ElementType }[] = [
  { id: 'builder', label: 'Builder', icon: BlocksIcon },
  { id: 'quests', label: 'Quests', icon: MapIcon },
  { id: 'sites', label: 'Sites', icon: GlobeIcon },
  { id: 'library', label: 'Library', icon: LibraryIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

function CaptchaAlert() {
  const [info] = useExtData(
    () => chrome.storage.local.get(['lastCaptchaAt', 'captchaDismissed']) as Promise<{ lastCaptchaAt?: number; captchaDismissed?: number }>,
    (k) => k === 'lastCaptchaAt' || k === 'captchaDismissed',
  );
  const at = info?.lastCaptchaAt || 0;
  if (!at || Date.now() - at > 30 * 60 * 1000 || at <= (info?.captchaDismissed || 0)) return null;
  return (
    <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200">
      <ShieldAlertIcon />
      <AlertTitle>CAPTCHA {timeAgo(at)}: slow down</AlertTitle>
      <AlertAction>
        <IconAction label="Dismiss" icon={XIcon} size="icon-xs" onClick={() => chrome.storage.local.set({ captchaDismissed: Date.now() })} />
      </AlertAction>
    </Alert>
  );
}

const SHELL = 'mx-auto w-full max-w-6xl px-3 @3xl/main:px-6';

export default function App() {
  const isPanel = document.body.dataset.mode === 'panel';
  const [view, setView] = React.useState<View>(initialView);
  const [params, setParams] = React.useState<Record<string, string>>({});

  const go = React.useCallback((v: View, p: Record<string, string> = {}) => {
    setView(v);
    setParams(p);
    try { localStorage.setItem('sq.view', v); } catch { /* storage blocked */ }
    if (!isPanel) history.replaceState(null, '', '#' + v);
    window.scrollTo({ top: 0 });
  }, [isPanel]);

  const nav = React.useMemo(() => ({ view, params, isPanel, go }), [view, params, isPanel, go]);

  return (
    <NavContext.Provider value={nav}>
      <div className="@container/main min-h-svh bg-background text-foreground">
        <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className={`${SHELL} flex h-11 items-center gap-2`}>
            <Logo />
            <span className="font-heading text-sm font-semibold tracking-tight">SearchQuest</span>
            <div className="ml-auto flex items-center">
              <IconAction label="Save current tab (on Google: import all results)" icon={BookmarkPlusIcon} side="bottom" onClick={saveCurrentTab} />
              {isPanel ? (
                <IconAction label="Open in a tab" icon={PanelRightOpenIcon} side="bottom" onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('app/app.html#' + view) })} />
              ) : null}
              <ThemeMenu />
            </div>
          </div>
          <div className={`${SHELL} overflow-x-auto [scrollbar-width:none]`}>
            <Tabs value={view} onValueChange={(v) => go(v as View)}>
              <TabsList variant="line" className="-mx-2 h-9 gap-0">
                {TABS.map(({ id, label, icon: Icon }) => (
                  <TabsTrigger key={id} value={id} className="px-2 @md/main:px-3 dark:data-active:border-transparent! dark:data-active:bg-transparent!">
                    <Icon className="hidden @lg/main:block" />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </header>
        <main className={`${SHELL} flex flex-col gap-4 pt-4 pb-20 @3xl/main:pt-6`}>
          <CaptchaAlert />
          {view === 'builder' && <BuilderView />}
          {view === 'quests' && <QuestsView />}
          {view === 'sites' && <SitesView />}
          {view === 'library' && <LibraryView />}
          {view === 'settings' && <SettingsView />}
        </main>
      </div>
    </NavContext.Provider>
  );
}
