# Brief originale del take-home (copiato dalla chat il 19/08/2026)

> Documento di specifica di riferimento. Le deroghe concordate col committente sono negli ADR (`docs/adr/`) e annotate in `docs/ASSUNZIONI.md`. NON modificare questo file: è il testo sorgente.

---

## 0. Regola zero — leggi prima di scrivere codice

Questo progetto è un take-home per una posizione da **product builder**. Il committente ha scritto esplicitamente:

> "lo scopo del test non è capire quanto sei bravo ad usare lovable (o tools simili) ma verificare che hai costruito qualcosa di cui hai capito le logiche e di cui sei in controllo."

Quindi il tuo obiettivo **non è massimizzare la velocità di consegna**. È lasciarmi in una condizione in cui posso difendere ogni riga in un colloquio tecnico. Concretamente:

- **Non scrivere mai più di una fase alla volta** (vedi §10). Fermati e aspettami.
- **Non introdurre astrazioni, librerie o pattern che non ti ho chiesto** senza prima spiegarmi perché e ottenere il mio ok.
- Ogni costante normativa nel codice deve avere accanto il **riferimento di legge** e la **fonte**.
- Se una scelta è un'approssimazione, va scritta in `docs/ASSUNZIONI.md`, non nascosta nel codice.
- Se ti accorgi che una mia istruzione è tecnicamente sbagliata (fiscalmente o architetturalmente), **dimmelo e fermati**. Non implementarla in silenzio.

## 1. Prima cosa da fare: crea la skill `grill-me`

[FATTO — la skill vive in `.claude/skills/grill-me/SKILL.md` col contenuto richiesto: 5 domande a fine fase (localizzazione / comportamento ai bordi / motivazione / fonte / rottura), una alla volta, indizio prima della risposta completa, aggiornare `docs/gaps.md` a fine sessione, fermarsi dopo tre "non lo so" di fila.]

## 2. Cosa costruiamo

Un calcolatore **RAL → netto annuo e mensile** per dipendenti italiani, anno d'imposta **2026**, con breakdown completo di tutte le trattenute.

Due interfacce sopra lo stesso motore di calcolo:

| Pagina | Uso | Auth |
|---|---|---|
| `/` — pubblica | Un utente inserisce RAL + comune + mensilità, vede netto e breakdown | nessuna |
| `/batch` — interna | Un membro del team carica un CSV di RAL, riscarica lo stesso CSV con colonne aggiunte | gate cosmetico |

**Sul gate della pagina `/batch`**: è un semplice confronto di stringa lato client. **È deliberatamente finto** — è un prototipo per un colloquio, non un sistema in produzione, e non protegge nulla di reale. Non spacciarlo per sicurezza né in UI né nel README: scrivi esplicitamente che in produzione servirebbe un IdP (es. Cloudflare Access, o auth server-side). Non perdere tempo a "rinforzarlo" con hashing o offuscamento: peggiorerebbe soltanto, dando un'illusione di sicurezza.

## 3. Vincoli tecnici

- **Stack**: Vite + React + TypeScript. Tailwind per lo stile. Vitest per i test.
- **Zero backend.** Il CSV va parsato ed elaborato interamente nel browser (PapaParse). Nessun dato retributivo deve mai lasciare la macchina dell'utente — è un argomento GDPR che voglio poter fare in colloquio, quindi rendilo esplicito nel README e in un microcopy nella UI.
- **Deploy**: statico, gratuito. Configura per **Cloudflare Pages** (build `npm run build`, output `dist`), ma verifica che il build funzioni anche servito da sottocartella, così resta portabile su GitHub Pages. Aggiungi `.github/workflows/` solo se scelgo GitHub Pages — chiedimelo.
- **Nessuna dipendenza runtime oltre**: react, react-dom, papaparse. Se pensi ne serva un'altra, chiedi prima.

## 4. Architettura obbligatoria

```
src/
  engine/
    parametri-2026.ts      # SOLO dati. Nessuna logica. Ogni valore con fonte in commento.
    territorio.ts          # matrice addizionali regionali/comunali
    calcolo.ts             # funzione pura calcolaNetto(input) -> Breakdown
    tipi.ts
    calcolo.test.ts
  ui/
    PaginaPubblica.tsx
    PaginaBatch.tsx
    componenti/
  main.tsx
docs/
  ASSUNZIONI.md            # ogni semplificazione, con impatto stimato sul risultato
  NORMATIVA.md             # mappa norma -> riga di codice
  gaps.md                  # generato dalla skill grill-me
```

**Vincolo forte**: `src/engine/` non deve importare **nulla** da `src/ui/`, non deve toccare il DOM, non deve fare I/O. Deve essere eseguibile in Node puro. Se questo vincolo si rompe, l'architettura è sbagliata.

Firma della funzione principale:

```ts
type Input = {
  ral: number;
  comune: CodiceComune;   // DEROGA CONCORDATA: slug lowercase ('napoli' | 'salerno' | ...), non sigle
  mensilita: 12 | 13 | 14;
};

type Breakdown = {
  ral: number;
  contributiInps: { imponibile: number; quotaBase: number; quotaAggiuntiva1pct: number; totale: number };
  imponibileFiscale: number;
  irpef: {
    lorda: number;
    perScaglione: { da: number; a: number | null; aliquota: number; imposta: number }[];
    detrazioneLavoroDipendente: number;
    maggiorazione65: number;
    ulterioreDetrazioneCuneo: number;
    trattamentoIntegrativo: number;
    netta: number;
  };
  addizionali: { regionale: number; comunale: number; totale: number };
  sommaEsenteCuneo: number;      // erogata, NON trattenuta
  nettoAnnuo: number;
  nettoMensile: number;
  totaleTrattenute: number;
  cuneoFiscalePct: number;       // trattenute / ral
  tfrAccantonato: number;        // informativo, NON sottratto dal netto
  costoAziendaStimato: number;   // informativo
};
```

## 5. Specifica del motore — parametri normativi 2026

Implementa **esattamente** questa pipeline. Non cambiare l'ordine dei passaggi.

### 5.1 Contributi previdenziali a carico dipendente

Base = RAL intera.

| Parametro | Valore | Fonte |
|---|---|---|
| Aliquota IVS dipendente, settore privato | 9,19% | Circolare INPS aliquote 2026 |
| Aliquota aggiuntiva sulla quota eccedente la prima fascia pensionabile | +1% | art. 3-ter D.L. 384/1992 |
| Prima fascia pensionabile 2026 | 56.224 € | Circolare INPS n. 6/2026 |
| Massimale contributivo (iscritti post 1996) | 122.295 € | Circolare INPS 2026 |

```
contributi = min(RAL, 122.295) × 9,19%
           + max(0, min(RAL, 122.295) − 56.224) × 1%
```

### 5.2 Imponibile fiscale

`imponibile = RAL − contributi` (i contributi sono deducibili ex art. 10 TUIR).

### 5.3 IRPEF lorda — scaglioni progressivi (L. 199/2025 art. 1 co. 3)

| Da | A | Aliquota |
|---|---|---|
| 0 | 28.000 | 23% |
| 28.001 | 50.000 | **33%** (ridotta dal 35% dal 1.1.2026) |
| 50.001 | — | 43% |

Calcolo marginale: ogni aliquota si applica **solo** alla porzione di reddito nello scaglione. Popola `perScaglione` per poterlo mostrare in UI.

### 5.4 Detrazioni

**a) Detrazione lavoro dipendente — art. 13 co. 1 TUIR**, sull'imponibile `R`:

| R | Detrazione |
|---|---|
| ≤ 15.000 | 1.955 |
| 15.001 – 28.000 | `1.910 + 1.190 × (28.000 − R) / 13.000` |
| 28.001 – 50.000 | `1.910 × (50.000 − R) / 22.000` |
| > 50.000 | 0 |

⚠️ Il rapporto va **troncato alla quarta cifra decimale, senza arrotondamento**, prima della moltiplicazione. Implementalo davvero e mettici un test dedicato.

**b) Maggiorazione art. 13 co. 1.1 TUIR**: `+65 €` se `25.000 < R ≤ 35.000`.

**c) Cuneo fiscale — art. 1 co. 4 e co. 6 L. 207/2024, reso strutturale dalla L. 199/2025.** Due misure distinte:

- `R ≤ 20.000` → **somma esente**. [DEROGA CONCORDATA — ADR 0001: il brief la descriveva "progressiva per scaglioni", ma la norma (verificata su Normattiva) applica UNA percentuale all'INTERO reddito, a scatti: 7,1% se R ≤ 8.500; 5,3% se 8.500 < R ≤ 15.000; 4,8% se 15.000 < R ≤ 20.000. Va **sommata al netto**.]
- `20.000 < R ≤ 32.000` → **ulteriore detrazione** di 1.000 €.
- `32.000 < R ≤ 40.000` → `1.000 × (40.000 − R) / 8.000`.
- `R > 40.000` → 0.

**d) Trattamento integrativo** (ex bonus Renzi, 1.200 €/anno): approssimazione ammessa — riconoscilo per `R ≤ 15.000` **solo se** l'IRPEF lorda supera la detrazione art. 13 (condizione di capienza). Zero sopra i 15.000. Documenta in `ASSUNZIONI.md` che la casistica reale 15–28k è esclusa. [DECISIONE Q9b: è un'EROGAZIONE — non riduce `irpef.netta`, si somma al netto.]

**e) Vincolo di incapienza**: `IRPEF netta = max(0, lorda − detrazioni)`. Le detrazioni **non generano credito**. Test obbligatorio su questo.

### 5.5 Addizionali

Base = **imponibile fiscale**, non il netto, non la RAL. Nessuna detrazione si applica alle addizionali.

### 5.6 Risultato

```
totaleTrattenute = contributi + irpefNetta + addRegionale + addComunale
nettoAnnuo       = RAL − totaleTrattenute + sommaEsenteCuneo + trattamentoIntegrativo
nettoMensile     = nettoAnnuo / mensilita
tfrAccantonato   = RAL / 13,5        // informativo
costoAzienda     = RAL × 1,30 circa  // informativo, dichiara che è una stima grezza
```

## 6. Matrice territoriale — capoluoghi campani

Tabella dichiarativa in `territorio.ts`, non `if/else`. Banale aggiungere un comune.

### Addizionale regionale Campania 2026 — progressiva per scaglioni

Base 1,53% + maggiorazioni (L.R. Campania 7/2022, confermata per il 2026): 1,73% fino a 15.000; 2,96% 15.001–28.000; 3,20% 28.001–50.000; 3,33% oltre. Fonte: `entrate.regione.campania.it/ca/addizionale-irpef` [VERIFICATA 19/08/2026].

### Addizionale comunale — capoluoghi [TUTTE VERIFICATE su CSV MEF il 19/08/2026 — vedi NORMATIVA.md]

| Comune | Aliquota | Soglia esenzione | Stato |
|---|---|---|---|
| Napoli | 1,00% | 12.000 € | verificata (delibera n. 143/2023) |
| Salerno | 1,10% | **10.000 €** | verificata — IL BRIEF DICEVA "nessuna": diverge, vale il MEF (delibera n. 54 del 22/12/2025) |
| Avellino | 1,00% | 20.000 € | verificata (delibera n. 59/2024) |
| Caserta | 0,80% | nessuna | verificata (delibera n. 79/2023) — era DA VERIFICARE |
| Benevento | 0,80% | nessuna | verificata (delibera n. 22/2011) — era DA VERIFICARE |

### Riga di controllo: Milano

Lombardia 1,23% / 1,58% / 1,72% / 1,73% sugli scaglioni 15.000 / 28.000 / 50.000 [VERIFICATA]; comunale 0,80% con esenzione fino a 23.000 € [VERIFICATA, delibera n. 46/2020]. Serve per cross-check con i calcolatori online.

### ⚠️ Semantica dell'esenzione

La soglia di esenzione è una **soglia, non una franchigia**: superata la soglia l'addizionale è dovuta **sull'intero imponibile**. Produce una **discontinuità** nel netto. Va: (1) coperta da test ai bordi (`soglia − 0,01` e `soglia + 0,01`), (2) **visibile nella UI** con una nota quando l'utente ci cade vicino.

## 7. Casi di test obbligatori

Non sono oracoli certificati: calcolati a mano [RICONTROLLATI: coerenti con la pipeline]. Se il motore diverge, non aggiustare il test: fermati e confronta i calcoli passo-passo.

### Caso A — RAL 35.000, Milano, 13 mensilità

| Voce | Atteso |
|---|---|
| Contributi INPS | 3.216,50 |
| Imponibile fiscale | 31.783,50 |
| IRPEF lorda | 7.688,56 |
| Detrazione art. 13 | 1.581,48 |
| Maggiorazione 65 € | 65,00 |
| Ulteriore detrazione cuneo | 1.000,00 |
| IRPEF netta | 5.042,08 |
| Add. regionale Lombardia | 454,98 |
| Add. comunale Milano | 254,27 |
| **Netto annuo** | **26.032,17** |
| Netto mensile (÷13) | 2.002,47 |

### Caso B — RAL 35.000, Napoli, 13 mensilità

| Voce | Atteso |
|---|---|
| Add. regionale Campania | 765,37 |
| Add. comunale Napoli | 317,84 |
| **Netto annuo** | **25.658,21** |
| Netto mensile (÷13) | 1.973,71 |

### Bordi obbligatori (un test ciascuno)

`8.500` · `15.000 / 15.001` · `20.000 / 20.001` · `23.000` (Milano) · `12.000` (Napoli) · [AGGIUNTO: `10.000` (Salerno)] · `25.000 / 35.000` (maggiorazione 65 €) · `28.000 / 28.001` · `32.000` · `40.000` · `50.000 / 50.001` · `56.224` (1% INPS) · `122.295` (massimale) · `0` · valori negativi e non numerici.

### Test di proprietà

Il netto deve essere **monotono crescente** rispetto alla RAL su tutto il dominio 0–200.000, tranne alle discontinuità note. [DECISIONE Q8a: whitelist COMPLETA di tutte le discontinuità — soglie comunali + scatti somma esente (8.500, 15.000) + cliff trattamento integrativo (15.000) — ciascuna con commento sulla causa. Una violazione fuori whitelist è un bug da segnalare.]

## 8. Pagina pubblica `/`

- Input: RAL (numerico), comune (select dalla matrice), mensilità (12/13/14).
- Output: netto annuo e mensile in evidenza, poi **il breakdown completo come tabella a cascata**, dalla RAL al netto, con ogni voce nominata come compare in busta paga.
- Ogni voce del breakdown ha un tooltip/accordion con: **la formula applicata con i numeri sostituiti** (non la formula astratta) e il riferimento normativo.
- Sezione separata e visivamente distinta "**non incide sul netto**": TFR accantonato, contributi c/azienda, costo azienda stimato.
- Banner permanente: prototipo, anno d'imposta 2026, nessun valore di consulenza fiscale, link a `docs/ASSUNZIONI.md`.
- Aggiornamento in tempo reale, nessun bottone "calcola".
- Aspetto: niente template generico. Prima di scrivere JSX proporre in due righe una direzione visiva (tipografia + palette + densità). Deve sembrare uno strumento HR, non una landing SaaS.

## 9. Pagina batch `/batch`

- Gate: campo password, confronto con costante `DEMO_PASSWORD` esportata da un file. Commento sopra la costante che dichiara che è cosmetica e perché va bene così.
- Upload CSV drag & drop. PapaParse, `header: true`.
- **Riconoscimento colonne tollerante**: `RAL`, `ral`, `Retribuzione Lorda Annua`, `lordo`… Se non trovata: mostra le colonne trovate e chiedi mapping via select. Non fallire in silenzio.
- Colonne opzionali `comune` e `mensilita`; se assenti, valori da due select globali.
- Output: CSV originale **con tutte le colonne di input preservate nell'ordine originale**, più in coda: `contributi_inps`, `imponibile_fiscale`, `irpef_lorda`, `detrazioni_totali`, `irpef_netta`, `addizionale_regionale`, `addizionale_comunale`, `netto_annuo`, `netto_mensile`, `totale_trattenute`, `cuneo_fiscale_pct`, `note`.
- `note`: warning per riga (RAL mancante/non numerica, comune non in matrice, soglia esenzione vicina). **Righe con errore non bloccano il file**: colonne calcolate vuote e nota valorizzata.
- Anteprima prime 10 righe prima del download.
- Separatore: rileva `,` vs `;` in input e **riusa lo stesso** in output. Decimali: rispetta la convenzione del file di input.
- Microcopy: "l'elaborazione avviene interamente nel tuo browser, nessun dato viene inviato a server".

## 10. Piano di lavoro — fermati a ogni fase

Una fase alla volta. Al termine: mostra il diff, poi **invoca `grill-me`**. Non passare oltre finché non arriva "avanti".

| Fase | Contenuto | Cancello | Stato |
|---|---|---|---|
| 0 | Skill grill-me + scaffold Vite/TS/Tailwind/Vitest + docs/ vuoti | build gira | ✅ FATTA + grigliata |
| 1 | parametri-2026.ts + territorio.ts + verifica MEF | dati verificati, fonti citate | ✅ FATTA + grigliata |
| 2 | calcolo.ts — solo contributi e imponibile | test verdi | ✅ FATTA + grigliata |
| 3 | IRPEF lorda + detrazioni + incapienza | Casi A/B passano sulla parte IRPEF | ✅ FATTA + grigliata |
| 4 | Addizionali + breakdown completo | Casi A/B passano interamente | ✅ FATTA |
| 5 | Test ai bordi + test di proprietà | tutti verdi, nessuna violazione inattesa | ✅ FATTA |
| 6 | Pagina pubblica | funzionante | ✅ FATTA |
| 7 | Pagina batch + CSV | round-trip di un CSV di prova | ✅ FATTA |
| 8 | docs/ completi + README + deploy Cloudflare Pages | live | ✅ FATTA (deploy su GitHub Pages, scelto dal committente) |

Alla fase 8, `ASSUNZIONI.md` deve coprire almeno: aliquota INPS fissa 9,19%, familiari a carico esclusi, trattamento integrativo approssimato, 13ª/14ª come divisore invece che tassata ad aliquota marginale, addizionali per competenza invece che per cassa, anno intero senza ragguaglio, nessun fondo sanitario/previdenza complementare CCNL, nessun premio detassato.

## 11. Domande preliminari

[FATTE — decisioni Q7–Q12 recepite: deroga somma esente in `docs/adr/0001`, whitelist di monotonia nel test di proprietà (`calcolo.test.ts`), trattamento integrativo come erogazione e slug lowercase implementati, glossario in `CONTEXT.md`.]
