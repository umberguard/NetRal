// Test del modulo CSV della pagina batch (§9 del brief).
//
// Girano in environment "node" come quelli del motore: `csv.ts` non tocca il
// DOM, e se un giorno lo toccasse questi test esploderebbero — è il punto.

import { describe, expect, it } from "vitest";
import {
  elaboraRighe,
  leggiCsv,
  nomiColonneCalcolate,
  serializzaEsito,
  type Mappatura,
  type Predefiniti,
} from "./csv";

const PREDEFINITI: Predefiniti = { comune: "napoli", mensilita: 13 };
const SOLO_RAL: Mappatura = { ral: "ral", comune: null, mensilita: null };

describe("leggiCsv — convenzione del file", () => {
  it("rileva il punto e virgola e la virgola decimale", () => {
    const letto = leggiCsv("ral;comune\r\n35000,50;napoli\r\n");
    expect(letto.convenzione).toEqual({ separatore: ";", decimale: "," });
    expect(letto.colonne).toEqual(["ral", "comune"]);
    expect(letto.righe).toHaveLength(1);
  });

  it("rileva la virgola come separatore e il punto decimale", () => {
    const letto = leggiCsv("ral,comune\n35000.50,milano\n");
    expect(letto.convenzione).toEqual({ separatore: ",", decimale: "." });
  });

  it("non scambia il punto delle migliaia per un punto decimale", () => {
    // "35.000" è trentacinquemila (stessa disambiguazione di leggiRal): il
    // file non dichiara nessun decimale, quindi vale il ripiego sul separatore.
    const letto = leggiCsv("ral;comune\n35.000;napoli\n");
    expect(letto.convenzione.decimale).toBe(",");
    expect(elaboraRighe(letto.righe, SOLO_RAL, PREDEFINITI)[0]!.breakdown?.ral).toBe(
      35_000,
    );
  });

  it("senza decimali e con separatore virgola ripiega sul punto decimale", () => {
    expect(leggiCsv("ral,comune\n35000,napoli\n").convenzione).toEqual({
      separatore: ",",
      decimale: ".",
    });
  });
});

describe("leggiCsv — riconoscimento tollerante delle colonne (§9)", () => {
  it("riconosce le intestazioni per alias, accenti e maiuscole", () => {
    const letto = leggiCsv(
      "Matricola;Retribuzione Lorda Annua;Comune;Mensilità\n1;35000;Napoli;13\n",
    );
    expect(letto.colonneRiconosciute).toEqual({
      ral: "Retribuzione Lorda Annua",
      comune: "Comune",
      mensilita: "Mensilità",
    });
  });

  it("non inventa la colonna della RAL: la lascia da mappare a mano", () => {
    const letto = leggiCsv("matricola;compenso\n1;35000\n");
    expect(letto.colonneRiconosciute.ral).toBeNull();
    // La pagina mostra queste colonne nel select di mappatura.
    expect(letto.colonne).toEqual(["matricola", "compenso"]);
  });
});

describe("elaboraRighe — una riga in errore non blocca il file (§9)", () => {
  const righe = [
    { ral: "35000", comune: "Napoli" },
    { ral: "abc", comune: "Napoli" },
    { ral: "", comune: "Napoli" },
    { ral: "-100", comune: "Napoli" },
    { ral: "30000", comune: "Gotham" },
    { ral: "30000", comune: "Milano" },
  ];
  const mappatura: Mappatura = { ral: "ral", comune: "comune", mensilita: null };
  const esiti = elaboraRighe(righe, mappatura, PREDEFINITI);

  it("calcola la riga valida (Caso B del brief §7)", () => {
    expect(esiti[0]!.breakdown?.nettoAnnuo).toBeCloseTo(25_658.21, 2);
  });

  it("annota la RAL non numerica senza fermarsi", () => {
    expect(esiti[1]!.breakdown).toBeNull();
    expect(esiti[1]!.note.join(" ")).toContain("non è un numero");
    // le righe successive sono state comunque calcolate
    expect(esiti[5]!.breakdown).not.toBeNull();
  });

  it("annota la RAL mancante", () => {
    expect(esiti[2]!.breakdown).toBeNull();
    expect(esiti[2]!.note).toEqual(["RAL mancante"]);
  });

  it("trasforma il RangeError del motore in nota (RAL negativa)", () => {
    expect(esiti[3]!.breakdown).toBeNull();
    expect(esiti[3]!.note.join(" ")).toContain("negativa");
  });

  it("annota il comune fuori dalla matrice territoriale", () => {
    expect(esiti[4]!.breakdown).toBeNull();
    expect(esiti[4]!.note.join(" ")).toContain("Gotham");
  });

  it("usa la colonna comune riga per riga, non solo il valore globale", () => {
    // Milano, RAL 30.000 → imponibile 27.243: l'addizionale regionale è quella
    // lombarda (184,50 + 193,44 = 377,94), non quella campana (621,90).
    expect(esiti[5]!.breakdown?.addizionali.regionale).toBeCloseTo(377.94, 2);
  });
});

describe("elaboraRighe — mensilità e note di prossimità", () => {
  it("rifiuta una mensilità non prevista", () => {
    const esiti = elaboraRighe(
      [{ ral: "35000", mensilita: "15" }],
      { ral: "ral", comune: null, mensilita: "mensilita" },
      PREDEFINITI,
    );
    expect(esiti[0]!.breakdown).toBeNull();
    expect(esiti[0]!.note.join(" ")).toContain("12, 13 o 14");
  });

  it("usa la mensilità della riga quando c'è", () => {
    const esiti = elaboraRighe(
      [{ ral: "35000", mensilita: "12" }],
      { ral: "ral", comune: null, mensilita: "mensilita" },
      PREDEFINITI,
    );
    const b = esiti[0]!.breakdown!;
    expect(b.nettoMensile).toBeCloseTo(b.nettoAnnuo / 12, 2);
  });

  it("segnala la vicinanza a una soglia di esenzione comunale", () => {
    // Napoli esenta fino a 12.000 € di imponibile: RAL 13.200 ≈ 11.985 di
    // imponibile, dentro la finestra di prossimità.
    const esiti = elaboraRighe([{ ral: "13200" }], SOLO_RAL, PREDEFINITI);
    expect(esiti[0]!.breakdown).not.toBeNull();
    expect(esiti[0]!.note.join(" ")).toContain("addizionale comunale di Napoli");
  });
});

describe("serializzaEsito — l'output riusa la convenzione dell'input (§9)", () => {
  it("scrive con punto e virgola e virgola decimale, colonne di input in testa", () => {
    const letto = leggiCsv("matricola;ral\n1;35000\n");
    const esiti = elaboraRighe(letto.righe, SOLO_RAL, PREDEFINITI);
    const csv = serializzaEsito(esiti, letto.colonne, letto.convenzione);
    const [intestazione, prima] = csv.split("\r\n");

    expect(intestazione).toBe(
      "matricola;ral;contributi_inps;imponibile_fiscale;irpef_lorda;" +
        "detrazioni_totali;irpef_netta;addizionale_regionale;addizionale_comunale;" +
        "netto_annuo;netto_mensile;totale_trattenute;cuneo_fiscale_pct;note",
    );
    expect(prima!.startsWith("1;35000;3216,50;31783,50;")).toBe(true);
    expect(prima).toContain(";25658,21;");
  });

  it("scrive con virgola e punto decimale quando il file arriva così", () => {
    const letto = leggiCsv("ral\n35000.00\n");
    const esiti = elaboraRighe(letto.righe, SOLO_RAL, PREDEFINITI);
    const righe = serializzaEsito(esiti, letto.colonne, letto.convenzione).split(
      "\r\n",
    );
    expect(righe[1]!.startsWith("35000.00,3216.50,31783.50,")).toBe(true);
  });

  it("lascia vuote le colonne calcolate della riga in errore e valorizza note", () => {
    const letto = leggiCsv("ral\nabc\n");
    const esiti = elaboraRighe(letto.righe, SOLO_RAL, PREDEFINITI);
    const riga = serializzaEsito(esiti, letto.colonne, letto.convenzione).split(
      "\r\n",
    )[1]!;
    expect(riga.startsWith("abc,,,,,,,,,,,")).toBe(true);
    expect(riga).toContain("non è un numero");
  });

  it("non sovrascrive una colonna `note` già presente nell'input", () => {
    expect(nomiColonneCalcolate(["ral", "note"]).note).toBe("note_netral");
    const letto = leggiCsv("ral;note\n35000;da rivedere\n");
    const csv = serializzaEsito(
      elaboraRighe(letto.righe, SOLO_RAL, PREDEFINITI),
      letto.colonne,
      letto.convenzione,
    );
    expect(csv.split("\r\n")[0]).toContain("note;contributi_inps");
    expect(csv.split("\r\n")[0]!.endsWith("note_netral")).toBe(true);
    expect(csv.split("\r\n")[1]!.startsWith("35000;da rivedere;")).toBe(true);
  });

  it("il file scaricato si rilegge con la stessa convenzione (round-trip)", () => {
    const letto = leggiCsv("ral;comune\n35000,00;Napoli\n28000,00;Milano\n");
    const csv = serializzaEsito(
      elaboraRighe(
        letto.righe,
        { ral: "ral", comune: "comune", mensilita: null },
        PREDEFINITI,
      ),
      letto.colonne,
      letto.convenzione,
    );
    const riletto = leggiCsv(csv);
    expect(riletto.convenzione).toEqual({ separatore: ";", decimale: "," });
    expect(riletto.righe).toHaveLength(2);
    expect(riletto.righe[0]!.netto_annuo).toBe("25658,21");
  });
});
