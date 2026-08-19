// Nota di prossimità a una discontinuità (§6 e §8 del brief).
//
// È l'unico punto della pagina in cui si usa un colore d'allarme: ambra, non
// rosso — non è un errore dell'utente, è un'informazione che gli serve prima
// di negoziare uno scatto di stipendio. `role="status"` perché il contenuto
// cambia mentre l'utente digita: va annunciato, ma senza interrompere.

import type { Prossimita } from "../discontinuita";
import { euro } from "../formato";

export function NotaProssimita({ vicine }: { vicine: Prossimita[] }) {
  return (
    <div role="status" className="space-y-2">
      {vicine.map(({ discontinuita, distanza, superata }) => (
        <div
          key={discontinuita.imponibile + discontinuita.titolo}
          className="rounded border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <p className="font-semibold">
            {discontinuita.titolo} —{" "}
            {superata
              ? `soglia superata di ${euro(distanza)}`
              : `mancano ${euro(-distanza)} alla soglia`}
          </p>
          <p className="mt-1 leading-relaxed">{discontinuita.causa}</p>
          <p className="mt-1 leading-relaxed">
            Attraversare la soglia di {euro(discontinuita.imponibile)} di
            imponibile fiscale vale circa{" "}
            <strong className="font-semibold tabular-nums">
              {euro(discontinuita.effettoNetto)}
            </strong>{" "}
            di netto annuo: qui un aumento di RAL può lasciare in tasca meno di
            prima.
          </p>
          <p className="mt-1 text-xs text-amber-800">
            {discontinuita.riferimento}
          </p>
        </div>
      ))}
    </div>
  );
}
