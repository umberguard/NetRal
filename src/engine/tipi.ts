// Tipi condivisi del motore.
// Nota sul ciclo tipi.ts ↔ territorio.ts: territorio.ts importa `Scaglione` da
// qui, qui si importa `SlugComune` da lì. Sono import di SOLI tipi, cancellati
// alla compilazione: a runtime nessuno dei due moduli dipende dall'altro.

import type { SlugComune } from "./territorio";

/**
 * Scaglione di un'imposta progressiva marginale: `aliquota` si applica alla
 * sola porzione di base imponibile fino a `fino` (null = ultimo scaglione,
 * nessun limite superiore).
 */
export type Scaglione = {
  fino: number | null;
  /** Frazione, non percentuale: 0.23 = 23%. */
  aliquota: number;
};

/**
 * Contributi previdenziali a carico dipendente (§5.1 del brief).
 * `imponibile` è l'imponibile CONTRIBUTIVO (RAL, con tetto al massimale) —
 * da non confondere con l'imponibile fiscale, che è RAL − totale.
 */
export type ContributiInps = {
  imponibile: number;
  quotaBase: number;
  quotaAggiuntiva1pct: number;
  totale: number;
};

/** Uno scaglione IRPEF applicato: l'imposta sulla porzione di imponibile [da, a]. */
export type ScaglioneApplicato = {
  da: number;
  a: number | null;
  aliquota: number;
  imposta: number;
};

/**
 * Sezione IRPEF del Breakdown (§4 del brief).
 * `netta` = max(0, lorda − le tre detrazioni): vincolo di incapienza.
 * `trattamentoIntegrativo` NON entra in `netta`: è un'erogazione che si somma
 * al netto (come la somma esente) — sta qui solo per essere mostrata in UI.
 */
export type Irpef = {
  lorda: number;
  perScaglione: ScaglioneApplicato[];
  detrazioneLavoroDipendente: number;
  maggiorazione65: number;
  ulterioreDetrazioneCuneo: number;
  trattamentoIntegrativo: number;
  netta: number;
};

/**
 * Addizionali all'IRPEF, entrambe sull'imponibile fiscale (§5.5 del brief).
 * Nessuna detrazione le riduce: la regionale è progressiva per scaglioni
 * marginali, la comunale è ad aliquota unica con soglia di esenzione.
 */
export type Addizionali = {
  regionale: number;
  comunale: number;
  totale: number;
};

/** Input del motore (§4 del brief). Il comune è uno slug della matrice territoriale. */
export type Input = {
  ral: number;
  comune: SlugComune;
  mensilita: 12 | 13 | 14;
};

/**
 * Risultato completo del calcolo (§4 del brief): ogni voce è già arrotondata
 * al centesimo e ogni totale è la somma delle voci arrotondate, così la
 * cascata mostrata in UI torna esattamente riga per riga.
 */
export type Breakdown = {
  ral: number;
  contributiInps: ContributiInps;
  imponibileFiscale: number;
  irpef: Irpef;
  addizionali: Addizionali;
  /** Cuneo misura 1: EROGATA in busta paga, non trattenuta — si somma al netto. */
  sommaEsenteCuneo: number;
  nettoAnnuo: number;
  nettoMensile: number;
  totaleTrattenute: number;
  /** Frazione, non percentuale: trattenute / RAL (0,2562 = 25,62%). */
  cuneoFiscalePct: number;
  /** Informativo: accantonato dal datore, NON sottratto dal netto. */
  tfrAccantonato: number;
  /** Informativo: stima grezza del costo del lavoro per l'azienda. */
  costoAziendaStimato: number;
};
