// Motore di calcolo — funzioni pure: nessun I/O, nessun DOM, eseguibile in Node puro.
// Tutti i valori intermedi restano in piena precisione; l'arrotondamento al
// centesimo avviene una sola volta, sulle voci finali del Breakdown (fase 4).
//
// Fase 2: contributi previdenziali e imponibile fiscale.
// Fase 3: IRPEF lorda, detrazioni, incapienza, misure cuneo, trattamento integrativo.
// Fase 4: addizionali regionale/comunale e assemblaggio del Breakdown.

import {
  DETRAZIONE_LAVORO_DIPENDENTE,
  INFORMATIVI,
  INPS,
  SCAGLIONI_IRPEF,
  SOMMA_ESENTE_CUNEO,
  TRATTAMENTO_INTEGRATIVO,
  ULTERIORE_DETRAZIONE_CUNEO,
} from "./parametri-2026";
import { COMUNI, REGIONI, type SlugComune } from "./territorio";
import type {
  Addizionali,
  Breakdown,
  ContributiInps,
  Input,
  Irpef,
  Scaglione,
  ScaglioneApplicato,
} from "./tipi";

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
 * Arrotondamento al centesimo, mezzo centesimo per eccesso.
 *
 * Sposta la virgola sulla RAPPRESENTAZIONE DECIMALE del numero invece di
 * moltiplicare per 100 in binario: `317,835 * 100` in floating point vale
 * 31783,499999999996 e arrotonderebbe per DIFETTO a 317,83, mentre l'importo
 * dovuto (1% di 31.783,50 — l'addizionale comunale di Napoli del Caso B) è
 * 317,84. Fuori dall'intervallo in cui JS stampa i numeri in notazione
 * posizionale (|v| < 1e-6 o ≥ 1e21) la conversione non si applica: lì
 * l'errore di rappresentazione è irrilevante e basta la via diretta.
 */
export function arrotonda2(valore: number): number {
  const centesimi = Number(`${valore}e2`);
  const scalato = Number.isFinite(centesimi) ? centesimi : valore * 100;
  return Math.round(scalato) / 100;
}

/**
 * Imposta progressiva per scaglioni MARGINALI: ogni aliquota si applica alla
 * SOLA porzione di base che cade nel proprio scaglione. La meccanica è identica
 * per l'IRPEF nazionale (art. 11 TUIR) e per l'addizionale regionale, quindi
 * vive qui una volta sola. `perScaglione` elenca gli scaglioni effettivamente
 * incisi, per il breakdown in UI.
 */
export function calcolaImpostaPerScaglioni(
  base: number,
  scaglioni: readonly Scaglione[],
): { totale: number; perScaglione: ScaglioneApplicato[] } {
  const perScaglione: ScaglioneApplicato[] = [];
  let totale = 0;
  let da = 0;
  for (const scaglione of scaglioni) {
    const tetto = scaglione.fino ?? Number.POSITIVE_INFINITY;
    const porzione = Math.max(0, Math.min(base, tetto) - da);
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
    if (scaglione.fino === null || base <= scaglione.fino) break;
    da = scaglione.fino;
  }
  return { totale, perScaglione };
}

/** IRPEF lorda per scaglioni marginali — art. 11 TUIR mod. L. 199/2025 art. 1 co. 3. */
export function calcolaIrpefLorda(imponibile: number): {
  totale: number;
  perScaglione: ScaglioneApplicato[];
} {
  return calcolaImpostaPerScaglioni(imponibile, SCAGLIONI_IRPEF);
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

/**
 * Addizionali regionale e comunale — §5.5 del brief. Base: l'IMPONIBILE
 * FISCALE (non la RAL, non il netto); nessuna detrazione le riduce.
 *
 * - Regionale: progressiva per scaglioni marginali, come l'IRPEF nazionale
 *   (aliquote per regione in `territorio.ts`, con legge regionale citata).
 * - Comunale: aliquota unica. `sogliaEsenzione` è una SOGLIA, non una
 *   franchigia: imponibile ≤ soglia → nulla è dovuto; oltre la soglia
 *   l'aliquota morde l'INTERO imponibile, non la sola eccedenza. Da qui la
 *   discontinuità nel netto alla soglia (art. 1 co. 11 D.L. 138/2011, che
 *   consente ai comuni soglie di esenzione per fasce di reddito).
 */
export function calcolaAddizionali(
  imponibile: number,
  comune: SlugComune,
): Addizionali {
  const { regione, comunale: addComunale } = COMUNI[comune];
  const regionale = calcolaImpostaPerScaglioni(
    imponibile,
    REGIONI[regione].scaglioni,
  ).totale;
  const esente =
    addComunale.sogliaEsenzione !== null &&
    imponibile <= addComunale.sogliaEsenzione;
  const comunaleDovuta = esente ? 0 : imponibile * addComunale.aliquota;
  return {
    regionale,
    comunale: comunaleDovuta,
    totale: regionale + comunaleDovuta,
  };
}

/**
 * Funzione principale: RAL → Breakdown completo (§5.6 del brief).
 *
 *   totaleTrattenute = contributi + IRPEF netta + addizionali
 *   nettoAnnuo       = RAL − totaleTrattenute + somma esente + trattam. integrativo
 *   nettoMensile     = nettoAnnuo / mensilità
 *
 * PRECISIONE. Tutti i calcoli sopra girano in piena precisione; qui, come
 * ultimo passo, ogni voce viene arrotondata al centesimo — e ogni voce che è
 * un TOTALE viene ricomposta dalle voci già arrotondate, mai arrotondando il
 * totale in piena precisione. Così la cascata mostrata in UI torna riga per
 * riga (è il criterio della busta paga: si sommano importi, non decimali
 * infiniti). Lo scarto rispetto all'alternativa è di 1 centesimo sull'anno —
 * documentato in docs/ASSUNZIONI.md.
 */
export function calcolaNetto(input: Input): Breakdown {
  const { ral, comune, mensilita } = input;
  validaRal(ral);

  // 1) piena precisione
  const contributi = calcolaContributiInps(ral);
  // come calcolaImponibileFiscale (art. 10 TUIR), ma senza ricalcolare i contributi
  const imponibilePieno = ral - contributi.totale;
  const irpef = calcolaIrpef(imponibilePieno);
  const addizionali = calcolaAddizionali(imponibilePieno, comune);
  const sommaEsente = calcolaSommaEsenteCuneo(imponibilePieno);

  // 2) voci elementari al centesimo
  const ralArrotondata = arrotonda2(ral);
  const quotaBase = arrotonda2(contributi.quotaBase);
  const quotaAggiuntiva1pct = arrotonda2(contributi.quotaAggiuntiva1pct);
  const contributiInps: ContributiInps = {
    imponibile: arrotonda2(contributi.imponibile),
    quotaBase,
    quotaAggiuntiva1pct,
    totale: quotaBase + quotaAggiuntiva1pct,
  };

  const perScaglione = irpef.perScaglione.map((s) => ({
    ...s,
    imposta: arrotonda2(s.imposta),
  }));
  const detrazioneLavoroDipendente = arrotonda2(
    irpef.detrazioneLavoroDipendente,
  );
  const maggiorazione65 = arrotonda2(irpef.maggiorazione65);
  const ulterioreDetrazioneCuneo = arrotonda2(irpef.ulterioreDetrazioneCuneo);
  const lorda = perScaglione.reduce((somma, s) => somma + s.imposta, 0);
  const irpefArrotondata: Irpef = {
    lorda,
    perScaglione,
    detrazioneLavoroDipendente,
    maggiorazione65,
    ulterioreDetrazioneCuneo,
    trattamentoIntegrativo: arrotonda2(irpef.trattamentoIntegrativo),
    // vincolo di incapienza: le detrazioni non generano credito
    netta: Math.max(
      0,
      lorda -
        detrazioneLavoroDipendente -
        maggiorazione65 -
        ulterioreDetrazioneCuneo,
    ),
  };

  const regionale = arrotonda2(addizionali.regionale);
  const comunale = arrotonda2(addizionali.comunale);
  const addizionaliArrotondate: Addizionali = {
    regionale,
    comunale,
    totale: regionale + comunale,
  };
  const sommaEsenteCuneo = arrotonda2(sommaEsente);

  // 3) totali, ricomposti dalle voci arrotondate
  const totaleTrattenute =
    contributiInps.totale +
    irpefArrotondata.netta +
    addizionaliArrotondate.totale;
  const nettoAnnuo =
    ralArrotondata -
    totaleTrattenute +
    sommaEsenteCuneo +
    irpefArrotondata.trattamentoIntegrativo;

  return {
    ral: ralArrotondata,
    contributiInps,
    imponibileFiscale: arrotonda2(imponibilePieno),
    irpef: irpefArrotondata,
    addizionali: addizionaliArrotondate,
    sommaEsenteCuneo,
    nettoAnnuo,
    nettoMensile: arrotonda2(nettoAnnuo / mensilita),
    totaleTrattenute,
    // Frazione, non percentuale (0,2562 = 25,62%): arrotondata alla 4ª cifra,
    // cioè al centesimo di punto percentuale — l'equivalente del centesimo di
    // euro per un rapporto. RAL 0: nessuna trattenuta e denominatore nullo,
    // il cuneo vale 0 e non NaN.
    cuneoFiscalePct:
      ral === 0 ? 0 : Math.round((totaleTrattenute / ral) * 10_000) / 10_000,
    tfrAccantonato: arrotonda2(ral / INFORMATIVI.divisoreTfr),
    costoAziendaStimato: arrotonda2(
      ral * INFORMATIVI.moltiplicatoreCostoAzienda,
    ),
  };
}
