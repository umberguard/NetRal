// Dal Breakdown alle righe della cascata mostrata in pagina (§8 del brief).
//
// Qui vive SOLO la derivazione: nessun JSX, nessuno stato. Ogni voce porta con
// sé la formula applicata CON I NUMERI GIÀ SOSTITUITI e il riferimento
// normativo (mappa completa in docs/NORMATIVA.md).
//
// Gli importi arrivano tutti dal Breakdown, già arrotondati al centesimo dal
// motore: qui non si ricalcola nulla che finisca in colonna. Le uniche
// chiamate al motore (`tronca`, `calcolaImpostaPerScaglioni`) servono a
// mostrare i passaggi intermedi — il rapporto dell'art. 13 prima e dopo il
// troncamento, le porzioni di imponibile incise dagli scaglioni regionali —
// mai a produrre il valore della riga.

import { calcolaImpostaPerScaglioni, tronca } from "../engine/calcolo";
import {
  DETRAZIONE_LAVORO_DIPENDENTE as DETRAZIONE,
  INFORMATIVI,
  INPS,
  SOMMA_ESENTE_CUNEO,
  TRATTAMENTO_INTEGRATIVO,
  ULTERIORE_DETRAZIONE_CUNEO as CUNEO,
} from "../engine/parametri-2026";
import { COMUNI, REGIONI, type SlugRegione } from "../engine/territorio";
import type { Breakdown, Input } from "../engine/tipi";
import { aliquota, euro, numero, percentuale2 } from "./formato";

/**
 * Una riga della cascata.
 * - `dettaglio`: sotto-riga di una voce (i singoli scaglioni IRPEF);
 * - `voce`: riga normale;
 * - `totale`: riga di somma (contributi, trattenute);
 * - `risultato`: netto annuo e netto mensile, le uniche in colore d'accento.
 */
export type Voce = {
  id: string;
  etichetta: string;
  importo: number;
  /**
   * Reso al posto di `euro(importo)` quando la voce non è un importo in euro
   * (il cuneo fiscale è una percentuale). Serve solo alla colonna di destra.
   */
  importoTestuale?: string;
  /** Verso in busta paga: "−" trattenuta, "+" erogazione, assente = base o risultato. */
  segno?: "−" | "+";
  formula: string;
  riferimento?: string;
  livello: "dettaglio" | "voce" | "totale" | "risultato";
};

/**
 * Formula dell'IRPEF lorda: la somma degli scaglioni incisi. Con un solo
 * scaglione la somma sarebbe la tautologia "1.670,90 € = 1.670,90 €", quindi
 * la riga dice invece dove cade l'imponibile.
 */
function formulaIrpefLorda(b: Breakdown, imponibile: number): string {
  const scaglioni = b.irpef.perScaglione;
  if (scaglioni.length === 0) {
    return `imponibile ${euro(imponibile)} → nessuna imposta`;
  }
  if (scaglioni.length === 1) {
    return `imponibile ${euro(imponibile)} tutto nel primo scaglione, al ${aliquota(scaglioni[0].aliquota)} → ${euro(b.irpef.lorda)}`;
  }
  return `${scaglioni.map((s) => euro(s.imposta)).join(" + ")} = ${euro(b.irpef.lorda)}`;
}

/** Formula della detrazione art. 13 co. 1 TUIR, ramo per ramo. */
function formulaDetrazioneArt13(imponibile: number, valore: number): string {
  if (imponibile <= DETRAZIONE.limiteFascia1) {
    return `imponibile ${euro(imponibile)} ≤ ${euro(DETRAZIONE.limiteFascia1)} → importo fisso ${euro(valore)}`;
  }
  if (imponibile > DETRAZIONE.limiteFascia3) {
    return `imponibile ${euro(imponibile)} > ${euro(DETRAZIONE.limiteFascia3)} → nessuna detrazione`;
  }
  // Rami b) e c): stessa meccanica, cambiano estremi e coefficienti.
  const [limite, ampiezza] =
    imponibile <= DETRAZIONE.limiteFascia2
      ? [
          DETRAZIONE.limiteFascia2,
          DETRAZIONE.limiteFascia2 - DETRAZIONE.limiteFascia1,
        ]
      : [
          DETRAZIONE.limiteFascia3,
          DETRAZIONE.limiteFascia3 - DETRAZIONE.limiteFascia2,
        ];
  const grezzo = (limite - imponibile) / ampiezza;
  const troncato = tronca(grezzo, DETRAZIONE.cifreTroncamentoRapporto);
  const rapporto =
    `(${euro(limite)} − ${euro(imponibile)}) / ${euro(ampiezza)} = ` +
    `${numero(grezzo, 6)}… → troncato alla 4ª cifra ${numero(troncato, 4)}`;
  return imponibile <= DETRAZIONE.limiteFascia2
    ? `${rapporto}; ${euro(DETRAZIONE.importoBase)} + ${euro(DETRAZIONE.quotaVariabile)} × ${numero(troncato, 4)} = ${euro(valore)}`
    : `${rapporto}; ${euro(DETRAZIONE.importoBase)} × ${numero(troncato, 4)} = ${euro(valore)}`;
}

/** Formula dell'ulteriore detrazione del cuneo — L. 207/2024 art. 1 co. 6. */
function formulaUlterioreDetrazione(
  imponibile: number,
  valore: number,
): string {
  if (imponibile <= CUNEO.redditoDa || imponibile > CUNEO.redditoA) {
    return `imponibile ${euro(imponibile)} fuori dall'intervallo ${euro(CUNEO.redditoDa)} – ${euro(CUNEO.redditoA)} → nulla spetta`;
  }
  if (imponibile <= CUNEO.redditoPieno) {
    return `${euro(CUNEO.redditoDa)} < ${euro(imponibile)} ≤ ${euro(CUNEO.redditoPieno)} → importo pieno ${euro(valore)}`;
  }
  return `${euro(CUNEO.importo)} × (${euro(CUNEO.redditoA)} − ${euro(imponibile)}) / ${euro(CUNEO.redditoA - CUNEO.redditoPieno)} = ${euro(valore)}`;
}

/** Formula della somma esente del cuneo — a scatti, ADR 0001. */
function formulaSommaEsente(imponibile: number, valore: number): string {
  const fascia = SOMMA_ESENTE_CUNEO.fasce.find((f) => imponibile <= f.fino);
  if (fascia === undefined) {
    const ultima = SOMMA_ESENTE_CUNEO.fasce[SOMMA_ESENTE_CUNEO.fasce.length - 1];
    return `imponibile ${euro(imponibile)} > ${euro(ultima.fino)} → nulla spetta`;
  }
  return `imponibile ${euro(imponibile)} ≤ ${euro(fascia.fino)}: la percentuale della fascia si applica all'intero imponibile → ${euro(imponibile)} × ${aliquota(fascia.percentuale)} = ${euro(valore)}`;
}

/** Formula del trattamento integrativo — D.L. 3/2020 art. 1, approssimato. */
function formulaTrattamentoIntegrativo(b: Breakdown): string {
  const imponibile = b.imponibileFiscale;
  const { lorda, detrazioneLavoroDipendente: detrazione } = b.irpef;
  if (imponibile > TRATTAMENTO_INTEGRATIVO.limiteReddito) {
    return `imponibile ${euro(imponibile)} > ${euro(TRATTAMENTO_INTEGRATIVO.limiteReddito)} → nulla spetta`;
  }
  if (lorda > detrazione) {
    return `imponibile ${euro(imponibile)} ≤ ${euro(TRATTAMENTO_INTEGRATIVO.limiteReddito)} e IRPEF lorda ${euro(lorda)} > detrazione ${euro(detrazione)} (capienza) → ${euro(TRATTAMENTO_INTEGRATIVO.importo)}`;
  }
  return `capienza assente: IRPEF lorda ${euro(lorda)} ≤ detrazione ${euro(detrazione)} → nulla spetta`;
}

/**
 * Formula dell'addizionale regionale: i prodotti scaglione per scaglione, con
 * le porzioni di imponibile effettivamente incise. I singoli prodotti non
 * vengono risolti — il totale mostrato è quello del Breakdown, arrotondato una
 * volta sola dal motore.
 */
function formulaRegionale(
  imponibile: number,
  regione: SlugRegione,
  totale: number,
): string {
  const { perScaglione } = calcolaImpostaPerScaglioni(
    imponibile,
    REGIONI[regione].scaglioni,
  );
  if (perScaglione.length === 0) {
    return `imponibile ${euro(imponibile)} → nulla è dovuto`;
  }
  const termini = perScaglione.map((s) => {
    const tetto = s.a === null ? imponibile : Math.min(imponibile, s.a);
    return `${euro(tetto - s.da)} × ${aliquota(s.aliquota)}`;
  });
  return `${termini.join(" + ")} = ${euro(totale)}`;
}

/** Formula dell'addizionale comunale, con la semantica di SOGLIA (non franchigia). */
function formulaComunale(
  imponibile: number,
  comune: Input["comune"],
  valore: number,
): string {
  const { comunale } = COMUNI[comune];
  if (comunale.sogliaEsenzione === null) {
    return `nessuna soglia di esenzione deliberata: ${euro(imponibile)} × ${aliquota(comunale.aliquota)} = ${euro(valore)}`;
  }
  if (imponibile <= comunale.sogliaEsenzione) {
    return `imponibile ${euro(imponibile)} ≤ soglia di esenzione ${euro(comunale.sogliaEsenzione)} → nulla è dovuto`;
  }
  return `imponibile ${euro(imponibile)} > soglia di esenzione ${euro(comunale.sogliaEsenzione)}: l'aliquota si applica all'INTERO imponibile → ${euro(imponibile)} × ${aliquota(comunale.aliquota)} = ${euro(valore)}`;
}

/**
 * La cascata completa, dalla RAL al netto mensile.
 * L'ordine delle righe è quello della pipeline del motore (§5 del brief) e
 * ogni riga di totale si legge come somma delle righe che la precedono.
 */
export function costruisciCascata(b: Breakdown, input: Input): Voce[] {
  const imponibile = b.imponibileFiscale;
  const contributi = b.contributiInps;
  const comune = COMUNI[input.comune];

  const baseContributiva =
    b.ral > INPS.massimaleContributivo
      ? `min(RAL ${euro(b.ral)}; massimale ${euro(INPS.massimaleContributivo)}) = ${euro(contributi.imponibile)}, poi `
      : "";

  const voci: Voce[] = [
    {
      id: "ral",
      etichetta: "RAL — Retribuzione Annua Lorda",
      importo: b.ral,
      formula: "punto di partenza del calcolo, valore inserito",
      livello: "voce",
    },
    {
      id: "inps-base",
      etichetta: "Contributi INPS — quota base",
      importo: contributi.quotaBase,
      segno: "−",
      formula: `${baseContributiva}${euro(contributi.imponibile)} × ${aliquota(INPS.aliquotaIvs)} = ${euro(contributi.quotaBase)}`,
      riferimento:
        "Aliquota IVS a carico dipendente e massimale — Circolare INPS n. 6 del 30/01/2026",
      livello: "dettaglio",
    },
    {
      id: "inps-1pct",
      etichetta: "Contributi INPS — aliquota aggiuntiva 1%",
      importo: contributi.quotaAggiuntiva1pct,
      segno: "−",
      formula: `max(0; ${euro(contributi.imponibile)} − ${euro(INPS.primaFasciaPensionabile)}) × ${aliquota(INPS.aliquotaAggiuntiva)} = ${euro(contributi.quotaAggiuntiva1pct)}`,
      riferimento:
        "Art. 3-ter D.L. 384/1992 · prima fascia pensionabile 2026: Circolare INPS n. 6/2026",
      livello: "dettaglio",
    },
    {
      id: "inps-totale",
      etichetta: "Totale contributi INPS",
      importo: contributi.totale,
      segno: "−",
      formula: `${euro(contributi.quotaBase)} + ${euro(contributi.quotaAggiuntiva1pct)} = ${euro(contributi.totale)}`,
      livello: "totale",
    },
    {
      id: "imponibile",
      etichetta: "Imponibile fiscale",
      importo: imponibile,
      formula: `RAL ${euro(b.ral)} − contributi ${euro(contributi.totale)} = ${euro(imponibile)}`,
      riferimento:
        "Art. 10 TUIR — i contributi obbligatori sono deducibili dal reddito",
      livello: "voce",
    },
  ];

  // IRPEF lorda: una sotto-riga per scaglione effettivamente inciso.
  for (const scaglione of b.irpef.perScaglione) {
    const tetto =
      scaglione.a === null ? imponibile : Math.min(imponibile, scaglione.a);
    voci.push({
      id: `irpef-scaglione-${scaglione.da}`,
      etichetta:
        scaglione.a === null
          ? `IRPEF — oltre ${euro(scaglione.da)}`
          : `IRPEF — da ${euro(scaglione.da)} a ${euro(scaglione.a)}`,
      importo: scaglione.imposta,
      segno: "−",
      formula: `${euro(tetto - scaglione.da)} × ${aliquota(scaglione.aliquota)} = ${euro(scaglione.imposta)}`,
      livello: "dettaglio",
    });
  }
  voci.push({
    id: "irpef-lorda",
    etichetta: "IRPEF lorda",
    importo: b.irpef.lorda,
    segno: "−",
    formula: formulaIrpefLorda(b, imponibile),
    riferimento:
      "Art. 11 TUIR mod. L. 199/2025 art. 1 co. 3 — scaglioni marginali 23% / 33% / 43%",
    livello: "totale",
  });

  voci.push(
    {
      id: "detrazione-art13",
      etichetta: "Detrazione lavoro dipendente",
      importo: b.irpef.detrazioneLavoroDipendente,
      segno: "+",
      formula: formulaDetrazioneArt13(
        imponibile,
        b.irpef.detrazioneLavoroDipendente,
      ),
      riferimento:
        "Art. 13 co. 1 TUIR — il rapporto è troncato alla 4ª cifra decimale, non arrotondato",
      livello: "dettaglio",
    },
    {
      id: "maggiorazione-65",
      etichetta: "Maggiorazione della detrazione",
      importo: b.irpef.maggiorazione65,
      segno: "+",
      formula:
        b.irpef.maggiorazione65 > 0
          ? `${euro(DETRAZIONE.maggiorazioneDa)} < ${euro(imponibile)} ≤ ${euro(DETRAZIONE.maggiorazioneA)} → ${euro(DETRAZIONE.maggiorazione)}`
          : `imponibile ${euro(imponibile)} fuori dall'intervallo ${euro(DETRAZIONE.maggiorazioneDa)} – ${euro(DETRAZIONE.maggiorazioneA)} → nulla spetta`,
      riferimento: "Art. 13 co. 1.1 TUIR",
      livello: "dettaglio",
    },
    {
      id: "ulteriore-detrazione",
      etichetta: "Ulteriore detrazione (cuneo)",
      importo: b.irpef.ulterioreDetrazioneCuneo,
      segno: "+",
      formula: formulaUlterioreDetrazione(
        imponibile,
        b.irpef.ulterioreDetrazioneCuneo,
      ),
      riferimento:
        "L. 207/2024 art. 1 co. 6, resa strutturale dalla L. 199/2025 — è una detrazione, riduce l'imposta",
      livello: "dettaglio",
    },
    {
      id: "irpef-netta",
      etichetta: "IRPEF netta",
      importo: b.irpef.netta,
      segno: "−",
      formula:
        `max(0; ${euro(b.irpef.lorda)} − ${euro(b.irpef.detrazioneLavoroDipendente)} − ${euro(b.irpef.maggiorazione65)} − ${euro(b.irpef.ulterioreDetrazioneCuneo)}) = ${euro(b.irpef.netta)}` +
        (b.irpef.netta === 0
          ? " — incapienza: l'eccedenza di detrazioni non genera credito"
          : ""),
      riferimento:
        "Vincolo di incapienza: le detrazioni non possono rendere l'imposta negativa",
      livello: "totale",
    },
    {
      id: "addizionale-regionale",
      etichetta: `Addizionale regionale ${REGIONI[comune.regione].nome}`,
      importo: b.addizionali.regionale,
      segno: "−",
      formula: formulaRegionale(
        imponibile,
        comune.regione,
        b.addizionali.regionale,
      ),
      riferimento: `Art. 50 D.Lgs. 446/1997 · aliquote ${REGIONI[comune.regione].nome} in territorio.ts — nessuna detrazione la riduce`,
      livello: "voce",
    },
    {
      id: "addizionale-comunale",
      etichetta: `Addizionale comunale ${comune.nome}`,
      importo: b.addizionali.comunale,
      segno: "−",
      formula: formulaComunale(imponibile, input.comune, b.addizionali.comunale),
      riferimento: `Art. 1 D.Lgs. 360/1998 · soglia: art. 1 co. 11 D.L. 138/2011 · delibera ${comune.comunale.delibera}`,
      livello: "voce",
    },
    {
      id: "totale-trattenute",
      etichetta: "Totale trattenute",
      importo: b.totaleTrattenute,
      segno: "−",
      formula: `contributi ${euro(contributi.totale)} + IRPEF netta ${euro(b.irpef.netta)} + addizionali ${euro(b.addizionali.totale)} = ${euro(b.totaleTrattenute)}`,
      livello: "totale",
    },
    {
      id: "somma-esente",
      etichetta: "Somma esente (cuneo)",
      importo: b.sommaEsenteCuneo,
      segno: "+",
      formula: formulaSommaEsente(imponibile, b.sommaEsenteCuneo),
      riferimento:
        "L. 207/2024 art. 1 co. 4-5, resa strutturale dalla L. 199/2025 (ADR 0001) — erogata in busta paga, non è una detrazione",
      livello: "voce",
    },
    {
      id: "trattamento-integrativo",
      etichetta: "Trattamento integrativo",
      importo: b.irpef.trattamentoIntegrativo,
      segno: "+",
      formula: formulaTrattamentoIntegrativo(b),
      riferimento:
        "D.L. 3/2020 art. 1 — erogazione, si somma al netto; approssimazione dichiarata in docs/ASSUNZIONI.md",
      livello: "voce",
    },
    {
      id: "netto-annuo",
      etichetta: "Netto annuo",
      importo: b.nettoAnnuo,
      formula: `RAL ${euro(b.ral)} − trattenute ${euro(b.totaleTrattenute)} + somma esente ${euro(b.sommaEsenteCuneo)} + trattamento integrativo ${euro(b.irpef.trattamentoIntegrativo)} = ${euro(b.nettoAnnuo)}`,
      livello: "risultato",
    },
    {
      id: "netto-mensile",
      etichetta: `Netto mensile (${input.mensilita} mensilità)`,
      importo: b.nettoMensile,
      formula: `${euro(b.nettoAnnuo)} / ${input.mensilita} = ${euro(b.nettoMensile)}`,
      riferimento:
        "13ª e 14ª trattate come semplice divisore del netto annuo — semplificazione in docs/ASSUNZIONI.md",
      livello: "risultato",
    },
  );

  return voci;
}

/**
 * Voci INFORMATIVE: non incidono sul netto (§8 del brief). Il cuneo fiscale è
 * un rapporto, non un importo, quindi la sua "colonna importo" resta vuota:
 * la percentuale sta nella formula.
 */
export function costruisciInformative(b: Breakdown): Voce[] {
  return [
    {
      id: "tfr",
      etichetta: "TFR accantonato",
      importo: b.tfrAccantonato,
      formula: `RAL ${euro(b.ral)} / ${numero(INFORMATIVI.divisoreTfr, 1)} = ${euro(b.tfrAccantonato)}`,
      riferimento:
        "Art. 2120 c.c. — accantonato dal datore, non trattenuto dal netto",
      livello: "voce",
    },
    {
      id: "costo-azienda",
      etichetta: "Costo azienda stimato",
      importo: b.costoAziendaStimato,
      formula: `RAL ${euro(b.ral)} × ${numero(INFORMATIVI.moltiplicatoreCostoAzienda, 2)} = ${euro(b.costoAziendaStimato)}`,
      riferimento:
        "Stima grezza, non un dato normativo: i contributi a carico azienda variano per CCNL e inquadramento",
      livello: "voce",
    },
    {
      id: "cuneo",
      etichetta: "Cuneo fiscale",
      importo: b.cuneoFiscalePct,
      importoTestuale: percentuale2(b.cuneoFiscalePct),
      formula: `trattenute ${euro(b.totaleTrattenute)} / RAL ${euro(b.ral)} = ${percentuale2(b.cuneoFiscalePct)}`,
      riferimento:
        "Quota della RAL trattenuta fra contributi, IRPEF e addizionali",
      livello: "voce",
    },
  ];
}
