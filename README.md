# NetRal — calcolatore RAL → netto, anno d'imposta 2026

Calcolatore da RAL a netto annuo e mensile per dipendenti italiani, con il breakdown
completo delle trattenute: contributi INPS, IRPEF per scaglioni, detrazioni, cuneo fiscale,
addizionale regionale e comunale. Due pagine sopra un unico motore di calcolo:

| Pagina | A cosa serve |
|---|---|
| `/` — pubblica | RAL + comune + mensilità → netto e cascata completa dalla RAL al netto, con la formula applicata e il riferimento normativo di ogni voce |
| `#/batch` — interna | Si carica un CSV di RAL, si riscarica lo stesso CSV con le colonne calcolate in coda |

**Demo**: https://umberguard.github.io/NetRal/ — la pagina batch è su
https://umberguard.github.io/NetRal/#/batch (password `DEMO_PASSWORD`, vedi
[Il gate della pagina batch](#il-gate-della-pagina-batch-è-finto-e-va-detto)).

Le rotte usano l'hash e non il path perché il sito è statico: un ricaricamento su `/batch`
chiederebbe all'hosting un file che non esiste, e servirebbe una regola di rewrite diversa
per ogni provider.

## Nessun dato retributivo lascia la macchina di chi lo usa

Non c'è backend. Non c'è un endpoint a cui inviare la RAL, non c'è un upload del CSV: il
calcolo e il parsing del file avvengono **interamente nel browser**, e il file di esito è
generato in pagina come Blob e scaricato dal browser stesso. Il sito è un bundle di file
statici; dopo il caricamento della pagina non parte più una sola richiesta di rete.

Per uno strumento che tratta stipendi questa non è una limitazione, è la scelta di
progetto più importante. Una tabella di RAL nominative è un insieme di dati personali di
categoria ordinaria ma ad alto impatto: caricarla su un server significherebbe individuare
un titolare del trattamento e una base giuridica, definire tempi di conservazione,
inventariare l'ubicazione dei dati, gestire un data breach se quel server viene violato.
Qui niente di tutto questo esiste, perché **il dato non si sposta**: resta nella memoria
della scheda del browser e sparisce alla chiusura. È privacy by design nel senso letterale
dell'art. 25 GDPR — il modo più solido di proteggere un dato è non riceverlo.

Conseguenza pratica: chi usa la pagina batch può lavorare su un file di RAL reali senza
chiedere autorizzazioni a nessuno, e senza che il file esca dal suo computer.

## Architettura

```
src/
  engine/            # puro: nessun import da ui/, nessun DOM, nessun I/O — gira in Node
    parametri-2026.ts  SOLO dati: aliquote, scaglioni, soglie. Ogni valore con la fonte accanto
    territorio.ts      SOLO dati: matrice addizionali regionali/comunali (chiavi slug: napoli, milano…)
    calcolo.ts         funzioni pure. calcolaNetto(input) -> Breakdown
    tipi.ts
    calcolo.test.ts
  ui/                # React: pagine, formattazione it-IT, lettura/scrittura CSV
    PaginaPubblica.tsx  PaginaBatch.tsx  componenti/
    formato.ts  cascata.ts  discontinuita.ts  csv.ts  accesso.ts  csv.test.ts
  main.tsx           # routing a hash, due rotte, nessun router
docs/                # ASSUNZIONI, NORMATIVA, BRIEF, adr/
```

Tre vincoli che reggono tutto il resto:

**I dati normativi sono separati dalla logica.** `parametri-2026.ts` e `territorio.ts`
contengono solo tabelle; `calcolo.ts` contiene solo funzioni pure che le leggono.
Aggiornare il calcolatore all'anno d'imposta 2027 significa toccare le tabelle, non le
formule. Aggiungere un comune alla matrice territoriale è **una riga** — i tipi sono
derivati dai dati con `keyof typeof`, quindi il compilatore aggiorna da sé la select della
pagina e i test.

**Ogni costante ha il riferimento di legge accanto**, nel commento sopra il valore, e una
riga in [`docs/NORMATIVA.md`](docs/NORMATIVA.md) che dice quale norma finisce in quale
costante, con la fonte e la data di verifica. Le aliquote comunali sono state riscontrate
sul CSV ufficiale MEF, non copiate dal brief: su Salerno il dato ufficiale diverge dal
testo del brief e il codice segue il MEF.

**Il motore è testato per davvero**: 111 test (91 sul motore, 20 sulla logica CSV, che è
anch'essa pura e testata in Node). Oltre ai due casi di riferimento e ai bordi di ogni
soglia, c'è un **test di proprietà sulla monotonia**: il netto deve crescere al crescere
della RAL su tutto il dominio 0–200.000 € e per ogni comune, scansione a passo fitto e
finestra a passo di 1 € attorno a ogni soglia nota. Le uniche eccezioni ammesse sono in una
**whitelist esplicita** di discontinuità, ognuna con l'importo del salto e la causa
normativa: soglie di esenzione comunali, scatti della somma esente, cliff del trattamento
integrativo, fine della maggiorazione di 65 €. Un calo del netto fuori da quella lista fa
fallire il test con comune, RAL e ampiezza del salto — è un bug, non un caso da aggiungere.

Vitest gira con `environment: "node"`, non jsdom: se un giorno l'engine toccasse il DOM,
i test esploderebbero invece di passare per caso.

## Documentazione

- [`docs/ASSUNZIONI.md`](docs/ASSUNZIONI.md) — ogni semplificazione del modello, con il
  perché e **quanto sbaglia in euro** su una RAL di 35.000. È il documento da leggere per
  primo se un numero non torna.
- [`docs/NORMATIVA.md`](docs/NORMATIVA.md) — mappa norma → costante nel codice, con fonte e
  data di verifica.
- [`docs/adr/`](docs/adr/) — le decisioni difficili da invertire. Al momento una:
  [la somma esente del cuneo è calcolata "a scatti"](docs/adr/0001-somma-esente-a-scatti.md),
  in deroga al brief, perché è quello che dice il testo di legge.
- [`CONTEXT.md`](CONTEXT.md) — glossario del dominio: detrazione contro deduzione, soglia
  contro franchigia, erogazione contro trattenuta. I termini usati nel codice sono questi.
- [`docs/BRIEF.md`](docs/BRIEF.md) — la specifica di partenza, con annotate le deroghe
  concordate.

`docs/` sta nel repository ma **non** nel sito pubblicato (la build pubblica solo `dist/`):
per questo il banner in pagina cita il percorso `docs/ASSUNZIONI.md` come testo invece di
linkarlo.

## Il gate della pagina batch è finto, e va detto

La password della pagina `#/batch` è la costante `DEMO_PASSWORD` esportata da
`src/ui/accesso.ts`, il cui valore è la stringa `"DEMO_PASSWORD"`. Il confronto avviene
lato client, contro una costante che finisce nel bundle JavaScript servito al browser:
chiunque apra i sorgenti della pagina la legge in chiaro in dieci secondi.

**Non protegge nulla, e non è un difetto da correggere in questa versione**: serve a
mostrare in una demo che le due pagine hanno pubblici diversi. Non è stato "rinforzato" con
un hash o un offuscamento di proposito — un hash confrontato lato client si legge insieme
al confronto, e l'unico effetto sarebbe dare l'illusione di una protezione. In produzione
la pagina starebbe dietro un identity provider (Cloudflare Access, o un auth server-side
con sessione firmata): la verifica deve avvenire dove l'utente non arriva.

## Comandi

```bash
npm ci        # installa le dipendenze bloccate dal lockfile
npm run dev   # dev server Vite
npm test      # Vitest, esecuzione singola (111 test)
npm run build # tsc --noEmit && vite build  → il type-check blocca il deploy
```

Dipendenze runtime: `react`, `react-dom`, `papaparse`. Nient'altro — il routing, la
formattazione it-IT e il calcolo sono scritti a mano.

Il deploy su GitHub Pages è automatico via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
a ogni push su `main` (build solo se i test passano). `vite.config.ts` usa `base: "./"`,
quindi il bundle funziona sia servito dalla radice di un dominio sia da una sottocartella
come `/NetRal/`.

## Limiti dichiarati

- **Non è consulenza fiscale.** È un prototipo: i risultati sono indicativi e vanno
  verificati su una busta paga reale prima di prendere qualunque decisione.
- **Anno d'imposta 2026**, con i parametri verificati ad agosto 2026. Aliquote comunali e
  regionali cambiano per delibera: vanno ricontrollate ogni anno sugli elenchi MEF.
- **Sei comuni** in matrice — i cinque capoluoghi campani più Milano come riga di controllo
  per il confronto con i calcolatori online.
- **Non sono modellati**: familiari a carico, premi di produttività detassati, fondi
  sanitari e previdenza complementare da CCNL, ragguaglio ad anno parziale, varianti di
  aliquota INPS per qualifica o settore. Ognuna di queste voci, con l'errore che introduce
  in euro, è in [`docs/ASSUNZIONI.md`](docs/ASSUNZIONI.md).
