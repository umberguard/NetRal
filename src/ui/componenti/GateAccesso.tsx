// Gate cosmetico della pagina batch (§2 del brief).
//
// Il confronto è in chiaro con la costante `DEMO_PASSWORD` e non protegge
// nulla: la spiegazione lunga sta in `src/ui/accesso.ts`. Qui la pagina lo
// dice anche all'utente, in chiaro — un gate finto spacciato per vero è
// peggio di nessun gate.

import { useState } from "react";
import { DEMO_PASSWORD } from "../accesso";
import { CAMPO } from "./ModuloInput";

export function GateAccesso({ onSblocco }: { onSblocco: () => void }) {
  const [password, setPassword] = useState("");
  const [sbagliata, setSbagliata] = useState(false);

  return (
    <form
      className="mx-auto max-w-md rounded border border-stone-300 bg-white p-5"
      onSubmit={(evento) => {
        evento.preventDefault();
        if (password === DEMO_PASSWORD) onSblocco();
        else setSbagliata(true);
      }}
    >
      <h2 className="text-sm font-semibold tracking-wide text-stone-900 uppercase">
        Area interna — elaborazione batch
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">
        Pagina riservata al team. La password della demo è{" "}
        <code className="rounded bg-stone-200 px-1 tabular-nums">
          {DEMO_PASSWORD}
        </code>
        .
      </p>

      <label
        className="mt-4 block text-xs font-semibold tracking-wide text-stone-600 uppercase"
        htmlFor="password"
      >
        Password
      </label>
      <input
        id="password"
        className={`${CAMPO} mt-1`}
        type="password"
        autoComplete="off"
        value={password}
        onChange={(evento) => {
          setPassword(evento.target.value);
          setSbagliata(false);
        }}
      />

      {sbagliata && (
        <p
          role="alert"
          className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900"
        >
          Password errata.
        </p>
      )}

      <button
        type="submit"
        className="mt-4 w-full rounded bg-blue-900 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus:ring-2 focus:ring-blue-900/40 focus:outline-none"
      >
        Entra
      </button>

      <p className="mt-4 border-t border-stone-200 pt-3 text-xs leading-relaxed text-stone-600">
        <strong className="font-semibold text-stone-900">
          Questo controllo è finto.
        </strong>{" "}
        È un confronto di stringa nel browser e la password sta nel codice
        servito alla pagina: chiunque può leggerla. Non protegge nulla e non va
        letto come una misura di sicurezza. In produzione la pagina starebbe
        dietro un identity provider (es. Cloudflare Access) o un'autenticazione
        server-side.
      </p>
    </form>
  );
}
