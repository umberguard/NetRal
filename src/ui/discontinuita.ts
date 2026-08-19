// Discontinuità del netto e nota di prossimità (§6 "semantica dell'esenzione"
// e §8 del brief). Modulo di UI: il motore non sa nulla di queste note.
//
// PROVENIENZA DEI DATI. Le discontinuità che dipendono dal comune NON sono
// riscritte a mano qui: si derivano dalla matrice territoriale
// (`COMUNI[·].comunale`), così aggiungere un comune resta una riga sola in
// `territorio.ts`. Restano dichiarate qui — perché non sono ricavabili da un
// singolo dato — le due discontinuità nazionali, misurate sul motore dal test
// di proprietà della fase 5 (scansione a passo 1 € su 0–200.000 × 6 comuni).

import { COMUNI, type SlugComune } from "../engine/territorio";
import { aliquota, euro } from "./formato";

/**
 * Ampiezza della finestra di prossimità, in euro di IMPONIBILE FISCALE
 * (non di RAL: le soglie di legge sono tutte definite sull'imponibile).
 *
 * 500 € di imponibile valgono circa 550 € di RAL sotto la prima fascia
 * contributiva: abbastanza larga da intercettare chi sta trattando uno
 * scatto di stipendio a ridosso di una soglia, abbastanza stretta da non
 * mostrare l'avviso quasi sempre (le soglie distano fra loro migliaia di euro).
 */
export const FINESTRA_PROSSIMITA = 500;

export type Discontinuita = {
  /** Valore di imponibile fiscale in cui il netto fa un salto all'indietro. */
  imponibile: number;
  titolo: string;
  /** Spiegazione in linguaggio naturale, con i numeri già sostituiti. */
  causa: string;
  /** Variazione del netto annuo nell'attraversare la soglia: sempre negativa. */
  effettoNetto: number;
  riferimento: string;
};

/**
 * Discontinuità che valgono per ogni comune. Ampiezze misurate in fase 5 e
 * verificate dal test di proprietà in calcolo.test.ts (whitelist con cause).
 *
 * NON è in elenco il gradino a 28.000 (−0,19 €): è un artefatto del
 * troncamento alla 4ª cifra del rapporto dell'art. 13 co. 1 TUIR, sotto la
 * soglia di rilevanza per chi legge (venti centesimi l'anno). Segnalarlo
 * svaluterebbe le note che contano.
 */
const DISCONTINUITA_NAZIONALI: readonly Discontinuita[] = [
  {
    imponibile: 15_000,
    titolo: "Fine delle agevolazioni per redditi bassi",
    causa:
      "Superati i 15.000 € di imponibile fiscale tre misure cambiano insieme: " +
      "si perdono i 1.200 € di trattamento integrativo, la detrazione per " +
      "lavoro dipendente passa da 1.955 € a 1.910 € più la quota variabile, e " +
      "la somma esente del cuneo scende dal 5,3% al 4,8% dell'imponibile.",
    effettoNetto: -130.12,
    riferimento:
      "Art. 13 co. 1 TUIR · D.L. 3/2020 art. 1 · L. 207/2024 art. 1 co. 4-5",
  },
  {
    imponibile: 35_000,
    titolo: "Fine della maggiorazione di 65 €",
    causa:
      "La maggiorazione dell'art. 13 co. 1.1 TUIR spetta solo fino a 35.000 € " +
      "di imponibile fiscale e si perde per intero, senza décalage: un euro in " +
      "più di imponibile costa 65 € di detrazione.",
    effettoNetto: -65,
    riferimento: "Art. 13 co. 1.1 TUIR",
  },
];

/**
 * Tutte le discontinuità che riguardano il comune selezionato: le due
 * nazionali più — se il comune ha deliberato una soglia di esenzione — quella
 * dell'addizionale comunale, derivata da `territorio.ts`.
 *
 * L'effetto sul netto della soglia comunale è `soglia × aliquota`: la soglia
 * non è una franchigia, superata l'addizionale è dovuta sull'INTERO imponibile
 * (art. 1 co. 11 D.L. 138/2011).
 */
export function discontinuitaDelComune(comune: SlugComune): Discontinuita[] {
  const { nome, comunale } = COMUNI[comune];
  if (comunale.sogliaEsenzione === null) return [...DISCONTINUITA_NAZIONALI];

  const soglia = comunale.sogliaEsenzione;
  const addizionaleDovuta = soglia * comunale.aliquota;
  return [
    ...DISCONTINUITA_NAZIONALI,
    {
      imponibile: soglia,
      titolo: `Soglia di esenzione dell'addizionale comunale di ${nome}`,
      causa:
        `${nome} esenta l'addizionale comunale fino a ${euro(soglia)} di ` +
        `imponibile fiscale. È una soglia, non una franchigia: superata, ` +
        `l'aliquota comunale — ${aliquota(comunale.aliquota)} — si applica ` +
        `all'intero imponibile e non alla sola eccedenza, quindi ` +
        `l'addizionale passa da zero a circa ` +
        `${euro(addizionaleDovuta)}.`,
      effettoNetto: -addizionaleDovuta,
      riferimento: `Art. 1 co. 11 D.L. 138/2011 · delibera ${comunale.delibera}`,
    },
  ];
}

export type Prossimita = {
  discontinuita: Discontinuita;
  /** Imponibile − soglia: negativo se la soglia è ancora davanti. */
  distanza: number;
  superata: boolean;
};

/**
 * Le discontinuità entro `FINESTRA_PROSSIMITA` euro dall'imponibile fiscale
 * corrente, dalla più vicina alla più lontana.
 */
export function discontinuitaVicine(
  imponibileFiscale: number,
  comune: SlugComune,
): Prossimita[] {
  return discontinuitaDelComune(comune)
    .map((discontinuita) => ({
      discontinuita,
      distanza: imponibileFiscale - discontinuita.imponibile,
      superata: imponibileFiscale > discontinuita.imponibile,
    }))
    .filter(({ distanza }) => Math.abs(distanza) <= FINESTRA_PROSSIMITA)
    .sort((a, b) => Math.abs(a.distanza) - Math.abs(b.distanza));
}
