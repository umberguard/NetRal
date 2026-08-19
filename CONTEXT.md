# NetRal — Calcolo RAL → Netto

Glossario del dominio fiscale del calcolatore RAL → netto per dipendenti italiani, anno d'imposta 2026. Solo definizioni: le semplificazioni stanno in `docs/ASSUNZIONI.md`, la mappa norma → codice in `docs/NORMATIVA.md`.

## Language

**RAL (Retribuzione Annua Lorda)**:
Il lordo annuo contrattuale del dipendente, base di partenza di ogni calcolo.
_Avoid_: lordo, stipendio lordo, gross salary

**Contributi INPS**:
I contributi previdenziali a carico del dipendente (IVS 9,19% + 1% oltre la prima fascia pensionabile), trattenuti sulla RAL.
_Avoid_: contributi sociali, oneri previdenziali

**Imponibile fiscale**:
RAL meno contributi INPS. È la base di IRPEF e addizionali, e la grandezza `R` su cui sono definite tutte le soglie di detrazioni e cuneo.
_Avoid_: reddito, imponibile (da solo), taxable income

**IRPEF lorda**:
L'imposta calcolata applicando gli scaglioni progressivi all'imponibile fiscale, prima delle detrazioni.

**Detrazione**:
Importo che si sottrae dall'IRPEF lorda (non dall'imponibile). Non genera mai credito: vale il vincolo di incapienza.
_Avoid_: confondere con deduzione o somma esente

**Deduzione**:
Importo che si sottrae dall'imponibile prima di calcolare l'imposta (es. i contributi INPS, ex art. 10 TUIR). Nel motore l'unica deduzione è quella dei contributi.

**Incapienza**:
La condizione in cui le detrazioni superano l'IRPEF lorda: l'eccedenza è persa, l'IRPEF netta è zero, mai negativa.

**Somma esente (cuneo)**:
Importo erogato in busta paga a chi ha imponibile ≤ 20.000 € (L. 207/2024): non è una detrazione, si somma al netto e non concorre al reddito. Calcolata "a scatti": una sola percentuale, scelta per fascia, applicata all'intero imponibile.
_Avoid_: bonus cuneo, detrazione cuneo (quella è l'ulteriore detrazione, misura distinta)

**Ulteriore detrazione (cuneo)**:
La seconda misura del cuneo fiscale (imponibile 20.000–40.000 €): questa sì è una detrazione, si sottrae dall'IRPEF lorda.

**Trattamento integrativo**:
Erogazione fino a 1.200 €/anno (ex bonus Renzi) per redditi bassi con capienza d'imposta. Come la somma esente, si aggiunge al netto: non riduce l'IRPEF.
_Avoid_: bonus Renzi (solo colloquiale), trattarlo come detrazione

**Addizionali**:
Addizionale regionale e comunale all'IRPEF, calcolate sull'imponibile fiscale. Nessuna detrazione le riduce.

**Soglia di esenzione (comunale)**:
Limite di imponibile sotto il quale l'addizionale comunale non è dovuta. È una soglia, non una franchigia: superata, l'addizionale si paga sull'intero imponibile, creando una discontinuità nel netto.
_Avoid_: franchigia

**Discontinuità**:
Punto del dominio in cui a un aumento della RAL corrisponde un netto più basso (soglie di esenzione comunale, scatti della somma esente, cliff del trattamento integrativo). Sono attese, note e testate: una discontinuità non in elenco è un bug.

**Netto annuo**:
RAL − trattenute (contributi, IRPEF netta, addizionali) + somme erogate (somma esente, trattamento integrativo).
_Avoid_: net retribution

**Mensilità**:
Numero di rate (12, 13 o 14) in cui il netto annuo viene diviso per ottenere il netto mensile.

**Comune**:
Elemento della matrice territoriale che determina addizionale regionale e comunale. Identificato da slug lowercase (`napoli`, `milano`), mai da sigla di provincia.
_Avoid_: sigle provincia come chiave (NA, MI), CodiceComune
