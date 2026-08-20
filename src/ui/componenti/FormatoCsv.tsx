// Documentazione in pagina del formato del CSV da caricare (§9 del brief).
//
// Sta qui e non in un README perché la domanda «come deve essere fatto il
// file?» arriva davanti alla dropzone, non su GitHub. Il componente è
// presentazionale: non conosce il file caricato e non ha stato proprio — il
// blocco richiudibile è un `<details>` nativo, non un `useState`.
//
// L'esempio non è riscritto qui: è `CSV_ESEMPIO` in `csv.ts`, la stessa
// stringa che i test danno in pasto al parser. Documentazione e codice non
// possono divergere.

import { COLONNE_CALCOLATE, CSV_ESEMPIO } from "../csv";

const CELLA = "border-b border-stone-200 px-2 py-1.5 align-top";

/** `<code>` inline, per i nomi di colonna e i valori ammessi. */
function Codice({ children }: { children: string }) {
  return (
    <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[0.95em] text-stone-800">
      {children}
    </code>
  );
}

type Props = {
  /**
   * Il download del file: è la stessa funzione che scarica il CSV dell'esito
   * (`scarica` in PaginaBatch), passata come prop per non avere due
   * meccanismi di salvataggio da mantenere allineati.
   */
  onScarica: (nomeFile: string, contenuto: string) => void;
};

export function FormatoCsv({ onScarica }: Props) {
  return (
    <section className="rounded border border-stone-300 bg-white p-4">
      <h2 className="text-sm font-semibold tracking-wide text-stone-900 uppercase">
        Com'è fatto il CSV
      </h2>
      <p className="mt-1 text-xs text-stone-600">
        Una riga per dipendente, con l'intestazione delle colonne sulla prima
        riga. Serve solo la RAL: tutto il resto ha un valore predefinito.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="text-left text-stone-500 uppercase">
              <th scope="col" className={`${CELLA} bg-stone-100 font-semibold`}>
                Colonna
              </th>
              <th scope="col" className={`${CELLA} bg-stone-100 font-semibold`}>
                Obbligatoria
              </th>
              <th scope="col" className={`${CELLA} bg-stone-100 font-semibold`}>
                Valori ammessi
              </th>
              <th scope="col" className={`${CELLA} bg-stone-100 font-semibold`}>
                Se manca
              </th>
            </tr>
          </thead>
          <tbody className="text-stone-700">
            <tr>
              <td className={CELLA}>
                <Codice>ral</Codice>
              </td>
              <td className={`${CELLA} font-semibold text-stone-900`}>Sì</td>
              <td className={CELLA}>
                numero, es. <Codice>35000</Codice> o <Codice>35.000,00</Codice>
              </td>
              <td className={CELLA}>
                la riga finisce in errore, le altre proseguono
              </td>
            </tr>
            <tr>
              <td className={CELLA}>
                <Codice>comune</Codice>
              </td>
              <td className={CELLA}>No</td>
              <td className={CELLA}>
                slug o nome, es. <Codice>napoli</Codice> oppure{" "}
                <Codice>Napoli</Codice>
              </td>
              <td className={CELLA}>
                vale il comune predefinito scelto qui sopra
              </td>
            </tr>
            <tr>
              <td className={CELLA}>
                <Codice>mensilita</Codice>
              </td>
              <td className={CELLA}>No</td>
              <td className={CELLA}>
                <Codice>12</Codice>, <Codice>13</Codice> o <Codice>14</Codice>
              </td>
              <td className={CELLA}>
                vale la mensilità predefinita scelta qui sopra
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <pre className="mt-4 overflow-x-auto rounded border border-stone-200 bg-stone-50 p-3 font-mono text-xs text-stone-800">
        {CSV_ESEMPIO.trimEnd()}
      </pre>

      <button
        type="button"
        className="mt-3 rounded bg-blue-900 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus:ring-2 focus:ring-blue-900/40 focus:outline-none"
        onClick={() => onScarica("netral-esempio.csv", CSV_ESEMPIO)}
      >
        Scarica il CSV di esempio
      </button>

      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-semibold text-blue-900">
          Dettagli sul formato
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-stone-600">
          <li>
            I nomi delle colonne sono riconosciuti anche in varianti — per la
            RAL <Codice>lordo</Codice>,{" "}
            <Codice>retribuzione annua lorda</Codice>,{" "}
            <Codice>stipendio lordo</Codice>, <Codice>gross salary</Codice>; per
            il comune <Codice>citta</Codice>, <Codice>sede</Codice>,{" "}
            <Codice>city</Codice>; per la mensilità{" "}
            <Codice>n. mensilità</Codice>, <Codice>rate</Codice>. Accenti e
            maiuscole non contano.
          </li>
          <li>
            Il separatore (<Codice>,</Codice> o <Codice>;</Codice>) e il
            decimale (<Codice>.</Codice> o <Codice>,</Codice>) vengono
            riconosciuti da soli, e l'esito riusa le stesse convenzioni del file
            caricato.
          </li>
          <li>
            Le colonne in più che il file già contiene (matricola, nome,
            reparto…) vengono conservate nell'esito, nell'ordine originale.
          </li>
          <li>
            Se la colonna della RAL non viene riconosciuta si può sceglierla a
            mano dopo il caricamento: senza, non si calcola nulla.
          </li>
          <li>
            Una riga non valida non blocca le altre: le sue colonne calcolate
            restano vuote e la spiegazione finisce nella colonna{" "}
            <Codice>note</Codice>.
          </li>
          <li>
            Colonne aggiunte in coda all'esito:{" "}
            {COLONNE_CALCOLATE.map((colonna, indice) => (
              <span key={colonna}>
                {indice > 0 && ", "}
                <Codice>{colonna}</Codice>
              </span>
            ))}
            .
          </li>
        </ul>
      </details>
    </section>
  );
}
