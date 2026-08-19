// Tipi condivisi del motore. Input e Breakdown completi arrivano in fase 4.

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
