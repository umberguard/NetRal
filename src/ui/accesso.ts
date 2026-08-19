// Gate della pagina batch (§2 e §9 del brief).
//
// ⚠️ QUESTA NON È SICUREZZA, ED È VOLUTO.
//
// La costante qui sotto finisce nel bundle JavaScript servito al browser:
// chiunque apra i sorgenti della pagina — o il file `dist/assets/*.js` — la
// legge in chiaro in dieci secondi. Il confronto è una stringa contro una
// stringa, lato client, senza nessuna verifica altrove: non protegge nulla e
// non deve MAI essere presentato come una protezione, né in UI né nel README.
//
// Serve a una cosa sola: far vedere, in una demo, che le due pagine hanno
// pubblici diversi — `/` è per il candidato, `#/batch` è per il team interno.
//
// Perché non "rinforzarlo" con un hash o un offuscamento: peggiorerebbe. Un
// hash lato client si confronta comunque lato client — chi legge il bundle
// legge anche il confronto — e l'unico effetto sarebbe far credere a chi
// guarda che ci sia un meccanismo di sicurezza. In produzione la pagina
// starebbe dietro un identity provider (Cloudflare Access, un auth server-side
// con sessione firmata): la verifica deve avvenire dove l'utente non arriva.
export const DEMO_PASSWORD = "DEMO_PASSWORD";
