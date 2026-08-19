// Pagina batch `#/batch` — §9 del brief.
//
// Un membro del team carica un CSV di RAL e riscarica lo stesso CSV con le
// colonne calcolate in coda. Tutto avviene nel browser: il file non viene mai
// caricato da nessuna parte — si legge con `File.text()` e si riscarica da un
// Blob costruito in memoria (argomento GDPR, §3 del brief).
//
// Qui vive SOLO l'orchestrazione: lettura, mappatura delle colonne, download.
// Il parsing, il calcolo riga per riga e la serializzazione stanno in
// `csv.ts`, che è puro e testato in Node.

import { useMemo, useState } from "react";
import { COMUNI, type SlugComune } from "../engine/territorio";
import {
  elaboraRighe,
  leggiCsv,
  serializzaEsito,
  type CsvLetto,
  type Mensilita,
} from "./csv";
import { BannerAvviso } from "./componenti/BannerAvviso";
import { AnteprimaEsito } from "./componenti/AnteprimaEsito";
import { GateAccesso } from "./componenti/GateAccesso";
import { CAMPO, ETICHETTA } from "./componenti/ModuloInput";

/** Marcatore di codifica UTF-8 in testa al file scaricato (vedi `scarica`). */
const BOM = "\uFEFF";

/** Righe mostrate in anteprima prima del download (§9). */
const RIGHE_ANTEPRIMA = 10;

const MENSILITA: readonly Mensilita[] = [12, 13, 14];

const SLUG_COMUNI = (Object.keys(COMUNI) as SlugComune[]).sort((a, b) =>
  COMUNI[a].nome.localeCompare(COMUNI[b].nome, "it"),
);

/** Il nome del file scaricato: `stipendi.csv` → `stipendi-netral.csv`. */
function nomeEsito(nomeOriginale: string): string {
  return `${nomeOriginale.replace(/\.csv$/i, "")}-netral.csv`;
}

/**
 * Salva il testo come file locale. È l'unico punto di tutta la fase che tocca
 * il DOM e le API del browser: `URL.createObjectURL` su un Blob costruito in
 * memoria, nessuna rete di mezzo.
 *
 * Il BOM in testa non è superstizione: senza, Excel apre un CSV UTF-8 con la
 * codepage di sistema e "mensilità" diventa "mensilitÃ ".
 */
function scarica(nomeFile: string, contenuto: string): void {
  const blob = new Blob([BOM + contenuto], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeFile;
  link.click();
  // Senza revoke il Blob resta in memoria finché la scheda è aperta.
  URL.revokeObjectURL(url);
}

export function PaginaBatch() {
  const [sbloccato, setSbloccato] = useState(false);

  const [nomeFile, setNomeFile] = useState<string | null>(null);
  const [letto, setLetto] = useState<CsvLetto | null>(null);
  const [erroreFile, setErroreFile] = useState<string | null>(null);
  const [trascinamento, setTrascinamento] = useState(false);

  // Colonna della RAL: proposta dal riconoscimento tollerante, correggibile a
  // mano quando il file usa un'intestazione che non è in elenco (§9).
  const [colonnaRal, setColonnaRal] = useState<string | null>(null);

  // Valori usati per le righe in cui comune e mensilità non ci sono (colonna
  // assente o cella vuota).
  const [comune, setComune] = useState<SlugComune>("napoli");
  const [mensilita, setMensilita] = useState<Mensilita>(13);

  async function caricaFile(file: File | undefined): Promise<void> {
    if (file === undefined) return;
    setErroreFile(null);
    try {
      const risultato = leggiCsv(await file.text());
      if (risultato.righe.length === 0) {
        setLetto(null);
        setNomeFile(file.name);
        setErroreFile("Il file non contiene righe di dati.");
        return;
      }
      setLetto(risultato);
      setNomeFile(file.name);
      setColonnaRal(risultato.colonneRiconosciute.ral);
    } catch {
      setLetto(null);
      setNomeFile(file.name);
      setErroreFile("Il file non è un CSV leggibile.");
    }
  }

  const esiti = useMemo(() => {
    if (letto === null || colonnaRal === null) return null;
    return elaboraRighe(
      letto.righe,
      {
        ral: colonnaRal,
        comune: letto.colonneRiconosciute.comune,
        mensilita: letto.colonneRiconosciute.mensilita,
      },
      { comune, mensilita },
    );
  }, [letto, colonnaRal, comune, mensilita]);

  const inErrore = esiti?.filter((esito) => esito.breakdown === null).length ?? 0;
  const conNote =
    esiti?.filter((esito) => esito.breakdown !== null && esito.note.length > 0)
      .length ?? 0;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <BannerAvviso />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <header className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              NetRal — elaborazione batch
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              Carica un CSV di RAL, riscarica lo stesso file con netto e
              trattenute in coda.
            </p>
          </div>
          <a
            className="text-sm text-blue-900 underline underline-offset-2"
            href="#/"
          >
            ← Calcolatore singolo
          </a>
        </header>

        {!sbloccato ? (
          <GateAccesso onSblocco={() => setSbloccato(true)} />
        ) : (
          <div className="space-y-6">
            <section
              className={`rounded border-2 border-dashed p-6 text-center ${
                trascinamento
                  ? "border-blue-900 bg-blue-50"
                  : "border-stone-300 bg-white"
              }`}
              onDragOver={(evento) => {
                evento.preventDefault();
                setTrascinamento(true);
              }}
              onDragLeave={() => setTrascinamento(false)}
              onDrop={(evento) => {
                evento.preventDefault();
                setTrascinamento(false);
                void caricaFile(evento.dataTransfer.files[0]);
              }}
            >
              <p className="text-sm text-stone-700">
                Trascina qui il CSV, oppure
              </p>
              <label className="mt-3 inline-block cursor-pointer rounded bg-blue-900 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">
                Scegli un file
                <input
                  className="sr-only"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(evento) => {
                    void caricaFile(evento.target.files?.[0]);
                    // Permette di ricaricare due volte lo stesso file.
                    evento.target.value = "";
                  }}
                />
              </label>
              <p className="mt-3 text-xs text-stone-600">
                L'elaborazione avviene interamente nel tuo browser: nessun dato
                viene inviato a server. Colonne riconosciute automaticamente:
                RAL (obbligatoria), comune e mensilità (opzionali).
              </p>
            </section>

            {erroreFile !== null && (
              <p
                role="alert"
                className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
              >
                {erroreFile}
              </p>
            )}

            {letto !== null && (
              <section className="rounded border border-stone-300 bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold tracking-wide text-stone-900 uppercase">
                    File caricato
                  </h2>
                  <p className="text-xs text-stone-600 tabular-nums">
                    {nomeFile} · {letto.righe.length} righe · separatore «
                    {letto.convenzione.separatore}» · decimali «
                    {letto.convenzione.decimale}» (l'esito userà gli stessi)
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className={ETICHETTA} htmlFor="colonna-ral">
                      Colonna della RAL
                    </label>
                    <select
                      id="colonna-ral"
                      className={`${CAMPO} mt-1`}
                      value={colonnaRal ?? ""}
                      onChange={(evento) =>
                        setColonnaRal(
                          evento.target.value === "" ? null : evento.target.value,
                        )
                      }
                    >
                      <option value="">— da scegliere —</option>
                      {letto.colonne.map((colonna) => (
                        <option key={colonna} value={colonna}>
                          {colonna}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={ETICHETTA} htmlFor="comune-predefinito">
                      Comune predefinito
                    </label>
                    <select
                      id="comune-predefinito"
                      className={`${CAMPO} mt-1`}
                      value={comune}
                      onChange={(evento) =>
                        setComune(evento.target.value as SlugComune)
                      }
                    >
                      {SLUG_COMUNI.map((slug) => (
                        <option key={slug} value={slug}>
                          {COMUNI[slug].nome}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-stone-500">
                      {letto.colonneRiconosciute.comune === null
                        ? "Nessuna colonna comune nel file: vale per tutte le righe."
                        : `Colonna «${letto.colonneRiconosciute.comune}»: il predefinito vale solo per le celle vuote.`}
                    </p>
                  </div>

                  <div>
                    <label className={ETICHETTA} htmlFor="mensilita-predefinita">
                      Mensilità predefinite
                    </label>
                    <select
                      id="mensilita-predefinita"
                      className={`${CAMPO} mt-1 tabular-nums`}
                      value={mensilita}
                      onChange={(evento) =>
                        setMensilita(Number(evento.target.value) as Mensilita)
                      }
                    >
                      {MENSILITA.map((numero) => (
                        <option key={numero} value={numero}>
                          {numero}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-stone-500">
                      {letto.colonneRiconosciute.mensilita === null
                        ? "Nessuna colonna mensilità nel file: vale per tutte le righe."
                        : `Colonna «${letto.colonneRiconosciute.mensilita}»: il predefinito vale solo per le celle vuote.`}
                    </p>
                  </div>
                </div>

                {colonnaRal === null && (
                  <p
                    role="alert"
                    className="mt-4 rounded border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950"
                  >
                    Non ho riconosciuto la colonna della RAL fra quelle del file
                    ({letto.colonne.join(", ")}). Scegli tu quale usare: senza
                    non posso calcolare nulla.
                  </p>
                )}
              </section>
            )}

            {letto !== null && esiti !== null && (
              <>
                <section className="flex flex-wrap items-center justify-between gap-3 rounded border border-stone-300 bg-white px-4 py-3">
                  <p className="text-sm text-stone-700 tabular-nums">
                    <strong className="font-semibold">
                      {esiti.length - inErrore}
                    </strong>{" "}
                    righe calcolate
                    {inErrore > 0 && (
                      <>
                        {" · "}
                        <strong className="font-semibold text-red-800">
                          {inErrore}
                        </strong>{" "}
                        in errore (colonne calcolate vuote, motivo nella colonna
                        note)
                      </>
                    )}
                    {conNote > 0 && (
                      <>
                        {" · "}
                        <strong className="font-semibold text-amber-800">
                          {conNote}
                        </strong>{" "}
                        con avviso di prossimità a una soglia
                      </>
                    )}
                  </p>
                  <button
                    type="button"
                    className="rounded bg-blue-900 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus:ring-2 focus:ring-blue-900/40 focus:outline-none"
                    onClick={() =>
                      scarica(
                        nomeEsito(nomeFile ?? "esito"),
                        serializzaEsito(esiti, letto.colonne, letto.convenzione),
                      )
                    }
                  >
                    Scarica il CSV con l'esito
                  </button>
                </section>

                <AnteprimaEsito
                  esiti={esiti.slice(0, RIGHE_ANTEPRIMA)}
                  colonneInput={letto.colonne}
                  decimale={letto.convenzione.decimale}
                  righeTotali={esiti.length}
                />
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
