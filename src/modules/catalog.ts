import { chordsModule } from './chords';
import { fretboardModule } from './fretboard';
import { readModule } from './readFret';
import { rhythmModule } from './rhythm';
import { staffModule } from './staffReading';
import { stringsModule } from './strings';
import { tabsModule } from './tabs';
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
  { id: 'staff', badge: 'M2', name: staffModule.name, desc: 'Eine Zeile Noten im System benennen, auch übereinander.', def: staffModule },
  { id: 'read', badge: 'M3', name: readModule.name, desc: 'Note im System finden und auf dem Griffbrett antippen.', def: readModule },
  { id: 'fret', badge: 'M4', name: fretboardModule.name, desc: 'Töne benennen, auf einer Saite finden, alle Stellen finden.', def: fretboardModule },
  { id: 'chords', badge: 'M5', name: chordsModule.name, desc: 'Diagramme lesen, Griffe setzen, Akkordtöne nennen.', def: chordsModule },
  { id: 'tabs', badge: 'M6', name: tabsModule.name, desc: 'Tab-Zeichen, Bögen, Akkorde und Capo wie auf Ultimate Guitar.', def: tabsModule },
  { id: 'rhythm', badge: 'M7', name: rhythmModule.name, desc: 'Notenwerte unter dem Tab, zählen, Schlagmuster, Tempo.', def: rhythmModule },
];

export function findModule(id: string): ModuleInfo | undefined {
  return MODULES.find((m) => m.id === id);
}
