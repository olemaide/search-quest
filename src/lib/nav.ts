import * as React from 'react';

export type View = 'builder' | 'quests' | 'sites' | 'library' | 'settings';
export const VIEWS: View[] = ['builder', 'quests', 'sites', 'library', 'settings'];

export interface Nav {
  view: View;
  params: Record<string, string>;
  isPanel: boolean;
  go: (view: View, params?: Record<string, string>) => void;
}

export const NavContext = React.createContext<Nav>({ view: 'builder', params: {}, isPanel: false, go: () => {} });
export const useNav = () => React.useContext(NavContext);

export function initialView(): View {
  const fromHash = location.hash.slice(1) as View;
  if (VIEWS.includes(fromHash)) return fromHash;
  try {
    const saved = localStorage.getItem('sq.view') as View;
    if (VIEWS.includes(saved)) return saved;
  } catch { /* storage blocked */ }
  return 'builder';
}
