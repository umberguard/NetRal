import { describe, expect, it } from "vitest";
import {
  arrotonda2,
  calcolaAddizionali,
  calcolaContributiInps,
  calcolaDetrazioneLavoroDipendente,
  calcolaImponibileFiscale,
  calcolaIrpef,
  calcolaIrpefLorda,
  calcolaMaggiorazione65,
  calcolaNetto,
  calcolaSommaEsenteCuneo,
  calcolaTrattamentoIntegrativo,
  calcolaUlterioreDetrazioneCuneo,
  tronca,
  validaRal,
} from "./calcolo";
import { INPS } from "./parametri-2026";
import { COMUNI, type SlugComune } from "./territorio";

// Fase 2: contributi e imponibile fiscale.
// Fase 3: IRPEF lorda, detrazioni, incapienza, misure cuneo.
// Fase 4: addizionali e Breakdown completo (Casi A/B interi).
// Fase 5: bordi obbligatori del brief §7 e proprietà di monotonia (in fondo).
// I valori attesi dei Casi A/B vengono dal brief (§7), ricontrollati a mano.
// R = 31.783,50 è l'imponibile fiscale dei Casi A e B (RAL 35.000).
const R_CASO_AB = 31_783.5;

describe("contributi INPS", () => {
  it("Caso A/B — RAL 35.000: 9,19% pieno, nessuna quota aggiuntiva", () => {
    const c = calcolaContributiInps(35_000);
    expect(c.imponibile).toBe(35_000);
    expect(c.quotaBase).toBeCloseTo(3_216.5, 2);
    expect(c.quotaAggiuntiva1pct).toBe(0);
    expect(c.totale).toBeCloseTo(3_216.5, 2);
  });

  it("bordo prima fascia — RAL 56.224: quota aggiuntiva ancora zero", () => {
    expect(calcolaContributiInps(56_224).quotaAggiuntiva1pct).toBe(0);
  });

  it("bordo prima fascia — RAL 56.225: 1% sul solo euro eccedente", () => {
    expect(calcolaContributiInps(56_225).quotaAggiuntiva1pct).toBeCloseTo(
      0.01,
      4,
    );
  });

  it("bordo massimale — RAL 122.295: contributi pieni sull'intera base", () => {
    const c = calcolaContributiInps(122_295);
    expect(c.imponibile).toBe(122_295);
    expect(c.quotaBase).toBeCloseTo(11_238.9105, 4);
    expect(c.quotaAggiuntiva1pct).toBeCloseTo(660.71, 2);
    expect(c.totale).toBeCloseTo(11_899.6205, 4);
  });

  it("oltre il massimale — RAL 200.000: contributi identici a 122.295", () => {
    expect(calcolaContributiInps(200_000)).toEqual(
      calcolaContributiInps(122_295),
    );
  });

  it("RAL 0: tutto zero, nessun errore", () => {
    expect(calcolaContributiInps(0)).toEqual({
      imponibile: 0,
      quotaBase: 0,
      quotaAggiuntiva1pct: 0,
      totale: 0,
    });
  });
});

describe("imponibile fiscale", () => {
  it("Caso A/B — RAL 35.000 → 31.783,50 (contributi deducibili ex art. 10 TUIR)", () => {
    expect(calcolaImponibileFiscale(35_000)).toBeCloseTo(31_783.5, 2);
  });

  it("oltre il massimale la deduzione resta quella versata: RAL 200.000 → 188.100,38", () => {
    expect(calcolaImponibileFiscale(200_000)).toBeCloseTo(188_100.3795, 4);
  });
});

describe("IRPEF lorda per scaglioni", () => {
  it("Caso A/B — R 31.783,50: 6.440 + 33% sulla porzione oltre 28.000", () => {
    const { totale, perScaglione } = calcolaIrpefLorda(R_CASO_AB);
    expect(totale).toBeCloseTo(7_688.555, 3);
    expect(perScaglione).toHaveLength(2);
    expect(perScaglione[0]).toEqual({
      da: 0,
      a: 28_000,
      aliquota: 0.23,
      imposta: 6_440,
    });
    expect(perScaglione[1]!.imposta).toBeCloseTo(1_248.555, 3);
  });

  it("bordo 28.000/28.001: il 33% morde solo l'euro eccedente", () => {
    expect(calcolaIrpefLorda(28_000).totale).toBeCloseTo(6_440, 2);
    expect(calcolaIrpefLorda(28_000).perScaglione).toHaveLength(1);
    expect(calcolaIrpefLorda(28_001).totale).toBeCloseTo(6_440.33, 2);
  });

  it("bordo 50.000/50.001: il 43% morde solo l'euro eccedente", () => {
    expect(calcolaIrpefLorda(50_000).totale).toBeCloseTo(13_700, 2);
    expect(calcolaIrpefLorda(50_001).totale).toBeCloseTo(13_700.43, 2);
  });

  it("imponibile 0: nessuna imposta, nessuno scaglione", () => {
    expect(calcolaIrpefLorda(0)).toEqual({ totale: 0, perScaglione: [] });
  });
});

describe("detrazione lavoro dipendente (art. 13) e troncamento", () => {
  it("Caso A/B — rapporto 0,8280227… troncato a 0,8280 → 1.581,48", () => {
    expect(calcolaDetrazioneLavoroDipendente(R_CASO_AB)).toBeCloseTo(
      1_581.48,
      2,
    );
  });

  it("troncamento ≠ arrotondamento — R 20.000: 0,6153 (non 0,6154) → 2.642,207", () => {
    // (28.000 − 20.000) / 13.000 = 0,61538…: arrotondando verrebbe 0,6154
    // e la detrazione 2.642,326. Il troncamento è il comportamento normativo.
    expect(calcolaDetrazioneLavoroDipendente(20_000)).toBeCloseTo(2_642.207, 3);
    expect(calcolaDetrazioneLavoroDipendente(20_000)).not.toBeCloseTo(
      2_642.326,
      3,
    );
  });

  it("troncamento anche in fascia c — R 30.000: 0,9090 (non 0,9091) → 1.736,19", () => {
    expect(calcolaDetrazioneLavoroDipendente(30_000)).toBeCloseTo(1_736.19, 2);
  });

  it("bordi di fascia: 15.000 → 1.955; 15.001 → 3.099,881 (salto reale della norma)", () => {
    expect(calcolaDetrazioneLavoroDipendente(15_000)).toBe(1_955);
    expect(calcolaDetrazioneLavoroDipendente(15_001)).toBeCloseTo(3_099.881, 3);
  });

  it("bordi di fascia: 28.000 → 1.910; 50.000 e oltre → 0", () => {
    expect(calcolaDetrazioneLavoroDipendente(28_000)).toBeCloseTo(1_910, 2);
    expect(calcolaDetrazioneLavoroDipendente(50_000)).toBe(0);
    expect(calcolaDetrazioneLavoroDipendente(50_001)).toBe(0);
  });

  it("tronca: helper generico", () => {
    expect(tronca(0.82802272, 4)).toBe(0.828);
    expect(tronca(0.61538461, 4)).toBe(0.6153);
    expect(tronca(0.99999999, 4)).toBe(0.9999);
  });
});

describe("maggiorazione 65 € (art. 13 co. 1.1)", () => {
  it("bordi: esclusa a 25.000, inclusa da 25.001 a 35.000, esclusa a 35.001", () => {
    expect(calcolaMaggiorazione65(25_000)).toBe(0);
    expect(calcolaMaggiorazione65(25_001)).toBe(65);
    expect(calcolaMaggiorazione65(35_000)).toBe(65);
    expect(calcolaMaggiorazione65(35_001)).toBe(0);
  });
});

describe("ulteriore detrazione cuneo (L. 207/2024 co. 6)", () => {
  it("bordi: 0 a 20.000, piena da 20.001 a 32.000, décalage, 0 a 40.000", () => {
    expect(calcolaUlterioreDetrazioneCuneo(20_000)).toBe(0);
    expect(calcolaUlterioreDetrazioneCuneo(20_001)).toBe(1_000);
    expect(calcolaUlterioreDetrazioneCuneo(32_000)).toBe(1_000);
    expect(calcolaUlterioreDetrazioneCuneo(36_000)).toBeCloseTo(500, 2);
    expect(calcolaUlterioreDetrazioneCuneo(40_000)).toBe(0);
    expect(calcolaUlterioreDetrazioneCuneo(40_001)).toBe(0);
  });
});

describe("somma esente cuneo (L. 207/2024 co. 4-5, a scatti — ADR 0001)", () => {
  it("la percentuale si applica all'INTERO imponibile, non per scaglioni", () => {
    expect(calcolaSommaEsenteCuneo(8_500)).toBeCloseTo(603.5, 2); // 7,1% × 8.500
    expect(calcolaSommaEsenteCuneo(15_000)).toBeCloseTo(795, 2); // 5,3% × 15.000
    expect(calcolaSommaEsenteCuneo(20_000)).toBeCloseTo(960, 2); // 4,8% × 20.000
  });

  it("gli scatti creano discontinuità: 8.501 e 15.001 valgono MENO di 8.500 e 15.000", () => {
    expect(calcolaSommaEsenteCuneo(8_501)).toBeCloseTo(450.553, 3); // 5,3% × 8.501
    expect(calcolaSommaEsenteCuneo(15_001)).toBeCloseTo(720.048, 3); // 4,8% × 15.001
  });

  it("sopra 20.000: zero (subentra l'ulteriore detrazione)", () => {
    expect(calcolaSommaEsenteCuneo(20_001)).toBe(0);
  });
});

describe("trattamento integrativo (approssimato — ASSUNZIONI.md)", () => {
  it("R ≤ 15.000 con capienza: 1.200", () => {
    const lorda = calcolaIrpefLorda(14_000).totale; // 3.220 > 1.955
    expect(calcolaTrattamentoIntegrativo(14_000, lorda, 1_955)).toBe(1_200);
  });

  it("incapiente (lorda ≤ detrazione): zero anche sotto 15.000", () => {
    const lorda = calcolaIrpefLorda(3_000).totale; // 690 < 1.955
    expect(calcolaTrattamentoIntegrativo(3_000, lorda, 1_955)).toBe(0);
  });

  it("sopra 15.000: zero (approssimazione dichiarata)", () => {
    const lorda = calcolaIrpefLorda(15_001).totale;
    expect(calcolaTrattamentoIntegrativo(15_001, lorda, 3_099.881)).toBe(0);
  });
});

describe("IRPEF netta e incapienza", () => {
  it("Caso A/B — netta 5.042,075 (lorda − 1.581,48 − 65 − 1.000)", () => {
    const irpef = calcolaIrpef(R_CASO_AB);
    expect(irpef.lorda).toBeCloseTo(7_688.555, 3);
    expect(irpef.detrazioneLavoroDipendente).toBeCloseTo(1_581.48, 2);
    expect(irpef.maggiorazione65).toBe(65);
    expect(irpef.ulterioreDetrazioneCuneo).toBe(1_000);
    expect(irpef.trattamentoIntegrativo).toBe(0);
    expect(irpef.netta).toBeCloseTo(5_042.075, 3);
  });

  it("VINCOLO DI INCAPIENZA — R 3.000: lorda 690 < detrazione 1.955 → netta 0, mai negativa", () => {
    const irpef = calcolaIrpef(3_000);
    expect(irpef.lorda).toBeCloseTo(690, 2);
    expect(irpef.detrazioneLavoroDipendente).toBe(1_955);
    expect(irpef.netta).toBe(0);
  });

  it("il trattamento integrativo NON riduce la netta (è un'erogazione)", () => {
    const irpef = calcolaIrpef(14_000);
    expect(irpef.trattamentoIntegrativo).toBe(1_200);
    // netta = max(0, 3.220 − 1.955) = 1.265: il TI non compare nella sottrazione
    expect(irpef.netta).toBeCloseTo(1_265, 2);
  });
});

describe("arrotondamento al centesimo", () => {
  it("mezzo centesimo per eccesso, anche quando il binario dice il contrario", () => {
    // 317,835 × 100 in floating point vale 31783,499999999996: senza il
    // passaggio per la rappresentazione decimale verrebbe 317,83.
    expect(arrotonda2(317.835)).toBe(317.84);
    expect(arrotonda2(1.005)).toBe(1.01);
    expect(arrotonda2(2.675)).toBe(2.68);
  });

  it("non tocca i valori già al centesimo e lascia 0 a 0", () => {
    expect(arrotonda2(254.27)).toBe(254.27);
    expect(arrotonda2(0)).toBe(0);
  });

  it("arrotonda per difetto sotto il mezzo centesimo", () => {
    expect(arrotonda2(454.9762)).toBe(454.98);
    expect(arrotonda2(317.834)).toBe(317.83);
  });
});

describe("addizionale regionale (scaglioni marginali)", () => {
  it("Caso A — Lombardia su R 31.783,50: 184,50 + 205,40 + 65,08 = 454,98", () => {
    expect(calcolaAddizionali(R_CASO_AB, "milano").regionale).toBeCloseTo(
      454.976,
      3,
    );
  });

  it("Caso B — Campania su R 31.783,50: 259,50 + 384,80 + 121,07 = 765,37", () => {
    expect(calcolaAddizionali(R_CASO_AB, "napoli").regionale).toBeCloseTo(
      765.372,
      3,
    );
  });

  it("è MARGINALE: a 15.001 solo l'euro eccedente sconta la seconda aliquota", () => {
    // Campania: 15.000 × 1,73% = 259,50; +1 € × 2,96% = 0,0296
    expect(calcolaAddizionali(15_000, "napoli").regionale).toBeCloseTo(259.5, 4);
    expect(calcolaAddizionali(15_001, "napoli").regionale).toBeCloseTo(
      259.5296,
      4,
    );
  });

  it("comuni della stessa regione condividono gli scaglioni regionali", () => {
    expect(calcolaAddizionali(31_783.5, "salerno").regionale).toBe(
      calcolaAddizionali(31_783.5, "benevento").regionale,
    );
  });

  it("imponibile 0: nessuna addizionale", () => {
    expect(calcolaAddizionali(0, "napoli")).toEqual({
      regionale: 0,
      comunale: 0,
      totale: 0,
    });
  });
});

describe("addizionale comunale (soglia di esenzione, non franchigia)", () => {
  it("Caso A — Milano 0,8% su 31.783,50 = 254,27 (soglia 23.000 superata)", () => {
    expect(calcolaAddizionali(R_CASO_AB, "milano").comunale).toBeCloseTo(
      254.268,
      3,
    );
  });

  it("Caso B — Napoli 1% su 31.783,50 = 317,84 (soglia 12.000 superata)", () => {
    expect(calcolaAddizionali(R_CASO_AB, "napoli").comunale).toBeCloseTo(
      317.835,
      3,
    );
  });

  it("sotto e ALLA soglia: zero (Napoli, 12.000)", () => {
    expect(calcolaAddizionali(11_999.99, "napoli").comunale).toBe(0);
    expect(calcolaAddizionali(12_000, "napoli").comunale).toBe(0);
  });

  it("appena sopra la soglia: l'aliquota morde l'INTERO imponibile, non l'eccedenza", () => {
    // 12.000,01 × 1% = 120,0001. Se fosse una franchigia sarebbe 0,0001.
    expect(calcolaAddizionali(12_000.01, "napoli").comunale).toBeCloseTo(
      120.0001,
      4,
    );
  });

  it("Salerno esenta fino a 10.000 (dato MEF, delibera n. 54 del 22/12/2025)", () => {
    expect(calcolaAddizionali(10_000, "salerno").comunale).toBe(0);
    expect(calcolaAddizionali(10_000.01, "salerno").comunale).toBeCloseTo(
      110.0001,
      4,
    );
  });

  it("senza soglia si paga da subito (Caserta, 0,8%)", () => {
    expect(calcolaAddizionali(1_000, "caserta").comunale).toBeCloseTo(8, 4);
  });

  it("totale = regionale + comunale", () => {
    const a = calcolaAddizionali(R_CASO_AB, "milano");
    expect(a.totale).toBeCloseTo(a.regionale + a.comunale, 6);
  });
});

describe("Breakdown completo — Caso A (RAL 35.000, Milano, 13 mensilità)", () => {
  const b = calcolaNetto({ ral: 35_000, comune: "milano", mensilita: 13 });

  it("le voci del brief §7, una per una", () => {
    expect(b.contributiInps.totale).toBeCloseTo(3_216.5, 2);
    expect(b.imponibileFiscale).toBeCloseTo(31_783.5, 2);
    expect(b.irpef.lorda).toBeCloseTo(7_688.56, 2);
    expect(b.irpef.detrazioneLavoroDipendente).toBeCloseTo(1_581.48, 2);
    expect(b.irpef.maggiorazione65).toBe(65);
    expect(b.irpef.ulterioreDetrazioneCuneo).toBe(1_000);
    expect(b.irpef.netta).toBeCloseTo(5_042.08, 2);
    expect(b.addizionali.regionale).toBeCloseTo(454.98, 2);
    expect(b.addizionali.comunale).toBeCloseTo(254.27, 2);
  });

  it("netto annuo 26.032,17 e mensile 2.002,47", () => {
    expect(b.nettoAnnuo).toBeCloseTo(26_032.17, 2);
    expect(b.nettoMensile).toBeCloseTo(2_002.47, 2);
  });

  it("nessuna erogazione: sopra 20.000 niente somma esente né trattamento integrativo", () => {
    expect(b.sommaEsenteCuneo).toBe(0);
    expect(b.irpef.trattamentoIntegrativo).toBe(0);
  });

  it("voci informative: TFR e costo azienda non incidono sul netto", () => {
    expect(b.tfrAccantonato).toBeCloseTo(2_592.59, 2); // 35.000 / 13,5
    expect(b.costoAziendaStimato).toBeCloseTo(45_500, 2); // 35.000 × 1,30
    expect(b.cuneoFiscalePct).toBeCloseTo(0.2562, 4); // 8.967,83 / 35.000
  });
});

describe("Breakdown completo — Caso B (RAL 35.000, Napoli, 13 mensilità)", () => {
  const b = calcolaNetto({ ral: 35_000, comune: "napoli", mensilita: 13 });

  it("cambiano solo le addizionali rispetto al Caso A", () => {
    expect(b.addizionali.regionale).toBeCloseTo(765.37, 2);
    expect(b.addizionali.comunale).toBeCloseTo(317.84, 2);
    expect(b.irpef.netta).toBeCloseTo(5_042.08, 2);
  });

  it("netto annuo 25.658,21 e mensile 1.973,71", () => {
    expect(b.nettoAnnuo).toBeCloseTo(25_658.21, 2);
    expect(b.nettoMensile).toBeCloseTo(1_973.71, 2);
  });
});

describe("assemblaggio del Breakdown", () => {
  it("la cascata torna al centesimo: RAL − trattenute + erogazioni = netto", () => {
    for (const ral of [0, 9_000, 16_000, 22_000, 35_000, 60_000, 200_000]) {
      const b = calcolaNetto({ ral, comune: "salerno", mensilita: 12 });
      expect(
        b.ral -
          b.totaleTrattenute +
          b.sommaEsenteCuneo +
          b.irpef.trattamentoIntegrativo,
      ).toBeCloseTo(b.nettoAnnuo, 2);
      expect(
        b.contributiInps.totale + b.irpef.netta + b.addizionali.totale,
      ).toBeCloseTo(b.totaleTrattenute, 2);
    }
  });

  it("le mensilità dividono il netto annuo, non lo cambiano", () => {
    const dodici = calcolaNetto({ ral: 35_000, comune: "milano", mensilita: 12 });
    const quattordici = calcolaNetto({
      ral: 35_000,
      comune: "milano",
      mensilita: 14,
    });
    expect(dodici.nettoAnnuo).toBe(quattordici.nettoAnnuo);
    expect(dodici.nettoMensile).toBeCloseTo(dodici.nettoAnnuo / 12, 2);
    expect(quattordici.nettoMensile).toBeCloseTo(
      quattordici.nettoAnnuo / 14,
      2,
    );
  });

  it("le erogazioni si SOMMANO al netto: R ≤ 15.000 porta somma esente e TI", () => {
    // RAL 14.000 → imponibile 12.713,40: somma esente 5,3%, TI incapiente
    const b = calcolaNetto({ ral: 14_000, comune: "caserta", mensilita: 12 });
    expect(b.sommaEsenteCuneo).toBeGreaterThan(0);
    expect(b.nettoAnnuo).toBeGreaterThan(b.ral - b.totaleTrattenute);
  });

  it("RAL 0: tutto zero, nessun NaN sul cuneo", () => {
    const b = calcolaNetto({ ral: 0, comune: "napoli", mensilita: 13 });
    expect(b.nettoAnnuo).toBe(0);
    expect(b.nettoMensile).toBe(0);
    expect(b.totaleTrattenute).toBe(0);
    expect(b.cuneoFiscalePct).toBe(0);
  });

  it("RAL invalida: RangeError, come per le funzioni di fase 2", () => {
    expect(() =>
      calcolaNetto({ ral: -1, comune: "napoli", mensilita: 13 }),
    ).toThrow(RangeError);
    expect(() =>
      calcolaNetto({ ral: Number.NaN, comune: "napoli", mensilita: 13 }),
    ).toThrow(RangeError);
  });
});

describe("validazione input", () => {
  it("RAL negativa: errore", () => {
    expect(() => calcolaContributiInps(-1)).toThrow(RangeError);
  });

  it("RAL non numerica (NaN): errore", () => {
    expect(() => calcolaContributiInps(Number.NaN)).toThrow(RangeError);
  });

  it("RAL non finita (Infinity): errore", () => {
    expect(() => calcolaContributiInps(Number.POSITIVE_INFINITY)).toThrow(
      RangeError,
    );
  });

  it("validaRal non lancia su 0 e su valori positivi", () => {
    expect(() => validaRal(0)).not.toThrow();
    expect(() => validaRal(35_000)).not.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// FASE 5 — bordi obbligatori (brief §7) e test di proprietà (monotonia).
//
// I test sopra sono ai bordi delle SINGOLE funzioni e lavorano sull'imponibile
// fiscale, che è la grandezza su cui la norma definisce ogni soglia. Qui sotto
// i bordi sono attraversati dal MOTORE INTERO, muovendo la RAL — l'unica cosa
// che l'utente controlla — per vedere se e quanto la discontinuità sopravvive
// fino al netto in busta paga. Le due cose non coincidono: a 8.500 di
// imponibile la somma esente cala di 153 €, ma il netto SALE di 1.047 €.
// ═════════════════════════════════════════════════════════════════════════════

/** Tutti i comuni della matrice: aggiungerne uno lo mette sotto test da solo. */
const TUTTI_I_COMUNI = Object.keys(COMUNI) as SlugComune[];

/**
 * RAL che produce esattamente `imponibile` di imponibile fiscale.
 * Sotto la prima fascia pensionabile i contributi sono una percentuale piatta
 * della RAL, quindi imponibile = RAL × (1 − 9,19%) e l'inversa è esatta.
 * Ricavata dal parametro invece che scritta a mano: se l'aliquota IVS cambia,
 * i bordi si spostano da soli. La soglia fiscale più alta del brief (50.000 di
 * imponibile → 55.060 di RAL) sta sotto la prima fascia; la guardia protegge
 * da un uso futuro fuori da quell'ipotesi.
 */
function ralPerImponibile(imponibile: number): number {
  const ral = imponibile / (1 - INPS.aliquotaIvs);
  if (ral > INPS.primaFasciaPensionabile) {
    throw new Error(
      "oltre la prima fascia i contributi non sono più proporzionali: l'inversa non vale",
    );
  }
  return ral;
}

/** Un centesimo di RAL: il passo con cui ci si affaccia ai due lati di un bordo. */
const SCOSTAMENTO = 0.01;

/**
 * Tolleranza dei confronti di monotonia. Ogni voce del Breakdown è arrotondata
 * al centesimo e i totali sommano voci arrotondate (fase 4): il netto può
 * oscillare di un centesimo in su o in giù rispetto alla curva "liscia". Un
 * centesimo (più un margine) NON è una discontinuità e non entra in whitelist.
 * Vedi docs/ASSUNZIONI.md.
 */
const EPSILON_ARROTONDAMENTO = 0.011;

/**
 * Netto annuo appena sotto e appena sopra una soglia di IMPONIBILE.
 * La RAL esatta della soglia non viene mai campionata: `soglia / 0,9081`
 * rimoltiplicato per 0,9081 in floating point ricade indifferentemente un ε
 * sopra o sotto la soglia, e il ramo scelto sarebbe una lotteria. Un centesimo
 * di RAL basta a stare da una parte sola e vale ~0,005 € di netto: due ordini
 * di grandezza sotto i salti che stiamo misurando.
 */
function nettiAttornoA(imponibile: number, comune: SlugComune) {
  const ral = ralPerImponibile(imponibile);
  const sotto = calcolaNetto({
    ral: ral - SCOSTAMENTO,
    comune,
    mensilita: 12,
  }).nettoAnnuo;
  const sopra = calcolaNetto({
    ral: ral + SCOSTAMENTO,
    comune,
    mensilita: 12,
  }).nettoAnnuo;
  return { sotto, sopra, salto: sopra - sotto };
}

describe("bordi §7 — cuneo: gli scatti della somma esente (8.500 e 15.000)", () => {
  it("8.500: la percentuale cambia da 7,1% a 5,3% e vale sull'INTERO imponibile", () => {
    // già verificato a livello di funzione sopra; qui la causa del salto:
    // 8.500 × (7,1% − 5,3%) = 153 € di somma esente in meno.
    expect(
      calcolaSommaEsenteCuneo(8_500) - calcolaSommaEsenteCuneo(8_500.01),
    ).toBeCloseTo(153, 1);
  });

  it("8.500: la capienza del trattamento integrativo scatta ESATTAMENTE lì (1.955 / 23% = 8.500)", () => {
    // Coincidenza numerica, non progetto del legislatore: la detrazione fissa
    // sotto i 15.000 (1.955) è pari al 23% di 8.500, quindi l'IRPEF lorda
    // supera la detrazione — condizione di capienza — proprio a questa soglia.
    expect(calcolaIrpefLorda(8_500).totale).toBeCloseTo(1_955, 2);
    expect(calcolaDetrazioneLavoroDipendente(8_500)).toBe(1_955);
    expect(calcolaTrattamentoIntegrativo(8_500, 1_955, 1_955)).toBe(0);
    expect(
      calcolaTrattamentoIntegrativo(
        8_500.01,
        calcolaIrpefLorda(8_500.01).totale,
        1_955,
      ),
    ).toBe(1_200);
  });

  it("8.500: sul NETTO non c'è alcun calo — i 1.200 € di TI coprono i 153 € persi", () => {
    // La stima di fase 4 dava 8.500 come discontinuità: sul netto non lo è.
    // −153 (somma esente) + 1.200 (trattamento integrativo) = +1.047.
    for (const comune of TUTTI_I_COMUNI) {
      expect(nettiAttornoA(8_500, comune).salto).toBeCloseTo(1_047, 1);
    }
  });

  it("15.000: tre effetti nello stesso punto, e il netto CALA di 130 €", () => {
    const { salto } = nettiAttornoA(15_000, "napoli");
    // +1.144,88 detrazione art. 13 (1.955 → 3.099,88: rami discontinui della
    // norma) − 1.200 trattamento integrativo (cliff) − 75,00 somma esente
    // (5,3% → 4,8% su 15.000) = −130,12.
    expect(salto).toBeCloseTo(-130.12, 1);
    expect(calcolaDetrazioneLavoroDipendente(15_001)).toBeGreaterThan(
      calcolaDetrazioneLavoroDipendente(15_000),
    );
    expect(calcolaTrattamentoIntegrativo(15_001, 10_000, 3_099.881)).toBe(0);
  });
});

describe("bordi §7 — soglie di esenzione dell'addizionale comunale", () => {
  // Soglia, non franchigia: superata di un centesimo, l'aliquota morde
  // l'intero imponibile. Il salto vale aliquota × soglia.
  it("Napoli 12.000: −120 € (1% × 12.000)", () => {
    expect(nettiAttornoA(12_000, "napoli").salto).toBeCloseTo(-120, 1);
  });

  it("Salerno 10.000: −110 € (1,1% × 10.000) — dato MEF, non quello del brief", () => {
    // Il brief §6 dava Salerno "nessuna esenzione"; il CSV MEF 2026 (delibera
    // n. 54 del 22/12/2025) dice esenzione fino a 10.000. Vale il MEF.
    expect(nettiAttornoA(10_000, "salerno").salto).toBeCloseTo(-110, 1);
  });

  it("Avellino 20.000: −160 €, cioè −200 di comunale sommati al +40 del cuneo", () => {
    // La soglia di Avellino cade esattamente dove finisce la somma esente e
    // inizia l'ulteriore detrazione (+40, vedi test sotto): i due effetti si
    // sommano e il calo netto è 200 − 40.
    expect(nettiAttornoA(20_000, "avellino").salto).toBeCloseTo(-160, 1);
  });

  it("Milano 23.000: −184 € (0,8% × 23.000)", () => {
    expect(nettiAttornoA(23_000, "milano").salto).toBeCloseTo(-184, 1);
  });

  it("la soglia di un comune è invisibile agli altri", () => {
    const altrove: [number, SlugComune][] = [
      [12_000, "milano"],
      [10_000, "napoli"],
      [23_000, "salerno"],
    ];
    for (const [soglia, comune] of altrove) {
      expect(nettiAttornoA(soglia, comune).salto).toBeGreaterThan(
        -EPSILON_ARROTONDAMENTO,
      );
    }
  });

  it("Caserta e Benevento non hanno soglia: nessuna discontinuità comunale", () => {
    for (const comune of ["caserta", "benevento"] as const) {
      for (const soglia of [10_000, 12_000, 23_000]) {
        expect(nettiAttornoA(soglia, comune).salto).toBeGreaterThan(
          -EPSILON_ARROTONDAMENTO,
        );
      }
      // pagano dal primo euro di imponibile
      expect(calcolaAddizionali(1, comune).comunale).toBeCloseTo(0.008, 6);
    }
  });
});

describe("bordi §7 — cuneo: 20.000 / 20.001, dalla somma esente all'ulteriore detrazione", () => {
  it("a 20.000 si perdono 960 € di somma esente e se ne guadagnano 1.000 di detrazione", () => {
    expect(calcolaSommaEsenteCuneo(20_000)).toBeCloseTo(960, 2);
    expect(calcolaSommaEsenteCuneo(20_001)).toBe(0);
    expect(calcolaUlterioreDetrazioneCuneo(20_000)).toBe(0);
    expect(calcolaUlterioreDetrazioneCuneo(20_001)).toBe(1_000);
  });

  it("sul netto il saldo è +40 €: è un salto, ma verso l'alto (nessuna violazione)", () => {
    // Vale solo dove non si somma una soglia comunale: Avellino ha la sua a
    // 20.000 e finisce sotto zero (test sopra).
    for (const comune of ["napoli", "milano", "caserta"] as const) {
      expect(nettiAttornoA(20_000, comune).salto).toBeCloseTo(40, 1);
    }
  });
});

describe("bordi §7 — maggiorazione 65 € (art. 13 co. 1.1): 25.000 e 35.000", () => {
  it("25.000: la maggiorazione entra e il netto sale di 65 €", () => {
    expect(nettiAttornoA(25_000, "napoli").salto).toBeCloseTo(65, 1);
  });

  it("35.000: la maggiorazione esce e il netto CALA di 65 € — discontinuità reale", () => {
    // La norma dà i 65 € solo per 25.000 < R ≤ 35.000: superato il limite si
    // perdono per intero, non in décalage. È una discontinuità che la stima
    // di fase 4 non aveva censito (vedi whitelist sotto).
    for (const comune of TUTTI_I_COMUNI) {
      expect(nettiAttornoA(35_000, comune).salto).toBeCloseTo(-65, 1);
    }
  });
});

describe("bordi §7 — IRPEF: 28.000 / 28.001 e 50.000 / 50.001", () => {
  it("28.000: la seconda aliquota morde solo l'eccedenza, ma la detrazione cambia RAMO", () => {
    // Lettera b) a 28.000: 1.910 + 1.190 × 0 = 1.910.
    // Lettera c) appena sopra: 1.910 × trunc(0,9999995; 4) = 1.910 × 0,9999.
    // Il troncamento alla quarta cifra fa perdere 0,19 € di detrazione di
    // colpo: micro-discontinuità della norma, documentata in ASSUNZIONI.md.
    expect(calcolaDetrazioneLavoroDipendente(28_000)).toBeCloseTo(1_910, 2);
    expect(calcolaDetrazioneLavoroDipendente(28_000.01)).toBeCloseTo(
      1_909.809,
      3,
    );
    expect(nettiAttornoA(28_000, "napoli").salto).toBeCloseTo(-0.191, 1);
  });

  it("50.000: terza aliquota e detrazione art. 13 già a zero — nessun salto", () => {
    // 1.910 × (50.000 − 50.000) / 22.000 = 0: la lettera c) si spegne con
    // continuità, quindi qui cambia solo la pendenza.
    expect(calcolaDetrazioneLavoroDipendente(50_000)).toBe(0);
    for (const comune of TUTTI_I_COMUNI) {
      expect(nettiAttornoA(50_000, comune).salto).toBeGreaterThan(
        -EPSILON_ARROTONDAMENTO,
      );
    }
  });
});

describe("bordi §7 — ulteriore detrazione cuneo: 32.000 e 40.000", () => {
  it("32.000: inizia il décalage, il netto non salta (la detrazione è continua)", () => {
    expect(calcolaUlterioreDetrazioneCuneo(32_000)).toBe(1_000);
    expect(calcolaUlterioreDetrazioneCuneo(32_001)).toBeCloseTo(999.875, 3);
    expect(nettiAttornoA(32_000, "napoli").salto).toBeGreaterThan(
      -EPSILON_ARROTONDAMENTO,
    );
  });

  it("40.000: il décalage arriva a zero da solo, nessun gradino residuo", () => {
    expect(calcolaUlterioreDetrazioneCuneo(39_999)).toBeCloseTo(0.125, 3);
    expect(calcolaUlterioreDetrazioneCuneo(40_000)).toBe(0);
    expect(nettiAttornoA(40_000, "napoli").salto).toBeGreaterThan(
      -EPSILON_ARROTONDAMENTO,
    );
  });
});

describe("bordi §7 — contributi: prima fascia 56.224 e massimale 122.295", () => {
  it("56.224: l'1% aggiuntivo parte solo sopra la fascia, il netto non salta", () => {
    const alBordo = calcolaNetto({
      ral: INPS.primaFasciaPensionabile,
      comune: "milano",
      mensilita: 12,
    });
    const sopra = calcolaNetto({
      ral: INPS.primaFasciaPensionabile + 100,
      comune: "milano",
      mensilita: 12,
    });
    expect(alBordo.contributiInps.quotaAggiuntiva1pct).toBe(0);
    expect(sopra.contributiInps.quotaAggiuntiva1pct).toBeCloseTo(1, 2);
    expect(sopra.nettoAnnuo).toBeGreaterThan(alBordo.nettoAnnuo);
  });

  it("122.295: oltre il massimale i contributi si congelano e il netto cresce PIÙ in fretta", () => {
    const passo = 100;
    const netto = (ral: number) =>
      calcolaNetto({ ral, comune: "milano", mensilita: 12 }).nettoAnnuo;
    const massimale = INPS.massimaleContributivo;
    const pendenzaSotto = netto(massimale) - netto(massimale - passo);
    const pendenzaSopra = netto(massimale + passo) - netto(massimale);
    // sotto: il 9,19% + 1% erode la RAL prima delle imposte; sopra, no.
    expect(pendenzaSopra).toBeGreaterThan(pendenzaSotto);
    expect(
      calcolaNetto({ ral: 200_000, comune: "milano", mensilita: 12 })
        .contributiInps.totale,
    ).toBeCloseTo(11_899.62, 2);
  });
});

describe("bordi §7 — RAL 0 e input non validi, dal motore intero", () => {
  it("RAL 0 su tutti i comuni: netto 0, nessuna addizionale, nessun NaN", () => {
    for (const comune of TUTTI_I_COMUNI) {
      const b = calcolaNetto({ ral: 0, comune, mensilita: 14 });
      expect(b.nettoAnnuo).toBe(0);
      expect(b.nettoMensile).toBe(0);
      expect(b.addizionali.totale).toBe(0);
      expect(b.cuneoFiscalePct).toBe(0);
    }
  });

  it("RAL non numerica passata a runtime (stringa): RangeError", () => {
    // TypeScript non la vede — la pagina batch legge un CSV, dove tutto è testo.
    expect(() =>
      calcolaNetto({
        ral: "35000" as unknown as number,
        comune: "napoli",
        mensilita: 13,
      }),
    ).toThrow(RangeError);
  });

  it("RAL Infinity e negativa dal motore intero: RangeError", () => {
    expect(() =>
      calcolaNetto({
        ral: Number.POSITIVE_INFINITY,
        comune: "napoli",
        mensilita: 13,
      }),
    ).toThrow(RangeError);
    expect(() =>
      calcolaNetto({ ral: -0.01, comune: "napoli", mensilita: 13 }),
    ).toThrow(RangeError);
  });
});

// ─── Test di proprietà: monotonia del netto rispetto alla RAL ───────────────

type Discontinuita = {
  /** Soglia sull'IMPONIBILE fiscale: la RAL corrispondente la dà ralPerImponibile. */
  imponibile: number;
  /** "tutti" = discontinuità nazionale; altrimenti i soli comuni che la vedono. */
  comuni: "tutti" | readonly SlugComune[];
  /** Salto atteso del netto annuo in €, ricavato dalla norma, non misurato dal motore. */
  salto: number;
  causa: string;
};

/**
 * Whitelist COMPLETA delle discontinuità note (decisione Q8a). Ogni voce dice
 * quanto vale il salto e perché esiste: una violazione di monotonia fuori da
 * questa lista è un bug del motore, non un caso da aggiungere qui.
 *
 * Rispetto alla stima di fase 4: 8.500 NON è una discontinuità
 * del netto (il trattamento integrativo entra proprio lì e la ribalta a
 * +1.047), mentre 28.000 e 35.000 mancavano.
 */
const DISCONTINUITA_ATTESE: readonly Discontinuita[] = [
  {
    imponibile: 15_000,
    comuni: "tutti",
    salto: -130.12,
    causa:
      "tre effetti insieme: +1.144,88 di detrazione art. 13 (rami discontinui), −1.200 di trattamento integrativo, −75 di somma esente (5,3% → 4,8%)",
  },
  {
    imponibile: 28_000,
    comuni: "tutti",
    salto: -0.191,
    causa:
      "cambio di ramo dell'art. 13 (lett. b → lett. c) con rapporto troncato alla 4ª cifra: 1.910 × 0,9999 invece di 1.910",
  },
  {
    imponibile: 35_000,
    comuni: "tutti",
    salto: -65,
    causa:
      "fine della maggiorazione art. 13 co. 1.1, che si perde per intero e non in décalage",
  },
  {
    imponibile: 10_000,
    comuni: ["salerno"],
    salto: -110,
    causa: "soglia di esenzione comunale di Salerno (1,1% sull'intero imponibile)",
  },
  {
    imponibile: 12_000,
    comuni: ["napoli"],
    salto: -120,
    causa: "soglia di esenzione comunale di Napoli (1% sull'intero imponibile)",
  },
  {
    imponibile: 20_000,
    comuni: ["avellino"],
    salto: -160,
    causa:
      "soglia di esenzione comunale di Avellino (−200), sommata al +40 del passaggio somma esente → ulteriore detrazione",
  },
  {
    imponibile: 23_000,
    comuni: ["milano"],
    salto: -184,
    causa: "soglia di esenzione comunale di Milano (0,8% sull'intero imponibile)",
  },
];

const riguarda = (d: Discontinuita, comune: SlugComune) =>
  d.comuni === "tutti" || d.comuni.includes(comune);

/**
 * Bordi del §7 che NON producono un salto verso il basso, ma che la scansione
 * deve comunque attraversare a passo fitto: è lì che una regressione avrebbe
 * più probabilità di creare un gradino nuovo.
 */
const BORDI_CONTINUI_IMPONIBILE = [
  8_500, 10_000, 12_000, 20_000, 23_000, 25_000, 32_000, 40_000, 50_000,
];

/** Bordi definiti sulla RAL e non sull'imponibile: i due gradini dei contributi. */
const BORDI_RAL = [INPS.primaFasciaPensionabile, INPS.massimaleContributivo];

const RAL_MASSIMA = 200_000;
/** Passo della scansione grossolana: a 25 € il netto cresce di 12–24 €, quindi
 *  un gradino di quell'ordine non riesce a nascondersi dentro un passo. */
const PASSO_SCANSIONE = 25;
/** Semiampiezza (in €) della finestra a passo 1 € attorno a ogni bordo noto. */
const FINESTRA_BORDO = 30;

/** Tutti i bordi rilevanti per un comune, espressi in RAL. */
function bordiRal(comune: SlugComune): number[] {
  return [
    ...DISCONTINUITA_ATTESE.filter((d) => riguarda(d, comune)).map((d) =>
      ralPerImponibile(d.imponibile),
    ),
    ...BORDI_CONTINUI_IMPONIBILE.map(ralPerImponibile),
    ...BORDI_RAL,
  ];
}

/**
 * Griglia di campionamento: passo grosso su tutto il dominio 0–200.000 più una
 * finestra fitta attorno a ogni bordo, con i due punti a ±1 centesimo che
 * isolano il salto in una coppia sola. Densa dove serve, larga dove non serve:
 * la suite deve restare di qualche centinaio di millisecondi.
 */
function grigliaRal(comune: SlugComune): number[] {
  const punti = new Set<number>();
  for (let ral = 0; ral <= RAL_MASSIMA; ral += PASSO_SCANSIONE) punti.add(ral);
  for (const bordo of bordiRal(comune)) {
    punti.add(bordo - SCOSTAMENTO);
    punti.add(bordo + SCOSTAMENTO);
    for (let d = 1; d <= FINESTRA_BORDO; d += 1) {
      punti.add(bordo - d);
      punti.add(bordo + d);
    }
  }
  return [...punti].filter((ral) => ral >= 0).sort((a, b) => a - b);
}

describe("proprietà — monotonia del netto rispetto alla RAL (brief §7)", () => {
  it("su 0–200.000, per ogni comune, il netto non cala mai fuori dalla whitelist", () => {
    const violazioni: string[] = [];
    for (const comune of TUTTI_I_COMUNI) {
      const soglie = DISCONTINUITA_ATTESE.filter((d) =>
        riguarda(d, comune),
      ).map((d) => ralPerImponibile(d.imponibile));
      const punti = grigliaRal(comune);
      let precedente = calcolaNetto({
        ral: punti[0]!,
        comune,
        mensilita: 12,
      }).nettoAnnuo;
      for (let i = 1; i < punti.length; i += 1) {
        const netto = calcolaNetto({
          ral: punti[i]!,
          comune,
          mensilita: 12,
        }).nettoAnnuo;
        const salto = netto - precedente;
        // la coppia "spiega" il calo solo se una soglia nota cade dentro
        const attraversaSoglia = soglie.some(
          (s) => s > punti[i - 1]! && s <= punti[i]!,
        );
        if (salto < -EPSILON_ARROTONDAMENTO && !attraversaSoglia) {
          violazioni.push(
            `${comune}: RAL ${punti[i - 1]} → ${punti[i]}, netto ${precedente} → ${netto} (${salto.toFixed(2)} €)`,
          );
        }
        precedente = netto;
      }
    }
    // Se questa lista non è vuota è un BUG del motore, non un caso da
    // aggiungere alla whitelist: il messaggio dice comune, RAL e ampiezza.
    expect(violazioni).toEqual([]);
  });

  for (const d of DISCONTINUITA_ATTESE) {
    const comuni = d.comuni === "tutti" ? TUTTI_I_COMUNI : d.comuni;
    it(`la discontinuità a imponibile ${d.imponibile} c'è e vale ${d.salto} € — ${d.causa}`, () => {
      for (const comune of comuni) {
        // ±0,02 € di scarto: è la crescita fisiologica del netto sui due
        // centesimi di RAL che separano i due campioni.
        expect(nettiAttornoA(d.imponibile, comune).salto).toBeCloseTo(
          d.salto,
          1,
        );
      }
    });
  }

  it("la crescita è stretta lontano dai bordi: +1 € di RAL non lascia mai il netto fermo", () => {
    // Complemento della scansione: lì si pretende "non cala", qui "sale".
    for (const ral of [1_000, 12_000, 18_000, 26_000, 45_000, 80_000, 150_000]) {
      const a = calcolaNetto({ ral, comune: "caserta", mensilita: 12 })
        .nettoAnnuo;
      const b = calcolaNetto({ ral: ral + 1, comune: "caserta", mensilita: 12 })
        .nettoAnnuo;
      expect(b - a).toBeGreaterThan(0.3);
    }
  });
});
