// Modulo di input: RAL, comune, mensilità. Nessun bottone "calcola" — la
// pagina ricalcola a ogni modifica (§8 del brief): il motore costa microsecondi.

import { COMUNI, type SlugComune } from "../../engine/territorio";

export type MensilitaAmmesse = 12 | 13 | 14;

const MENSILITA: readonly MensilitaAmmesse[] = [12, 13, 14];

/** Slug dei comuni della matrice territoriale, in ordine alfabetico di nome. */
const SLUG_COMUNI = (Object.keys(COMUNI) as SlugComune[]).sort((a, b) =>
  COMUNI[a].nome.localeCompare(COMUNI[b].nome, "it"),
);

// Esportate perché anche la pagina batch ha campi e etichette: due pagine
// dello stesso strumento devono avere gli stessi input, e una costante
// condivisa costa meno di un file di stili in più.
export const CAMPO =
  "w-full rounded border border-stone-400 bg-white px-3 py-2 text-sm text-stone-900 " +
  "focus:border-blue-900 focus:ring-2 focus:ring-blue-900/30 focus:outline-none";

export const ETICHETTA =
  "block text-xs font-semibold tracking-wide text-stone-600 uppercase";

type Props = {
  ralTesto: string;
  onRalTesto: (valore: string) => void;
  comune: SlugComune;
  onComune: (valore: SlugComune) => void;
  mensilita: MensilitaAmmesse;
  onMensilita: (valore: MensilitaAmmesse) => void;
};

export function ModuloInput({
  ralTesto,
  onRalTesto,
  comune,
  onComune,
  mensilita,
  onMensilita,
}: Props) {
  return (
    <form
      // La RAL è un numero di sei cifre: non serve una colonna elastica.
      className="grid grid-cols-1 gap-4 sm:grid-cols-[10rem_minmax(0,1fr)_auto]"
      // niente submit: il risultato è già aggiornato a ogni battuta
      onSubmit={(evento) => evento.preventDefault()}
    >
      <div>
        <label className={ETICHETTA} htmlFor="ral">
          RAL annua
        </label>
        <input
          id="ral"
          className={`${CAMPO} mt-1 tabular-nums`}
          // `text` e non `number`: accetta "35.000" e "35.000,50" senza che il
          // browser li rifiuti, la lettura è in formato.ts → leggiRal.
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="35.000"
          value={ralTesto}
          onChange={(evento) => onRalTesto(evento.target.value)}
        />
      </div>

      <div>
        <label className={ETICHETTA} htmlFor="comune">
          Comune
        </label>
        <select
          id="comune"
          className={`${CAMPO} mt-1`}
          value={comune}
          onChange={(evento) => onComune(evento.target.value as SlugComune)}
        >
          {SLUG_COMUNI.map((slug) => (
            <option key={slug} value={slug}>
              {COMUNI[slug].nome}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={ETICHETTA} htmlFor="mensilita">
          Mensilità
        </label>
        <select
          id="mensilita"
          className={`${CAMPO} mt-1 tabular-nums sm:w-24`}
          value={mensilita}
          onChange={(evento) =>
            onMensilita(Number(evento.target.value) as MensilitaAmmesse)
          }
        >
          {MENSILITA.map((numero) => (
            <option key={numero} value={numero}>
              {numero}
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}
