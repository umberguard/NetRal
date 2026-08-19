// Matrice territoriale delle addizionali IRPEF — SOLO DATI dichiarativi.
// Aggiungere un comune = una riga in COMUNI (più la regione in REGIONI se nuova):
// i tipi SlugComune/SlugRegione si aggiornano da soli.
//
// Fonte comunali: CSV ufficiale MEF, elenchi addizionale comunale 2025 e 2026
// (www1.finanze.gov.it → Fiscalità locale → Addizionale comunale IRPEF),
// scaricati e verificati il 19/08/2026. I comuni marcati "0*" nell'elenco 2026
// non hanno (ancora) deliberato per il 2026: per legge resta efficace l'ultima
// delibera pubblicata (art. 1 co. 169 L. 296/2006) — qui citata per ciascuno.

import type { Scaglione } from "./tipi";

/**
 * Addizionale comunale: aliquota unica sull'intero imponibile fiscale.
 * `sogliaEsenzione` è una SOGLIA, non una franchigia: imponibile ≤ soglia → 0;
 * oltre la soglia l'aliquota si applica all'INTERO imponibile (discontinuità
 * nel netto, coperta da test e segnalata in UI). null = nessuna esenzione.
 */
export type AddizionaleComunale = {
  aliquota: number;
  sogliaEsenzione: number | null;
  /** Delibera comunale come risulta dall'elenco MEF. */
  delibera: string;
};

export type Regione = {
  nome: string;
  /** Scaglioni marginali sull'imponibile fiscale (come l'IRPEF nazionale). */
  scaglioni: readonly Scaglione[];
};

export const REGIONI = {
  campania: {
    nome: "Campania",
    // Base 1,53% + maggiorazioni — L.R. Campania 30/03/2022 n. 7, in vigore
    // dall'anno d'imposta 2022 e confermata fino al 2026.
    // Fonte: entrate.regione.campania.it/ca/addizionale-irpef (verificata 19/08/2026).
    scaglioni: [
      { fino: 15_000, aliquota: 0.0173 },
      { fino: 28_000, aliquota: 0.0296 },
      { fino: 50_000, aliquota: 0.032 },
      { fino: null, aliquota: 0.0333 },
    ],
  },
  lombardia: {
    nome: "Lombardia",
    // In vigore dal 2022. Fonte: elenco MEF addizionali regionali, Regione
    // Lombardia codice 10 (www1.finanze.gov.it/.../addregirpef.php?reg=10),
    // verificata 19/08/2026. Milano è la riga di controllo per il cross-check
    // con i calcolatori pubblici.
    scaglioni: [
      { fino: 15_000, aliquota: 0.0123 },
      { fino: 28_000, aliquota: 0.0158 },
      { fino: 50_000, aliquota: 0.0172 },
      { fino: null, aliquota: 0.0173 },
    ],
  },
} as const satisfies Record<string, Regione>;

export type SlugRegione = keyof typeof REGIONI;

export type Comune = {
  nome: string;
  regione: SlugRegione;
  comunale: AddizionaleComunale;
};

export const COMUNI = {
  napoli: {
    nome: "Napoli",
    regione: "campania",
    comunale: {
      aliquota: 0.01,
      sogliaEsenzione: 12_000,
      delibera: "n. 143 del 29/12/2023 (conferma, pubbl. MEF 20/12/2025)",
    },
  },
  salerno: {
    nome: "Salerno",
    regione: "campania",
    comunale: {
      aliquota: 0.011,
      sogliaEsenzione: 10_000,
      delibera: "n. 54 del 22/12/2025 (conferma, pubbl. MEF 14/01/2026)",
    },
  },
  avellino: {
    nome: "Avellino",
    regione: "campania",
    comunale: {
      aliquota: 0.01,
      sogliaEsenzione: 20_000,
      delibera: "n. 59 del 13/12/2024 (conferma, pubbl. MEF 09/09/2025)",
    },
  },
  caserta: {
    nome: "Caserta",
    regione: "campania",
    comunale: {
      aliquota: 0.008,
      sogliaEsenzione: null,
      delibera: "n. 79 del 28/07/2023 (conferma, pubbl. MEF 20/12/2025)",
    },
  },
  benevento: {
    nome: "Benevento",
    regione: "campania",
    comunale: {
      aliquota: 0.008,
      sogliaEsenzione: null,
      delibera: "n. 22 del 14/07/2011 (conferma, pubbl. MEF 20/12/2025)",
    },
  },
  milano: {
    nome: "Milano",
    regione: "lombardia",
    comunale: {
      aliquota: 0.008,
      sogliaEsenzione: 23_000,
      delibera: "n. 46 del 28/09/2020 (conferma, pubbl. MEF 20/12/2025)",
    },
  },
} as const satisfies Record<string, Comune>;

export type SlugComune = keyof typeof COMUNI;
