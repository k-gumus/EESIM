// Arayüz durumu: görünümler, sekmeler, açık pencereler (modallar)
import { create } from 'zustand';
import type { CompType } from '../circuit/types';

export interface Views {
  three: boolean;
  scope: boolean;
  right: boolean;
}

export type RightTab = 'lab' | 'props' | 'ai';

interface UIState {
  views: Views;
  tab: RightTab;
  catalog: 'first' | 'menu' | null;
  catalogTopic: string | null;
  netlist: boolean;
  infoType: CompType | null;
  tour: 'first' | 'return' | null;
  setViews: (v: Partial<Views>) => void;
  setTab: (t: RightTab) => void;
  openCatalog: (mode?: 'first' | 'menu', topic?: string | null) => void;
  closeCatalog: () => void;
  setNetlist: (v: boolean) => void;
  showInfo: (t: CompType | null) => void;
  startTour: (t: 'first' | 'return' | null) => void;
}

function loadViews(): Views {
  const def = { three: false, scope: true, right: true };
  try {
    return { ...def, ...JSON.parse(localStorage.getItem('ieeesim.views') ?? '{}') };
  } catch {
    return def;
  }
}

export const useUI = create<UIState>((set, get) => ({
  views: loadViews(),
  tab: 'lab',
  catalog: null,
  catalogTopic: null,
  netlist: false,
  infoType: null,
  tour: null,
  setViews: (v) => {
    const views = { ...get().views, ...v };
    set({ views });
    try {
      localStorage.setItem('ieeesim.views', JSON.stringify(views));
    } catch {
      /* depolama yok */
    }
  },
  setTab: (tab) => set({ tab, views: get().views.right ? get().views : { ...get().views, right: true } }),
  openCatalog: (mode = 'menu', topic = null) => set({ catalog: mode, catalogTopic: topic }),
  closeCatalog: () => set({ catalog: null }),
  setNetlist: (netlist) => set({ netlist }),
  showInfo: (infoType) => set({ infoType }),
  startTour: (tour) => set({ tour }),
}));
