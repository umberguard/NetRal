// Lettura, elaborazione e scrittura del CSV della pagina batch (§9 del brief).
//
// Modulo PURO: niente DOM, niente Blob, niente React. Tutto quello che sta qui
// gira in Node ed è coperto da `csv.test.ts` (environment "node", come i test
// del motore). La pagina si limita a leggere il testo del file, a mostrarlo e
// a offrirne il download: nessun dato lascia il browser (§3, argomento GDPR).
//
// Come per la pagina pubblica: la UI importa dal motore, mai il contrario.

import * as Papa from "papaparse";
import { calcolaNetto } from "../engine/calcolo";
import { COMUNI, type SlugComune } from "../engine/territorio";
import type { Breakdown } from "../engine/tipi";
import { discontinuitaVicine } from "./discontinuita";
import { euro, leggiRal } from "./formato";

/** Separatore di campo: il brief (§9) chiede di gestire questi due e solo questi. */
export type Separatore = "," | ";";

/** Separatore decimale usato DENTRO i valori numerici del file. */
export type SeparatoreDecimale = "," | ".";

/**
 * Convenzione tipografica del file caricato. Viene rilevata in lettura e
 * RIUSATA in scrittura: chi carica un CSV all'italiana (`;` + virgola
 * decimale) riscarica un CSV all'italiana, che Excel riapre senza procedura
 * di importazione.
 */
export type Convenzione = {
  separatore: Separatore;
  decimale: SeparatoreDecimale;
};

export type Mensilita = 12 | 13 | 14;

const MENSILITA_AMMESSE: readonly Mensilita[] = [12, 13, 14];

/** Riga del file di input: valori grezzi, chiave = intestazione di colonna. */
export type RigaCsv = Record<string, string>;

/**
 * Il CSV di esempio mostrato nella sezione «Com'è fatto il CSV» della pagina
 * batch e scaricato dal pulsante lì dentro. Vive qui, accanto al parser, per
 * un motivo preciso: `csv.test.ts` lo dà in pasto a `leggiCsv` e a
 * `elaboraRighe` e pretende zero note: se un giorno gli alias o le regole
 * cambiassero, l'esempio documentato non potrebbe divergere in silenzio.
 *
 * Le righe coprono i casi che l'utente deve vedere: riga completa, comune
 * scritto per nome anziché per slug, mensilità 14, cella comune vuota (scatta
 * il predefinito scelto in pagina), RAL con decimali.
 *
 * Convenzione: separatore `,` e punto decimale — la forma anglosassone, quella
 * che un foglio esporta di default. Il parser accetta anche `;` + virgola.
 */
export const CSV_ESEMPIO = `ral,comune,mensilita
28000,napoli,13
32000,Milano,13
45000,salerno,14
24000,,12
36500.50,caserta,13
`;

// ---------------------------------------------------------------------------
// Riconoscimento tollerante delle intestazioni (§9)
// ---------------------------------------------------------------------------

/**
 * Forma canonica di un'intestazione: minuscole, senza accenti, senza segni di
 * punteggiatura, spazi collassati. "Retribuzione Lorda Annua (€)" → "retribuzione lorda annua".
 * Serve solo al confronto con gli alias: il nome originale della colonna resta
 * intatto nell'output.
 */
function canonica(intestazione: string): string {
  return intestazione
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Alias accettati per le tre colonne che il motore sa usare. Sono nomi visti
 * davvero negli export dei gestionali paghe e nei fogli fatti a mano: se la
 * colonna non è in elenco la pagina NON fallisce in silenzio, mostra le
 * colonne trovate e chiede la mappatura (§9).
 */
const ALIAS: Record<"ral" | "comune" | "mensilita", readonly string[]> = {
  ral: [
    "ral",
    "ral annua",
    "retribuzione annua lorda",
    "retribuzione lorda annua",
    "lordo",
    "lordo annuo",
    "stipendio lordo",
    "salario lordo",
    "gross",
    "gross salary",
    "annual gross",
  ],
  comune: ["comune", "comune di residenza", "citta", "sede", "city"],
  mensilita: ["mensilita", "n mensilita", "numero mensilita", "rate", "mensilita annue"],
};

/** Colonne di input riconosciute automaticamente; `null` = da mappare a mano. */
export type ColonneRiconosciute = {
  ral: string | null;
  comune: string | null;
  mensilita: string | null;
};

function riconosci(colonne: readonly string[]): ColonneRiconosciute {
  const trova = (alias: readonly string[]) =>
    colonne.find((colonna) => alias.includes(canonica(colonna))) ?? null;
  return {
    ral: trova(ALIAS.ral),
    comune: trova(ALIAS.comune),
    mensilita: trova(ALIAS.mensilita),
  };
}

// ---------------------------------------------------------------------------
// Rilevamento della convenzione decimale
// ---------------------------------------------------------------------------

/**
 * Che separatore decimale usa QUESTO valore? `null` se non lo dice (nessun
 * decimale, o solo un punto in posizione da migliaia).
 *
 * Stessa disambiguazione di `leggiRal` in formato.ts, ed è voluto: se il
 * lettore interpreta "35.000" come trentacinquemila, lo scrittore non deve
 * dedurne che il file usa il punto decimale.
 */
function classificaDecimale(valore: string): SeparatoreDecimale | null {
  const pulito = valore.replace(/[\s€]/g, "");
  if (pulito === "") return null;
  if (pulito.includes(",")) return ",";
  const ultimoPunto = pulito.lastIndexOf(".");
  if (ultimoPunto === -1) return null;
  const unicoPunto = pulito.indexOf(".") === ultimoPunto;
  const gruppoFinale = pulito.length - ultimoPunto - 1;
  return unicoPunto && gruppoFinale !== 3 ? "." : null;
}

/**
 * Convenzione decimale del file: vince il primo valore che si pronuncia,
 * cercato prima nella colonna della RAL (l'unica di cui conosciamo la natura
 * numerica) e poi, se quella tace, in tutte le altre celle.
 *
 * Se nel file non compare nessun decimale ("35000" e basta) la convenzione si
 * deduce dal separatore di campo: `;` è la forma europea, che accompagna la
 * virgola decimale. È un'assunzione, dichiarata in docs/ASSUNZIONI.md.
 */
function rilevaDecimale(
  righe: readonly RigaCsv[],
  colonnaRal: string | null,
  separatore: Separatore,
): SeparatoreDecimale {
  if (colonnaRal !== null) {
    for (const riga of righe) {
      const esito = classificaDecimale(riga[colonnaRal] ?? "");
      if (esito !== null) return esito;
    }
  }
  for (const riga of righe) {
    for (const valore of Object.values(riga)) {
      const esito = classificaDecimale(valore ?? "");
      if (esito !== null) return esito;
    }
  }
  return separatore === ";" ? "," : ".";
}

// ---------------------------------------------------------------------------
// Lettura
// ---------------------------------------------------------------------------

export type CsvLetto = {
  /** Intestazioni nell'ordine originale: l'output le ripropone identiche (§9). */
  colonne: string[];
  righe: RigaCsv[];
  convenzione: Convenzione;
  colonneRiconosciute: ColonneRiconosciute;
};

/**
 * Parsa il testo del CSV con PapaParse (`header: true`, §9) lasciando che sia
 * lui a indovinare il separatore fra `,` e `;`, e rileva la convenzione
 * decimale. Non calcola nulla: l'elaborazione è un passo separato, così la
 * pagina può prima chiedere la mappatura delle colonne.
 */
export function leggiCsv(testo: string): CsvLetto {
  const esito = Papa.parse<RigaCsv>(testo, {
    header: true,
    skipEmptyLines: "greedy",
    // Il campo non viene ripulito: gli spazi attorno ai numeri li toglie
    // `leggiRal`, e le intestazioni le normalizza `canonica`.
    delimitersToGuess: [",", ";"],
  });

  const separatore: Separatore = esito.meta.delimiter === ";" ? ";" : ",";
  const colonne = (esito.meta.fields ?? []).filter((campo) => campo !== "");
  const righe = esito.data;
  const colonneRiconosciute = riconosci(colonne);

  return {
    colonne,
    righe,
    convenzione: {
      separatore,
      decimale: rilevaDecimale(righe, colonneRiconosciute.ral, separatore),
    },
    colonneRiconosciute,
  };
}

// ---------------------------------------------------------------------------
// Elaborazione riga per riga
// ---------------------------------------------------------------------------

/** Colonna del file da cui leggere ciascun dato; `null` = usa il valore globale. */
export type Mappatura = {
  ral: string;
  comune: string | null;
  mensilita: string | null;
};

/** Valori globali per le righe in cui comune e mensilità non sono nel file (§9). */
export type Predefiniti = {
  comune: SlugComune;
  mensilita: Mensilita;
};

/**
 * Esito di una riga. `breakdown === null` significa riga in errore: le colonne
 * calcolate restano vuote e il motivo finisce in `note`. Una riga in errore
 * NON blocca il file (§9): le altre si calcolano normalmente.
 */
export type EsitoRiga = {
  origine: RigaCsv;
  breakdown: Breakdown | null;
  note: string[];
};

/** Indice slug + nome del comune → slug, per riconoscere "Napoli" come `napoli`. */
const COMUNE_PER_NOME = new Map<string, SlugComune>(
  (Object.keys(COMUNI) as SlugComune[]).flatMap((slug) => [
    [slug, slug] as const,
    [canonica(COMUNI[slug].nome), slug] as const,
  ]),
);

function leggiComune(
  valore: string | undefined,
  predefinito: SlugComune,
): { comune: SlugComune } | { errore: string } {
  const testo = (valore ?? "").trim();
  if (testo === "") return { comune: predefinito };
  const slug = COMUNE_PER_NOME.get(canonica(testo));
  return slug === undefined
    ? {
        errore: `comune «${testo}» non presente nella matrice territoriale (${Object.keys(COMUNI).join(", ")})`,
      }
    : { comune: slug };
}

function leggiMensilita(
  valore: string | undefined,
  predefinita: Mensilita,
): { mensilita: Mensilita } | { errore: string } {
  const testo = (valore ?? "").trim();
  if (testo === "") return { mensilita: predefinita };
  const numero = Number(testo.replace(",", "."));
  return MENSILITA_AMMESSE.includes(numero as Mensilita)
    ? { mensilita: numero as Mensilita }
    : { errore: `mensilità «${testo}» non ammessa: sono previste 12, 13 o 14` };
}

/**
 * Calcola una riga. Ogni motivo di scarto — RAL mancante o non numerica,
 * comune fuori matrice, mensilità non prevista, `RangeError` del motore —
 * diventa una nota in italiano, mai un'eccezione che risale alla pagina.
 */
function elaboraRiga(
  origine: RigaCsv,
  mappatura: Mappatura,
  predefiniti: Predefiniti,
): EsitoRiga {
  const note: string[] = [];

  const testoRal = (origine[mappatura.ral] ?? "").trim();
  const ral = leggiRal(testoRal);
  if (testoRal === "") note.push("RAL mancante");
  else if (ral === null) note.push(`RAL «${testoRal}» non è un numero`);

  const comune = leggiComune(
    mappatura.comune === null ? undefined : origine[mappatura.comune],
    predefiniti.comune,
  );
  if ("errore" in comune) note.push(comune.errore);

  const mensilita = leggiMensilita(
    mappatura.mensilita === null ? undefined : origine[mappatura.mensilita],
    predefiniti.mensilita,
  );
  if ("errore" in mensilita) note.push(mensilita.errore);

  if (ral === null || "errore" in comune || "errore" in mensilita) {
    return { origine, breakdown: null, note };
  }

  try {
    const breakdown = calcolaNetto({
      ral,
      comune: comune.comune,
      mensilita: mensilita.mensilita,
    });
    // Avviso, non errore: la riga è calcolata: segnala solo che siamo a
    // ridosso di una discontinuità del netto (§9, "soglia esenzione vicina").
    for (const vicina of discontinuitaVicine(
      breakdown.imponibileFiscale,
      comune.comune,
    )) {
      note.push(
        `${vicina.discontinuita.titolo}: soglia ${euro(vicina.discontinuita.imponibile)} di imponibile ` +
          `${vicina.superata ? "superata di" : "distante"} ${euro(Math.abs(vicina.distanza))}`,
      );
    }
    return { origine, breakdown, note };
  } catch (errore) {
    // `validaRal` respinge RAL negativa/non finita: il messaggio del motore è
    // già scritto per essere letto, si riusa così com'è.
    note.push(
      errore instanceof RangeError
        ? errore.message
        : "calcolo non riuscito per questa riga",
    );
    return { origine, breakdown: null, note };
  }
}

export function elaboraRighe(
  righe: readonly RigaCsv[],
  mappatura: Mappatura,
  predefiniti: Predefiniti,
): EsitoRiga[] {
  return righe.map((riga) => elaboraRiga(riga, mappatura, predefiniti));
}

// ---------------------------------------------------------------------------
// Scrittura
// ---------------------------------------------------------------------------

/**
 * Colonne aggiunte in coda a quelle di input, nell'ordine fissato dal brief §9.
 *
 * `detrazioni_totali` somma le tre DETRAZIONI (art. 13, maggiorazione 65 €,
 * ulteriore detrazione cuneo) e NON comprende somma esente e trattamento
 * integrativo: quelle sono erogazioni che si sommano al netto, non riducono
 * l'IRPEF (vedi CONTEXT.md). Il brief fissa l'elenco delle colonne e non le
 * prevede: per questo `netto_annuo` non è ricostruibile dalle sole colonne
 * dell'output — annotato in docs/ASSUNZIONI.md.
 *
 * `cuneo_fiscale_pct` è espresso in punti percentuali (25,62 = 25,62%), non
 * come frazione: il suffisso `_pct` lo promette.
 */
export const COLONNE_CALCOLATE = [
  "contributi_inps",
  "imponibile_fiscale",
  "irpef_lorda",
  "detrazioni_totali",
  "irpef_netta",
  "addizionale_regionale",
  "addizionale_comunale",
  "netto_annuo",
  "netto_mensile",
  "totale_trattenute",
  "cuneo_fiscale_pct",
  "note",
] as const;

export type ColonnaCalcolata = (typeof COLONNE_CALCOLATE)[number];

/**
 * Nomi effettivi delle colonne calcolate: se il file di input ha già una
 * colonna con lo stesso nome (capita con `note`), la nuova prende il suffisso
 * `_netral` invece di sovrascriverla — le colonne di input vanno preservate.
 */
export function nomiColonneCalcolate(
  colonneInput: readonly string[],
): Record<ColonnaCalcolata, string> {
  const presi = new Set(colonneInput);
  const nomi = {} as Record<ColonnaCalcolata, string>;
  for (const colonna of COLONNE_CALCOLATE) {
    let nome: string = colonna;
    for (let n = 1; presi.has(nome); n += 1) {
      nome = n === 1 ? `${colonna}_netral` : `${colonna}_netral_${n}`;
    }
    presi.add(nome);
    nomi[colonna] = nome;
  }
  return nomi;
}

/**
 * Numero come stringa nella convenzione del file: due decimali fissi, nessun
 * separatore delle migliaia. Le migliaia sarebbero un problema, non un
 * servizio: un "35.000,00" riletto da un altro strumento può diventare 35.
 */
function scriviNumero(valore: number, decimale: SeparatoreDecimale): string {
  const testo = valore.toFixed(2);
  return decimale === "," ? testo.replace(".", ",") : testo;
}

/**
 * I valori delle colonne calcolate per una riga, già come stringhe: li usano
 * sia il CSV scaricato sia l'anteprima in pagina, così quello che si vede è
 * esattamente quello che si scarica. Riga in errore → celle vuote e `note`
 * valorizzata (§9).
 */
export function valoriCalcolati(
  esito: EsitoRiga,
  decimale: SeparatoreDecimale,
): Record<ColonnaCalcolata, string> {
  const nota = esito.note.join(" · ");
  if (esito.breakdown === null) {
    const vuote = {} as Record<ColonnaCalcolata, string>;
    for (const colonna of COLONNE_CALCOLATE) vuote[colonna] = "";
    return { ...vuote, note: nota };
  }
  const b = esito.breakdown;
  const n = (valore: number) => scriviNumero(valore, decimale);
  return {
    contributi_inps: n(b.contributiInps.totale),
    imponibile_fiscale: n(b.imponibileFiscale),
    irpef_lorda: n(b.irpef.lorda),
    detrazioni_totali: n(
      b.irpef.detrazioneLavoroDipendente +
        b.irpef.maggiorazione65 +
        b.irpef.ulterioreDetrazioneCuneo,
    ),
    irpef_netta: n(b.irpef.netta),
    addizionale_regionale: n(b.addizionali.regionale),
    addizionale_comunale: n(b.addizionali.comunale),
    netto_annuo: n(b.nettoAnnuo),
    netto_mensile: n(b.nettoMensile),
    totale_trattenute: n(b.totaleTrattenute),
    cuneo_fiscale_pct: n(b.cuneoFiscalePct * 100),
    note: nota,
  };
}

/**
 * Il CSV di esito: tutte le colonne di input nell'ordine originale, poi le
 * colonne calcolate. Separatore e convenzione decimale sono quelli del file
 * caricato (§9). Terminatore CRLF come da RFC 4180.
 */
export function serializzaEsito(
  esiti: readonly EsitoRiga[],
  colonneInput: readonly string[],
  convenzione: Convenzione,
): string {
  const nomi = nomiColonneCalcolate(colonneInput);
  const colonne = [...colonneInput, ...COLONNE_CALCOLATE.map((c) => nomi[c])];
  const righe = esiti.map((esito) => {
    const calcolate = valoriCalcolati(esito, convenzione.decimale);
    const riga: Record<string, string> = {};
    for (const colonna of colonneInput) riga[colonna] = esito.origine[colonna] ?? "";
    for (const colonna of COLONNE_CALCOLATE) riga[nomi[colonna]] = calcolate[colonna];
    return riga;
  });

  return Papa.unparse(righe, {
    columns: colonne,
    delimiter: convenzione.separatore,
    newline: "\r\n",
  });
}
