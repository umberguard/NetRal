import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { PaginaBatch } from "./ui/PaginaBatch";
import { PaginaPubblica } from "./ui/PaginaPubblica";

type Rotta = "pubblica" | "batch";

/**
 * La rotta corrente, letta dall'hash: `#/batch` → pagina batch, tutto il resto
 * → pagina pubblica.
 *
 * Perché l'hash e non il path vero (`/batch`, come li nomina il brief §2):
 * il sito è statico e con `base: "./"` deve restare portabile anche in
 * sottocartella. Con i path veri un ricaricamento su `/batch` chiederebbe al
 * server un file che non esiste, e servirebbe una regola di rewrite diversa
 * per ogni hosting. L'hash non arriva mai al server.
 *
 * Perché non react-router: due rotte e nessun parametro non giustificano una
 * dipendenza runtime in più (§3 del brief ne ammette tre in tutto).
 */
function rottaCorrente(): Rotta {
  const percorso = window.location.hash.replace(/^#\/?/, "");
  return percorso === "batch" ? "batch" : "pubblica";
}

function App() {
  const [rotta, setRotta] = useState<Rotta>(rottaCorrente);

  useEffect(() => {
    const aggiorna = () => setRotta(rottaCorrente());
    window.addEventListener("hashchange", aggiorna);
    return () => window.removeEventListener("hashchange", aggiorna);
  }, []);

  return rotta === "batch" ? <PaginaBatch /> : <PaginaPubblica />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
