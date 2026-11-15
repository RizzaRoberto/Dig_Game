// =====================================================================
//  LIVELLI
//  Ogni livello è un reperto. Per aggiungerne uno:
//   1. metti il tuo file .glb in  src/modelli/
//   2. aggiungi un blocco qui sotto con  modello: 'nomefile.glb'
//  Tutti i campi non scritti prendono il valore di LIVELLO_DEFAULT (src/config.js).
//
//  Campi disponibili:
//   id            identificativo unico (serve per salvare i progressi)
//   nome          nome mostrato nel gioco
//   descrizione   una riga mostrata nella scelta del livello
//   modello       file .glb in src/modelli/  (oppure  procedurale: 'ammonite' | 'trilobite' | 'crystal')
//   dimensione    lato più lungo del reperto in cm (consigliato 6–13)
//   orientamento  'casuale' oppure [gradiX, gradiY, gradiZ]
//   strati        { terra: voxel, sabbia: voxel }  spessore degli strati (1 voxel ≈ 5 mm)
//   vittoria      quanta parte del reperto va scoperta per vincere (0–1)
//   resistenza    moltiplicatore del danno (0.5 = più robusto, 2 = più fragile)
//   coloreDetriti colore delle schegge se il reperto si rompe
// =====================================================================
import { LIVELLO_DEFAULT } from './config.js';

const LIVELLI = [
  {
    id: 'ammonite',
    nome: 'Ammonite',
    descrizione: 'Un mollusco marino di 150 milioni di anni fa. Guscio robusto: ideale per iniziare.',
    modello: 'ammonite.glb',
    dimensione: 11,
    resistenza: 0.8,
  },

  // Esempio di livello con un tuo modello:
  // {
  //   id: 'dente-trex',
  //   nome: 'Dente di T-rex',
  //   descrizione: 'Fragile e appuntito: niente trapano vicino alla punta!',
  //   modello: 'dente.glb',
  //   dimensione: 9,
  //   orientamento: [0, 0, 90],
  //   strati: { terra: 5, sabbia: 2.5 },
  //   resistenza: 1.5,
  //   coloreDetriti: '#f2ead8',
  // },
];

export const LEVELS = LIVELLI.map(l => ({ ...LIVELLO_DEFAULT, ...l, strati: { ...LIVELLO_DEFAULT.strati, ...(l.strati || {}) } }));
