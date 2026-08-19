// Motore di calcolo — funzioni pure: nessun I/O, nessun DOM, eseguibile in Node puro.
// Tutti i valori intermedi restano in piena precisione; l'arrotondamento al
// centesimo avviene una sola volta, sulle voci finali del Breakdown (fase 4).
//
// Fase 2: contributi previdenziali e imponibile fiscale.
// Fase 3: IRPEF lorda, detrazioni, incapienza, misure cuneo, trattamento integrativo.

import {
  DETRAZIONE_LAVORO_DIPENDENTE,
  INPS,
  SCAGLIONI_IRPEF,
  SOMMA_ESENTE_CUNEO,
  TRATTAMENTO_INTEGRATIVO,
  ULTERIORE_DETRAZIONE_CUNEO,
} from "./parametri-2026";
import type { ContributiInps, Irpef, ScaglioneApplicato } from "./tipi";

/**
 * Valida la RAL. Il dominio del motore è [0, +∞): RAL = 0 è un input legittimo
 * (netto zero), tutto il resto è un errore del chiamante — la pagina batch
 * intercetta l'eccezione e la trasforma nella colonna `note` (fase 7).
 */
export function validaRal(ral: number): void {
  if (typeof ral !== "number" || Number.isNaN(ral)) {
    throw new RangeError("RAL non numerica");
  }
  if (!Number.isFinite(ral)) {
    throw new RangeError("RAL non finita");
  }
  if (ral < 0) {
    throw new RangeError("RAL negativa");
  }
}

/**
 * Contributi previdenziali a carico dipendente — §5.1 del brief.
 *
 *   imponibile contributivo = min(RAL, massimale)          [Circ. INPS 6/2026]
 *   quota base              = imponibile × 9,19%           [Circ. INPS 6/2026]
 *   quota aggiuntiva        = max(0, imponibile − 56.224) × 1%
 *                                                          [art. 3-ter D.L. 384/1992]
 */
export function calcolaContributiInps(ral: number): ContributiInps {
  validaRal(ral);
  const imponibile = Math.min(ral, INPS.massimaleContributivo);
  const quotaBase = imponibile * INPS.aliquotaIvs;
  const quotaAggiuntiva1pct =
    Math.max(0, imponibile - INPS.primaFasciaPensionabile) *
    INPS.aliquotaAggiuntiva;
  return {
    imponibile,
    quotaBase,
    quotaAggiuntiva1pct,
    totale: quotaBase + quotaAggiuntiva1pct,
  };
}

/**
 * Imponibile fiscale = RAL − contributi: i contributi obbligatori sono
 * deducibili dal reddito (art. 10 TUIR). È la grandezza `R` su cui sono
 * definiti scaglioni IRPEF, detrazioni, cuneo e addizionali.
 * Nota: la deduzione NON è limitata dal massimale — si deduce il versato.
 */
export function calcolaImponibileFiscale(ral: number): number {
  return ral - calcolaContributiInps(ral).totale;
}

/**
 * Troncamento (NON arrotondamento) alla n-esima cifra decimale.
 * Richiesto dalla prassi ministeriale per il rapporto della detrazione art. 13:
 * 0,8280227… con 4 cifre diventa 0,8280 — mai 0,8281.
 */
export function tronca(valore: number, cifre: number): number {
  const fattore = 10 ** cifre;
  return Math.trunc(valore * fattore) / fattore;
}

/**
 * IRPEF lorda per scaglioni marginali — art. 11 TUIR mod. L. 199/2025.
 * Ogni aliquota si applica alla SOLA porzione di imponibile nel proprio
 * scaglione. `perScaglione` elenca gli scaglioni effettivamente incisi,
 * per il breakdown in UI.
 */
export function calcolaIrpefLorda(imponibile: number): {
  totale: number;
  perScaglione: ScaglioneApplicato[];
} {
  const perScaglione: ScaglioneApplicato[] = [];
  let totale = 0;
  let da = 0;
  for (const scaglione of SCAGLIONI_IRPEF) {
    const tetto = scaglione.fino ?? Number.POSITIVE_INFINITY;
    const porzione = Math.max(0, Math.min(imponibile, tetto) - da);
    if (porzione > 0) {
      const imposta = porzione * scaglione.aliquota;
      perScaglione.push({
        da,
        a: scaglione.fino,
        aliquota: scaglione.aliquota,
        imposta,
      });
      totale += imposta;
    }
    if (scaglione.fino === null || imponibile <= scaglione.fino) break;
    da = scaglione.fino;
  }
  return { totale, perScaglione };
}

/**
 * Detrazione per redditi di lavoro dipendente — art. 13 co. 1 TUIR.
 * Il rapporto delle fasce b) e c) è troncato alla 4ª cifra decimale PRIMA
 * della moltiplicazione. I denominatori (13.000 e 22.000) sono le ampiezze
 * delle fasce, quindi derivati dai limiti invece che ripetuti come costanti.
 */
export function calcolaDetrazioneLavoroDipendente(imponibile: number): number {
  const D = DETRAZIONE_LAVORO_DIPENDENTE;
  if (imponibile <= D.limiteFascia1) {
    return D.importoFisso;
  }
  if (imponibile <= D.limiteFascia2) {
    const rapporto = tronca(
      (D.limiteFascia2 - imponibile) / (D.limiteFascia2 - D.limiteFascia1),
      D.cifreTroncamentoRapporto,
    );
    return D.importoBase + D.quotaVariabile * rapporto;
  }
  if (imponibile <= D.limiteFascia3) {
    const rapporto = tronca(
      (D.limiteFascia3 - imponibile) / (D.limiteFascia3 - D.limiteFascia2),
      D.cifreTroncamentoRapporto,
    );
    return D.importoBase * rapporto;
  }
  return 0;
}

/** Maggiorazione di 65 € per 25.000 < R ≤ 35.000 — art. 13 co. 1.1 TUIR. */
export function calcolaMaggiorazione65(imponibile: number): number {
  const D = DETRAZIONE_LAVORO_DIPENDENTE;
  return imponibile > D.maggiorazioneDa && imponibile <= D.maggiorazioneA
    ? D.maggiorazione
    : 0;
}

/**
 * Cuneo, misura 2: ulteriore detrazione — L. 207/2024 art. 1 co. 6.
 * Piena (1.000 €) fino a 32.000, décalage lineare fino ad azzerarsi a 40.000.
 */
export function calcolaUlterioreDetrazioneCuneo(imponibile: number): number {
  const U = ULTERIORE_DETRAZIONE_CUNEO;
  if (imponibile <= U.redditoDa || imponibile > U.redditoA) {
    return 0;
  }
  if (imponibile <= U.redditoPieno) {
    return U.importo;
  }
  return (U.importo * (U.redditoA - imponibile)) / (U.redditoA - U.redditoPieno);
}

/**
 * Cuneo, misura 1: somma esente — L. 207/2024 art. 1 co. 4-5 (ADR 0001).
 * A SCATTI: una sola percentuale, scelta per fascia, sull'INTERO imponibile.
 * Non è una detrazione: il chiamante la SOMMA al netto.
 */
export function calcolaSommaEsenteCuneo(imponibile: number): number {
  for (const fascia of SOMMA_ESENTE_CUNEO.fasce) {
    if (imponibile <= fascia.fino) {
      return imponibile * fascia.percentuale;
    }
  }
  return 0;
}

/**
 * Trattamento integrativo — D.L. 3/2020, APPROSSIMATO (vedi ASSUNZIONI.md):
 * riconosciuto per intero se R ≤ 15.000 e c'è capienza (IRPEF lorda maggiore
 * della detrazione art. 13); zero altrimenti. Erogazione, non detrazione.
 */
export function calcolaTrattamentoIntegrativo(
  imponibile: number,
  irpefLorda: number,
  detrazioneArt13: number,
): number {
  const T = TRATTAMENTO_INTEGRATIVO;
  return imponibile <= T.limiteReddito && irpefLorda > detrazioneArt13
    ? T.importo
    : 0;
}

/**
 * Sezione IRPEF completa del Breakdown.
 * Vincolo di incapienza: netta = max(0, lorda − detrazioni) — le detrazioni
 * non generano mai credito. Il trattamento integrativo NON è sottratto qui:
 * viaggia come erogazione e si somma al netto (fase 4).
 */
export function calcolaIrpef(imponibile: number): Irpef {
  const { totale: lorda, perScaglione } = calcolaIrpefLorda(imponibile);
  const detrazioneLavoroDipendente =
    calcolaDetrazioneLavoroDipendente(imponibile);
  const maggiorazione65 = calcolaMaggiorazione65(imponibile);
  const ulterioreDetrazioneCuneo = calcolaUlterioreDetrazioneCuneo(imponibile);
  const trattamentoIntegrativo = calcolaTrattamentoIntegrativo(
    imponibile,
    lorda,
    detrazioneLavoroDipendente,
  );
  const netta = Math.max(
    0,
    lorda - detrazioneLavoroDipendente - maggiorazione65 - ulterioreDetrazioneCuneo,
  );
  return {
    lorda,
    perScaglione,
    detrazioneLavoroDipendente,
    maggiorazione65,
    ulterioreDetrazioneCuneo,
    trattamentoIntegrativo,
    netta,
  };
}
