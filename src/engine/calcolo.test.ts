import { describe, expect, it } from "vitest";
import {
  calcolaContributiInps,
  calcolaDetrazioneLavoroDipendente,
  calcolaImponibileFiscale,
  calcolaIrpef,
  calcolaIrpefLorda,
  calcolaMaggiorazione65,
  calcolaSommaEsenteCuneo,
  calcolaTrattamentoIntegrativo,
  calcolaUlterioreDetrazioneCuneo,
  tronca,
  validaRal,
} from "./calcolo";

// Fase 2: contributi e imponibile fiscale.
// Fase 3: IRPEF lorda, detrazioni, incapienza, misure cuneo.
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
