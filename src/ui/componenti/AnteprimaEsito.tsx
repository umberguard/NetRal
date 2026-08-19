// Anteprima delle prime righe elaborate, prima del download (§9 del brief).
//
// Mostra ESATTAMENTE le stringhe che finiranno nel CSV — stessi valori, stessa
// convenzione decimale — perché l'anteprima le prende da `valoriCalcolati`,
// la stessa funzione che usa il serializzatore. Se qui torna, torna nel file.

import {
  COLONNE_CALCOLATE,
  nomiColonneCalcolate,
  valoriCalcolati,
  type EsitoRiga,
  type SeparatoreDecimale,
} from "../csv";

const CELLA = "border-b border-stone-200 px-2 py-1.5 whitespace-nowrap";

type Props = {
  esiti: EsitoRiga[];
  colonneInput: string[];
  decimale: SeparatoreDecimale;
  /** Numero di righe totali del file, per dire quante non sono in anteprima. */
  righeTotali: number;
};

export function AnteprimaEsito({
  esiti,
  colonneInput,
  decimale,
  righeTotali,
}: Props) {
  const nomi = nomiColonneCalcolate(colonneInput);

  return (
    <section className="rounded border border-stone-300 bg-white">
      <header className="border-b border-stone-200 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-stone-900 uppercase">
          Anteprima
        </h2>
        <p className="mt-1 text-xs text-stone-600">
          Prime {esiti.length} righe su {righeTotali}. Le colonne di input sono
          preservate nell'ordine originale; in coda le colonne calcolate.
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs tabular-nums">
          <thead>
            <tr className="text-left text-stone-500 uppercase">
              {colonneInput.map((colonna) => (
                <th
                  key={`in-${colonna}`}
                  scope="col"
                  className={`${CELLA} bg-stone-100 font-semibold`}
                >
                  {colonna}
                </th>
              ))}
              {COLONNE_CALCOLATE.map((colonna) => (
                <th
                  key={colonna}
                  scope="col"
                  className={`${CELLA} bg-blue-50 font-semibold text-blue-900`}
                >
                  {nomi[colonna]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {esiti.map((esito, indice) => {
              const calcolate = valoriCalcolati(esito, decimale);
              const inErrore = esito.breakdown === null;
              return (
                <tr
                  // Le righe di un CSV non hanno identità propria: l'indice è
                  // la chiave onesta (l'elenco non viene mai riordinato).
                  key={indice}
                  className={inErrore ? "bg-red-50/60 text-red-900" : "text-stone-800"}
                >
                  {colonneInput.map((colonna) => (
                    <td key={`in-${colonna}`} className={CELLA}>
                      {esito.origine[colonna] ?? ""}
                    </td>
                  ))}
                  {COLONNE_CALCOLATE.map((colonna) => (
                    <td
                      key={colonna}
                      className={`${CELLA} ${
                        colonna === "note"
                          ? "max-w-md whitespace-normal text-stone-600"
                          : "text-right"
                      }`}
                    >
                      {calcolate[colonna]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
