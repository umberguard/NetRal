// La cascata del breakdown: una riga per voce, dalla RAL al netto mensile.
//
// La formula con i numeri sostituiti e il riferimento normativo sono SEMPRE
// visibili, non nascosti in un tooltip: chi legge deve poter seguire il
// calcolo riga per riga senza interagire. È la densità di uno strumento HR.

import type { Voce } from "../cascata";
import { euro } from "../formato";

/** Classi della riga per livello: la gerarchia si legge dalla tipografia. */
const RIGA: Record<Voce["livello"], string> = {
  dettaglio: "text-stone-500",
  voce: "text-stone-800",
  totale: "border-t border-stone-300 bg-stone-100/70 font-medium text-stone-900",
  risultato: "border-t border-blue-900/30 bg-blue-50/60 font-semibold text-blue-900",
};

function RigaVoce({ voce }: { voce: Voce }) {
  const dettaglio = voce.livello === "dettaglio";
  const segno = voce.importo === 0 ? "" : (voce.segno ?? "");
  return (
    <tr className={RIGA[voce.livello]}>
      <th
        scope="row"
        className={`py-2 pr-4 text-left align-top font-normal ${dettaglio ? "pl-6" : ""}`}
      >
        <span className={voce.livello === "dettaglio" ? "" : "font-medium"}>
          {voce.etichetta}
        </span>
        {voce.riferimento !== undefined && (
          <span className="mt-0.5 block text-xs font-normal text-stone-500">
            {voce.riferimento}
          </span>
        )}
      </th>
      <td className="py-2 pr-4 align-top text-xs leading-relaxed text-stone-600 tabular-nums">
        {voce.formula}
      </td>
      <td
        className={`py-2 text-right align-top whitespace-nowrap tabular-nums ${
          voce.livello === "risultato" ? "text-base" : ""
        }`}
      >
        {segno}
        {voce.importoTestuale ?? euro(voce.importo)}
      </td>
    </tr>
  );
}

type Props = {
  voci: Voce[];
  titolo: string;
  /** Reso sotto il titolo: serve alla sezione "non incide sul netto". */
  descrizione?: string;
};

export function CascataBreakdown({ voci, titolo, descrizione }: Props) {
  return (
    <section className="rounded border border-stone-300 bg-white">
      <header className="border-b border-stone-200 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-stone-900 uppercase">
          {titolo}
        </h2>
        {descrizione !== undefined && (
          <p className="mt-1 text-xs text-stone-600">{descrizione}</p>
        )}
      </header>
      <div className="overflow-x-auto px-4">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead>
            <tr className="text-xs tracking-wide text-stone-500 uppercase">
              <th scope="col" className="py-2 pr-4 text-left font-semibold">
                Voce
              </th>
              <th scope="col" className="py-2 pr-4 text-left font-semibold">
                Formula applicata
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Importo
              </th>
            </tr>
          </thead>
          <tbody>
            {voci.map((voce) => (
              <RigaVoce key={voce.id} voce={voce} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
