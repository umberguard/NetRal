// Parametri normativi — anno d'imposta 2026. SOLO DATI, nessuna logica.
// Ogni valore riporta riferimento di legge e fonte di verifica.
// Mappa completa norma → codice in docs/NORMATIVA.md; semplificazioni in docs/ASSUNZIONI.md.
// Verifiche effettuate il 19/08/2026.

import type { Scaglione } from "./tipi";

/**
 * Contributi previdenziali a carico del dipendente (IVS, settore privato).
 * Fonte: Circolare INPS n. 6 del 30/01/2026 (valori 2026).
 */
export const INPS = {
  /** 9,19% — aliquota IVS a carico del lavoratore, generalità dei dipendenti privati. */
  aliquotaIvs: 0.0919,
  /** +1% sulla quota eccedente la prima fascia pensionabile — art. 3-ter D.L. 384/1992. */
  aliquotaAggiuntiva: 0.01,
  /** Prima fascia di retribuzione pensionabile 2026. */
  primaFasciaPensionabile: 56_224,
  /**
   * Massimale annuo della base contributiva (iscritti a gestioni previdenziali
   * dal 1/1/1996). Qui applicato a tutti i lavoratori: vedi docs/ASSUNZIONI.md.
   */
  massimaleContributivo: 122_295,
} as const;

/**
 * Scaglioni IRPEF 2026 — art. 11 TUIR come modificato dalla L. 199/2025
 * art. 1 co. 3 (seconda aliquota dal 35% al 33% dal 1/1/2026).
 * Marginali: ogni aliquota si applica alla sola porzione di reddito nello scaglione.
 */
export const SCAGLIONI_IRPEF: readonly Scaglione[] = [
  { fino: 28_000, aliquota: 0.23 },
  { fino: 50_000, aliquota: 0.33 },
  { fino: null, aliquota: 0.43 },
];

/**
 * Detrazione per redditi di lavoro dipendente — art. 13 co. 1 TUIR.
 * Le formule vivono in calcolo.ts (fase 3); qui solo le costanti.
 *   R ≤ 15.000          → 1.955
 *   15.000 < R ≤ 28.000 → 1.910 + 1.190 × (28.000 − R) / 13.000
 *   28.000 < R ≤ 50.000 → 1.910 × (50.000 − R) / 22.000
 *   R > 50.000          → 0
 */
export const DETRAZIONE_LAVORO_DIPENDENTE = {
  /** Lett. a): importo fisso per imponibile ≤ 15.000. */
  importoFisso: 1_955,
  limiteFascia1: 15_000,
  /** Lett. b) e c): base fissa della detrazione. */
  importoBase: 1_910,
  /** Lett. b): quota variabile aggiuntiva sulla fascia 15.000–28.000. */
  quotaVariabile: 1_190,
  limiteFascia2: 28_000,
  /** Lett. c): la detrazione si azzera a 50.000. */
  limiteFascia3: 50_000,
  /**
   * Il rapporto delle formule va TRONCATO alla quarta cifra decimale, senza
   * arrotondamento, prima della moltiplicazione (prassi delle istruzioni
   * ministeriali ai modelli dichiarativi).
   */
  cifreTroncamentoRapporto: 4,
  /** Maggiorazione di 65 € se 25.000 < R ≤ 35.000 — art. 13 co. 1.1 TUIR. */
  maggiorazione: 65,
  maggiorazioneDa: 25_000,
  maggiorazioneA: 35_000,
} as const;

/**
 * Cuneo fiscale, misura 1: SOMMA ESENTE erogata in busta paga (non è una
 * detrazione, non concorre al reddito) — L. 207/2024 art. 1 co. 4 e 5,
 * resa strutturale dalla L. 199/2025.
 * A SCATTI, non progressiva: una sola percentuale, scelta in base alla fascia,
 * applicata all'INTERO imponibile ("applicando al reddito di lavoro dipendente
 * la percentuale corrispondente" — testo verificato su Normattiva il 19/08/2026).
 * Vedi docs/adr/0001-somma-esente-a-scatti.md.
 */
export const SOMMA_ESENTE_CUNEO = {
  fasce: [
    { fino: 8_500, percentuale: 0.071 },
    { fino: 15_000, percentuale: 0.053 },
    { fino: 20_000, percentuale: 0.048 },
  ],
} as const;

/**
 * Cuneo fiscale, misura 2: ULTERIORE DETRAZIONE (questa sì riduce l'IRPEF) —
 * L. 207/2024 art. 1 co. 6, resa strutturale dalla L. 199/2025.
 *   20.000 < R ≤ 32.000 → 1.000
 *   32.000 < R ≤ 40.000 → 1.000 × (40.000 − R) / 8.000
 *   R > 40.000          → 0
 */
export const ULTERIORE_DETRAZIONE_CUNEO = {
  importo: 1_000,
  redditoDa: 20_000,
  /** Fino a qui l'importo è pieno; oltre, décalage lineare fino a redditoA. */
  redditoPieno: 32_000,
  redditoA: 40_000,
} as const;

/**
 * Trattamento integrativo (ex "bonus Renzi") — D.L. 3/2020 art. 1.
 * Erogazione, non detrazione: si somma al netto.
 * APPROSSIMAZIONE dichiarata: riconosciuto solo per R ≤ 15.000 con capienza
 * (IRPEF lorda > detrazione art. 13); la casistica reale 15.000–28.000 è
 * esclusa — vedi docs/ASSUNZIONI.md.
 */
export const TRATTAMENTO_INTEGRATIVO = {
  importo: 1_200,
  limiteReddito: 15_000,
} as const;

/** Voci informative: mostrate in UI, NON incidono sul netto. */
export const INFORMATIVI = {
  /** TFR: retribuzione annua / 13,5 — art. 2120 c.c. */
  divisoreTfr: 13.5,
  /** Costo azienda ≈ RAL × 1,30 — stima grezza, dichiarata tale in UI. */
  moltiplicatoreCostoAzienda: 1.3,
} as const;
