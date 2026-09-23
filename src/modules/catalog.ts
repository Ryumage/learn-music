import { stringsModule } from './strings';
import type { ModuleDef } from './types';

/** Module in der Reihenfolge des empfohlenen Lernwegs (PLAN.md, Kap. 2). */
export interface ModuleInfo {
  id: string;
  badge: string;
  name: string;
  desc: string;
  /** umgesetztes Modul; fehlt, solange es „bald“ kommt */
  def?: ModuleDef;
}

export const MODULES: readonly ModuleInfo[] = [
  { id: 'strings', badge: 'M1', name: stringsModule.name, desc: 'Namen, Nummern und Lage der Leersaiten.', def: stringsModule },
  { id: 'staff', badge: 'M2', name: 'Noten lesen', desc: 'Eine Zeile Noten im System benennen, auch übereinander.' },
  { id: 'read', badge: 'M3', name: 'Noten → Griffbrett', desc: 'Note im System finden und auf dem Griffbrett antippen.' },
  { id: 'fret', badge: 'M4', name: 'Griffbrett', desc: 'Töne benennen, auf einer Saite finden, alle Stellen finden.' },
  { id: 'chords', badge: 'M5', name: 'Akkorde', desc: 'Diagramme lesen, Griffe setzen, Akkordtöne nennen.' },
  { id: 'tabs', badge: 'M6', name: 'Tabs lesen', desc: 'Tab-Zeichen, Bögen, Akkorde und Capo wie auf Ultimate Guitar.' },
  { id: 'rhythm', badge: 'M7', name: 'Rhythmus', desc: 'Notenwerte unter dem Tab, zählen, Schlagmuster, Tempo.' },
];

export function findModule(id: string): ModuleInfo | undefined {
  return MODULES.find((m) => m.id === id);
}
