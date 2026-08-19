// Banner PERMANENTE (§8 del brief): sempre visibile, mai chiudibile.
// Dice tre cose che non devono mai essere fraintese — è un prototipo, i
// parametri sono quelli dell'anno d'imposta 2026, non è consulenza fiscale —
// più il microcopy sul calcolo interamente lato client (argomento GDPR, §3).

export function BannerAvviso() {
  return (
    <div className="border-b border-stone-300 bg-stone-200/70 px-4 py-2 text-xs leading-relaxed text-stone-700">
      <p className="mx-auto max-w-5xl">
        <strong className="font-semibold text-stone-900">Prototipo</strong> —
        anno d'imposta <strong className="font-semibold">2026</strong>. I
        risultati sono indicativi e{" "}
        <strong className="font-semibold text-stone-900">
          non hanno alcun valore di consulenza fiscale
        </strong>
        : familiari a carico, premi detassati, fondi CCNL e ragguagli ad anno
        parziale non sono modellati (semplificazioni elencate in{" "}
        <code className="rounded bg-stone-300/60 px-1">docs/ASSUNZIONI.md</code>
        ). Il calcolo avviene interamente nel tuo browser: nessun dato
        retributivo viene inviato a un server.
      </p>
    </div>
  );
}
