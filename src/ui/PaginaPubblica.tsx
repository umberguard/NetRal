// Pagina pubblica `/` — §8 del brief.
//
// Tiene lo stato dei tre input e orchestra: lettura della RAL → motore →
// cascata + nota di prossimità. Nessuna logica fiscale vive qui: le formule
// stanno in `src/engine/`, le stringhe che le raccontano in `cascata.ts`.
//
// La UI importa dal motore, mai il contrario (vincolo forte, brief §4).

import { useMemo, useState } from "react";
import { calcolaNetto } from "../engine/calcolo";
import type { SlugComune } from "../engine/territorio";
import type { Breakdown } from "../engine/tipi";
import { costruisciCascata, costruisciInformative } from "./cascata";
import { discontinuitaVicine } from "./discontinuita";
import { euro, leggiRal } from "./formato";
import { BannerAvviso } from "./componenti/BannerAvviso";
import { CascataBreakdown } from "./componenti/CascataBreakdown";
import {
  ModuloInput,
  type MensilitaAmmesse,
} from "./componenti/ModuloInput";
import { NotaProssimita } from "./componenti/NotaProssimita";

/**
 * Esito del calcolo per la pagina: o un Breakdown, o un motivo per cui non
 * c'è. Il motore lancia `RangeError` sugli input fuori dominio (RAL negativa):
 * qui l'eccezione diventa un messaggio, mai una pagina bianca.
 */
type Esito =
  | { stato: "vuoto" }
  | { stato: "errore"; messaggio: string }
  | { stato: "ok"; breakdown: Breakdown };

function calcola(
  ral: number | null,
  testoGrezzo: string,
  comune: SlugComune,
  mensilita: MensilitaAmmesse,
): Esito {
  if (ral === null) {
    return testoGrezzo.trim() === ""
      ? { stato: "vuoto" }
      : { stato: "errore", messaggio: "La RAL inserita non è un numero." };
  }
  try {
    return { stato: "ok", breakdown: calcolaNetto({ ral, comune, mensilita }) };
  } catch (errore) {
    return {
      stato: "errore",
      // Il messaggio del motore ("RAL negativa", "RAL non finita") è già
      // scritto per essere letto: si mostra così com'è, senza reinventarlo qui.
      messaggio:
        errore instanceof RangeError
          ? `${errore.message}.`
          : "Impossibile calcolare il netto per questo valore.",
    };
  }
}

export function PaginaPubblica() {
  // Valori iniziali: il Caso B del brief (§7), così la pagina apre già con un
  // esempio verificato invece che con una tabella vuota.
  const [ralTesto, setRalTesto] = useState("35.000");
  const [comune, setComune] = useState<SlugComune>("napoli");
  const [mensilita, setMensilita] = useState<MensilitaAmmesse>(13);

  const ral = leggiRal(ralTesto);
  // Il calcolo costa microsecondi: `useMemo` serve solo a non rifare le
  // stringhe della cascata a ogni render di React, non per prestazioni.
  const esito = useMemo(
    () => calcola(ral, ralTesto, comune, mensilita),
    [ral, ralTesto, comune, mensilita],
  );

  const breakdown = esito.stato === "ok" ? esito.breakdown : null;
  const vicine =
    breakdown === null
      ? []
      : discontinuitaVicine(breakdown.imponibileFiscale, comune);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <BannerAvviso />

      <main className="mx-auto max-w-5xl px-4 py-6">
        <header className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              NetRal — da RAL a netto, anno d'imposta 2026
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              Ogni voce riporta la formula applicata con i numeri sostituiti e
              la norma che la regge.
            </p>
          </div>
          {/* Rotta interna: la pagina batch è dietro un gate (cosmetico). */}
          <a
            className="text-sm text-blue-900 underline underline-offset-2"
            href="#/batch"
          >
            Elaborazione batch →
          </a>
        </header>

        <div className="mb-6 rounded border border-stone-300 bg-white p-4">
          <ModuloInput
            ralTesto={ralTesto}
            onRalTesto={setRalTesto}
            comune={comune}
            onComune={setComune}
            mensilita={mensilita}
            onMensilita={setMensilita}
          />
        </div>

        {esito.stato === "vuoto" && (
          <p className="rounded border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-stone-500">
            Inserisci una RAL per vedere il calcolo.
          </p>
        )}

        {esito.stato === "errore" && (
          <p
            role="alert"
            className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
          >
            {esito.messaggio} Ammessi i valori da 0 in su, con la virgola come
            separatore decimale.
          </p>
        )}

        {breakdown !== null && (
          <div className="space-y-6">
            <section className="grid grid-cols-1 gap-px overflow-hidden rounded border border-blue-900/30 bg-blue-900/20 sm:grid-cols-2">
              <div className="bg-white px-4 py-4">
                <p className="text-xs font-semibold tracking-wide text-stone-600 uppercase">
                  Netto annuo
                </p>
                <p className="mt-1 text-3xl font-semibold text-blue-900 tabular-nums">
                  {euro(breakdown.nettoAnnuo)}
                </p>
              </div>
              <div className="bg-white px-4 py-4">
                <p className="text-xs font-semibold tracking-wide text-stone-600 uppercase">
                  Netto mensile · {mensilita} mensilità
                </p>
                <p className="mt-1 text-3xl font-semibold text-blue-900 tabular-nums">
                  {euro(breakdown.nettoMensile)}
                </p>
              </div>
            </section>

            {/* Sempre montata, anche vuota: `role="status"` annuncia le note
                che compaiono mentre l'utente digita. */}
            <NotaProssimita vicine={vicine} />

            <CascataBreakdown
              titolo="Dalla RAL al netto"
              voci={costruisciCascata(breakdown, {
                ral: breakdown.ral,
                comune,
                mensilita,
              })}
            />

            <CascataBreakdown
              titolo="Non incide sul netto"
              descrizione="Voci informative: non sono trattenute in busta paga e non entrano nel netto annuo."
              voci={costruisciInformative(breakdown)}
            />
          </div>
        )}
      </main>
    </div>
  );
}
