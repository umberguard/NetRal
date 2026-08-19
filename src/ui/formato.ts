// Formattazione e lettura dei numeri secondo la convenzione italiana.
// Solo `Intl`: nessuna libreria (vincolo §3 del brief).
//
// Le istanze di NumberFormat sono costruite una volta sola a livello di modulo:
// crearle a ogni render costerebbe più del calcolo del netto.

// `useGrouping` esplicito non è pignoleria: il default della locale it-IT è
// "min2", che NON separa le migliaia a quattro cifre — "8000,00 €" invece di
// "8.000,00 €". In una colonna di importi incolonnati stona e si legge peggio.
// `true` equivale a "always" (NumberFormat v3) ed è l'unica forma tipizzata
// con `lib: ES2022`, senza toccare tsconfig.
const EURO = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

/** Aliquote: 0,0919 → "9,19%", 0,23 → "23%". */
const ALIQUOTA = new Intl.NumberFormat("it-IT", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Percentuali di risultato, sempre a due decimali: 0,2562 → "25,62%". */
const PERCENTUALE_2 = new Intl.NumberFormat("it-IT", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Importo in euro, convenzione italiana: 1234.56 → "1.234,56 €". */
export function euro(valore: number): string {
  return EURO.format(valore);
}

/** Aliquota come frazione (0,0919), resa in percentuale senza zeri inutili. */
export function aliquota(frazione: number): string {
  return ALIQUOTA.format(frazione);
}

/** Percentuale a due decimali fissi (per il cuneo fiscale). */
export function percentuale2(frazione: number): string {
  return PERCENTUALE_2.format(frazione);
}

/**
 * Numero puro con un numero fisso di decimali. Serve a mostrare il rapporto
 * dell'art. 13 TUIR prima e dopo il troncamento alla 4ª cifra: è un rapporto,
 * non un importo, quindi niente simbolo di valuta.
 */
export function numero(valore: number, cifre: number): string {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: cifre,
    maximumFractionDigits: cifre,
  }).format(valore);
}

/** Il numero è già valido come stringa decimale con il punto? */
const DECIMALE_CANONICO = /^-?\d+(\.\d+)?$/;

/**
 * Legge la RAL digitata dall'utente accettando l'inserimento "naturale":
 * `35000`, `35.000`, `35.000,50`, `35000.50`, `35 000 €`.
 *
 * Regole di disambiguazione del punto (l'unico caso davvero ambiguo):
 * - se c'è una virgola, vale la convenzione italiana piena — il punto separa
 *   le migliaia, la virgola i decimali;
 * - senza virgola, un solo punto seguito da un gruppo di lunghezza diversa
 *   da tre è un separatore decimale (`35000.5`); in tutti gli altri casi il
 *   punto separa le migliaia (`35.000` → 35.000, non 35,000).
 *
 * Ritorna `null` per input vuoto o non numerico: la pagina resta in stato
 * neutro. I valori numerici ma fuori dominio (negativi) sono passati al
 * motore, che li respinge con `RangeError` — la validazione fiscale resta
 * in un posto solo.
 */
export function leggiRal(testo: string): number | null {
  const pulito = testo.replace(/[\s €]/g, "");
  if (pulito === "") return null;

  let normalizzato: string;
  if (pulito.includes(",")) {
    normalizzato = pulito.replace(/\./g, "").replace(",", ".");
  } else if (pulito.includes(".")) {
    const ultimoPunto = pulito.lastIndexOf(".");
    const unicoPunto = pulito.indexOf(".") === ultimoPunto;
    const gruppoFinale = pulito.slice(ultimoPunto + 1);
    const puntoDecimale = unicoPunto && gruppoFinale.length !== 3;
    normalizzato = puntoDecimale ? pulito : pulito.replace(/\./g, "");
  } else {
    normalizzato = pulito;
  }

  if (!DECIMALE_CANONICO.test(normalizzato)) return null;
  const valore = Number(normalizzato);
  return Number.isFinite(valore) ? valore : null;
}
