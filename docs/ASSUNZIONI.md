# Assunzioni e semplificazioni

Ogni voce documenta: **cosa** è stato semplificato, **perché**, e **quanto sbaglia** in euro su una RAL di 35.000 (dove la voce non incide su quella RAL, lo dice).

## Emerse in fase 1 (dati e parametri)

### Massimale contributivo applicato a tutti
- **Cosa**: il tetto di 122.295 € alla base contributiva vale per legge solo per gli iscritti a gestioni previdenziali dal 1/1/1996; il motore lo applica a chiunque.
- **Perché**: la data di prima iscrizione non è un input del calcolatore.
- **Impatto su RAL 35.000**: zero (il massimale morde solo sopra 122.295 € di RAL; lì, per un ante-1996, il motore sottostima i contributi e sovrastima il netto).

### Neutralizzazione del taglio IRPEF sopra 200.000 € non modellata
- **Cosa**: la L. 199/2025 sterilizza il beneficio dell'aliquota al 33% (max ~440 €) per redditi complessivi oltre 200.000 €; il motore non lo fa.
- **Perché**: con il dominio dichiarato (RAL fino a 200.000) l'imponibile massimo è ~188.100 € — la soglia non viene mai raggiunta.
- **Impatto su RAL 35.000**: zero; zero su tutto il dominio testato.

## Emerse in fase 4 (addizionali e assemblaggio)

### Ordine degli arrotondamenti: i totali sommano voci già arrotondate
- **Cosa**: il motore calcola tutto in piena precisione, poi arrotonda al centesimo ogni voce del Breakdown; i totali (IRPEF lorda, contributi, addizionali, `totaleTrattenute`, `nettoAnnuo`) sono la **somma delle voci arrotondate**, non l'arrotondamento del totale in piena precisione (`arrotonda2` + `calcolaNetto` in `calcolo.ts`).
- **Perché**: è il criterio della busta paga — si sommano importi liquidati al centesimo, non decimali infiniti — ed è l'unico che fa tornare la cascata mostrata in UI riga per riga. Con l'ordine opposto la somma delle voci visibili non corrisponderebbe al netto visibile.
- **Impatto su RAL 35.000**: **1 centesimo l'anno**. Caso A (Milano) 26.032,17 contro 26.032,18; Caso B (Napoli) 25.658,21 contro 25.658,22. I valori qui riportati sono quelli del brief §7.

### Addizionale comunale dovuta sull'intero imponibile fiscale annuo
- **Cosa**: superata la soglia di esenzione, l'aliquota comunale si applica all'intero imponibile fiscale dell'anno, senza ragguaglio a giorni né distinzione tra acconto e saldo.
- **Perché**: il motore ragiona per competenza su un anno intero di lavoro (vedi voce sulle addizionali per competenza qui sotto); acconto e saldo sono un fatto di cassa dell'anno successivo.
- **Impatto su RAL 35.000**: zero sull'importo annuo dovuto; cambia solo *quando* viene trattenuto.

### Costo azienda: moltiplicatore forfettario 1,30
- **Cosa**: `costoAziendaStimato = RAL × 1,30`, come indicato dal brief §5.6.
- **Perché**: il costo reale dipende da CCNL, settore, dimensione aziendale e agevolazioni; nessuno di questi è un input del calcolatore. È una voce dichiaratamente informativa, mostrata nella sezione "non incide sul netto".
- **Impatto su RAL 35.000**: nessuno sul netto (non entra in alcun calcolo). La stima 45.500 € può discostarsi di alcune migliaia di euro dal costo effettivo.

## Emerse in fase 5 (test ai bordi e di proprietà)

### Tolleranza di un centesimo nei confronti di monotonia
- **Cosa**: il test di proprietà pretende `netto(RAL + passo) ≥ netto(RAL) − 0,011 €`, non `≥ netto(RAL)` (`EPSILON_ARROTONDAMENTO` in `calcolo.test.ts`).
- **Perché**: con l'ordine di arrotondamento adottato in fase 4 (ogni voce al centesimo, i totali sommano voci arrotondate) il netto oscilla di ±1 centesimo attorno alla curva "liscia" — due voci possono arrotondarsi entrambe per difetto un euro di RAL più in là. Non è una discontinuità e non entra nella whitelist: allargare la whitelist per un centesimo nasconderebbe i gradini veri.
- **Impatto su RAL 35.000**: nessuno sul risultato; è solo la sensibilità del test. Il gradino più piccolo che il motore produce davvero (0,19 €, voce seguente) resta ben sopra la soglia.

### Micro-discontinuità di 0,19 € a 28.000 € di imponibile
- **Cosa**: attraversando 28.000 € di imponibile la detrazione art. 13 passa dalla lettera b) alla lettera c) e cala di 0,191 € di colpo (`1.910 + 1.190 × 0` = 1.910 contro `1.910 × 0,9999` = 1.909,809), quindi il netto cala di altrettanto.
- **Perché**: è il troncamento del rapporto alla quarta cifra decimale imposto dal brief §5.4 e dalla prassi ministeriale. Il rapporto della lettera c) appena sopra 28.000 vale 0,9999995…, troncato a 0,9999: un decimillesimo perso su una base di 1.910 €. Con l'arrotondamento — vietato dalla norma — il gradino non ci sarebbe.
- **Impatto su RAL 35.000**: zero (la soglia è a 30.834 € di RAL). Dove morde vale 0,19 € l'anno, meno di 2 centesimi al mese.

### Discontinuità a 35.000 € di imponibile (maggiorazione art. 13 co. 1.1)
- **Cosa**: non è un'approssimazione ma un gradino della norma, censito qui perché mancava dalla tabella di fase 4: superati i 35.000 € di imponibile si perdono per intero i 65 € di maggiorazione, senza décalage. Il netto cala di 65 €.
- **Perché**: art. 13 co. 1.1 TUIR concede la maggiorazione solo per `25.000 < R ≤ 35.000`. Il motore la applica alla lettera; è in whitelist con test dedicato.
- **Impatto su RAL 35.000**: zero (imponibile 31.783,50, sotto la soglia). Morde a RAL 38.542.

## Emerse in fase 7 (pagina batch CSV)

Nessuna di queste tocca il calcolo: sono scelte di lettura e di scrittura del file, dichiarate qui perché cambiano *quello che si legge* nell'esito.

### Convenzione decimale dedotta dal separatore quando il file non la dichiara
- **Cosa**: se nel CSV caricato nessun valore contiene un decimale (solo `35000`, mai `35000,50` né `35000.50`), l'esito usa la virgola decimale quando il separatore di campo è `;` e il punto quando è `,` (`rilevaDecimale` in `src/ui/csv.ts`).
- **Perché**: il file non dice nulla e una convenzione va scelta comunque. `;` è la forma con cui Excel italiano esporta, e accompagna la virgola decimale; `,` come separatore di campo esclude la virgola decimale non quotata. La disambiguazione del punto è la stessa di `leggiRal` (`35.000` è trentacinquemila, non 35).
- **Impatto su RAL 35.000**: zero sui numeri; cambia solo la resa (`25658,21` contro `25658.21`).

### Numeri dell'esito senza separatore delle migliaia
- **Cosa**: le colonne calcolate sono scritte con due decimali fissi e nessun separatore delle migliaia (`25658,21`, non `25.658,21`).
- **Perché**: il CSV è un formato di scambio, non una stampa. Un `25.658,21` riletto da uno strumento che assume il punto decimale diventa 25,658: il separatore delle migliaia in un CSV è un rischio, non un servizio. La formattazione all'italiana resta nella pagina pubblica.
- **Impatto su RAL 35.000**: zero.

### `detrazioni_totali` non comprende le erogazioni; il netto non è ricostruibile dalle sole colonne
- **Cosa**: `detrazioni_totali` somma le tre detrazioni (art. 13, maggiorazione 65 €, ulteriore detrazione cuneo). Somma esente del cuneo e trattamento integrativo **non** sono colonne dell'esito, perché il tracciato del brief (§9) non le prevede.
- **Perché**: sono erogazioni, non detrazioni — si sommano al netto e non riducono l'IRPEF (vedi `CONTEXT.md`); metterle in `detrazioni_totali` sarebbe un errore di dominio. Conseguenza da conoscere: per RAL basse `netto_annuo` è più alto della differenza fra le colonne mostrate, ed è corretto così. Il dettaglio completo di quelle due voci si vede nella pagina pubblica.
- **Impatto su RAL 35.000**: zero (entrambe le erogazioni sono nulle a quell'imponibile). Morde sotto i 20.000 € di imponibile.

### `cuneo_fiscale_pct` in punti percentuali
- **Cosa**: la colonna riporta `26,69` per un cuneo del 26,69%, non `0,2669` (il `Breakdown` tiene la frazione).
- **Perché**: il suffisso `_pct` promette punti percentuali, ed è la forma che un foglio di calcolo somma e media senza sorprese.
- **Impatto su RAL 35.000**: zero sul calcolo.

### Riconoscimento delle colonne per elenco chiuso di alias
- **Cosa**: le intestazioni sono confrontate, dopo normalizzazione (minuscole, accenti e punteggiatura tolti), con un elenco fisso di alias (`ALIAS` in `src/ui/csv.ts`). Nessuna somiglianza approssimata.
- **Perché**: un riconoscimento "intelligente" che sbaglia colonna calcolerebbe stipendi sul numero di matricola senza dirlo. Se l'alias non c'è la pagina mostra le colonne trovate e chiede la mappatura a mano (§9: non fallire in silenzio).
- **Impatto su RAL 35.000**: zero.

### Note di prossimità nel batch con la stessa finestra della pagina pubblica
- **Cosa**: la colonna `note` segnala le discontinuità entro ±500 € di imponibile (`FINESTRA_PROSSIMITA`), riusando `discontinuitaVicine` della pagina pubblica.
- **Perché**: la stessa RAL non può essere "vicina alla soglia" in una pagina e non nell'altra.
- **Impatto su RAL 35.000**: nessuno sul calcolo; su Napoli a RAL 35.000 non compare nessuna nota.

## Semplificazioni strutturali del modello (lista minima del brief §10)

Sono le otto semplificazioni che il brief §10 chiede di dichiarare esplicitamente. Non
sono bug: sono i confini del modello. Riferimento per gli importi: **RAL 35.000, Napoli,
13 mensilità** (Caso B del brief §7 — imponibile fiscale 31.783,50, netto annuo 25.658,21).
A quel livello di imponibile l'aliquota marginale complessiva vale **37,2%** (33% IRPEF +
3,20% addizionale regionale Campania + 1,00% addizionale comunale Napoli), a cui si somma
l'effetto della detrazione art. 13 lettera c), che cresce di 1.910/22.000 = 0,0868 € per
ogni euro di imponibile in meno.

### Aliquota INPS fissa al 9,19%, senza varianti di CCNL o di dimensione aziendale
- **Cosa**: `INPS.aliquotaIvs` è una costante unica (`parametri-2026.ts`). Nella realtà la
  quota a carico del dipendente cambia per qualifica e per settore: dirigenti, apprendisti,
  agricoltura, aziende con contribuzione ridotta, contributi minori (es. fondo garanzia,
  CIGS) che possono spostare il totale di qualche decimo di punto.
- **Perché**: qualifica, CCNL e dimensione aziendale non sono input del calcolatore, e
  chiederli triplicherebbe il modulo per un effetto di secondo ordine. Il 9,19% è il caso
  del dipendente non dirigente del settore privato, cioè la stragrande maggioranza dei
  destinatari dello strumento.
- **Impatto su RAL 35.000**: uno scostamento di **0,10 punti** di aliquota vale 35 € di
  contributi e, per effetto della minore deduzione, **circa 19 € di netto annuo** (≈ 1,5 €
  al mese). Un errore di mezzo punto — il massimo plausibile — vale circa 95 € l'anno.

### Familiari a carico esclusi (art. 12 TUIR)
- **Cosa**: il motore non chiede né applica le detrazioni per coniuge e figli a carico.
  Calcola il netto di un dipendente **senza familiari fiscalmente a carico**.
- **Perché**: sarebbero almeno tre input in più (coniuge sì/no, numero di figli ≥ 21 anni,
  altri familiari) con regole di ripartizione fra i genitori che il brief non chiede; e
  dal 2022 le detrazioni per figli sotto i 21 anni sono state assorbite dall'Assegno Unico,
  che non passa dalla busta paga. Restano fuori dal perimetro dichiarato dal brief §5.4,
  che elenca solo art. 13, maggiorazione 65 €, cuneo e trattamento integrativo.
- **Impatto su RAL 35.000**: il motore **sottostima** il netto di chi ha carichi di
  famiglia. Ordine di grandezza a quell'imponibile: circa 690 € l'anno per il coniuge a
  carico e circa 630 € per un figlio di almeno 21 anni — quindi oltre 1.300 € l'anno nel
  caso di entrambi. Zero per chi non ha familiari a carico, che è il caso modellato.

### Trattamento integrativo approssimato: solo imponibile ≤ 15.000 con capienza
- **Cosa**: `calcolaIrpef` riconosce i 1.200 € solo se l'imponibile è ≤ 15.000 **e**
  l'IRPEF lorda supera la detrazione art. 13. La casistica reale della fascia
  **15.000–28.000** — dove il trattamento spetta, ma limitato alla differenza fra il totale
  delle detrazioni spettanti e l'imposta lorda — **non è modellata**: sopra i 15.000 il
  motore restituisce sempre zero.
- **Perché**: la condizione della fascia alta dipende da detrazioni che il motore non
  conosce (carichi di famiglia, oneri detraibili al 19%, interessi sul mutuo, spese
  sanitarie). Senza quegli input il calcolo non sarebbe più accurato, sarebbe solo più
  complicato. È l'approssimazione esplicitamente ammessa dal brief §5.4 lett. d).
- **Impatto su RAL 35.000**: **zero** — a imponibile 31.783,50 il trattamento non spetta in
  nessuna lettura della norma. Morde nella fascia 15.000–28.000 di imponibile per chi ha
  molte detrazioni, dove il motore può sottostimare il netto **fino a 1.200 € l'anno**.

### 13ª e 14ª come divisore del netto annuo, non come mensilità tassate a parte
- **Cosa**: `nettoMensile = nettoAnnuo / mensilita`. Nella realtà la tredicesima è una busta
  a sé: su di essa non spettano le detrazioni mensili (art. 13 TUIR è rapportato al periodo
  di lavoro, non alle mensilità aggiuntive) e non si applicano le rate delle addizionali.
- **Perché**: il brief §5.6 fissa esattamente questa formula, e l'oggetto dello strumento è
  il **netto annuo**: il numero mensile serve a dare una scala leggibile, non a riprodurre
  il cedolino di dicembre.
- **Impatto su RAL 35.000**: **zero sul netto annuo** — la mensilità è solo un divisore, non
  entra in nessun calcolo fiscale. Cambia solo la lettura del netto mensile: i 1.973,71 €
  mostrati sono una **media**, non l'importo di una busta reale. Nella realtà le dodici
  mensilità ordinarie sono più alte e quella di tredicesima più bassa, perché su di essa
  l'IRPEF si applica senza detrazioni. La somma dei tredici cedolini resta 25.658,21 €.

### Addizionali per competenza, non per cassa
- **Cosa**: il motore imputa all'anno 2026 le addizionali **maturate** sull'imponibile 2026.
  Nella realtà l'addizionale regionale e il saldo di quella comunale si trattengono in 11
  rate nell'**anno successivo**, e nell'anno corrente si versa un acconto comunale (30%
  dell'addizionale dell'anno precedente, art. 1 co. 4 D.Lgs. 360/1998).
- **Perché**: il calcolatore risponde alla domanda "quanto mi costa fiscalmente questa RAL",
  che è una domanda di competenza. Modellare la cassa richiederebbe l'imponibile dell'anno
  precedente — un input che nessuno ha sottomano quando confronta due offerte di lavoro.
- **Impatto su RAL 35.000**: **zero sull'importo annuo dovuto** (765,37 € di regionale
  Campania + 317,84 € di comunale Napoli = 1.083,21 €). Cambia solo *quando* la trattenuta
  compare in busta: un cedolino reale di gennaio 2026 porta rate riferite al 2025.

### Anno intero, senza ragguaglio delle detrazioni ai giorni di lavoro
- **Cosa**: il motore assume un rapporto di lavoro di **365 giorni**. La detrazione art. 13
  spetta invece "in rapporto al periodo di lavoro nell'anno": chi è assunto a metà anno ne
  matura la metà. Nessun input di data di assunzione o cessazione.
- **Perché**: la RAL è per definizione una grandezza annua contrattuale; confrontare offerte
  significa confrontare anni pieni. Un input di giorni renderebbe ambiguo il significato
  stesso del campo RAL (è il contrattuale annuo o il percepito nel periodo?).
- **Impatto su RAL 35.000**: **zero** per un anno intero, che è il caso modellato. Per un
  rapporto di 6 mesi con la stessa RAL contrattuale, la detrazione art. 13 andrebbe
  dimezzata: il motore la conta intera (1.581,48 € nel Caso A) e **sovrastima il netto di
  circa 790 €** sul periodo. Lo stesso vale per la maggiorazione di 65 €.

### Nessun fondo sanitario né previdenza complementare da CCNL
- **Cosa**: la RAL è considerata interamente imponibile. Non sono modellati i versamenti a
  fondi di assistenza sanitaria integrativa (esclusi dal reddito entro 3.615,20 €, art. 51
  co. 2 lett. a TUIR) né i contributi a previdenza complementare (deducibili entro
  5.164,57 €, art. 10 co. 1 lett. e-bis TUIR), che in molti CCNL sono automatici.
- **Perché**: dipendono dal CCNL applicato e da scelte individuali di adesione — due input
  che il calcolatore non ha e che il brief non prevede. Inoltre non sono trattenute "perse":
  sono retribuzione che cambia forma, e sommarle alle trattenute darebbe un netto
  fuorviante.
- **Impatto su RAL 35.000**: chi versa **1.000 € l'anno** a previdenza complementare vede il
  netto in busta scendere di **circa 540 €** (i 1.000 € escono, ma 459 € rientrano come
  minori imposte grazie alla deduzione), a fronte di 1.000 € accantonati sulla propria
  posizione. Il netto mostrato dal motore è quindi più alto del netto in busta di chi
  aderisce, ma la differenza non è una perdita.

### Nessun premio di produttività detassato
- **Cosa**: ogni euro di RAL è trattato come retribuzione ordinaria ad aliquota progressiva.
  I premi di risultato erogati in esecuzione di contratti aziendali o territoriali (art. 1
  co. 182 e seguenti L. 208/2015) sono invece soggetti, entro 3.000 € e sotto un tetto di
  reddito, a un'**imposta sostitutiva** dell'IRPEF e delle addizionali, ad aliquota ridotta.
- **Perché**: il regime dipende da requisiti aziendali (contratto collettivo di secondo
  livello depositato, incrementalità di un obiettivo misurabile) che non sono una proprietà
  della RAL e non possono essere dedotti dall'input. Chi ha un premio detassato lo sa e sa
  già che il calcolo standard non lo rappresenta.
- **Impatto su RAL 35.000**: se **3.000 €** dei 35.000 fossero un premio detassato, la quota
  imponibile corrispondente (2.724,30 € al netto dei contributi, che restano dovuti anche
  sui premi) pagherebbe l'imposta sostitutiva invece del 37,2% marginale: il motore
  **sottostima il netto di alcune centinaia di euro l'anno** — ordine di grandezza 600–700 €
  su un premio di 3.000 €. ⚠️ L'aliquota sostitutiva vigente per il 2026 non è citata qui
  con la precisione richiesta alle costanti del motore, proprio perché non è implementata:
  la stima è un ordine di grandezza, non un calcolo su un'aliquota verificata alla fonte.
