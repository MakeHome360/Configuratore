# Ristruttura.CAD / Configuratore — Product Requirements Document

## Recent Updates (Round 64 — Feb 2026 — Riepilogo stampabile + Composite sconto/maggiorazione)

**Richieste utente** (in ordine):
1. "il riepilogo del preventivo devi metterlo innanzitutto che si possa stampare e poi deve essere su carta intestata e deve essere figo e costruito per invogliare il cliente a comprare"
2. "hai sistemato le voci del riepilogo preventivo che riportavano i prezzi di acquisto? e poi li hai proprio tolti?"
3. "Replicare logica sconto+maggiorazione anche in PreventivoComposite"

### 🖨 PreventivoStampa.jsx — pagina A4 vendor-friendly
Nuova route `/preventivi/:id/stampa`. Componente standalone che renderizza un foglio A4 pulito, stampabile e accattivante.

**Struttura del documento** (in ordine top-down):
1. **Carta intestata** — logo azienda (o iniziale stilizzata), ragione sociale + sito, indirizzo, telefono, email, P.IVA. Bordo inferiore colorato col `colore_primario` del brand.
2. **Titolo** — "Proposta di ristrutturazione" + `Preventivo PRV-XXXX` + date emissione/validità (30 giorni).
3. **Cliente + Pacchetto** — riquadri side-by-side con dati cliente e icona pacchetto scelto, badge maggiorazione mq se applicabile.
4. **HERO TOTALE** — banner gradient pieno schermo con il totale evidenziato a 6xl/72px, copy "Investimento totale chiavi in mano" + "IVA inclusa · Nessun costo nascosto". Pill verde sconto se applicato.
5. **Cosa è incluso** — 6 pill (Manodopera, Impianti, Finiture, Pratiche, Garanzia, Assistenza) + tabella lavorazioni in colonne (qty + unità, NO prezzi singoli forfait).
6. **Configurazione bagni** — card per ogni bagno con badge Incluso/Aggiuntivo, tier, color dot, descrizione tier.
7. **Optional** — tabella con descrizione e prezzo totale (qui sì il prezzo è visibile perché non forfait).
8. **Breakdown totali** — Base / Extra / Optional / Bagni / Subtotale / Sconto / IVA / TOTALE chiavi in mano (bordo nero spesso).
9. **Perché scegliere noi** — 4 feature di vendita (prezzo bloccato, PM dedicato, materiali, garanzia).
10. **Termini pagamento** — 30% firma + 40% SAL + 30% saldo, note preventivo, validità.
11. **CTA non stampabile** — pulsanti telefono + email + conferma.
12. **Firma cliente + Firma azienda** — riga firma per accettazione cartacea.

**Toolbar non-stampabile** in alto: "Torna al preventivo" + "Stampa o salva come PDF" (window.print()).

**CSS print**:
```css
@media print {
  @page { size: A4; margin: 0; }
  .print:hidden { display: none !important; }
}
```

**Fix gradient hero**: se `colore_primario` non è hex (es. "teal" parola CSS), usa fallback senza alpha per evitare `tealdd` invalido.

### 🚫 Prezzi acquisto: confermato che NON appaiono nel riepilogo
Verificato `PreventivoPacchetto.jsx`: nessun riferimento a `prezzo_acquisto` nel codice. Nello step 6 (Riepilogo) e nel nuovo `PreventivoStampa.jsx`:
- Voci del pacchetto: SOLO descrizione + qty + unità (formula forfettaria)
- Banner esplicito "Il prezzo del pacchetto è forfettario · le singole voci/quantità sono indicative e non determinano un prezzo unitario al cliente"
- Optional ed extra liberi: prezzo totale visibile (è giusto, sono opzioni aggiuntive non forfait)
- Bagni: nel riepilogo solo tier/descrizione, nessun prezzo singolo (sono inclusi nel hero totale)

### 💰📐 PreventivoComposite.jsx — replica sconto autorizzato + maggiorazione mq
Stessa logica già implementata in `PreventivoPacchetto` ora applicata anche al Composite:
- `useAuth()` → `isAdmin` flag
- `mqAdj` useMemo: <40 mq = ×1.15 (a corpo), <60 = +10%, else normale. Applicato al `totaleVoci`.
- Banner mq nella sidebar sezioni (rosso/amber) con icona AlertTriangle + spiegazione concisa
- Campo `scontoPct` separato da `sconto` EUR pre-esistente (entrambi convivono)
- Cap automatico a 5% se ruolo venditore + apertura Dialog richiesta autorizzazione (uguale pattern)
- Caricamento richiesta sconto attiva su `useEffect` (badge in attesa/approvato/rifiutato)
- Dialog richiesta sconto identico a PreventivoPacchetto (motivo obbligatorio + invio admin)

### 🐛 Bug fix collaterali
- `isNew = !id || id === "new"` in PreventivoComposite/PreventivoPacchetto/PreventivoBagno: il route `/preventivo*/new` veniva interpretato come `id="new"` e tentava di caricare un preventivo inesistente. Fix uniforme.
- `GET /preventivi/{id}`: admin ora vede tutti i preventivi (prima 404 per quelli non suoi). Mantiene filter user_id per non-admin.
- Bottone "PDF rapido" rinominato per chiarezza, accanto al nuovo "Anteprima stampa" (verde, evidenziato).

### File toccati
- `frontend/src/pages/PreventivoStampa.jsx` (NUOVO, ~280 righe)
- `frontend/src/pages/PreventivoComposite.jsx` (sconto + maggiorazione + dialog)
- `frontend/src/pages/PreventivoPacchetto.jsx` (bottone Anteprima stampa, isNew fix)
- `frontend/src/pages/PreventivoBagno.jsx` (isNew fix)
- `frontend/src/App.js` (nuova route)
- `backend/server.py` (admin vede tutti i preventivi singoli)

### Verifica E2E
- Screenshot PreventivoStampa: carta intestata, hero teal con 35.629€, breakdown, "Perché scegliere noi", termini, CTA, firma — tutto perfetto ✓
- Composite/new: nessun runtime error 404, sconto-pct input visibile, banner mq compare a mq=30/50 ✓

## Recent Updates (Round 63 — Feb 2026 — Email reali SMTP Aruba)

**Richiesta utente**: "voglio la notifica e poi va bene. impostiamo le email reali nel senso che serve per la registrazione, inviti, notifiche, reminder ecc ecc"

### 📧 Servizio Email centralizzato (SMTP Aruba)
**Provider**: SMTP Aruba (server proprio del cliente, no provider esterno terzi).
**Configurazione** (`/app/backend/.env`):
- `SMTP_HOST=smtps.aruba.it`
- `SMTP_PORT=465`
- `SMTP_USE_SSL=true`
- `SMTP_USER=noreply@sadicasa.it`
- `SMTP_PASSWORD=***` (cifrata in .env, mai esposta al FE)
- `SMTP_FROM_EMAIL=noreply@sadicasa.it`
- `SMTP_FROM_NAME=Sa di casa`
- `APP_PUBLIC_URL=https://cad-stima-cantiere.preview.emergentagent.com`

**Libreria**: `aiosmtplib==5.1.0` (async, non blocca FastAPI). Aggiunta a `requirements.txt`.

**Helper** (`/app/backend/email_service.py`):
- `send_email(to, subject, html, text, reply_to, cc)` — funzione base, errori loggati ma non sollevati (best-effort)
- `is_email_enabled()` — verifica config
- Wrapper HTML responsive 600px con header dark, body, footer "non rispondere a questa email"
- Template specifici già pronti:
  - `send_welcome_email(to, name, role)` — registrazione
  - `send_invite_email(to, name, role, temp_password, custom_message)` — invito utente generico (venditore, gestore, cliente, subappaltatore)
  - `send_otp_email(to, name, otp, documento_nome)` — codice OTP firma documento
  - `send_sconto_request_admin_email(...)` — notifica admin di nuova richiesta sconto (con marginalità ATTUALE vs SE-APPROVO)
  - `send_sconto_decision_email(...)` — notifica venditore di approva/rifiuta (con icona, % approvato, nota admin)
  - `send_reminder_email(to, name, subject, items, cta_label, cta_path)` — reminder generico (lista items + CTA)

### 🔗 Integrazioni nei flussi business
1. **Registrazione utente** (`server.py POST /auth/register`):
   - Email di benvenuto all'utente (stato pending)
   - Email a TUTTI gli admin: "Nuova registrazione da approvare" con nome, email, ruolo richiesto, telefono, messaggio + CTA a /adminutenti

2. **Invito utente admin** (`routes_biz.py POST /users/invite`):
   - Email all'invitato con password temporanea + CTA al login

3. **Invito Portale Cliente** (`routes_round10.py POST /cliente-portal/invita`):
   - Email al cliente con password temporanea + nota personalizzata sul portale + scadenza

4. **Invito Subappaltatore** (`routes_round10.py POST /subappaltatori-portal/invita`):
   - Email al sub con credenziali + nota su capacità del portale (preventivi, commesse, firma)

5. **OTP firma documenti** (`routes_round10.py POST /firma/richiedi-otp`):
   - Email al firmatario con codice OTP grande, scadenza 10 min
   - Mantiene `dev_otp_code` nel response solo se `EMERGENT_DEV_MODE=true` (per facilità di test)

6. **Notifica sconto admin** (`server.py POST /preventivi/{id}/sconto-richiesta`):
   - Email a tutti gli admin con tabella: venditore, preventivo, cliente, % richiesta, margine ATTUALE vs SE-APPROVO (rosso se < 20%), motivo del venditore, CTA "Vai alle richieste sconto"

7. **Notifica decisione sconto venditore** (`server.py PUT /sconto-richieste/{rid}/decide`):
   - Email al venditore richiedente con icona ✓/✗, percentuale approvata (se diversa dalla richiesta), nota dell'admin

### Test E2E
- Test SMTP self-send a `noreply@sadicasa.it`: SUCCESS ✓
- Test POST sconto-richiesta + email admin: `[EMAIL] inviata a ['admin@admin.it'] (subject=⚠ Richiesta sconto 12.0%)` ✓
- Test PUT sconto/decide + email venditore: `[EMAIL] inviata a ['admin@admin.it'] (subject=✓ Sconto approvato)` ✓
- Errore atteso solo su email seed `admin@ristruttura.app` (dominio inesistente, è solo seed iniziale dell'admin DB)

### Note pratiche
- Le email vengono inviate in async via `aiosmtplib` con SSL diretto su porta 465 (standard Aruba).
- Tutti gli errori SMTP sono loggati ma NON bloccano il flusso business (es. se Aruba è down, la registrazione/sconto procedono comunque).
- I template usano CSS inline + tabelle HTML compatibili con tutti i client email (Outlook incluso).
- Reminder schedulato giornaliero: helper `send_reminder_email` pronto, da agganciare a un job APScheduler o cron quando ti serve (es. "Fasi cantiere in scadenza tra 3 giorni").

## Recent Updates (Round 62 — Feb 2026 — Sconto autorizzato + Maggiorazione mq + Computo tier bagni)

### 💰 Sconto preventivi con workflow di autorizzazione
**Richiesta utente**: "i venditori hanno un margine di sconto del 5% e solo io posso autorizzare uno sconto maggiore. Devi darmi (nel momento in cui valuto) i numeri della marginalità in quel momento."

**Logica implementata**:
- **Venditore**: sconto fino al 5% applicabile direttamente. Sopra il 5% l'input viene cappato a 5% e si apre automaticamente un Dialog di richiesta autorizzazione (campo % + motivo obbligatorio).
- **Admin**: sconto libero senza limiti, nessuna soglia.
- Bottone "Richiedi sconto maggiore" anche manuale per il venditore.

**Backend** (`server.py`):
- Costante `SOGLIA_SCONTO_AUTO = 5.0`
- Funzione `_calc_marginalita_preventivo(prev, voci_back, sconto_simulato_pct)` che calcola live:
  - Subtotal pre-sconto
  - Costo netto stimato (prezzo_acquisto × qty per items/extra, optional/1.6, costi netti bagni: silver 2000€, gold 3200€, platinum 5500€)
  - Margine € e % sia ATTUALE (sconto effettivo) sia SE-APPROVO (sconto richiesto)
- Endpoints:
  - `POST /api/preventivi/{id}/sconto-richiesta` — crea/sostituisce richiesta pending (verifica > soglia, motivo obbligatorio)
  - `GET /api/sconto-richieste?stato=…` — admin vede tutte, venditore solo le sue; arricchisce con `marginalita_live` e `marginalita_senza_sconto_extra`
  - `PUT /api/sconto-richieste/{rid}/decide` — solo admin; approva (con `pct_approvato` modificabile, default = richiesto) o rifiuta. Su approvazione: aggiorna `preventivi.sconto_pct` + `sconto_autorizzato_da` + `sconto_autorizzato_il`.

**Frontend nuova pagina** (`AdminScontoRichieste.jsx`):
- Lista richieste filtrabili per stato (pending / approvato / rifiutato / tutte)
- Card per richiesta con: badge stato, numero preventivo, cliente, % richiesta evidenziata, motivo del venditore in italico
- **4 KPI box marginalità**: Subtotale | Costo netto stimato | Margine ATTUALE | Margine SE APPROVO (colorato rosso se < 20%)
- Indicazione delta margine (es. "−4.500€" sotto Margine SE APPROVO)
- Bottoni "Rifiuta" e "Approva" → Dialog con campo % modificabile e nota per il venditore
- Sidebar admin: nuovo link "Richieste Sconto" con icona ShieldCheck

### 📐 Maggiorazione automatica mq piccole
**Richiesta utente**: "sotto i 60 mq devi aumentare di un 10% i prezzi. Sotto i 40 mq vanno calcolati a corpo perché altrimenti la marginalità scende troppo."

**Logica implementata** (`PreventivoPacchetto.jsx` — `useMemo mqAdjustment`):
- **mq < 40 → modalità A CORPO**: equiparato a 40 m² + 15% di margine sicurezza (`base = price_per_m2 × 40 × 1.15`)
- **40 ≤ mq < 60 → +10%**: `base = price_per_m2 × mq × 1.10`
- **mq ≥ 60 → normale**: `base = price_per_m2 × mq`
- Banner esplicativo nello step "Metri quadri" (rosso per A CORPO, amber per +10%) con icona e descrizione completa del motivo (costi fissi cantiere non scalabili)
- Preview base ora mostra: "380 €/m² × 40,0 m² · ×1.15 (maggiorazione mq piccole)"

### 🛁 Computo metrico differenziato per tier bagno (P1 risolto)
**Logica** (`server.py _auto_populate_commessa_from_preventivo`):
- Lettura collection `bathroom_tiers` (fallback prezzi hardcoded silver/gold/platinum)
- Per ogni bagno del preventivo:
  - **Incluso + tier != silver** → voce computo: `"Upgrade Bagno #N → GOLD (differenza vs SILVER)"` con `prezzo_unit = tier.price − silver.price`
  - **Extra (non incluso)** → voce computo: `"Bagno #N aggiuntivo GOLD (completo, extra)"` con `prezzo_unit = tier.price`
- Totale computo aggiornato. Granularità voce-per-voce (silver→gold→platinum mapping completo) lasciata a iterazione futura — questa soluzione mantiene la marginalità corretta in fattura.

### Verifica E2E
- Test backend curl: POST richiesta 15% → marginalità mostra Margine SENZA sconto 80.86% vs Margine SE APPROVO 77.48%. PUT decide approva al 12% → preventivo.sconto_pct = 12 ✓
- Screenshot UI:
  - mq=30 → banner rosso "MODALITÀ A CORPO" + preview 17.480€ (380 × 40 × 1.15) ✓
  - mq=50 → banner amber "MAGGIORAZIONE +10%" + preview 20.900€ (380 × 50 × 1.10) ✓
  - mq=70 → nessun banner, preview normale ✓
  - Admin sconto-richieste page: card con badge, marginalità, bottoni approva/rifiuta ✓

## Recent Updates (Round 61 — Feb 2026 — 4 fix workflow + snap millimetrico CAD)

### 📐 Precisione millimetrica CAD
**Prima**: `GRID = 10` cm — tutti gli elementi (muri/porte/finestre/impianti) snappavano a multipli di 10 cm.
**Adesso**: `GRID = 0.1` cm (1 mm). Anche `snap()` in `utils.js` ha default `step=0.1`. Render visivo della griglia invariato (linee 10 cm + 1 m). Misure ora precise al millimetro.

### 🔨 Fasi del popup "Nuova fase" — bug fix critico
**Prima**: `CommessaWorkflow.jsx` chiamava `/api/fasi-templates` (21 fasi HARDCODED in `routes_commessa_workflow.py`) ignorando le fasi che l'admin aveva creato nel menu sidebar "Fasi Commessa" (collection `fasi_commessa`).
**Adesso**: chiama `/api/fasi-commessa` (database admin-managed). Mappa i campi `{name, description, order}` → `{titolo, durata_gg, ordine, color, categoria}` attesi dal popup. Ordina per `order`.

### ✅ Checklist venditore — popup helper + condizioni + ordine workflow
**Prima**: lista di 12 voci senza spiegazioni; ordine non logico (privacy in mezzo, data inizio in fondo).
**Adesso**:
- **Ordine workflow**: cliente → contratto → acconto → pratica edilizia → progetto → materiali → computo → preventivi sub → fasi → data inizio → foto rilievo → privacy.
- **Numero progressivo** (1., 2., ...) accanto a ogni step.
- **Bottone "?" blu** per ogni voce → apre Dialog **"Come completare questa voce"** con:
  - Step ricapitolato + badge critico
  - Istruzioni multi-riga su DOVE andare e COSA fare per completarla
  - **Condizione automatica** documentata (es. "spunta verde quando contratto.firmato = true")
  - Stato attuale: COMPLETATA (verde) o DA COMPLETARE (zinc)
- Le voci della checklist sono già "condizionate" automaticamente dal dato sottostante (lettura DB). Nessuna spunta manuale.

### 📸 NUOVA TAB: "8. Foto Cantiere" (multi-upload raggruppato per giorno)
**Backend** (`routes_commessa_workflow.py`):
- Modello `FotoCantiereIn` (BaseModel + `extra="allow"`) con `data, titolo, foto[], note`.
- Endpoint:
  - `GET /api/commesse/{cid}/foto-cantiere`
  - `POST /api/commesse/{cid}/foto-cantiere`
  - `PUT /api/commesse/{cid}/foto-cantiere/{gid}`
  - `DELETE /api/commesse/{cid}/foto-cantiere/{gid}`
- Riuso dell'endpoint generico `POST /api/uploads` per il file binario (con `tipo="foto-cantiere"`).
- Aggiunto `foto_cantiere` nello snapshot `GET /api/commesse/{cid}/workflow`.

**Frontend** (`CommessaWorkflow.jsx > FotoCantiere`):
- Nuova tab "📸 8. Foto Cantiere" inserita tra Fasi (7) e Voci e Acquisti (rinumerata 9).
- Bottone "Nuova giornata" → Dialog con:
  - Input data + Titolo (es: "Demolizioni cucina", "Posa massetto")
  - Input note facoltative
  - Multi-upload `<input type="file" multiple accept="image/*">` con caricamento sequenziale all'endpoint `/uploads`
  - Anteprima foto caricate con bottone Elimina su hover
- Lista giornate raggruppate per `data` (più recente prima):
  - Card con data grande in stile calendario + titolo + note + count foto
  - Griglia thumbnail responsive 2/3/4/6 colonne
  - Click foto → **Lightbox** full-screen
  - Edit / Delete per giornata
- Empty state grafico se nessuna foto

### 💰 Soglie prezzo per pacchetto — sblocco UI
**Prima**: l'input "Soglia prezzo MAX coperto dal pacchetto" in `AdminPacchetti.jsx` era VISIBILE solo se la voce backoffice aveva `modificabile_dal_venditore=true`. Le voci non modificabili (lavorazioni, impianti) non potevano avere soglie diverse per pacchetto.
**Adesso**: l'input è SEMPRE VISIBILE per ogni voce dentro al pacchetto. Stile diverso (amber per modificabili, blue per non-modificabili) con helper testo che chiarisce il significato del campo. Così per la stessa voce X puoi impostare soglie diverse in BASIC/SMART/PREMIUM/ELITE.
- Frontend `PreventivoPacchetto.jsx` già usa `it.unit_price_pkg` come soglia per il calcolo extras → impatto immediato.

### Verifiche E2E
- Snap millimetrico: `snap(123.47) → 123.5`, `snap(99.95) → 100` ✓
- Fasi popup: 18 fasi dell'admin visibili (era 21 hardcoded prima ma errate) ✓
- Checklist help popup: apre con istruzioni e badge stato attuale ✓
- Foto cantiere: POST/GET/PUT/DELETE backend, FE Dialog con multi-upload + lightbox + raggruppamento per giorno ✓
- Soglie pacchetto: input visibile per OGNI voce in OGNI pacchetto (Demolizione 15.75€, Decorazione 8€, Muro cartongesso 26€, ecc.) ✓

## Recent Updates (Round 60 — Feb 2026 — Bagni multipli + Optional qty universale + Fix Round 59)
**Richieste utente**:
1. *"in ogni pacchetto devi darmi la possibilità di aggiungere più bagni... se ho silver incluso e voglio sostituirlo con un gold devi aggiungere solo la differenza ma nel computo metrico le voci silver vengono SOSTITUITE con quelle gold"*
2. *"le quantità sono già modificabili perché quelle lo sono sempre. devi sistemare la cosa dei prezzi"*

### 🛁 Bagni multipli nei pacchetti
**Prima**: lo step 4 era un radio button singolo che permetteva di scegliere un solo livello bagno (silver/gold/platinum) come surcharge differenziale.

**Adesso** (`PreventivoPacchetto.jsx` step 4):
- Nuovo schema dati `prev.bathrooms: [{ id, tier_id, included }]`.
- Auto-init: appena l'utente entra nello step 4, viene creato automaticamente "Bagno #1 SILVER incluso nel pacchetto" (riflette il bagno base coperto dal pacchetto).
- L'utente può:
  - **Cambiare livello del bagno #1** (incluso): paga solo la **differenza** rispetto a SILVER (es. SILVER→GOLD = +2000€, SILVER→PLATINUM = +5500€).
  - **Aggiungere altri bagni** ("+ Aggiungi un altro bagno"): ognuno paga il **prezzo intero** del livello scelto (SILVER 3500€, GOLD 5500€, PLATINUM 9000€).
- Per ogni bagno, 3 card tier (SILVER/GOLD/PLATINUM) visibili con prezzo coerente al contesto (upgrade vs intero).
- Box "Sintesi bagni" in fondo allo step 4 con elenco dei bagni e totale (`bagni-total` testid).
- Riepilogo (step 6): nuova sezione `riepilogo-bagni` con dettaglio Bagno #N · TIER · (incluso/extra) e costo singolo.
- **Backward-compat**: preventivi vecchi con `bathroom_tier` (stringa singola) vengono automaticamente convertiti in `bathrooms: [{ tier_id: <legacy>, included: true }]` al load.
- Backend: `extra="allow"` su `PreventivoIn` consente di salvare/leggere `bathrooms` senza cambiare il modello Pydantic. Test E2E POST/GET ok.

### 💰 Optional con quantità modificabile per TUTTI (forfait/pz/m²) e prezzo coerente
**Prima**: nello step 3, solo gli optional con `per_m2=true` mostravano un input qty modificabile. Per i forfait e i `pz` la qty era fissa a 1 e cambiare voce non aggiornava il prezzo.

**Adesso**:
- Tutti gli optional (anche forfait/pz) hanno un input qty visibile quando selezionati (`optional-qty-<id>`).
- Total ricalcolato in tempo reale: `total = qty × unit_price_scontato` per qualsiasi unità.
- Es. Portoncino blindato qty=3 → 3 × 1890€ = 5670€ (prima fissato a 1890€).
- Salva nel payload `optional[]: [{ id, name, qty, unit_price, total, per_m2, unit, descrizione }]`.

### 🐛 Bug fix collaterali
- **Riepilogo Optional (step 6)**: bug critico — usava `prev.optionals.filter(o.selected)` (campo inesistente, doveva essere `prev.optional`). Ora legge correttamente dalla lista reale degli optional selezionati con qty + total + descrizione.
- **Totals typo**: `totals.extra` (non esistente) → `totals.extras` nella card "Extra dal configuratore/infissi" nello step 2.
- **Import API mancante**: `AdminMaterialiTemplate.jsx` usava `import api from "@/lib/api"` (default export inesistente) → corretto in `import { api }` (named). Sbloccava la compilazione del bundle.

### Verifica
- POST `/api/preventivi` con `bathrooms: [...]` → salvato e ritornato correttamente nel GET. Test E2E con curl ok.
- Screenshot frontend: Bagno #1 GOLD incluso (+2000€) + Bagno #2 GOLD extra (+5500€) → Sintesi 7500€, IVA inclusa 37.510€ ✓
- Optional qty=2 condizionatore (5580€) + qty=3 portoncino (5670€) = Optional sidebar 11.250€ ✓
- Dashboard count e lista preventivi allineati (48 = 48 per admin scope=all).


## Recent Updates (Round 51 — Feb 2026 — Stanze curve & Muri ad arco)
**Problema utente**: "se voglio disegnare una stanza tonda o a mezza luna non posso perchè posso solo fare linee rette sia con le stanze che con i muri".

### ⌒ Muro ad arco (parete curva)
Nuovo tool **"Muro ad arco · click+drag"** in toolbar Base.
- **Workflow**: 1° click endpoint A · 2° click endpoint B → genera muro ad arco con sagitta default = 1/6 della corda
- Salvato in `walls[]` con campi extra: `arc: true, bow: number, sweep: 1|-1`
- **Render 2D**: SVG `<path>` con elliptical arc command, raggio calcolato `r = chord²/(8·bow) + bow/2`
- **Render 3D**: segmentato in 16 piccoli muri rettilinei lungo l'arco circolare (mantiene visual qualità + compatibilità con il flusso esistente)
- **Etichetta lunghezza arco**: posizionata sul punto medio dell'arco, mostra la **lunghezza reale dell'arco** (non la corda)
- **Pannello proprietà completo**:
  - Input sagitta (cm) + preset rapidi (10/20/30/50/70/100/150 cm)
  - Bottone **"⇋ Ribalta direzione arco"** per cambiare il verso (sweep)
  - **"Converti in muro retto"** per appiattire
  - Su qualsiasi muro retto esistente: bottone **"⌒ Trasforma in muro ad arco"** (sagitta iniziale = corda/6)

### ⭕ Stanza tonda (perimetro circolare)
Nuovo tool **"Stanza tonda · drag raggio"**.
- **Workflow**: click sul centro + drag verso il bordo → finalizza con il rilascio
- Genera 48 punti uniformi sulla circonferenza → poligono regolare 48-gon (visivamente liscio)
- Crea 48 muri perimetrali + 1 room con `shape: 'round'`, `centerX/Y, radius` memorizzati
- Compatibile con tutta la pipeline esistente: pavimenti, prospetti, demolizioni, MEP, preventivo

### 🌙 Stanza a mezzaluna (semicerchio chiuso)
Nuovo tool **"Stanza a mezzaluna · drag"**.
- **Workflow**: click sul centro + drag verso il punto più curvo → l'asse del diametro è perpendicolare al vettore di drag, l'arco è sul lato del drag
- Genera 24 punti sul semicerchio + 2 endpoint del diametro → poligono di 26 vertici
- Calcolo dinamico in tempo reale di area e diametro nel draft (label live)

### Live preview durante il disegno
- Stanze tonde: cerchio tratteggiato blu + label `⌀NNcm · X.XX m²` + hint "rilascia per creare"
- Mezzaluna: SVG path tratteggiato con area calcolata
- Muri arcuati: arco tratteggiato verde + linea corda di riferimento + label `corda Xm · sagitta Ym`

## Recent Updates (Round 50 — Feb 2026 — Pilastri circolari + Cerchio libero)
### ⭕ Pilastri/Colonne con forma circolare
**Prima**: i pilastri erano solo rettangolari (`width × depth`).

**Ora** (`column.shape: 'rect' | 'circle'`):
- Toggle **▭ Rettangolare / ⭕ Circolare** nella toolbar inferiore (quando tool=column) E nel pannello proprietà
- Forma circolare: 1 input "⌀ Diametro" invece di L/P + preset rapidi ⌀20/⌀30/⌀40/⌀50/⌀60/⌀80
- Forma rettangolare: 3 input L/P/H + preset 30×30, 40×40, 50×50, 60×25
- Banner placement adattivo: `"pilastro · cemento · ⌀30×270cm"` o `"pilastro · cemento · 40×30×270cm"`
- **Render 2D**: `<circle>` con croce centrale CAD e label "P" per pilastri tondi; `<rect>` con diagonali per rettangolari
- **Render 3D** (`Viewer3D.jsx`): `THREE.CylinderGeometry(diam/2, diam/2, h, 32)` per circolari, `BoxGeometry` per rettangolari
- Backward compatible: pilastri esistenti senza `shape` rimangono `'rect'`

### 🔵 Tool "Cerchio libero" per elementi decorativi/strutturali tondi
**Nuovo tool generico** `tool='circle'` per disegnare cerchi liberi: gazebo, fontane, tavoli rotondi, aiuole, marker di progetto, ecc.

**Workflow**:
- Click+drag → definisce il raggio in tempo reale (con label `⌀NNcm` live durante il draw)
- Click singolo → usa il raggio default configurato in toolbar
- Storage in `project.data.circles[]: {id, x, y, radius, label, fillColor, strokeColor, filled, phase}`

**Configurazione toolbar** (panel quando tool=circle):
- Raggio default + preset ⌀50/⌀100/⌀150/⌀200/⌀300/⌀400
- Etichetta opzionale (es. "Gazebo", "Tavolo", "Fontana")
- Toggle Riempito on/off
- 2 color picker: Riempimento + Bordo

**Render 2D**:
- Cerchio in opacity 35% (se filled) + bordo continuo
- Croce centrale piccola (simbolo CAD di marker)
- Label esterna sotto al cerchio (se impostata) + label interna "⌀NNcm"
- Maniglia di resize blu sulla destra quando selezionato (drag → cambia raggio in tempo reale)
- Drag del corpo intero per spostarlo

**Pannello proprietà** con: label, raggio/diametro, colori, toggle riempimento, area calcolata in m² + circonferenza in m.

## Recent Updates (Round 49 — Feb 2026 — Rilevamento automatico stanze + Strumenti di misurazione + Landing Blog)
### 🏠 Auto-rilevamento stanze dai muri (richiesta utente P0)
**Problema**: quando l'utente disegnava una stanza con il tool "Muro" (anziché tool "Stanza"), il sistema non la riconosceva come stanza → niente quote, niente conteggio nel preventivo.

**Soluzione** (`utils.js:detectRoomsFromWalls`):
- Algoritmo planar-graph **face-finding**: ogni muro diventa 2 semi-archi orientati. Per ogni semi-arco trova il successivo "left-turn" (CCW) attorno al nodo di destinazione. Seguendo i cicli si estraggono tutte le facce del grafo.
- Snap endpoint con tolleranza 8cm (per fondere angoli quasi-coincidenti)
- Esclude i muri demoliti
- Identifica e scarta la faccia esterna (test point-in-polygon per ogni candidata)
- `roomPolygonAlreadyExists` dedup intelligente: confronta centroidi + rapporto aree (>70%) per non duplicare stanze esistenti

**UI** (`Editor.jsx`):
- Bottone **"Auto-stanze"** (emerald, icona Home) nella toolbar superiore accanto a "Importa Pianta"
- Toast risultato: `"✓ 3 stanze rilevate dai muri · 47.5 m² · rinominale dal pannello proprietà"`
- Le stanze rilevate ereditano la `phase` corrente (fatto/progetto) e hanno `auto_detected=true`

**Test unitari** (9/9 passati, `__tests__/detectRooms.test.mjs`):
- Rettangolo singolo → 1 stanza, area corretta
- Triangolo aperto → 0 stanze
- 2 rettangoli adiacenti con muro condiviso → 2 stanze
- Muro demolito esclude stanza
- Snap endpoint con tolleranza 8cm
- Dedup di stanza già esistente

### 📐 Strumenti di misurazione (Lunghezza / Area / Volume)
**Nuovo gruppo tool "Misura"** in `Editor.jsx` con 4 strumenti:
- **Lunghezza · 2 click**: 2 click su 2 punti → mostra distanza in metri con tick perpendicolari agli estremi e badge centrale
- **Area · poligono**: click multipli sui vertici, doppio click chiude → mostra Area in m² + Perimetro in m
- **Volume · poligono × H**: come Area + altezza pavimento corrente (default 270cm) → calcola e mostra Volume in m³
- **Cancella misure**: pulisce tutte le misurazioni

**Storage**: tutte le misure persistite in `project.data.measurements: [{id, kind, points, height_cm?}]`. Si salvano col progetto.

**UI**:
- Render dedicato in violet (#9333EA) per distinguersi dai disegni progettuali
- Bottone X rosso accanto al badge per eliminare la singola misura
- Hint "doppio click per chiudere" durante il draft di area/volume
- Live preview durante il drawing (linea tratteggiata + badge in tempo reale)

### 📰 Blog visibile nel menu principale + 2 aperture separate (Brà / Settimo)
- **Navbar Landing** (`Navbar.jsx`): aggiunto link **"Blog"** tra "Come funziona" e "Contatti" (desktop + mobile)
- **Aperture separate** (`Landing.jsx`): Brà (CN) e Settimo Torinese (TO) ora hanno 2 card distinte nella sezione contatti, ognuna con email mailto dedicato (`?subject=Apertura%20Brà` / `?subject=Apertura%20Settimo%20Torinese`)
- **Footer** aggiornato con 2 voci "Prossima apertura" separate
- **Top strip**: "2 NUOVI SHOWROOM IN ARRIVO: BRA' (CN) · SETTIMO TORINESE (TO)"

## Recent Updates (Round 48 — Feb 2026 — Fix Import Planimetria porte/finestre + Auto-pagamento SAL + Auto-popolazione Voci Acquisti)
### 📋 Auto-popolazione "Voci e Acquisti" dal "Computo Metrico" (P1)
**Prima**: l'utente doveva digitare manualmente ogni voce di acquisto nella tab "Voci e Acquisti" anche se il computo metrico la conteneva già.

**Adesso** (`routes_commessa_workflow.py:import_voci_acquisti` — `POST /commesse/{cid}/workflow/voci-acquisti/import-from-computo`):
- Legge `commessa.computo_metrico.items`
- Per ogni voce calcola `stima_backoffice = voce_backoffice.prezzo_acquisto × qty` (fallback su prezzo_unit se voce non in catalogo)
- Copia automaticamente `subappaltatore = artigiano_nome` se voce già assegnata (artigiano/autorizzato)
- 3 modalità:
  - `merge=true` (default): aggiunge solo voci con `voce_id` non già presente
  - `only_assigned=true`: importa solo voci con `stato_assegnazione ≠ da_assegnare`
  - `category_filter=[...]`: importa solo categorie selezionate
- Voci importate marcate con `from_computo=true` + `computo_item_id` per tracciabilità

**UI** (`CommessaWorkflow.jsx:VociAcquistiTab`):
- 2 nuovi bottoni nell'header: "📋 Importa da Computo" (tutte) + "Solo assegnate"
- Empty state ricco: se la lista è vuota e il computo ha N voci → CTA grande "Importa N voci dal Computo"
- Riga importata evidenziata in blue + badge `📋 da computo · CATEGORIA`
- Tooltip "Computo metrico vuoto: rigeneralo nella tab Computo" quando disabilitato

**Test E2E** (4/4 passati):
- Import completo: stima_backoffice corretta (prezzo_acquisto × qty), sub copiato per voci assegnate
- only_assigned salta correttamente le da_assegnare
- merge=true evita duplicati su re-import
- Computo vuoto → 400

### 🔴 Fix CRITICO Import Planimetria: porte/finestre ora arrivano davvero
**Bug root**: il prompt Gemini chiedeva `doors`/`windows` ma il backend in `server.py:ai_floorplan_import` parsava SOLO `rooms` e a riga 1050 forzava `"doors": [], "windows": []` hardcoded → l'output dell'AI veniva BUTTATO. Per questo l'utente vedeva la pianta importata "più piccola e senza porte/finestre".

**Fix**:
- Parse di `doors[]`/`windows[]` dalla risposta AI con sanitization (x, y, width, hinge, swing, kind, sillHeight)
- **Snap to wall** algoritmico: per ogni porta/finestra trova il muro più vicino tra quelli generati dalle stanze, calcola `wallId` + `t∈[0,1]` (parametro lungo il muro). Soglia max 200cm dal muro → altrimenti scartata.
- **Rescale coerente**: `_apply_scale` ora scala ANCHE le coordinate raw di porte/finestre (x, y, width), non solo rooms/walls
- Supporto `kind='vetrina'` (vetrina commerciale full-height) e `kind='portafinestra'` con `sillHeight=0` automatico
- Default `ante=2` per finestre
- Response include `doors_count` e `windows_count` (testabili dal frontend)
- Logging: `[floorplan] parsed N rooms, X/Y doors snapped, X/Y windows snapped`

### 🟢 P1 Convalida SAL → Auto-pagamento Cassa Commessa
**Prima**: cliccare "Convalida & sblocca pagamento" sul Gestore Cantieri segnava solo `convalidato=true` ma NON creava alcun movimento di cassa → il pagamento al sub restava manuale.

**Adesso** (`routes_round10.py:convalida_avanzamento`):
- Calcolo automatico importo: `importo_pattuito × (perc_corrente − Σ perc_già_pagate)` → solo il DELTA non già pagato
- Crea movimento in `commesse_cassa`:
  - `tipo='uscita'`, `stato_pagamento='programmato'`, scadenza +15 giorni
  - `beneficiario_tipo='subappaltatore'`, `beneficiario_nome` recuperato da subappaltatori.nome
  - `categoria='avanzamento'`, `auto_generated=true`, `source={type:'sal_convalida', ass_id, avanzamento_id}`
- **Idempotenza**: se l'avanzamento è già convalidato → ritorna `already_validated:true` senza duplicare
- **Tracking**: l'avanzamento salva `pagamento_movimento_id` per evitare doppi pagamenti su SAL incrementali
- **Frontend** (`GestoreCantieri.jsx`):
  - Banner emerald in alto "Auto-pagamento SAL attivo" spiega il flusso
  - Toast post-convalida mostra importo programmato: `"SAL convalidato · Pagamento programmato di € 5.000,00 aggiunto alla Cassa Commessa"`

### Test E2E Round 48 (8/8 passati)
- `test_floorplan_parses_doors_windows` ✅
- `test_floorplan_rescale_applies_to_doors` ✅ (target 48m² → factor 2.0)
- `test_sal_convalida_genera_cassa_movimento` ✅
- `test_sal_convalida_solo_delta_perc` ✅
- `test_import_all_voci_da_computo` ✅
- `test_import_solo_assegnate` ✅
- `test_import_merge_evita_duplicati` ✅
- `test_import_computo_vuoto_400` ✅

### Verifiche su P1 pre-esistenti
- **Drag interattivo demolizione parziale**: già funzionante da Round 25 (`demo-partial-drag` + maniglie `demo-handle` in Canvas2D.jsx:550-577)
- **Quote sx/dx/h Prospetti**: già funzionante da Round 33 (tabella ordinata `N° | SIGLA | SX | DX | H` in Prospetti.jsx:218-267)

## Recent Updates (Round 47 — Mag 2026 — Blog SEO con 50 articoli pre-scritti)
### 📰 Blog completo per acquisizione organica
**Obiettivo**: aumentare traffico organico tramite contenuti SEO-ottimizzati sulle keyword "ristrutturazione", "bagno", "cucina", "preventivo", "bonus", "costi", ecc.

**Backend** (`/app/backend/`):
- **`blog_seed.py`**: 50 articoli pre-scritti su 18 categorie:
  - Ristrutturazione, Bagno, Cucina, Costi e Preventivi, Bonus e Detrazioni, Materiali, Risparmio Energetico, Design, Errori da evitare, Guide pratiche, Progettazione, Esterni, Investimenti immobiliari, Accessibilità, Burocrazia, Tecnologia casa, Ristrutturazione low-cost, Mini appartamenti.
  - Ogni articolo: ~300-700 parole, title, slug, excerpt, content_md (markdown), tags, seo_keywords, meta_description, hero_emoji.
  - Date pubblicazione spread su 90 giorni passati per look naturale.
- **Endpoint pubblici** (`server.py`):
  - `GET /api/blog/posts?category=X&limit=N` — lista
  - `GET /api/blog/posts/{slug}` — singolo (incrementa views)
  - `GET /api/blog/categories` — lista categorie
- **Endpoint admin**:
  - `GET/POST/PUT/DELETE /api/admin/blog/posts[/{slug}]`
- **Seed automatico startup**: se collection `blog_posts < 50` → upsert dei 50 articoli.

**Frontend**:
- **`/blog`** — `Blog.jsx`: index pubblico con filtri categoria + search, grid cards con emoji hero, CTA preventivo
- **`/blog/:slug`** — `BlogPost.jsx`: detail pubblico con mini parser markdown → HTML (titoli, bold, liste, paragrafi), aggiornamento dinamico `<title>` e `<meta description>` per SEO, articoli correlati, breadcrumb back
- **`/adminblog`** — `AdminBlog.jsx`: gestione completa (lista con stato pub/draft, views, edit modal con titolo/slug/categoria/excerpt/contenuto MD/tag/SEO keywords/meta description/published toggle)
- **Sidebar admin**: nuova voce "Blog (SEO)" (icona Newspaper)
- **Landing footer**: link `Blog & Guide` aggiornato da `#` a `/blog`

**SEO ready**:
- URL friendly: `/blog/quanto-costa-ristrutturare-casa-2026`
- Meta description e title dinamici per ogni articolo
- Categorie come tag visibili
- Linking interno tramite articoli correlati
- Markup HTML semantico (h1, h2, h3, article, time)

**Test E2E**:
- 50 articoli seedati ✅
- 18 categorie distinte ✅
- API `/api/blog/posts` ritorna 50 risultati ✅
- API `/api/blog/posts/{slug}` ritorna contenuto completo + incrementa views ✅
- Lint JS pulito ✅

## Recent Updates (Round 46 — Mag 2026 — Import planimetria: fix 504 timeout)
### 🚀 Performance fix Gateway Timeout 504
**Causa**: l'ingress Kubernetes su sadicasa.it ha un timeout ~60s. `gemini-2.5-pro` su PDF/PNG di 1MB+ impiegava 35-40s + latenza upload → superava il limite e dava `Request failed with status code 504`.

**3 ottimizzazioni** in `/api/ai/floorplan-import`:
1. **Modello → `gemini-2.5-flash`** (era `gemini-2.5-pro`): 3-5× più veloce per task vision, qualità sufficiente per estrazione planimetrie.
2. **Output PDF → JPEG q=85 a 1200px lato lungo** (era PNG 1600px): payload -70%.
3. **Downscale anche immagini non-PDF**: PNG/JPG dell'utente vengono ridotti a 1200px JPEG q=85 prima di inviarle a Gemini. Anche le foto extra (max 5) ridotte a 1024px q=80.

**Benchmark**:
- Prima: ~35-40s (PDF 30KB + Gemini Pro)
- Dopo: **~8s totali end-to-end** (PDF→JPEG + Gemini Flash + post-processing)
- Margine di sicurezza vs limite 60s: 7×

## Recent Updates (Round 45 — Mag 2026 — Import planimetria: AI indipendente + piastrelle W×L)
### 🎯 Fix UX import planimetria (feedback utente)
**1. AI non condizionata dalle dimensioni utente**
- Prima: i campi `known_area_m2 / known_width_cm / known_height_cm` venivano inseriti nel **system prompt** come "Total floor area MUST be approximately X m²" → l'AI veniva guidata e tendeva a produrre già numeri vicini al target.
- Adesso: queste dimensioni sono usate ESCLUSIVAMENTE per il **post-processing matematico** (rescale finale). L'AI lavora autonomamente, poi il backend applica il fattore di scala alla pianta restituita.
- Risultato: AI libera + utente che corregge a posteriori. Test verificato: scenario AI-libera → `scale_applied: None`, scenario con area=70 → `scale_applied: {factor: 1.597}` applicato senza guidare l'AI nel prompt.

**2. Porta standard non più obbligatoria**
- Prima: `reference_door_cm` aveva default 80cm sempre inserito nel prompt.
- Adesso: campo VUOTO di default, inserito nel prompt SOLO se l'utente lo specifica. Placeholder: "es. 80 (lascia vuoto se non sai)".

**3. Piastrella con Larghezza × Lunghezza**
- Prima: campo singolo (assumeva quadrata).
- Adesso: 2 input separati `reference_tile_w_cm` × `reference_tile_l_cm` (es. 30×60 rettangolari, 20×120 listoni). Prompt si adatta: se w==l usa "square", altrimenti "WxL cm".

**4. UI modal rinnovata**
- Sezione 📏 **amber "Dimensioni reali"** (post-processing only) — tutti opzionali, con label esplicito "L'AI non viene influenzata".
- Sezione 🔍 **violet "Riferimenti visivi nelle foto"** (anchor visivi nel prompt) — porta + piastrella W×L.
- Sezione 📸 **blue "Foto aggiuntive"** invariata.

## Recent Updates (Round 44 — Mag 2026 — Import planimetria con dimensioni reali + foto multiple)
### 🎯 Calibrazione dimensionale planimetria (problema misure non realistiche)
**Causa**: l'AI Gemini stimava le dimensioni in cm a sentimento dalle proporzioni dell'immagine. Per locali fotografati o digitalizzati in scala arbitraria le dimensioni risultanti non corrispondevano alla metratura reale del cliente.

**Soluzione a 3 livelli**:

#### 1. Dimensioni note dell'utente (ground truth)
Nuovi campi nel modal Importa Pianta:
- **Metratura (m²)**: se fornita, l'output viene **scalato linearmente di √(target/current)** per ottenere esattamente la metratura totale dichiarata.
- **Larghezza + Profondità (m)**: scaling sull'ingombro complessivo (bbox) tramite media dei fattori width/height per mantenere proporzioni.
- **Porta standard (cm)**: anchor di calibrazione (default 80 cm).
- **Piastrella pavimento (cm)**: se le foto extra mostrano piastrelle visibili, l'AI le conta per derivare le dimensioni stanza.

**Post-processing backend** (`/api/ai/floorplan-import`): dopo aver ricevuto la pianta dall'AI, calcola l'area totale dei poligoni, confronta col target, applica il fattore di scala a tutti i punti rooms + walls. Ritorna `scale_applied: {by, factor, target_m2|target_w_cm/target_h_cm}` nella response.

**Test E2E**: target 120m² → output 120.00m² ✓ · target 10×8m → output 1000×800cm ✓

#### 2. Foto aggiuntive del locale (cross-check)
- Nuovo campo nel modal: upload fino a **5 foto** del locale reale (camere, bagno, cucina, ecc).
- Le foto vengono ottimizzate client-side (max 1280px JPEG q=0.8) e inviate come multimodal payload Gemini insieme alla pianta 2D.
- System prompt aggiornato: "Use the X ADDITIONAL PHOTOS to calibrate proportions: count visible doors/windows, count floor tiles, identify furniture (standard bed = 160×200cm, sofa = 200×90cm, toilet = 40×60cm, refrigerator = 60×60cm) and cross-check against the 2D plan."
- Response include `extra_photos_used: N`.

#### 3. UI/UX modal
- 2 sezioni colorate: 📏 amber per dimensioni note + 📸 blu per foto extra.
- Toast risultato include scala applicata e foto usate: `"Planimetria importata · 3 stanze · scalata a 85m² (×1.42) · 3 foto ref"`.

### Note tecniche
- Backend usa `pypdfium2` (PDF) e `LlmChat` Gemini multimodal con N immagini.
- I PDF passano per la stessa pipeline: prima pagina → PNG → eventuale rescale finale → AI.
- Frontend timeout 180s per gestire elaborazioni multi-foto.
- Limite hard: max 5 foto extra (oltre satura il prompt).

## Recent Updates (Round 43 — Mag 2026 — Import planimetria PDF)
### 📄 Import planimetria — supporto PDF
- **Causa**: il modal "Importa Pianta" accettava solo `image/*`. I PDF venivano rifiutati dal file picker e `optimizeImage` crashava sul tipo `application/pdf`.
- **Fix backend** (`server.py:/api/ai/floorplan-import`):
  - Nuova dipendenza `pypdfium2==5.8.0` (pure Python, niente poppler/system libs) — aggiunta a `requirements.txt`.
  - Rileva PDF da MIME (`application/pdf`) o da magic-bytes base64 (`JVBERi0` = `%PDF-`).
  - Converte la **prima pagina** in PNG @ scale 2.0 (~150 DPI), ridimensiona a max 1600px lato lungo, comprime PNG ottimizzato. Logging di dimensioni.
  - Errori PDF restituiti come HTTP 400 con messaggio chiaro ("Salva la planimetria come JPG/PNG e riprova").
- **Fix frontend** (`Editor.jsx`):
  - Input file `accept="image/*,.pdf,application/pdf"`.
  - Branch dedicato: i PDF bypassano `optimizeImage` e vanno al backend tal-quali. Le immagini continuano col flow esistente (ottimizzazione canvas).
  - Payload include `mime` (`"application/pdf"` o tipo originale) per indicare al backend cosa è arrivato.
  - Timeout esteso a 180s per i PDF (il rendering può richiedere qualche secondo extra).
- **Test E2E**: PDF di prova (3 stanze disegnate come rettangoli) → AI estrae correttamente 3 stanze (Cucina, Bagno, Camera) con 4 punti ciascuna. ✅

## Recent Updates (Round 42 — Mag 2026 — Chiusura lista 10 punti utente)
### 📁 Documenti Aziendali Template (NUOVO)
- Backend: 4 endpoint `/api/documenti-template/*` (admin POST/DELETE, all-roles GET). File su `/app/backend/uploads/tpl-{uuid}.{ext}`, collection `documenti_template`. Tipi predefiniti: contratto_cliente, contratto_subappalto, capitolato, privacy_gdpr, checklist_sopralluogo, verbale_consegna, sal_template, altro.
- Frontend: `AdminDocumentiTemplate.jsx` con upload (drag&drop file), raggruppamento per tipo, download, delete (admin only). Sidebar: nuova voce **Documenti Aziendali** (FileText icon) visibile ad admin/venditore/gestore. Per venditori/PM: solo lettura + download.
- Use case: admin carica una volta i contratti/capitolati vergini, venditori e PM li scaricano per farli firmare al volo a cliente/sub.

### 🎯 Wall_side positioning — FIX DEFINITIVO (ricorrente da 3 round)
- **Causa root**: `nearestWallNormal` (2D) e `sideOffset` (3D) consideravano SOLO `walls` espliciti. Le **quick-room** (Cucina/Bagno/Camera) sono poligoni `rooms.points` senza wall objects → la funzione falliva e tornava normale di default `(0,1)` → l'elemento non si spostava o si spostava nella direzione sbagliata.
- **Fix**: entrambe le funzioni ora iterano ANCHE i segmenti del perimetro stanza. Per ogni segmento stanza, la normale viene orientata **verso il centroide del poligono** = verso l'interno della stanza. Convenzione finale:
  - **Lato A (-1)** = esterno stanza (fuori dal poligono)
  - **Sul muro (0)** = centrato
  - **Lato B (+1)** = interno stanza (verso il centro del poligono)
- Pannello proprietà aggiornato con sotto-label "(esterno/centro/interno)" + tip "Lato B punta sempre verso l'INTERNO della stanza più vicina".
- Riguarda elementi: electrical, plumbing, gas, hvac (sia 2D che 3D).

### 🎨 Porte / Finestre — Colore + Maniglie
- **Porta**: nuova sezione pannello proprietà con:
  - 8 colori battente (Bianco/Noce/Rovere/Wengé/Grigio/Antracite/Nero/RAL custom con input hex)
  - 5 modelli maniglia (Classica/Moderna/Minimal/Retrò/Pomo per blindate)
  - 6 finiture maniglia (Cromato/Satinato/Nero opaco/Ottone/Oro rosa/Bianco)
- **Finestra**: oltre al `frameColor` già esistente, aggiunti:
  - 4 modelli maniglia (Cremonese classica/Design moderno/Minimal/Con chiave)
  - 5 finiture (Stesso colore telaio/Cromato/Satinato/Nero opaco/Ottone)
- **3D**: `Viewer3D.jsx` ora applica `doorColor` (con mappa 8 colori + fallback RAL hex) e `handleFinish` su maniglie (cromato/satinato/nero/ottone/oro-rosa/bianco). Pomo per porte blindate (sfera 6cm) vs maniglia (cilindro).
- Tutti i nuovi campi salvano in `data-testid` standardizzati: `door-color-*`, `door-handle-model`, `door-handle-finish`, `win-handle-model`, `win-handle-finish`.

### 🤖 Rendering AI — fedeltà alla pianta 2D
- **Prompt riscritto**: 4 STRICT INSTRUCTIONS che dicono al modello di trattare la pianta 2D come **TECHNICAL DRAWING** da rispettare (non come "inspiration"). Preserve wall positions, room shapes, room counts, opening locations. NO add/remove rooms o muri.
- **`project_summary` strutturato**: frontend ora invia oltre al PNG anche un riassunto JSON con elenco stanze (nome + area m² + materiale pavimento + colore pareti) + totali (m² totali, numero porte/finestre/muri). Il backend lo inserisce nel prompt come "FLOORPLAN STRUCTURE (use these EXACT rooms with EXACT proportions)" → l'AI ha contesto preciso.
- **System message** rinforzato: "Treat the 2D image as a TECHNICAL DRAWING that must be respected in every wall position, room shape and opening location. Do not invent rooms or walls."

### 📊 Errore caricamento Nuovo Preventivo
- Toast generico `"Errore caricamento"` sostituito con messaggio dettagliato che mostra il vero error code (`response.data.detail` / `statusText` / `message`) + console.error per debug. Permette di capire al volo se è la rete, un endpoint giù, o un dato corrotto.

### 📊 Resoconto costi commessa
- **Verificato**: `routes_commessa_workflow.py:516,528` usa già `prezzo_acquisto` da `voci_backoffice` per il `costo_previsionale` e `costo_confermato`. Il backend è corretto. Se la commessa non mostra numeri:
  - Apri tab **Computo Metrico** → se vuoto, clicca "Rigenera" (popola dal preventivo).
  - Verifica che le voci del preventivo abbiano `voce_id` matchabili nel DB voci_backoffice.

## Recent Updates (Round 41 — Mag 2026 — Bug critici CAD + UX Workflow)
### 🔴 BUG CRITICO CAD risolto (P0): aggiungere muro faceva DIMINUIRE preventivo
- **Causa**: `applyWallAddWithSplit` in `Canvas2D.jsx:1905` divideva la stanza in 2 nuove con ID nuovi MA non migrava `tiling`, `demolitions`, `controsoffitti` che riferivano il vecchio roomId → diventavano orfani e il pavimento spariva dal preventivo. L'utente vedeva totale calare da €8.449 a €4.743 dopo aver disegnato un muro divisorio.
- **Fix**: riscritta `applyWallAddWithSplit` per:
  - Migrare `tiling` con `roomId === splitRoomId`: assegna alla nuova stanza che contiene `startPoint`, oppure duplica su entrambe se non c'è punto di riferimento.
  - Migrare `demolitions` (pavimento/rivestimento): usa centroide del `polygon` o coordinata `(x,y)` per scegliere la stanza giusta; demolizioni totali vengono duplicate.
  - Migrare `controsoffitti`: stessa logica.
  - Mantenere tutte le altre proprietà (electrical, plumbing, paint, progetto overrides) via spread di `baseProps`.

### 🟡 UX Workflow Commessa
- ✅ **Tab Lavorazioni / Calendario**: riscritta da vista 4 mesi (120 giorni · 18px/giorno) a **vista mensile** con:
  - Header con ◀ Mese AAAA ▶ + bottone **Oggi**.
  - Larghezza giorno aumentata a 38px (più leggibile).
  - Etichette "Lun/Mar/…" + numero giorno.
  - Bar lavorazioni clippate al mese visibile (durata totale mostrata tra parentesi).
  - testid: `lav-prev-month`, `lav-next-month`, `lav-month-label`, `lav-today`.
- ✅ **Tab Voci e Acquisti**: ora ogni riga si **collega al listino backoffice**:
  - Select voce_backoffice (al posto di input testo libero, ma testo libero rimane come fallback).
  - Nuova colonna **Qty** + nuova colonna **Stima nostra** = `voce.prezzo_acquisto × qty` (in blu).
  - Nuova colonna **Δ vs stima** = preventivato_sub − stima (rosso se sub sopra stima, verde se sotto).
  - Tfoot con totali Stima · Preventivato · Δ.
  - testid: `va-voce-link-{i}`, `va-qty-{i}`, `va-stima-{i}`.

### 🟡 CAD — Pilastri/Colonne con dimensioni custom
- ✅ Editor.jsx — nuovo state `columnSize = {w, d, h}` con 3 input (L/P/H in cm) + 4 preset rapidi (30×30, 40×40, 50×50, 60×25) sotto il selettore tipo pilastro.
- ✅ Canvas2D.jsx — placement usa `columnSize` invece di valori hardcoded `{30,30}`. Banner aggiornato a `pilastro · cemento · 30×30×270cm · click per posizionare`.
- ✅ Il pannello proprietà del pilastro selezionato continua a permettere l'edit post-creazione.

## Recent Updates (Round 40 — Mag 2026 — Fix marginalità Pacchetti & Voci)
- 🐛 **BUG CRITICO P0 risolto**: la card "Pacchetti & Voci" mostrava marginalità sbagliate (BASIC 4.2%, PREMIUM -17.1%, ELITE 34.6%). Il calcolo costi usava `prezzo_rivendita` (= prezzo di vendita al cliente) invece di `prezzo_acquisto` (= costo netto al fornitore). Identico errore del foglio Numbers di confronto del cliente.
- ✅ **Fix in `/app/frontend/src/pages/admin/AdminPacchetti.jsx`** (linee 54-61, 87-98, 250):
  - `costi = Σ (qty × prezzo_acquisto)` per voce inclusa (costo netto al fornitore)
  - `rivenditaTotale = Σ (qty × prezzo_rivendita)` (somma listino se vendute singolarmente)
  - `Margine con pacchetto = (ricavo - costi) / ricavo` ← KPI principale
  - `Margine con listino = (rivendita_tot - costi) / rivendita_tot` ← KPI confronto
- ✅ **UI migliorata**: card pacchetto ora mostra 4 KPI invece di 3 (Ricavo · Costo netto · Rivendita totale · Margine pacchetto + Margine listino). Layout 2×2 + riga full-width per margine listino.
- ✅ **Preview MQ diversi** (50/70/90/120) corretta con stesso fix + label "Ricavo / Costo netto / Margine".
- ✅ **Verifica numeri post-fix con DB attuale** (70mq):
  - BASIC:   ricavo €26.600 · costo netto €5.566 · margine **79.1%** (era 4.2%)
  - SMART:   ricavo €34.300 · costo netto €15.526 · margine **54.7%** (era 5.5%)
  - PREMIUM: ricavo €55.300 · costo netto €34.327 · margine **37.9%** (era -17.1%)
  - ELITE:   ricavo €82.600 · costo netto €28.542 · margine **65.4%** (era 34.6%)
- ⚠️ **Backend già corretto**: `routes_commessa_workflow.py:516,528` calcola correttamente `costo_previsionale/confermato` su `prezzo_acquisto`. Bug era esclusivamente lato frontend admin card.
- 🟡 **Discrepanza residua col foglio Numbers del cliente**: il foglio "PREVENTIVATORE SOFT" indica per BASIC@70mq costi netti €13.743 / margine 48.33%. Il nostro DB BASIC ha qty incluse più magre (€5.566). Serve allineare le `qty_ratio` delle voci pacchetto al foglio Numbers (lavoro separato, da confermare voce per voce).

## Recent Updates (Round 39 — Feb 2026 — Unificazione definitiva + auto-computo + voci preventivo)
- ✅ **UNA SOLA pagina commessa**: `DettaglioCommessa` ora redirige sempre a `/commesse/{id}/workflow`. Eliminata ogni duplicazione di tab Documenti/Computo.
- ✅ **11 tab nel Workflow** (era 9): Contratto · Checklist · Documenti · Materiali · Computo · Artigiani/Sub · **Lavorazioni/Calendario (NEW)** · Fasi cantiere (Gantt) · **Voci e Acquisti (NEW)** · Cassa & Pagamenti · Resoconto.
- ✅ **Lavorazioni / Calendario**: nuova tab con vista giornaliera a 4 mesi (120 giorni), barre colorate per ogni lavorazione, drag&edit data inizio/fine, sub-appaltatore assegnato, 8 colori a scelta. Modal di edit con date, colore, note.
- ✅ **Voci e Acquisti**: nuova tab con riconciliazione preventivato vs effettivo per ogni sub/fornitore. Colonne: Voce, Sub-appaltatore, Preventivato, Effettivo, **Δ** (rosso se sforato, verde se sotto budget), Pagato. Tfoot con totali.
- ✅ **Auto-generazione computo metrico** alla creazione commessa da preventivo accettato: legge `preventivo.items[]`, costruisce `commessa.computo_metrico` automaticamente (niente più click manuale su "Rigenera"). Codice in `routes_biz.py:create_commessa`.
- ✅ **Riepilogo preventivo mostra le voci**: nello Step 6 (Riepilogo) del `PreventivoPacchetto.jsx` ora c'è una tabella dettagliata con tutte le `prev.items[]` (Voce, Qty, U.M., Prezzo, Totale). Righe `from_configuratore` evidenziate in ambra.

## Recent Updates (Round 38 — Feb 2026 — Notifiche Live cross-cantieri)
- ✅ **`GET /api/dashboard-alerts`**: endpoint aggregato che restituisce:
  - `scadenze_scadute`: pagamenti programmati con data passata (border-left rosso).
  - `scadenze_imminenti`: pagamenti entro 7 giorni (border-left ambra).
  - `documenti_sub_alert`: documenti sub-appaltatori scaduti o in scadenza ≤30gg (border-left viola).
  - `checklist_alerts`: cantieri aperti da >30gg con step critici mancanti (contratto firmato, pratica edilizia, materiali, computo) (border-left blu).
  - `totale_alert_critici`: contatore aggregato per badge sidebar.
  - Filtra per `venditore_id` se il ruolo è "venditore".
- ✅ **`DashboardAlerts.jsx`** (nuovo componente): mostrato in cima a `Dashboard.jsx` (admin/gestore/utente) e `DashboardVenditore.jsx`. Sezioni collassabili, click su un alert → naviga al workflow della commessa o al dettaglio del sub-appaltatore. Stato "Tutto sotto controllo" verde quando 0 alert.
- ✅ **Sidebar badge rosso pulsante** su "Dashboard" con conteggio alerts (polling ogni 3 minuti per admin/venditore/gestore). Testid: `sidebar-alert-badge`.

## Recent Updates (Round 37 — Feb 2026 — Big Fix: 12 user complaints risolti)
### Bug critici prezzi (P0)
- ✅ **Configuratore Esigenze**: prezzi finali non matchavano i pacchetti. Il calcolo leggeva `prezzo_mq` (null) invece di `price_per_m2` ed aveva fallback errati (380/580/850/1300). Fix: ora legge `price_per_m2` con fallback corretti **380/490/790/1180**.
- ✅ **Pacchetto base**: contava extra anche senza modifiche. La `unit_price` iniziale era il `prezzo_rivendita` pieno invece della soglia `unit_price_pkg` → per voci `modificabile_dal_venditore` veniva sempre incluso `(prezzo_rivendita - unit_price_pkg) * incl` come extra. Fix: default a `unit_price_pkg`.
- ✅ **Computo metrico non si generava**: il backend cercava `voci_dettaglio[]` o `computo[]` ma i preventivi reali hanno `items[]`. Fix: ora legge `items[]` (formato PreventivoIn standard) con fallback ai legacy.

### Workflow Cantieri unificato (P1)
- ✅ **De-duplicazione "Documenti"**: `DettaglioCommessa` redirige automaticamente a `/commesse/{id}/workflow`. Niente più tab gemelle.
- ✅ **9 tab nel Workflow** (era 8): Contratto · **Checklist venditore (NEW)** · Documenti · Materiali · Computo · Artigiani/Sub · Fasi cantiere · Cassa & Pagamenti · Resoconto.
- ✅ **Computo metrico in 3 viste**:
  - **Con prezzi** (interna): voce, qty, U.M., prezzo unit., totale + tfoot totale.
  - **Senza prezzi (per artigiani)**: stampabile in PDF per richiesta preventivo.
  - **Assegnazione voci**: barra avanzamento %, filtri Tutte/Assegnate/Da assegnare, bottone "Assegna" per riga con modal (artigiano/interno/autorizzato, scelta da preventivi caricati o nome libero, note). Le assegnazioni vengono **preservate** se rigenero il computo.
- ✅ **Cassa con scadenze pagamenti**:
  - 5 KPI: Incassato · Da incassare · Uscite pagate · Da pagare · Saldo cassa.
  - 3 viste: **Riepilogo per beneficiario** (pagato/da pagare/scaduto/prossima scadenza per ogni sub/fornitore), **Scadenze pagamenti** (ordinate per data con badge SCADUTO), **Storico movimenti**.
  - Nuovo form: stato_pagamento (pagato/programmato), data_scadenza, beneficiario_tipo (cliente/subappaltatore/fornitore/interno), categoria (acconto/avanzamento/saldo/materiali/extra).
  - Marginalità ricalcolata: solo movimenti `pagato` contano; `da_incassare_scadenze`/`da_pagare_scadenze` esposti.
- ✅ **Checklist Venditore anti-dimenticanza**: 12 step (dati cliente, contratto firmato, acconto, pratica edilizia, progetto CAD, materiali firmati, computo generato, preventivi artigiani, fasi pianificate, foto rilievo, GDPR, data inizio). Barra avanzamento % step critici. Badge "Critico" rosso per step obbligatori mancanti.
- ✅ **Materiali tab più chiara**: tooltip su colonne ("Da listino interno", "Descrizione/modello scelto", "U.M.", "Prezzo unit. al cliente"), placeholder esempi ("Piastrella Marazzi 60x60..."), label "Confermato/firmato dal cliente (blocca cambi senza extra)".
- ✅ **Gantt Fasi ingrandito**: COL_W 28-60px (era 20-40), ROW_H 44px (era 32), LABEL_W 240px, weekend evidenziati in ambra, header date più grandi (12px), titolo + esecutore + giorni durata visibili in ogni barra.

### Sub-appaltatori — Documenti + Affidamento (P1)
- ✅ **Sezione Documenti sub-appaltatore** in `SubappaltatoreDettaglio`: 9 tipi richiesti (DURC, visura camerale, carta d'identità, assicurazione RC, INPS/INAIL — **5 obbligatori**; SOA, ISO 9001, misure/strumenti, altro — opzionali). Upload PDF/JPG/PNG con data emissione/scadenza, badge MANCANTE/SCADUTO/OK.
- ✅ **Badge "Pronto per ricevere affidamenti"** (verde) / **"Documenti incompleti — NON può ricevere affidamenti"** (rosso) in alto a destra.
- ✅ **VINCOLO 3 in `POST /subappaltatori/assegna`**: oltre a (preventivo accettato + contratto subappalto firmato), ora richiede TUTTI i documenti obbligatori validi e non scaduti. Solo l'**admin** può comunque effettuare l'affidamento (già esistente).
- ✅ Endpoint nuovi: `GET /subappaltatori/tipi-documenti`, `GET /{id}/documenti`, `POST /{id}/documenti`, `DELETE /{id}/documenti/{doc_id}`, `GET /{id}/ready-check`.

## Recent Updates (Round 36 — Feb 2026 — Drag&drop impianti in 3D + UX Toaster)
- ✅ **3D — Inserimento diretto impianti via click** (P1 richiesta utente):
  - Quando l'utente attiva un tool MEP (Elettrico / Idraulico / HVAC / Gas) e poi clicca su un muro nel 3D, viene piazzato un nuovo punto sulla parete colpita.
  - Calcolo automatico: `x,y` proiettati sul segmento del muro, `wall_side` (-1/+1) dal segno del prodotto scalare con la normale del muro, `height_cm` dalla Y del click (clamp [5, roomHeight-5]).
  - Toast conferma `✓ Presa aggiunta in 3D · h=XXcm` + banner viola pinned in alto-sinistra del 3D `🎯 Modalità inserimento <tool>...` con `data-testid='3d-placement-hint'`.
- ✅ **3D — Drag punti MEP esistenti**: estesi i `Picker3D` draggable kinds a `electrical/plumbing/hvac/gas`. Drag libero su XZ, commit aggiorna `x,y` nello state. Era già supportato per items/walls/rooms/doors/windows/columns; ora completo per tutti i MEP.
- 🐛 **FIX UX HIGH**: Sonner Toaster era `position='top-right'` → si sovrapponeva al bottone Salva del header (top-right). Sposta cliccato a `position='bottom-right'`. Risolve il "Salva no-op silenzioso" segnalato dal testing agent.
- 🔧 **Unificazione `uid()`** per i nuovi punti MEP (era `Math.random().toString(36).slice(2,10)`).

## Recent Updates (Round 35 — Feb 2026 — Wall Prospetto Editor + MEP in 3D)
- ✅ **WallProspettoEditor** (richiesta utente più volte: "il muro devo poterlo ruotare di 180 gradi… così posso aggiungere ciò che voglio"):
  - Modal a schermo intero che apre il prospetto di UN SINGOLO muro selezionato.
  - Toolbar: ⚡ Elettrico (con kind: presa/luce/interruttore/spia) · 💧 Idraulico (acqua/scarico) · ❄ HVAC (split).
  - Click sul prospetto → piazza il punto a posizione X (cm da sx) e altezza Y (cm da pavimento) con toast conferma.
  - Bottone "🔄 Ruota 180° (mostra l'altro lato)" cambia Lato A↔B; i punti su ciascun lato sono memorizzati con `wall_side` (-1/+1).
  - Liste separate Lato A (fronte) e Lato B (dietro) con bottone elimina per ogni punto.
  - Se entrambi i lati hanno impianti → banner verde "genera 2 prospetti separati nelle Tavole".
  - **FIX critico**: `setWallProspettoId is not defined` in PropertiesPanel (era dichiarato in scope Editor) → ora passato come prop `openWallProspetto`.
- ✅ **Viewer3D — render impianti MEP** (era completamente assente: il 3D mostrava solo muri/stanze/porte/finestre/items/colonne):
  - `renderMep()` aggiunto in `buildScene` per `electrical`, `plumbing`, `hvac`, `gas`.
  - Posizionamento Y intelligente: `floor=true` → Y=2cm (a pavimento, marker ring arancione); altrimenti `height_cm` o STD_H standard (presa=30, luce=110, split=230, scarico=30, ecc.).
  - Side offset rispetto al muro più vicino (~15cm) basato su `wall_side`.
  - Geometrie distintive: split (cuboide 80×25×18cm bianco), caldaia (45×70×35), VMC (60×25×25), quadro (35×50×12), luce (sfera + PointLight), plumbing (cilindro), default outlet (cubo 10×10×4cm).
  - Colori per kind: luce=ambra, deviatore=violet, presa-tv=ciano, presa-cucina=arancio, scarico=nero, calda=rosso.
- ✅ **`A pavimento` Switch**: testid stabile `mep-floor-toggle` (era dinamico `${kind}-floor-toggle`). Per cucina ad isola, prese centro stanza.

## Recent Updates (Round 34 — Feb 2026 — AI sul 2D + Composite voci editabili)
- ✅ **AI assistente CAD 2D** (richiesta utente: l'AI deve modificare gli spazi via comando):
  - Endpoint backend `POST /api/ai/cad-edit` → LLM **Claude Sonnet 4.5** (tool-use via JSON strutturato) con summary del progetto.
  - Bottone toolbar editor "AI 2D" (icona Sparkles violetta).
  - Pannello chat fluttuante in basso-destra (`AiCadEditPanel.jsx`) con storico, esempi, input multilinea.
  - 16 operazioni supportate: `addWall, removeWall, moveWall, markWallDemolished, addRoom, removeRoom, renameRoom, addDoor, addWindow, moveDoor, moveWindow, removeDoor, removeWindow, addElectrical, addPlumbing, addColumn, paintWall, paintAllWalls, splitRoomByLine, noop`.
  - Coordinate in cm, rispetta `view_mode` (in Progetto applica override su Stato di Fatto).
  - Test endpoint OK: comando italiano → JSON ops parsable → applicazione al state.
- ✅ **Composite — voci editabili dal venditore**:
  - 5 voci FORNITURA marcate `modificabile_dal_venditore=true` nel `COMPOSITE_SECTIONS` seed (costo fornitura piastrelle/parquet, rivestimento, sanitari, rubinetterie, corpi illuminanti).
  - UI `PreventivoComposite.jsx`: per voci modificabili il prezzo diventa un Input editabile inline; per le lavorazioni resta locked (🔒) e mostrato come listino read-only.
  - Badge visivi: "prezzo editabile" (emerald) vs "🔒 lavorazione" (zinc).
  - Save salva il prezzo custom in `composite_selections[].price` + flag `modificabile_dal_venditore` per audit.

## Recent Updates (Round 33 — Feb 2026 — Piastrelle solo catalogo, Prospetti tabella quote, Tile 3D)
- ✅ **Piastrelle SOLO dal Catalogo (sinistra)**: il pannello "Prezzi Negoziati" (destra) ora ESCLUDE le categorie `PAVIMENTAZIONE_GRES`, `PAVIMENTAZIONE_PARQUET`, `PAVIMENTAZIONE_LAMINATO`, `PAVIMENTAZIONE_MARMO`, `RIVESTIMENTO_PIASTRELLE`. Il tipo materiale pavimento si gestisce solo dal catalogo per stanza.
- ✅ **Tile in 3D adesso visibili in QUALSIASI fase** (era visibile solo in viewMode='progetto'): se l'utente posa una tile sul pavimento di una stanza, il colore appare sia nello "Stato di Fatto" sia in "Progetto" (con priorità al progetto se entrambi presenti).
- ✅ **Tile salva la `phase` corrente**: posando una tile in fase Progetto, non sovrascrive quella dello Stato di Fatto. Filtraggio Viewer3D per phase coerente al viewMode attivo.
- ✅ **Prospetti — quote NON più sovrapposte**: rimosse le quote sx/dx/h disegnate "sotto la parete" che si sovrapponevano quando i punti erano vicini. Sostituite con una **TABELLA ordinata** sotto il prospetto con header `N° | SIGLA | SX (cm) | DX (cm) | H (cm)` + leader line tratteggiata che collega il punto sulla parete alla sua riga in tabella. Riga unica per punto, zebra striping, nessuna sovrapposizione possibile.
- ✅ **Pilastro in toolbar Base** (conferma posizione: tra "Scala" e "Arredo", icona Square) — già aggiunto in Round 30.

## Pending — confermati per il prossimo round
- 🟡 **AI sul 2D — modificare spazi via comando** (feature grande, 1 round dedicato): richiede LLM con tool-use (`addWall / removeWall / mergeRoom / splitRoom / moveWindow / moveDoor / addElectricalPoint / ...`).
- 🟡 **Composite — voci editabili dal venditore**: il flag `modificabile_dal_venditore` esiste già nel DB per ogni voce. Serve UI nell'Admin Voci Backoffice per togglare on/off + far apparire la differenza nel composite editor (input prezzo abilitato vs locked).
- 🟡 Auto-snap impianti su muro
- 🟡 Email reale (SendGrid/Resend) per OTP

## Recent Updates (Round 32 — Feb 2026 — Wall color override, Voci Pavimentazione split, JWT 8h)
- ✅ **Wall color NON sbava più sullo "Stato di Fatto"**: in modalità "Progetto" tutte le modifiche (paintColor / decorVoceId / decorVoceName / decorVocePrice) vengono salvate come **override in `wall.progetto.*`** invece di mutare l'oggetto base. Lo Stato di Fatto resta intatto. Banner amber sul pannello in modalità Progetto:  "⚙️ Modalità Progetto: il colore/decorazione viene salvato SOLO come override progetto (lo Stato di Fatto resta intatto)". Anche il bottone "Applica a tutta la casa" rispetta il viewMode.
- ✅ **Rendering 2D + 3D** legge `wall.progetto.paintColor` quando viewMode='progetto' (con fallback a `wall.paintColor`).
- ✅ **Voci Backoffice — SPLIT PAVIMENTAZIONE** (richiesto utente più volte):
  - Nuove categorie: `PAVIMENTAZIONE_GRES`, `PAVIMENTAZIONE_PARQUET`, `PAVIMENTAZIONE_LAMINATO`, `PAVIMENTAZIONE_MARMO`, `RIVESTIMENTO_PIASTRELLE`
  - Endpoint `POST /api/voci-backoffice/migrate-pavimentazione` (admin) eseguito → 14 voci spostate da MURATURA alle nuove categorie + `modificabile_dal_venditore=true` applicato. Cosi puoi:
    - Includere nei pacchetti "X m² di Gres con prezzo MAX €Y" indipendentemente dalla scelta del cliente (può scegliere tra tutti i Gres della categoria)
    - L'extra scatta sia su quantità sia su prezzo (riservato ai materiali modificabili)
- ✅ **JWT access token esteso da 60 min → 8 ore** + **auto-refresh** nel client API axios (response interceptor 401 → POST `/auth/refresh` → ripeti). Risolve l'errore "token scaduto" durante sessioni lunghe (rendering AI, modellazione, ecc.).
- ✅ **"Listino personalizzato" rinominato "🏷️ Prezzi NEGOZIATI con il tuo fornitore"** e nascosto in `<details>` collassato di default con helper esplicativo: distingue **scegliere il TIPO** (catalogo) da **cambiare il PREZZO** (override). Tolto il box blu "Per aggiungere voci dal catalogo…" perché ridondante.

## Pending / Da fare nel prossimo round
- 🟡 **AI sul 2D — modifica spazi via comando** (feature nuova grande):
  - Chat AI in cui chiedi "togli il muro tra cucina e soggiorno" / "ridisegna 2 stanze da una grande" → l'AI ha tool-call per `addWall / removeWall / addRoom / moveWindow / ecc.` e modifica direttamente `project.data`. Richiede LLM con function calling (Claude Sonnet 4.5 o GPT-5.2) + un set di tools mappati a operazioni sul progetto. Stima: 1 round di lavoro dedicato.
- 🟡 **AI rendering**: la chiamata Gemini funziona, ma se vedi ancora errori dopo questo fix, è probabilmente esaurimento credito Emergent LLM. Verifica balance dal Profilo → Universal Key.
- 🟡 Auto-snap impianti su muro più vicino
- 🟡 Email reale (SendGrid/Resend) per OTP

## Recent Updates (Round 31 — Feb 2026 — Configuratore Infissi unificato)
- ✅ **Componente condiviso `AbacoInfisso`** in `/app/frontend/src/components/AbacoInfisso.jsx`: stessa anteprima usata in 3 punti (PreventivoInfissi, InfissoQuickConfigurator, CAD finestre).
  - Supporta size `big` (560×360 per pagina dedicata) e `mini` (360×220 per dialog/pannelli)
  - Render condiviso → modifiche grafiche da farsi in un solo punto
- ✅ **Anta singola: lato cerniera + maniglia visibili**:
  - Nuovo campo `hingeSide: 'sx' | 'dx'` per anta singola battente
  - Rendering: 3 cerniere sul lato scelto + cremonese (barra + pomello + maniglietta orizz.) sul lato opposto
  - UI bottoni espliciti: "◀ Sinistra (cerniera sx · maniglia dx)" / "(cerniera dx · maniglia sx) Destra ▶"
  - Etichetta riepilogativa nel SVG: `... · 1 ANTA · cardine SX · ...`
  - Per ante > 1: cerniere ed maniglie distribuite auto come industria reale (esterne incernierate ai bordi, interne verso il bordo più vicino)
- ✅ **CAD finestre — pannello proprietà arricchito**:
  - Anteprima AbacoInfisso in cima al pannello (mini)
  - Nuovi campi: ante (1-4), colore telaio (bianco/antracite/grigio/marrone/noce/rovere), tipo vetro, switch tapparella, switch zanzariera
  - Il cardine già esisteva (hinge left/right) ora mappato a hingeSide del configuratore
- ✅ **3D Finestre — vetro TRASPARENTE** (era tinta unita):
  - Telaio CAVO (4 box: top/bottom/left/right) invece di 1 box pieno → il vetro è visibile
  - Vetro `THREE.MeshPhysicalMaterial` con `transmission: 0.85`, `transparent: true`, `opacity: 0.5`, `ior: 1.4` → trasparenza fisica
  - Vetro suddiviso per ante (con divider verticale tra anta e anta)
  - Davanzale 3D separato (3cm spessore)
  - Cassonetto tapparella 3D sopra la finestra quando `tapparella = true`

## Recent Updates (Round 30 — Feb 2026 — Nuovo tool Pilastro/Colonna)
- ✅ **Tool CAD "Pilastro"** (richiesta utente: prima li disegnava con muri mattone → diventavano "stanze strane"):
  - **3 tipi**: Cemento armato (180€/pz), Muratura mattone (95€/pz), Cartongesso rivestimento (65€/pz)
  - 3 nuove voci backoffice aggiunte via `seed-missing` (`voce-pilastro-cemento`, `voce-pilastro-mattone`, `voce-pilastro-cartongesso`) — categoria MURATURA, unit=`pz`, NON modificabile dal venditore
  - Render **2D** in `Canvas2D.jsx`: rect orientabile con colore differenziato per kind, diagonali del simbolo CAD, label "P" centrale
  - Render **3D** in `Viewer3D.jsx`: BoxGeometry verticale a tutta altezza (default 270cm) — colore beton/mattone/cartongesso
  - **Drag&drop** funzionante sia in 2D sia in 3D (estesi `Picker3D` + `Canvas2D` drag handlers)
  - Pannello **proprietà** con select tipo + larghezza/profondità/altezza/rotazione + bottone elimina
  - **Estimation**: i pilastri vengono conteggiati a PEZZO (NON come muri → niente più stanze strane). Mappato via `VOCE_MAP` `pilastro_cemento` / `pilastro_mattone` / `pilastro_cartongesso` → voce backoffice corrispondente
  - Banner placement: "pilastro · cemento · click per posizionare"

## Recent Updates (Round 29 — Feb 2026 — Fix dolorosi Round 28 utente)
- ✅ **3D Orbit non più ruba il drag**: shared `dragActiveRef` tra `Picker3D` e `OrbitLite`. Quando l'utente afferra un muro/stanza/oggetto la camera NON orbita più. Era la causa di "muovo un muro e gira tutta la stanza".
- ✅ **WallSideIndicator funziona davvero**: aggiunto **offset visivo fisico** dell'elemento di 18cm in direzione del lato del muro selezionato (lato A / Centro / lato B). Prima la freccia si vedeva ma l'elemento restava sul muro — ora si sposta visibilmente nel lato della stanza scelto. Helper `sidePosition(walls, x, y, side)` applicato a electrical/plumbing/gas/hvac. Pannello proprietà riscritto con bordo violetto spesso, descrizione chiara "Su quale lato del muro?" e bottoni più grandi.
- ✅ **Extras prezzo SOLO per MATERIALI modificabili**: ripristinata la logica eccedenza prezzo sopra soglia pacchetto, ma con regola precisa:
  - Materiali (`modificabile_dal_venditore = true`): extras = qty_extras × prezzo + (prezzo > soglia ? (prezzo − soglia) × incluse : 0)
  - Lavorazioni (non modificabili: muratura, impianti, etc): SOLO qty_extras (mai extras prezzo)
  - Voce non inclusa nel pacchetto (incl=0): tutta extra (qty × prezzo)
- ✅ **Configuratore Infissi RIDISEGNATO**:
  - LEFT: **Tipologia** dropdown a solo 2 opzioni (Finestra · Porta-finestra)
  - RIGHT: **Apertura** (Battente · Scorrevole +20%) + **Numero ante** (1/2/3/4)
  - Misure GROSSE in cassetto giallo dedicato (Larghezza / Altezza / Qty input h-12 text-2xl font-extrabold)
  - Anteprima SVG molto più grande (560×360) con quote numeriche **visibili** (era il bug `{larghezza} cm` come 2 child SVG → ora `{`${larghezza} cm`}` template literal)
  - Etichetta riepilogativa in basso al SVG: `FINESTRA · BATTENTE · 2 ANTAE · PVC bianco · Doppio vetro`
  - Cerchi numerati 1/2/3/4 sulle ante chiari
  - tipologia_id calcolato automaticamente da `resolveTipologiaId(categoria, apertura, ante, tipologie)` per il pricing backend
  - Backward-compat per preventivi infissi salvati prima del refactor (deriva categoria/apertura da tipologia_id legacy)

## Pending / Da fare in prossimo round (per chiarezza)
- 🟡 **Voci Backoffice — split materiali pavimentazione**: togliere "Gres / Laminato / Parquet" dalla categoria MURATURA e creare categorie dedicate (PAVIMENTAZIONE_GRES, PAVIMENTAZIONE_LAMINATO, PAVIMENTAZIONE_PARQUET) — richiede migrazione DB + UI AdminVociBackoffice. Il listino voci_backoffice ha già le voci tile-specific (voce-gres-*, voce-laminato-*, voce-parquet-*) ma sono sotto "MURATURA".
- 🟡 **Sezione Infissi nel Voci Backoffice**: oggi i prezzi infissi sono via `/api/infissi-config` (admin endpoint separato). Linkare con voci_backoffice (voce-infissi-pvc, voce-infissi-alluminio, voce-infissi-legno esistono già).
- 🟡 **Auto-snap al muro durante posa impianti**: quando si piazza un elettrico/idraulico, lo snap dovrebbe essere automatico al muro più vicino + impostare wall_side = lato della stanza nella quale si è cliccato.

## Recent Updates (Round 28 — Feb 2026 — Fix critici Round 27 utente)
- ✅ **Extras Pacchetto: regola corretta** — gli extras ora vengono conteggiati SOLO se `qty_richiesta > included_qty` oppure se `included_qty === 0`. Rimossa la vecchia logica "price-over-soglia su qty inclusa" che gonfiava il preventivo. La soglia pacchetto resta come avviso informativo amber sopra l'input (non genera più extra).
  - Caso A: qty=10, incl=15, prezzo=30€ → Extra: 0€ ✓
  - Caso B: qty=20, incl=15, prezzo=30€ → Extra: 5 × 30 = 150€ ✓
  - Caso C: qty=10, incl=0, prezzo=30€ → Extra: 10 × 30 = 300€ ✓
- ✅ **Input numerici NON vanno più negativi**: aggiunto `min={0}` a TUTTI gli input number in PreventivoPacchetto, PreventivoInfissi, PreventivoBagno, PreventivoComposite, InfissoQuickConfigurator (mq, qty, sconto, IVA, prezzo, larghezza, altezza, sicurezza%, dir. lavori%). Validazione anche on-change con `Math.max(0, …)`.
- ✅ **Configuratore Infissi ANTE visibili**: separatori spessi (rect 6px) + cerchi numerati `1/2/3/4` in basso a ogni anta nell'AbacoInfisso SVG (sia PreventivoInfissi sia InfissoQuickConfigurator). Adesso un infisso a "2 ante" è inconfondibilmente a 2 ante.
- ✅ **3D Viewer FIX CRITICO scena vuota**: il `center` della camera ora considera SIA `walls` SIA `rooms.points` (prima solo walls → progetti senza muri = camera puntata a origine = stanze fuori vista). Aggiunta anche posizione iniziale camera adattiva alla bbox e ground/grid dimensionati alla casa (non più 60m × 60m fissi).
- ✅ **3D Drag&Drop COMPLETO** (richiesta utente "Tutto"): il `Picker3D` ora supporta drag di **items, rooms, walls, doors, windows** (non più solo items). Ogni kind ha la sua logica di commit:
  - items → aggiorna (x, y)
  - rooms → trasla tutti i `points` di delta(x, y)
  - walls → trasla entrambi gli endpoint x1,y1,x2,y2
  - doors/windows → ricalcola `t` proiettando il punto sul segmento del muro
  - Editor.jsx dispatcha onDrag per `kind` aggiornando lo state corretto.
- ✅ **Porte 3D allineate**: refactor del rendering porte con `THREE.Group` con pivot al cardine. Il pannello porta è ora offset dal cardine (non più dal centro del muro) e la rotazione (apertura 30°) avviene attorno al cardine corretto, rispettando `d.hinge` (left/right) e `d.swing` (inside/outside). Maniglia posizionata sul lato opposto al cardine.
- ✅ **Finestre 3D con ante**: aggiunti divider verticali per finestre con `ante > 1`.
- ✅ **WallSideIndicator sempre visibile + rotation-aware**: la freccia "Lato A/B" è counter-rotata per rispettare la rotazione dell'elemento (prima per electrical/hvac con rotation != 0 puntava nella direzione sbagliata). Quando `wall_side = 0` (Centro), mostra un cerchio tratteggiato grigio invece di scomparire. Aggiunta label "A"/"B" sopra la freccia.
- ✅ **Fix /preventivoinfissi/new** (trovato dal testing agent): `isNew = !id || id === 'new'` (prima `!id` falliva perché useParams ritorna la stringa 'new' come id → 404 + crash UI).
- ✅ **Tests**: `pytest` 89/97 passed (3 stale fixtures pre-esistenti, 1 fixture-env minore). Frontend smoke validato via screenshot tool.

## Recent Updates (Round 27 — Feb 2026 — No-AI + Gantt + Upload + Drag3D + Title forzato)
- ✅ **Title browser FORZATO via JS**: `useEffect` in `App.js` con interval che riscrive `document.title` ogni 1.5s contro lo script Emergent esterno che lo sovrascrive. Fix definitivo.
- ✅ **Rimossa AI da workflow artigiani**: ora SOLO controllo matematico:
  - Scarto ≤ +10% rivendita → **OK** (verde)
  - +10% < scarto ≤ +25% → **Warning** (ambra) 
  - Scarto > +25% → **BLOCCO** (rosso) → richiede autorizzazione admin
  - Mostra differenza in € + % e giudizio italiano chiaro
- ✅ **Gantt visivo Fasi cantiere**: SVG bars colorate per stato (grigio/blu/verde/ambra) + asse temporale con marker settimanali (lunedì) + legenda. Cambio stato inline via dropdown.
- ✅ **Upload file binari**: nuovo endpoint `POST /api/uploads` (multipart, max 20MB) + `GET /api/uploads/{filename}` con FileResponse. Storage su `/app/backend/uploads/`. Componente `UploadField` riutilizzabile integrato in: Contratto (PDF), Documenti (qualsiasi), Preventivi artigiani (PDF). Niente più solo URL esterni.
- ✅ **Drag & Drop COMPLETO nel 3D**: `Picker3D` ora supporta sia `onSelect` (click→selezione) sia `onDrag` (trascinamento). Implementato con `THREE.Plane` orizzontale a y=0 e raycaster. Gli items (mobili/oggetti) si possono trascinare nel 3D e la posizione (x, y in cm CAD) viene salvata nello state del progetto. Sync automatico con 2D.
- ✅ **6/6 pytest** PASSED (workflow E2E + provvigioni + round23).

## Recent Updates (Round 26 — Feb 2026 — 3D-only Mode + Workflow Commessa Completo)
- ✅ **Toggle 2D/3D/Both**: nuovo selettore in Editor toolbar — l'utente può lavorare solo in 2D, solo in 3D, o entrambi affiancati. Sostituito il vecchio bottone "Mostra/Nascondi 3D".
- ✅ **Workflow Commessa Completo** (`/commesse/:cid/workflow`):
  - Nuova pagina `CommessaWorkflow.jsx` con **8 tab**: Contratto · Documenti · Materiali · Computo · Artigiani · Fasi cantiere · Cassa · Resoconto.
  - 6 KPI cards live in alto: Preventivato · Costo previsto · Costo confermato · Incassato (+ saldo da incassare) · Uscite · Margine attuale.
  - **Tab 1 Contratto**: link/testo + check "Firmato dal cliente" + data firma.
  - **Tab 2 Documenti**: tabella con tipi (progetto/tavola/doc_casa/doc_cliente/altro), link a Drive/Dropbox, note.
  - **Tab 3 Materiali**: tabella editabile con voci backoffice + qty + prezzo + firma cliente.
  - **Tab 4 Computo Metrico**: rigenerato auto-magic dal preventivo collegato. Ogni riga ha `stato_assegnazione` (da_assegnare/artigiano/interno/autorizzato).
  - **Tab 5 Artigiani**: upload preventivi (link PDF + testo estratto). **AI confronta** con voci backoffice e ritorna giudizio + scarto%. Soglia +10% rivendita → richiede autorizzazione admin/responsabile/area_manager. Modalità "Operai interni" (no preventivo, costo = prezzo_acquisto).
  - **Tab 6 Fasi cantiere**: chi (interno/artigiano) fa cosa (titolo + voci) quando (data inizio/fine + stato).
  - **Tab 7 Cassa**: incassi (cliente) + uscite (artigiani/fornitori) + grafico saldo.
  - **Tab 8 Resoconto**: confronto Partenza vs Arrivo con Δ vs atteso, alert rosso se margine < previsto, alert verde se cantiere chiuso in attivo.
- ✅ **Backend completo** (`routes_commessa_workflow.py`, ~430 righe):
  - Endpoint per ognuno dei 8 tab + `/marginalita` (live) + `/resoconto`.
  - **AI analisi** preventivi artigiani: confronto vs `prezzo_acquisto` e `prezzo_rivendita` delle voci backoffice + giudizio testuale italiano + giudizio AI (Gemini Flash, opzionale, se `EMERGENT_LLM_KEY` configurato).
  - **Notifiche automatiche**: quando un preventivo supera la soglia, viene creata una `notifiche` per ruolo `admin` con link al workflow.
  - **Endpoint autorizzazione** (`/autorizza`): solo admin/responsabile/area_manager possono autorizzare un preventivo artigiano sopra soglia.
  - **Notifiche utente** (`GET /notifiche/me`, `POST /notifiche/{id}/letta`): filtra per `target_user_id` o `target_role`.
- ✅ **Test pytest** `tests/test_workflow_commessa.py` (E2E 10 step: contratto → documento → computo → artigiano OK → artigiano da_autorizzare → notifica → autorizza → cassa → fase → marginalità + resoconto): **PASSED**. Totale 6/6 test PASSED.

## Recent Updates (Round 25 — Feb 2026 — 3D Interattivo + Drag Demolizione + Fix Tavole)
- ✅ **3D Click → Selezione**: implementato `Picker3D` con raycaster Three.js. Cliccare su una stanza, muro o oggetto nel 3D ora apre il pannello proprietà a destra (sync con `selected` del 2D). Distinzione click vs orbit-drag (movimento <4px = click).
- ✅ **3D Highlight selezionato**: nuovo `Highlight3D` che disegna `EdgesGeometry` arancione attorno all'elemento selezionato (sia da 2D che da 3D click).
- ✅ **userData applicato a meshes**: rooms (pavimenti), walls e items hanno `userData = { kind, id }` per identificazione veloce.
- ✅ **Drag interattivo demolizione muri parziale**: già presente in codebase (`demo-partial-drag` + handles `demo-handle`). Banner toolbar aggiornato a "🔨 Trascina sul muro per definire la porzione da demolire. Affina con maniglie/pannello."
- ✅ **Conferma fix Round 23/24** (riepilogo per chiarezza utente):
  - **Lato muro presa**: nel pannello proprietà degli impianti (electrical/plumbing/gas/hvac) c'è il selettore **"◀ Lato A | • Centro | Lato B ▶"** con freccia visiva colorata che parte dall'elemento e indica il lato sul muro più vicino. ✓
  - **Tavole elettriche differenziate**: sigle distinte (P / P+ / TV / RJ / I / DV / L / LED / Q) con colori dedicati per tipo + cerchi più grandi su sigle 2-3 caratteri + anti-overlap badge `h=`. ✓
  - **Pavimenti unificati**: 1 sola fonte di verità (tool Schema piastrelle), banner blu nel pannello che spiega la priorità, color picker + 12 preset, "Applica a TUTTA la casa", calcolo m² preciso. ✓

## Recent Updates (Round 24 — Feb 2026 — Unificazione Pavimento + 3D Allineato + UX Stanza)
- ✅ **3D BUG pavimento fuori dalla stanza FIXATO**: `mesh.rotation.x = -π/2` invertiva l'asse Y rispetto a muri/oggetti. Cambiato a `+π/2` con `side: DoubleSide` per allineare correttamente il polygon-pavimento ai muri (mappa `(x,y) 2D → (x,0,y) 3D`).
- ✅ **3D filtrato per phase (fatto/progetto)**: Viewer3D ora riceve `viewMode` da Editor.jsx e filtra `rooms`, `walls`, `doors`, `windows`, `items` con la stessa logica del 2D. Niente più bleeding "vedo nel 3D cose che non sono in questa fase".
- ✅ **Tiling come Single Source of Truth pavimento**:
  - Tool "Schema piastrelle" → aggiunto **color picker + 12 preset** (terracotta, antracite, bianco, marmo, etc).
  - Bottoni "↗ Applica a TUTTA la casa" + "✕ Rimuovi posa da tutte le stanze".
  - Quando esiste almeno un `tiling[]` nel progetto, **SOLO** le stanze con tiling specifico contano per il pavimento m² nel preventivo (`progetto.floorMaterial` viene IGNORATO per il pavimento). Risolto bug "ho applicato in metà casa ma calcola 42 m² tutta casa".
  - Il 2D e il 3D usano `tiling.color` come priorità sul colore visivo del pavimento → si vede subito il cambio dopo aver scelto il colore.
- ✅ **Pannello stanza più chiaro**:
  - Nuovo banner blu "📐 Pavimento → preventivo" che spiega quale fonte verrà usata (tiling vs floorMaterial) e mostra la voce applicata alla stanza corrente.
  - I 3 switch "Imp. elettrico / Imp. idraulico / Controsoffitto totale" ora hanno **descrizione + tooltip** che spiegano cosa fanno e che entrano nel preventivo al m².
- ✅ **Tooltip su switch** con dettagli costruttivi (rifacimento cavi, tubi acqua/scarichi, cartongesso 2 lastre + isolante).

## Recent Updates (Round 23 — Feb 2026 — CAD Save Fix + Elettrico Specifico + Lato Muro + Configuratore Infissi)
- ✅ **Bug CRITICO salvataggio CAD**: `/api/projects/{id}` filtrava per `user_id` → admin che apriva progetto di un altro utente otteneva 404 sul Salva. Ora admin può read/update/delete qualsiasi progetto; gli altri ruoli restano scoped al proprio user_id (`server.py`).
- ✅ **Voci elettriche specifiche** mappate a preventivo: 5 nuove voci backoffice (`voce-punto-presa-tv`, `voce-punto-rj45`, `voce-punto-presa-cucina`, `voce-punto-deviatore`, `voce-punto-luce-led`) + backfill automatico se DB già seedato + mapping `utils.js` aggiornato. Prima questi tipi venivano "aggiunti" al progetto ma erano invisibili nel canvas e mappati erroneamente a `punto_luce`.
- ✅ **Simboli CAD distintivi** in `Canvas2D.jsx`: 
  - `presa` (cerchio + due stecche · viola)
  - `presa-cucina` ("16A" · arancio · linea dedicata)
  - `presa-tv` (triangolino antenna · ciano)
  - `presa-rj45` (rettangolo con pin · teal)
  - `deviatore` ("DV" · violet)
  - `punto-luce-led` ("LED" · ambra)
  - `interruttore` / `luce` / `quadro` / `scatola` come prima
  - Fallback "?" per tipi non riconosciuti (così non spariscono più).
- ✅ **Lato muro (visto da sopra)**: nuova proprietà `wall_side ∈ {-1, 0, 1}` su electrical/plumbing/gas/hvac. Pannello proprietà ha 3 bottoni "◀ Lato A | • Centro | Lato B ▶". `WallSideIndicator` calcola la normale del muro più vicino e disegna una freccia colorata che indica il lato.
- ✅ **Prospetti differenziati**: `symbolFor()` riformato (P, P+, TV, RJ, I, DV, L, LED, Q, F, C, S) e `colorFor()` con colore dedicato per ogni tipo elettrico/idraulico. Anti-overlap badge `h=` (sposta sopra il simbolo se 2 punti entro 60cm a stessa altezza).
- ✅ **Configuratore Infissi rinnovato** (`PreventivoInfissi.jsx`):
  - Maniglia tipo "cremonese" (barra verticale + sfera + indicatore alto) ben visibile.
  - 3 cerniere sul lato sinistro del telaio.
  - Davanzale grigio per finestre/porte-finestre (etichetta DAVANZALE).
  - Riflesso vetro diagonale + ombra del frame (filter dropShadow) per realismo.
  - Anteprima colore nel select (quadrato accanto al menu).
- ✅ **Test pytest** `tests/test_round23_fixes.py` (2 test) + `test_provvigioni_dashboard.py` → 5/5 PASSED.

## Recent Updates (Round 22 — Feb 2026 — Brand + Dashboard Venditori & Provvigioni)
- ✅ **Brand title**: cambiato `<title>` da "Emergent | Fullstack App" → **"Sa di Casa | Ristrutturazioni e Arredo"** (`/app/frontend/public/index.html`) + meta description coerente.
- ✅ **Dashboard Venditori personalizzata** (`/app/frontend/src/pages/DashboardVenditore.jsx`):
  - Nuovo Dashboard automatico per ruolo `venditore` (Dashboard.jsx redirige in base al ruolo).
  - Header con badge gerarchia (Venditore / Responsabile P.V. / Area Manager) e % provvigione.
  - 4 KPI cards: Provvigioni Totali, Fatturato Personale, Preventivi, Fatturato Team.
  - Tabs: Panoramica, Provvigioni, Team (solo per manager).
  - Tabella provvigioni con tipo Diretta/Override e stato (previsionale/maturata/maturata_completa/sospesa).
  - Ranking team con riga utente evidenziata.
  - Anche admin può aprire dashboard di un singolo venditore via `/dashboardvenditore/:vid` (link da `AdminVenditori.jsx`).
- ✅ **Calcolo provvigioni live** (backend, `routes_biz.py`):
  - `GET /api/venditori/me/dashboard` (venditore + admin) e `/api/venditori/{id}/dashboard` (admin only).
  - `GET /api/provvigioni/me` (rows + totale).
  - Logica gerarchica: `semplice` vede solo proprie; `responsabile` aggiunge override su colleghi stesso `negozio_id`; `area_manager` su tutti i negozi in `negozi_ids`.
  - Stato derivato dallo stato commessa: `da_iniziare→previsionale`, `in_corso→maturata`, `completata→maturata_completa`, `sospesa→sospesa`.
- ✅ **Impostazioni Provvigioni** (Admin → Impostazioni): aggiunte 5 nuove % configurabili con backfill automatico nel doc esistente (`provvigione_*_pct`, default 3/5/7 personali e 1/1.5 override).
- ✅ **Test pytest** `tests/test_provvigioni_dashboard.py` (3/3 PASSED) per regressione.

## Recent Updates (Round 21 — Feb 2026 — Quote 2D 4 lati + UX Demolizioni)
- ✅ **Quote dimensionali sulla Pianta 2D su tutti i 4 lati** (`Canvas2D.jsx`): catena ticks + quote parziali + quote totali su SOPRA, SOTTO, SINISTRA e DESTRA del bbox progetto. Stile architettonico professionale (JetBrains Mono 11/13px, stroke #1F2937).
- ✅ **Quote interne ai poligoni stanza**: ogni lato di ogni stanza ha un badge bianco bordato nero con la sua misura (es. `4,00 m`). Format coerente con virgola IT via `fmtNum`.
- ✅ **Banner hint contestuali per i tool Demolizioni**: 5 banner colorati (rosa muri, arancio pavimenti, ambra rivestimenti) sopra il canvas con istruzioni chiare per ogni tool: `data-testid="tool-hint-demolish-{wall|wall-partial|floor|floor-partial|rivestimento}"`.
- ✅ **Label Demolizioni più espressive**: "Muro · click", "Muro parziale · drag", "Pavimento · totale", "Pavimento · area", "Rivestim. · parziale". Mappatura UX:
  - Pavimento area = poligono drawing (click vertici, doppio click chiude)
  - Muri = click sul muro intero (toggle demolito)
  - Muro parziale = drag sulla parete + maniglie/pannello per affinare
  - Rivestimento = click parete + sx/dx/h da pannello proprietà
- ✅ **Tutti i tool demolizione confluiscono in un'unica voce "Demolizione e smaltimento"** (Round 20) con calcolo m² preciso

## Recent Updates (Round 16 — Feb 2026 - Bug Critici Quote/Tavole)
- ✅ **JSX SVG bug fix**: i numeri nelle quote sx/dx/h dei Prospetti non erano visibili perché JSX `<text>sx {var}</text>` creava 2 text node figli che SVG renderizzava come un solo glyph. Convertito a template literal `{`sx ${var}`}` ovunque (Prospetti.jsx, Canvas2D.jsx)
- ✅ **Auto-fit viewBox sulle Tavole**: nuovo prop `autoFit` su Canvas2D che calcola bbox di tutto il contenuto del progetto (rooms, walls, MEP) e dimensiona il viewBox per non tagliare nulla
- ✅ **Quote interne su ogni segmento del poligono stanza**: ogni lato di ogni stanza ottiene un badge bianco con la sua misura (es. 4.00 m, 2.50 m), incluse pareti interne tra stanze
- ✅ **Prospetti**: badge con padding dinamico (padBottom cresce in base ai punti MEP), offset verticale per ogni MEP point per evitare sovrapposizione tra badge sx/dx, font ingranditi (h=14, sx/dx=13)
- ✅ **Tool change reset**: cambiando tool (es. wall→tiling), tutti i draft pendenti (wallDraft, roomDraft, demoAreaDraft, pendingClicks) vengono resettati per evitare creazione di muri/stanze fantasma
- ✅ **Tile pattern visibility**: piastrelle ora hanno fillOpacity 0.55 e stroke #525252 più scuro, marker partenza più grande (r=7)
- ✅ **GasSymbol r=16 + label "GAS"**, ElectricalSymbol/PlumbingSymbol enlarged con etichette tipo (PRESA/INT/LUCE/QUADRO/F/C/S)

## Recent Updates (Round 15 — Feb 2026)
- ✅ X delete (cestino) per ogni voce del Preventivo Live + box "Voci rimosse · Ripristina tutte"
- ✅ Punti Gas BEN VISIBILI sulla Tavola del Gas
- ✅ Quote dimensionali abilitate su tutte le tavole impianti
- ✅ Wall Decoration UX: voce catalogo + "Applica a tutta la casa"
- ✅ Tile "Applica a TUTTE le stanze" copre anche stanze "Stato di Fatto"
- ✅ Impianto elettrico/idraulico/gas/hvac contati sempre nel preventivo
- ✅ window.__editorTest.setSelected esposto

## Recent Updates (Round 18 — Feb 2026 — Pacchetto editabile + PDF scala 1:100)
- ✅ **Pacchetto — voci editabili nel preventivo**: ogni voce pre-inclusa ha:
  - ✕ rimozione dal preventivo (con box "N voci rimosse · ripristina")
  - Input "€ / unità" per override prezzo per quella specifica voce
  - Input "Richieste" per variare la qty
  - Le voci escluse non contribuiscono agli extras
- ✅ **Export PDF Tavole in scala 1:100 REALE**: 
  - Per ogni tavola, computa dim. carta in base al viewBox (1 unità = 1 cm reale → 0,1 mm carta)
  - Pagina PDF custom per ogni tavola (non più A3 fisso)
  - Cartiglio professionale: titolo, data, frame, barra scala 0-3m, note "SCALA 1:100"
  - Render SVG in PNG alla risoluzione 2x del viewBox per stampa nitida
  - Filename: `<projetto>-tavole-scala-1-100.pdf`

## Recent Updates (Round 17 — Feb 2026)
- Quote professionali nero/grigio
- Pacchetti ordinati per prezzo crescente
- Doppio bottone su ogni voce Preventivo Live (X + Trash2)
- Preventivo guard mode
- Scala 1:100 badge sulle Tavole
- Prospetti consolidati (IMPIANTI SU QUESTA PARETE)
- Quote MEP sotto quote porte/finestre
- Quote su ogni lato di ogni stanza

## Recent Updates (Round 19 — Feb 2026 — Multi-split, punto acqua composito, pellicolatura, lock prezzo)
- ✅ **Climatizzatore Quadri-split**: nuovo HVAC kind con auto-piazzamento 4 split + 1 UE; banner "Posiziona Split N/4"; voce backoffice `voce-condiz-quadri`
- ✅ **Punto acqua composito (F+C+S)**: tipo "punto-completo" con flag has_fredda/has_calda/has_scarico (qualsiasi sotto-insieme); il CAD mostra i cerchi delle sole tubazioni richieste; sempre conta come 1 punto acqua; switch toggle nel pannello proprietà
- ✅ **Posa porta blindata default**: quando NON c'è pacchetto, ogni porta blindata aggiunge automaticamente la voce "Posa porta blindata"; nei pacchetti la posa è inclusa
- ✅ **Pellicolatura PVC**: switch + texture text per ogni finestra PVC; calcola maggiorazione % (default 25%, configurabile dalle Voci Backoffice)
- ✅ **Lock prezzo se !modificabile_dal_venditore**: nel PreventivoPacchetto il campo "€/unità" mostra 🔒 e prezzo read-only se voce non modificabile; modificabile_dal_venditore viene propagato da pkg.items → prev.items
- ✅ **Carta da parati**: voci backoffice `voce-carta-parati-rimoz` (rimozione) e `voce-carta-parati-posa` (posa) con `cad_category="DECORAZIONE"`; selezionabili per parete singola via wall-decor-voce-select (già esistente)
- ✅ **Voci backoffice nuove**: 9 voci aggiunte via `/api/voci-backoffice/seed-missing`

## Recent Updates (Round 20 — Feb 2026 — Demolizione unificata + Soglia pacchetto + Fasi cherry-pick)
- ✅ **Demolizione raggruppata**: tutte le demolizioni CAD (muri, pavimenti, rivestimenti, demo parziali) ora aggregate sotto la voce unica `voce-demolizione` "Demolizione e smaltimento" (€30.6/m²); le voci specifiche restano disponibili per casi puntuali (es. controsoffitto)
- ✅ **Toggle "+ massetto" su demolizione pavimento**: switch nel pannello proprietà; se attivo conta 2× area (pavimento + sottostante massetto)
- ✅ **Soglia max prezzo per pacchetto** (`unit_price_pkg` su pkg.items): nel PreventivoPacchetto, se l'utente sceglie una voce a prezzo > soglia, l'eccedenza × qty inclusa viene contata come EXTRA (mostrato in arancione + dettaglio); soglia configurabile in AdminPacchetti (UI già presente)
- ✅ **Fasi commessa cherry-pick**: nuovo bottone 🔨 sulla pagina Preventivi che apre modal "Converti in Commessa"; checkbox per ogni fase (default tutte selezionate); seleziona/deseleziona tutte; backend `POST /api/commesse` accetta nuovo campo `fasi_attive_ids`; commessa creata contiene SOLO le fasi attive
- ✅ **Endpoint corretto** `/fasi-commessa` (non `/fasi`)
- ✅ Voce backoffice "Demolizione e smaltimento" già presente (id `voce-demolizione`)

## Recent Updates (Round 19 — Feb 2026)
- Climatizzatore Quadri-split (4+1)
- Punto acqua composito (F+C+S)
- Posa porta blindata default
- Pellicolatura PVC + texture
- Lock prezzo se !modificabile_dal_venditore
- Carta da parati (rimoz + posa)

## Original Problem Statement
> "puoi costruire un programma di progettezione tipo cad che faccia anche rendering del risultato per preventivare e progettare ristrutturazioni?"
> User explicitly requested a 1:1 functional replica of configuratore.base44.app with CAD as a plus feature.

## Reference App
`configuratore.base44.app` — all pricing, logic and UI flows mirrored as faithfully as possible.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor) + bcrypt/JWT Bearer tokens + emergentintegrations (Gemini Nano Banana for AI render)
- **Frontend**: React 19 + Shadcn/UI + React Three Fiber (CAD) + jsPDF + persistent teal sidebar (`AppLayout`)
- **Auth**: Bearer token in localStorage + optional httpOnly cookie; brute-force protection
- **API base**: `/api/*`

## Core Modules (all implemented)
### Preventivi (4 tipi)
- **Pacchetto**: BASIC 380, SMART 490, PREMIUM 790, ELITE 1180 €/mq. Wizard 7 step.
- **Solo Bagno**: manodopera base 6.500€ + SILVER 3.500 / GOLD 5.500 / PLATINUM 9.000 + piastrelle mq × €/mq + extras, IVA 10%
- **Composite**: 13 sezioni (Pavimentazione/Pareti/Soffitti/Pratiche/4 Impianti/Illuminanti/Porte/Sanitari/Infissi/Accessori) + Sicurezza 3% + Dir. Lavori 5%
- **Solo Infissi**: tipologie × materiali (PVC/Alluminio/Legno-Al) × vetri (doppio/triplo/triplo basso-emissivo) × dimensioni

### CRM & Lead
- ConfiguratoreEsigenze: 8 domande → pacchetto consigliato automatico
- Pipeline kanban: Nuovo → Contattato → Preventivo → Vinto / Perso
- Tabella alternativa

### Commesse
- Auto-number COM-YYYYMM-XXXX
- 18 fasi checklist default (Sopralluogo → Saldo) con obbligatorietà e doc flag
- 8 tabs: Preventivo / Calendario / Checklist / Materiali / Computo Metrico / Voci e Acquisti / Documenti / Dati Economici
- Conversione Preventivo Accettato → Commessa (admin/venditore)

### Admin Backoffice (tutte admin-gated)
- Pacchetti & Voci (con marginalità e simulazione MQ)
- Optional (listino/scontato/risparmio per pacchetto)
- Voci Backoffice (MURATURA/IMPIANTI/INFISSI/SERVIZI — Acquisto × Ricarico = Rivendita)
- Fasi Commessa (18)
- Venditori (Performance)
- Subappaltatori + Fornitori (tabs)
- Negozi (punti vendita)
- Report Budget (Preventivato vs Effettivo)
- Template Email (preventivo/commessa/voce)
- Utenti & Ruoli (admin/venditore/cliente/subappaltatore/user)
- Dati Azienda (branding + 6 colori primari dinamici)
- Impostazioni (margine/costi fissi/IVA/ricarichi/sicurezza/DL)

### Dashboard
- 4 KPI (Preventivi Totali/Approvati/Commesse Attive/Fatturato)
- Grafico "Preventivi per Pacchetto" BASIC/SMART/PREMIUM/ELITE
- Stato Commesse (Da Iniziare/In Corso/Completata/Sospesa)
- Ultimi preventivi + commesse attive
- DashboardCliente e DashboardSubappaltatore (viste dedicate per ruolo)

### CAD (plus beyond base44)
- Progetti CAD list page
- 2D SVG editor + 3D Three.js viewer + rendering AI Gemini Nano Banana
- Materiali (9 cat / 31 item)

## Data Model
- **users**: {id, email, name, role, password_hash}
- **preventivi**: {id, user_id, numero, stato, tipo, cliente, package_id, mq, items, optional, bathroom_tier, manodopera_base, piastrelle_*, extra_voci, composite_selections, infissi[], sicurezza_pct, direzione_lavori_pct, sconto_pct/eur, iva_pct, totale_iva_incl/escl}
- **commesse**: {id, numero, preventivo_id, cliente, stato, checklist[18], materiali[], voci_acquisti[], documenti[], fatturato, incassato, costi_effettivi, avanzamento_pct, data_inizio/fine}
- **leads**: {id, nome, cognome, ..., mq, esigenze[], pacchetto_consigliato, stato, venditore_id}
- **voci_backoffice**: {id, category, name, prezzo_acquisto, ricarico, unit} → rivendita calcolata
- **fasi_commessa**: {id, order, name, description, has_doc, obbligatoria}
- **template_email**: {id, code, trigger, recipient, subject, body}
- **negozi / subappaltatori / impostazioni / dati_azienda**
- **materials / projects** (CAD)

## Changelog (Feb 2026 — round 14: HOTFIX critici pacchetto/piastrelle)

**🔴 BUG-FIX P0 — Decorazione contata x4 nel pacchetto (segnalato dall'utente: "x4 rispetto alla metratura della casa")**
- Bug: nel pacchetto, "Decorazione" inclusa con `qty_ratio: 1.0` × mq pavimento (es. 100m²), ma il CAD calcola `pittura_pareti = perimetro × altezza` (es. 280m² per casa 100m²). Risultato: 180m² extra contati come fuori pacchetto, quando la decorazione del pacchetto è in realtà FORFAIT (copre tutta la casa).
- Fix: introdotto flag `fullCoverage: true` in `PACKAGE_VOCE_GROUPS` per voci pacchetto generiche/forfait. Quando `fullCoverage` è true, `includedMap[key] = qtyByKey[key]` (= consumo CAD effettivo, qualunque sia). Voci coperte: Decorazione, Pittura prima mano, Rasatura pareti, Posa massetto, Massetto cementizio, Massetto autolivellante, Posa pavimento ceramica, Posa rivestimento ceramica, Posa parquet, Posa Battiscopa, Demolizione e smaltimento. Verificato con test Node: casa 100m² + BASIC → pittura 108m² consumata, 108m² inclusa, **0 extra**.

**🔴 BUG-FIX P0 — Cambio prezzo piastrelle non conta l'eccedenza come extra**
- Bug: il vecchio approccio creava un `tilingLump` extra che bypassava completamente la logica `priceOverrides` + `refPriceMap` del pacchetto. L'eccedenza (es. Gres marmo 72€/m² vs pacchetto 41.58€/m²) NON veniva calcolata: o tutto extra o niente.
- Fix: il tiling specifico ora produce un **prezzo medio ponderato per area** (`tilingAvgPrice`) che funziona come override automatico della voce `pavimento_piastrelle`. Il calcolo eccedenza (`price_delta_extra = (override - refPrice) × qty_inclusa`) ora opera correttamente. Il listino personalizzato dell'utente (`priceOverrides[voce.id]`) ha SEMPRE la precedenza sul tiling-avg.
- Test verificato:
  - Caso A: `tiling = Gres marmo 72€/m²`, pacchetto = 41.58€/m² → extra **3042€** (= 30.42 × 100m²) ✅
  - Caso B: `priceOverrides[v-pp]=90€/m²` + tiling Gres 72€/m² → vince override, extra **4842€** ✅
  - Caso C: senza pacchetto, override 90€/m² → totale **9000€** = 90 × 100m² ✅

**🔴 BUG-FIX P0 — Schema piastrelle: applica a TUTTE le stanze in 1 click**
- Bug: l'utente doveva cliccare in OGNI stanza per posare lo stesso tipo (causa discrepanze, errori, frustrazione: "rischio di avere discrepanze tra una stanza e l'altra").
- Fix: nuovo bottone verde **"↗ Applica a TUTTE le stanze"** (data-testid `tile-apply-all-rooms`) nel pannello tool tiling. Click → propaga il tipo+formato+angolo a tutte le stanze del progetto, sostituendo eventuali tiling esistenti. Toast conferma il numero di stanze aggiornate.

**Display migliorato**: nel computo metrico la voce `Piastrelle pavimento` ora mostra il nome della voce specifica scelta (es. "Gres porcellanato effetto marmo 60×120 (Cucina)") invece del generico, e usa il `voce_id` corretto per il salvataggio in preventivo.

**Tests:** Backend 5/5 PASS. Test calcolo Node: 3 scenari pacchetto + override + tiling → tutti corretti. Lint pulito.

---



**🔴 BUG-FIX UX P0 — Demolizione muro PARZIALE con DRAG visivo**
- Bug: l'utente lavorava SOLO con input numerici per definire da/a della demolizione parziale (richiesta: "voglio anche disegnare la demolizione disegnando").
- Fix: aggiunte maniglie circolari rosse interattive (data-testid `wall-demo-handle-from-{wallId}` / `wall-demo-handle-to-{wallId}`) sui punti from/to della demolizione parziale quando il muro è selezionato in tool=select. Drag in tempo reale aggiorna `demolito_partial.from`/`to`. Hint nel pannello proprietà: "Trascina i pallini rossi sul canvas".

**🔴 BUG-FIX UX P0 — Quote complete nei Prospetti pareti**
- Bug: i Prospetti mostravano solo larghezza+altezza totali muro e WxH per opening, MA mancavano (richiesta esplicita ripetuta): distanza da sx, distanza da dx, altezza apertura per ogni elemento; sill height per finestre; rendering visivo demolizioni.
- Fix: `Prospetti.jsx` riscritto con `DimLine`/`DimLineV` complete per ogni elemento. Ora ogni porta/finestra renderizza: width sotto pavimento, sx/dx (distanze dai bordi) sotto, H altezza apertura a sinistra (verticale), parapetto a destra (per finestre). Le demolizioni parziali del muro hanno hatch arancione + quota WxH. Le demolizioni rivestimento (zona) sono renderizzate con hatch arancione + label `DEMO RIV.`

**🔴 BUG-FIX UX P0 — Catalogo voci spostato in TAB dedicato + applica a selezionato**
- Bug: il catalogo voci era nascosto in fondo al tab PROPRIETÀ ("troppo in basso, come le applico agli elementi?").
- Fix: 
  - Spostato `CatalogoVociPanel` dal PropertiesPanel al tab CATALOGO (data-testid `tab-catalog`), con sub-tabs `Voci Backoffice` (default) / `Arredi & Materiali`.
  - Quando una parete è selezionata: banner blu (`catalog-selected-wall`) con L/H/area + bottone `↗ parete (qty)` su ogni voce che calcola qty automaticamente in base a m²/ml della parete.
  - Quando una stanza è selezionata: banner verde (`catalog-selected-room`) con area/perimetro + bottone `↗ stanza (qty)` che calcola qty su area/perimetro.
  - Sempre disponibili: `+ libera` (qty=1) e `↗ tutta casa` (calcolo cumulativo su tutte le stanze).
  - Ogni voce aggiunta è marcata con `target_kind` (wall/room/all-house/free) e `target_id` per audit.
  - Tab default cambiato da `cost` a `properties` (più intuitivo).
  - PropertiesPanel mostra ora un banner "Per aggiungere voci dal catalogo, vai al tab CATALOGO".

**🔴 BUG-FIX UX P0 — Schema piastrelle: scelta TIPO specifico dal catalogo**
- Bug: il tool 'Schema piastrelle' permetteva di scegliere SOLO il formato (60x60, 30x60, ecc.) ma NON il tipo di piastrella ("non mi fa selezionare il tipo di pavimento").
- Fix:
  - Nuovo Select `tile-voce-select` nel pannello tool tiling: lista voci backoffice filtrate per nome (gres/parquet/marmo/pvc/laminato).
  - Tile object salva ora `voceId`, `vocePrice`, `voceName`.
  - `estimateProjectV2` riconosce `tilingLumps` per ogni tiling con voce: sottrae l'area dalla voce generica `pavimento_piastrelle` e crea una riga dedicata "Gres porcellanato effetto X · stanza Y" con il prezzo specifico della voce scelta.

**🆕 SEED — 13 nuove voci backoffice tile-specific**
- `voce-gres-cemento-60x60`, `voce-gres-marmo-60x120`, `voce-gres-legno-22x90`, `voce-gres-pietra-80x80`, `voce-gres-mono-30x60`, `voce-marmo-naturale-25x150`, `voce-parquet-rovere-pl`, `voce-parquet-noce-spina`, `voce-pvc-effetto-legno`, `voce-laminato-ac4`, `voce-piast-mosaico-bagno`, `voce-piast-cucina-10x10`, `voce-piast-bagno-25x40`. Tutte `modificabile_dal_venditore=True` con prezzi realistici (gres mono 27€, marmo naturale 162€, parquet noce spina 162€).
- `gruppoOf()` in Editor.jsx esteso per riconoscere correttamente 5 gruppi: Muratura/Impianti/Serramenti/Finiture/Servizi anche per categoria backoffice in maiuscolo (IMPIANTI/INFISSI/SERVIZI/MURATURA).

**Tests:** Backend 5/5 pytest PASS (`/app/backend/tests/test_round13.py`). Frontend smoke OK: tab CATALOGO funziona, 4 gruppi visibili (43+32+10+7=92 voci), Listino Personalizzato con 13 nuove voci tile editabili, hint demo, lint pulito su tutti i file modificati.

---



**🔵 PORTE/FINESTRE VISIBILI IN 3D**
- Bug: il Viewer3D mostrava solo il VARCO senza il pannello porta o il vetro finestra.
- Fix: `Viewer3D.jsx` ora aggiunge dopo ogni muro:
  - Pannello PORTA (BoxGeometry width×height×4cm) inclinato 30° per simulare apertura, colore marrone default o `door.color` se settato. Maniglia cilindrica argentata a 100cm.
  - TELAIO finestra (cornice bianca/colorata) + VETRO azzurrato semitrasparente (opacity 0.55, metalness 0.4) all'interno del varco, tra `sillHeight` e `sillHeight + height`.

**🔵 AUTO-POSA + MASSETTO ACCOPPIATI AUTOMATICAMENTE**
- Quando il CAD genera una qty di Piastrelle pavimento → aggiunge automaticamente "Posa piastrelle pavimento" + "Massetto cementizio".
- Stessa logica per: Parquet, Pavimento PVC, Piastrelle rivestimento.
- Map `PAIRED_LABOR` in utils.js. Coperte da pacchetto se `PACKAGE_VOCE_GROUPS` le include.

**🆙 LOGICA "MODIFICABILE DAL VENDITORE" CHIARITA**
- Backend `/api/packages` ora espone `unit_price_pkg` (prezzo MAX coperto) e `modificabile_dal_venditore` per ogni item.
- Backoffice Pacchetti: nuovo input "Prezzo MAX coperto" visibile SOLO per voci modificabili.
- CAD Listino personalizzato CON pacchetto: bandiera amber "+X€ eccedenza → extra" se override > pkg_max, verde "✓ entro soglia" se ≤. SENZA pacchetto: prezzo applicato direttamente.

**Tests:** Browser test porta 3D visibile ✅. Lint pulito.

---

## Changelog (Feb 2026 — round 12.2: catalogo voci CAD + bugfix elettrico/quick-room/extra + scale prezzo a corpo)

**🔴 BUG FIX**
- **Auto-impianto elettrico nelle quick-room**: rimosso `electrical: true` di default sia in QuickRoom (Editor.jsx:278) che in nuova stanza disegnata a mano (Canvas2D.jsx:694). Ora le stanze nascono SENZA elettrico/idraulico (default false), si attivano esplicitamente.
- **Muri quick-room contati come "nuova costruzione"**: cambiato `wallKind = phase==="fatto" ? "esistente" : "nuovo"` → `wallKind = "esistente"` SEMPRE per quick-room (rappresentano stanze esistenti della casa). Solo il tool wall esplicito disegna muri "nuovi" di costruzione.
- **Senza pacchetto: voci NON marcate come "extra"**: la colonna "Extra" del computo metrico è ora visibile SOLO quando c'è un packageRef. Senza pacchetto, ogni voce è semplicemente una riga del preventivo (non extra).

**🆕 CATALOGO VOCI BACKOFFICE NEL CAD**
- Nuova sezione `CatalogoVociPanel` nel pannello globale (no-element-selected) con TUTTE le voci backoffice raggruppate in **4 macro-categorie**: Muratura / Impianti / Serramenti / Finiture (mapping `CAT_TO_GRUPPO`).
- Filtro ricerca live + collapse per gruppo + click `+` per aggiungere come riga preventivo.
- "Voci aggiunte" salvate in `project.data.manualItems = [{voce_id, qty, unit_price, unit_price_override, descrizione}]`.
- Quantità e prezzo modificabili dopo l'aggiunta. Bottone Trash per rimuovere.
- estimateProjectV2 aggrega le manualItems come voci a corpo (sempre extras, no qty_inclusa).

**🆕 SCALE: PREZZO A CORPO**
- Pannello scala selezionata: nuovo input "Prezzo a corpo (€)". Quando settato, sostituisce il prezzo standard della voce backoffice ed è SEMPRE conteggiato come extra (anche senza pacchetto).
- estimateProjectV2 separato: `lumpItems` per scale con `priceLump > 0`.
- Scala a chiocciola già esiste come `stairsKind="chiocciola"` nel toolbar Base → Scala.

**Tests:**
- Browser test verificato: camera aggiunta → 0 voci nel computo (no impianto elettrico forzato) ✅
- Pannello catalogo: Muratura mostra 29 voci, Serramenti 10, Finiture 40 ✅
- Click su "Demolizione controsoffitto 25€/m²" → aggiunta come "Voci aggiunte (1)" con qty/prezzo modificabili ✅
- Lint Python e JS puliti.



## Changelog (Feb 2026 — round 12: AI Rendering 3D fotorealistico + miglioramenti pianta architettonica)

**🎨 FRONT A — Pianta 2D in stile architettonico (Archsynth-like)**
- Etichette stanze rese in MAIUSCOLO grosso (fontSize 18, fontWeight 700, letterSpacing 1.5) per leggibilità da vista d'insieme.
- **Catena di quote dimensionali esterne**: bbox totale di tutte le stanze con ticks su ogni vertice X/Y, quote parziali tra ticks (in metri, 2 decimali) + quota TOTALE finale orizzontale e verticale.
- Render automatico quando il layer Dimensions è attivo.

**🤖 FRONT B — AI Rendering 3D fotorealistico (Gemini Nano Banana)**
- Nuovo modulo `/app/backend/routes_render.py` con endpoint `POST /api/render/3d`.
- Input: `image_base64` (PNG della pianta 2D o snapshot 3D), `style` (isometric_dollhouse / interior_room / exterior), opzionale `prompt` custom.
- Output: PNG/JPG base64 + log audit in collection `renders`.
- Usa **Emergent LLM Key gratuito** + modello `gemini-3.1-flash-image-preview` (Nano Banana) via emergentintegrations LlmChat.
- 3 prompt template ottimizzati: dollhouse isometrico, interior, esterno.
- Frontend `Editor.jsx`:
  - Bottone Sparkles in toolbar apre modal "Rendering AI fotorealistico".
  - 3 stili selezionabili (radio cards) con descrizione di ogni opzione.
  - Per dollhouse: cattura SVG 2D → PNG via canvas → invio AI.
  - Per interior/exterior: snapshot Three.js → AI.
  - Modal mostra rendering generato in 30-60s + bottone Scarica PNG.
- Test verificato browser: 4 stanze (cucina/bagno/camera/soggiorno) → dollhouse 3D fotorealistico con mobili/luci/terrazza/vetture in ~30s ✅.

**Tests:** Lint Python e JS puliti. Test e2e browser PASS (vedi screenshot conversazione).



## Changelog (Feb 2026 — round 11.6: copertura pacchetti corretta + override prezzi venditore + applica-tutta-casa)

**FIX CRITICO — Demolizioni e voci generiche pacchetto NON coperte**
- Era: il package PREMIUM include "Demolizione e smaltimento" coeff 1.0 (= 100% mq della casa). La VOCE_MAP CAD mappa solo `demolizione_muro → "Demolizione muri"` → nessun match → tutta la demolizione finiva extra.
- Ora: nuovo `PACKAGE_VOCE_GROUPS` in utils.js per voci pacchetto generiche con MULTIPLE CAD keys e flag `shared` (budget condiviso):
  - "Demolizione e smaltimento" → [demolizione_pavimento, demolizione_muro, demolizione_rivestimento, demolizione_controsoffitto] (shared=true, budget cumulato)
  - "Decorazione" → [pittura_pareti]
  - "Posa massetto" → [pavimento_piastrelle, pavimento_parquet, pavimento_pvc] (shared)
  - "Posa pavimento ceramica" / "Posa rivestimento ceramica" / "Posa Battiscopa" → alias 1:1
- estimateProjectV2 riscritto per supportare `voci_incluse` con array `keys` e `shared`: il budget condiviso viene consumato in ordine sulle quantità reali; non-shared applica qty piena ad ogni key.
- Test Node verifica: 28mq stanze + 20mq demolizione pavimento + PREMIUM (790€/m² × 28 = 22.120€ forfait) → extra_total=0 ✅ (prima erano centinaia di €).

**FEATURE — Materiali "applica a tutta casa"**
- Ogni MaterialPicker (pavimento/pareti/soffitto, sia stato di fatto che modifiche di progetto) ha bottone "↗ Tutta casa" sopra il select.
- Click → applica il materiale corrente a TUTTE le stanze (target=base se in mode fatto, target=progetto.X se in mode progetto).
- Toast conferma il numero di stanze aggiornate.
- Non rompe override per stanza: l'utente può ri-cambiare singole stanze dopo aver fatto il broadcast.

**FEATURE — Override prezzi voci modificabili dal venditore**
- Nuova sezione "Listino personalizzato" nel pannello globale del CAD (visibile quando nessun elemento è selezionato).
- Mostra solo le voci con `modificabile_dal_venditore=true` (campo già esistente nel backoffice).
- Per ciascuna: prezzo di riferimento + input prezzo override.
- Se in pacchetto e override > prezzo riferimento → l'**eccedenza** sulle quantità INCLUSE viene aggiunta come extra (richiesta utente: "se supera quel prezzo viene contato come extra l'eccedenza").
- Salvato in `project.data.priceOverrides = { voce_id: customPrice }`.
- estimateProjectV2 usa l'override quando presente, calcolando price_delta_extra.

**Tests:**
- Lint JS pulito su Editor.jsx + utils.js.
- Test Node manuale: PREMIUM 28mq, 20mq demolizione pavimento → 0€ extra (correttezza copertura confermata).



## Changelog (Feb 2026 — round 11: pacchetti dinamici + fix critici Editor)

**FRONTEND (Editor.jsx + Canvas2D.jsx + utils.js):**
- **FIX CRITICO crash demolizione muro parziale**: `setDrag({kind:"demo-partial-drag", ...})` non passava `start: p`. `onMouseMove` accedeva `drag.start.x` → undefined → crash. Aggiunto `start: p` + fallback difensivo `drag.start || p`.
- **FIX label menu CAD**: TOOL_GROUPS rendering controllava `g.id === "demo"` mentre l'id reale è `demolizioni`/`costruzioni`/`elettrico`/`termo`. Tutte le label apparivano come "Finiture". Sostituito con `g.label`. Ora visualizza: Base / Demolizioni / Pacchetto / Costruzioni / Imp.Elettrico / Imp.Termo-Idraulico.
- **NUOVA logica pacchetti V2 (richiesta utente)**: 
  - Eliminato hardcoded `mq=80` e `voci_incluse` inventate. 
  - Nuovo `buildPackageRef(pkg, projectData)` in utils.js: calcola `mq_progetto` come somma stanze in stato di progetto (o area del nuovo `packageArea` polygon se settato). 
  - `package_base_total = price_per_m2 × mq_progetto` (es. BASIC 380€/m² × 28m² = 10.640€).
  - `voci_incluse` derivate da `package.items[]` con `qty_inclusa` calcolata in base a `qty_mode`: `mq` → ratio×mq, `fissa`/`pz` → qty_value (es. 1 caldaia inclusa).
  - `extra_total` = quantità eccedenti `qty_inclusa` + voci NON incluse nel pacchetto (al 100% prezzo voci_backoffice).
  - Inverse map `NAME_TO_CAD_KEY` per matchare voce backoffice → CAD key.
- **NUOVO tool "Area pacchetto"** (gruppo dedicato): l'utente disegna un poligono libero per delimitare l'area su cui calcolare il pacchetto (es. casa 200m² ma ristrutturazione solo 100m²). Render verde tratteggiato con label "AREA PACCHETTO X m²". Click → click → doppio click chiude.
- **Auto-recompute packageRef** via useEffect quando cambiano `rooms`, `packageArea` o `package_id`: mq e forfait restano sempre sincronizzati.
- **Demolizione rivestimento ZONA precisa**: era full-wall × altezza prompt. Ora click sul muro crea una demolizione default che si modifica nel pannello proprietà con: posizione orizzontale (cm sx, cm dx) + altezza da terra (cm) + altezza demolizione (cm). Render rettangolo arancione tratteggiato con label `DEMO RIV. WxH @ h-da-terra`. Calcolo area precisa.
- **PropertiesPanel kind="demolitions"** aggiunto: editor zone rivestimento con 4 input numerici e calcolo area live.
- **Preventivi.jsx CAD-aware**: nuova label "CAD" per `tipo=cad`, bottone modifica reindirizza al CAD editor del progetto collegato (non più ai wizard pacchetto).

**FRONTEND (AppLayout):**
- **Rimosso "Commesse"** dalla sidebar (era ridondante con Gestione Cantieri, su richiesta utente). Resta solo "Gestione Cantieri" in sezione Cantieri.
- **Estesi ruoli Gestione Cantieri** ad admin/gestore/venditore/user: tutti vedono i cantieri pertinenti.
- **GestoreCantieri unificato**: KPI (totali/in corso/fatturato/incassato/da convalidare), filtri stato, lista cantieri con badge da convalidare e link al dettaglio. Sostituisce funzionalmente la pagina Commesse.

**BACKEND (routes_round10.py):**
- `/gestore/cantieri` ora accessibile anche a venditore/user (con filtri appropriati): admin/venditore/user vedono tutto, gestore solo i propri.

**BUSINESS LOGIC: PACCHETTO**
- Trial-split già correttamente raggruppato (1 climatizzatore_trial per gruppo, NON 3× monosplit + 1 UE) — verificato in `estimateProjectV2` linee 344-368.
- PreventivoIn (model_config extra=allow) accetta `package_base_total`, `extra_total`, `package_name`, `package_price_per_m2` → preservati al riapertura del preventivo CAD (totale_iva_incl include forfait + extras correttamente).

**Tests:**
- Curl test verificato: POST /preventivi tipo=cad con package_base_total=10640, extra_total=13057 → totale_iva_escl=23697 salvato e riletto correttamente.
- Browser test verificato: BASIC su 28m² → forfait 10.640€ + extras 13.057€ = 23.697€ totale, console pulita.
- Demolizione muro parziale drag su muro: nessun crash, demolito_partial.from/to aggiornati live, preventivo aggiunge "Demolizione muri" voce.
- Backend: 90/93 pytest passing (3 test obsoleti per count voci/materiali pre-seed-update, non regressioni).



## Changelog (Feb 2026 — round 10: Portale Cliente + Subappaltatori + Gestore Cantieri + RBAC)

**BACKEND** (nuovo modulo /app/backend/routes_round10.py, 480 LOC):
- **Subappaltatori dashboard finance**: `GET /api/subappaltatori-dashboard` ritorna per ogni sub: cantieri attivi, importo totale, fatturato, incassato, da incassare, ritardi (calcolati su data_fine_prevista vs now).
- **Assegnazioni subappaltatori**: collection `subapp_assegnazioni` con avanzamenti dichiarati e convalide. Endpoint: POST /subappaltatori/assegna, PUT /subappaltatori/assegnazioni/{id}, POST /subappaltatori/assegnazioni/{id}/avanzamenti, POST /subappaltatori/assegnazioni/{id}/avanzamenti/{aid}/convalida.
- **Convalida sblocca pagamento**: `pagamento_sbloccato=true` automaticamente sull'avanzamento convalidato.
- **Gestore Cantieri**: `GET /api/gestore/cantieri` (admin vede tutto, gestore solo i suoi). PUT /commesse/{id}/assegna-gestore.
- **Portale Cliente con utenza temporanea**: `POST /api/cliente-portal/invita` genera password 8-char e crea utenza role=cliente con `cliente_portal_expires_at` (durata 6 mesi cantiere + 30gg). `POST /api/auth/login-cliente` verifica scadenza. `GET /api/cliente-portal/me` ritorna commessa+SAL pubblico (avanzamenti convalidati)+documenti+commenti. `POST /cliente-portal/commessa/{id}/commenti`.
- **Firma elettronica semplice OTP**: collection `firma_otp_codes` + `documenti_commessa`. Flow: POST /firma/richiedi-otp (genera OTP 6-digit, dev=ritorna codice; prod=email) → POST /firma/conferma con audit trail completo (IP + user_agent + timestamp + validità legale citata art. 20 CAD + Reg. eIDAS).
- **RBAC filtri**: `GET /api/preventivi-filtered` (admin=tutto, venditore=del suo negozio, cliente=della sua commessa). `GET /api/commesse-filtered` (admin=tutto, gestore=assegnate, venditore=del negozio, sub=assegnate, cliente=propria).
- **AUTH: ruolo "gestore" aggiunto** alle role validate in routes_biz.set_role.

**FRONTEND** (6 nuove pagine + AppLayout RBAC):
- `/dashboard-subappaltatori` (admin/gestore): KPI fatturato/incassato/da-incassare/ritardi + tabella per sub.
- `/subappaltatori/:id`: dettaglio con cantieri assegnati, avanzamenti dichiarati e bottoni convalida.
- `/gestore-cantieri` (admin/gestore): cantieri assegnati, badge "X da convalidare", convalida singolo avanzamento sblocca pagamento.
- `/portale-sub` (subappaltatore): le sue commesse, dichiara avanzamento (descrizione + % + note), vede stato convalida.
- `/portale-cliente` (cliente): banner gradient con commessa, "Accesso valido X giorni", SAL pubblico, documenti firmabili con modal OTP, commenti.
- `/portale-cliente/login`: login dedicato per clienti con credenziali temporanee.
- AppLayout NAV esteso con sezioni "Cantieri" (admin/gestore/sub) e "Cliente" (cliente). Filtraggio automatico per ruolo.
- DettaglioCommessa: bottone "Invita cliente al portale" che mostra credenziali generate da copiare.
- AuthContext: nuovo `loginCliente(email, pwd)` + `setUserAndToken({token,user})`.

**Test E2E backend (curl) PASS:**
- POST /cliente-portal/invita → password generata, scadenza 218gg ✓
- POST /auth/login-cliente → token JWT valido ✓
- GET /cliente-portal/me → commessa COM-202604-7D06 con SAL+docs+commenti ✓
- POST /documenti tipo=contratto firma_richiesta=true ✓
- GET /documenti?commessa_id=X come cliente → solo visibili_cliente ✓
- POST /firma/richiedi-otp → OTP 6 cifre + scadenza 10min ✓
- POST /firma/conferma → audit trail completo (IP, UA, timestamp, validità legale) ✓
- GET /subappaltatori-dashboard, /gestore/cantieri, /preventivi-filtered, /commesse-filtered → tutti rispondono ✓

**Test E2E frontend (Playwright):**
- Login cliente test@example.com con pwd temporanea XQUJNCXE → entra in /portale-cliente
- Vede commessa, "Accesso valido ancora 218 giorni", documento "Contratto preliminare" già FIRMATO (dal test backend)
- Sidebar filtrata correttamente per ruolo cliente (solo Preventivi/Commesse/Portale Cliente)

## Changelog (Feb 2026 — round 9: Editor↔Preventivi flow + bug fix)
- **EDITOR → SALVA COME PREVENTIVO**: nuovo bottone verde nel pannello "Preventivo Live" (data-testid="save-as-preventivo-button") crea un preventivo tipo="cad" via POST /api/preventivi con tutti gli items del computo metrico, project_id linkato. Backend: PreventivoIn accetta extra fields (project_id, package_base_total, extra_total). Sync inverso bidirezionale: il progetto si salva con `preventivo_id`. Successo verificato e2e (PRV-2026-0018).
- **EDITOR → BUDGET WARNING**: nuovo banner data-testid="budget-status" in cima al CostPanel quando il progetto è collegato a un preventivo. Mostra numero, stato (BOZZA/ACCETTATO/etc), budget. Calcola overBudget = estimate.total - linkedPreventivo.totale_iva_escl. Banner verde se sotto budget, rosso se sfora. Avvertenza specifica se preventivo accettato e si sfora.
- **EDITOR → AGGIORNA PREVENTIVO COLLEGATO**: il bottone diventa "Aggiorna Preventivo collegato" per progetti già linkati: PUT /api/preventivi/{id} (no duplicazione).
- **AUTO-LINK ORPHAN PREVENTIVI**: GET /api/projects/{id} ora cerca automaticamente un preventivo orphan (project_id == this) e popola project.preventivo_id se mancante. Risolve la legacy data dei progetti pre-Round-9.
- **DEMOLIZIONE MURO PARZIALE INTERACTIVE DRAG**: tool demolish-wall-partial ora supporta drag-to-resize. Click sul muro inizializza demolito_partial.from = demolito_partial.to = tHit. Trascinando, l'intervallo si espande live. Al rilascio, switch a tool select per refining via pannello proprietà numerico.
- **TAVOLE GHOST PERIMETRO**: estese le ghostWalls anche alla vista 'costruzioni' (mostra muri esistenti come riferimento del contesto). Vista 'demolizioni' include ANCHE i muri di progetto non demoliti (oltre a quelli fatto).
- **FIX phase migration al caricamento**: ensurePhase() assegna "fatto" ai muri/stanze/items legacy senza phase per evitare contaminazione delle tavole separate.

## Backend tests
- `/app/backend/tests/test_iter9_round.py`: 8/8 PASS (POST /preventivi tipo=cad, GET include CAD, PUT no duplicate, projects↔preventivi bidir sync, idempotent create-project endpoint, 404 handling).

## Changelog (Feb 2026 — round 8: separazione fatto/progetto + pacchetto live)
- **STATO DI FATTO IMMUTABILE in mode Progetto**: PropertiesPanel ora riceve `editMode`. Per stanze/muri con `phase=fatto` mostra banner 🔒 e disabilita i campi (`fieldset disabled` + opacity-60). Nelle stanze fatto compare un blocco amber "⚒ Modifiche di progetto" con override floorMaterial/wallMaterial/ceilingMaterial/controsoffitto/electrical/plumbing/pittura. La stanza fatto resta intatta nel DB; solo `room.progetto` viene popolato.
- **PREVENTIVO LIVE LE MODIFICHE DI PROGETTO**: `estimateProjectV2` ora itera tutte le stanze (fatto+progetto). Per fatto considera SOLO se ha `room.progetto` overrides. Per progetto usa direttamente le sue proprietà. Esempio test reale: cucina 14m² fatto + progetto={parquet, controsoffitto, elettrico} → 4599€ senza pacchetto.
- **PACCHETTO LIVE corretto**: il packageRef ora salva `price_per_m2` e `package_base_total` (mq_inclusi × prezzo). estimateProjectV2 calcola: total = forfait_pacchetto + extra_non_coperti. CostPanelV2 mostra 3 righe: "Forfait pacchetto", "Voci incluse (coperte)", "Extra (non coperti)". Test reale: stessa cucina con BASIC → 31.162€ = 30.400€ forfait + 762€ extra controsoffitto. SENZA pacchetto era 4599€. ORA i numeri cambiano correttamente.
- **PHASE MIGRATION**: al caricamento del progetto, ensurePhase() assegna automaticamente phase="fatto" a tutti gli elementi senza phase (correzione legacy che faceva apparire roba di progetto anche in tavola fatto).
- **addQuickRoom** ora setta `phase` corretto in base a editMode (era il bug che causava elementi senza phase, mostrati in entrambe le viste).
- **Label "Stato di Fatto"** ripristinato (era stato accorciato a "Fatto").
- **Stanze con modifiche di progetto** sul canvas mostrano overlay tratteggiato amber + label "⚒ MODIFICHE PROGETTO".
- **FIX SPLIT STANZA ROBUSTO**: riscritta `splitRoomByWall` con line-line intersection (non più segment-segment), tolleranza snap-grid (u in [-1e-3, 1+1e-3]), dedup intersezioni vicine, validazione midpoint-in-polygon per poligoni concavi. Test E2E browser-validated: stanza Cucina + muro orizzontale → split in 'Cucina A' + 'Cucina B' (verificato anche nel computo metrico: 1094€ muro nuovo + 428€ demoliz. muri + 227€ demoliz. pavim).
- **FIX VOCI PREVENTIVO SEPARATE**: aggiunte 4 voci backoffice distinte (Demolizione muri 22€/m², Demolizione pavimento 18€/m², Demolizione rivestimento pareti 16.5€/m², Demolizione controsoffitto 14€/m²). Aggiunto endpoint `POST /api/voci-backoffice/seed-missing` per popolarle senza distruggere voci esistenti. VOCE_MAP in utils.js aggiornata (demolizione_muro/pavimento/rivestimento/controsoffitto puntano a 4 voci specifiche).
- **FIX DEMOLIZIONE PAVIMENTO PARZIALE**: il rendering canvas ora distingue demolizione TOTALE (hatch+contorno su tutta la stanza, label "DEMO PAV. TOTALE") da PARZIALE (solo poligono area free-form, label "DEMO X.XX m²"). estimateProjectV2 ricalcola area dal poligono se presente.
- **FIX DEMOLIZIONE RIVESTIMENTO PER PARETE SINGOLA**: tool ora chiede SU QUALE MURO cliccare (non più stanza intera). Prompt per altezza demolizione (default 200cm). Rendering: linea arancione tratteggiata sul muro selezionato con label 'DEMO RIV. h=200cm'. Calcola areaM2 = lunghezza_parete × altezza/100.
- **NUOVO TOOL DEMOLIZIONE MURO PARZIALE** (`tool-demolish-wall-partial`): click su un muro auto-seleziona e attiva pannello proprietà 'Demolizione parziale' con default {from: 0.3, to: 0.7, height: 270}. La porzione viene resa rosso tratteggiato sul canvas con quote.
- **CATALOGO MATERIALI ARRICCHITO**: aggiunte 8 nuove voci (6 piastrelle pavimento: 30x60, 60x60, 60x120, 80x80, 22.5x90, 25x150 + 2 piastrelle parete: bagno 25x40, cucina 10x10). Endpoint `POST /api/materials/seed-missing` per sync con utenti esistenti.
- **SIDEBAR APPLAYOUT A SCOMPARSA**: la sidebar AppLayout è ora collassabile (data-testid sidebar-toggle-open / sidebar-toggle-close). Auto-chiusa nelle pagine /editor/* per dare spazio al CAD. Apribile manualmente con icona Menu in alto-sx.
- **TOOLBAR EDITOR COMPATTA**: bottoni icona-only (no testo) per Annulla/Ripristina/Importa/3D/AI/Tavole/PDF, compattati in 8 px. Bottone 'Salva' sticky a destra (sempre visibile anche con viewport stretto). Toolbar overflow-x scrollable.
- **HELPER WINDOW.__editorTest**: esposto in dev/preview per E2E testing affidabile (getProject, setProjectData, addWallProgetto con auto-split).
- **Tool SCALA implementato**: `tool-stairs` in toolbar Base; sub-kind picker `stairs-kind` (chiocciola/muratura/legno); rendering SVG StairSymbol (chiocciola = cerchio con raggi, rampa = rettangolo con gradini + freccia salita); pannello proprietà completo con type/L/P/rotazione; tracciato in `voci_backoffice` (scala_chiocciola 1200€, scala_muratura 2500€, scala_legno 1800€); phase corretta applicata.
- **Demolizione Pavimento area FREE-FORM**: tool-demolish-floor-partial NON usa più `window.prompt` per la percentuale. Ora disegna un poligono libero (click vertici, doppio click chiude); `polygon[]` salvato nella demolition; `estimateProjectV2` ricalcola `areaM2` dal poligono se presente; rendering live del poligono draft + label "DEMO X.XX m²" sul canvas.
- **Tavola Demolizioni con muri perimetrali GHOST**: in `Canvas2D.jsx` quando `viewMode==='demolizioni'`, il perimetro stato di fatto (muri non demoliti, phase=fatto) viene renderizzato come linea grigia tratteggiata sottile come riferimento. I muri demoliti restano evidenziati in rosso.
- **Split automatico stanza con muro divisorio**: `splitRoomByWall` in `utils.js` calcola intersezioni del muro con i lati del poligono stanza tramite `segmentIntersect`. Se trova esattamente 2 intersezioni full-crossing, divide il poligono in 2 nuove stanze (`{Nome} A` e `{Nome} B`) preservando proprietà (floorMaterial, electrical, plumbing, controsoffitto, phase). Verifica unit test passata: horiz/vert/diag full-cross OK, no-cross/external/endpoint NO SPLIT.
## Changelog (Feb 2026 — round 6 bug fixing)
- **FIX CRITICO: Stato di Fatto NON fattura più nel preventivo**:
  - `isProgetto` ora ESATTAMENTE filtra solo `phase === "progetto"` (era anche `!phase`, troppo permissivo)
  - Walls: filtro stretto, solo se phase=progetto OR (legacy senza phase E kind=cartongesso/nuovo)
  - Rooms con phase=fatto NON fatturano più impianto_elettrico_mq/idraulico_mq
- **FIX BUG: Presa diventava "punto luce LED"**:
  - Mapping electrical aggiornato: presa→`punto_presa`, interruttore→`punto_interruttore`, luce→`punto_luce`, quadro→`quadro_elettrico`
  - Nuove voci backoffice: punto_presa (35€), punto_interruttore (28€), quadro_elettrico (280€), punto_scarico (75€), punto_gas (110€), caldaia_condensazione (1500€), caldaia_ibrida (3800€), canalizzato_unita_interna (1100€), canalizzato_canale_ml (45€/ml), vmc (1900€), porta_blindata_cl3 (720€), porta_blindata_cl4 (1100€), scala_chiocciola (1200€), scala_muratura (2500€), scala_legno (1800€)
- **Editor: UNDO / REDO**:
  - Bottoni "Annulla" / "Ripristina" in toolbar editor (data-testid: undo-btn, redo-btn)
  - Shortcut Ctrl/Cmd+Z e Ctrl/Cmd+Shift+Z (skip se in input)
  - Stack snapshot fino a 50 stati
- **PreventivoComposite**:
  - Bottone "Infissi" spostato in alto a destra (no più mescolato con dati cliente)
  - Sezione "Infissi (extra configuratore)" in sidebar separata da divider
  - Loading state visibile se sezioni non ancora caricate
  - Toast errore migliorato con messaggio backend
- **Frontend "Conferma rilievo misure infissi"** (DettaglioCommessa):
  - Nuova `RilievoMisureTable` mostrata sotto la voce checklist con `fase_id="rilievo-misure"`
  - Input per L_definitiva/H_definitiva, calcolo automatico Δ% e stato (verde≤5%, giallo 5-8%, rosso>8%)
  - Persistenza tramite save({checklist})
- **Export PDF Tavole**: gestione errori robusta, ora se un SVG fallisce non rompe l'intero export e mostra messaggio "Anteprima non disponibile" sulla pagina specifica. Toast finale con conteggio tavole esportate

## TASK NON COMPLETATI (richiedono round successivo o decisione utente):
- ❌ Split automatico stanza con muro divisorio (richiede algoritmo polygon split + dialog conferma)
- ❌ Tool scale CAD (chiocciola/muratura/legno) - serve simbolo SVG + Properties panel
- ❌ Demolizione pavimento per AREA selezionata (serve rect tool)
- ❌ Tavola demolizioni con muri perimetrali ghost (richiede modifica TavoleModal layers)
- ❌ Prospetti pareti: quote elementi (h, dx, sx) per ogni MEP (modifica Prospetti.jsx)
- ❌ Bottone "Apri progettazione" da preventivo + collegamento bidirezionale preventivo↔progetto (serve project.preventivo_id nel backend e UI)
- ❌ Pacchetto: prezzo TOTALE per MQ visibile subito (parzialmente già visibile, richiede UI tweak)
- ⚠️ Trasparenza prezzi (badge "da Voci Backoffice") - cosmetic enhancement
- **Lotto F-G-H-I — Bug critici CAD + UI infissi + nuove feature progettazione**:
  - **FIX CRITICO Phase-aware estimate**: aggiunto campo `phase: "fatto"|"progetto"` su muri/porte/finestre/items/electrical/plumbing/gas/hvac/text/rooms in Canvas2D. estimateProjectV2 ora fattura SOLO elementi con `phase==='progetto'` (più demolizioni e muri cartongesso/nuovo). Lo "Stato di Fatto" non contagia più il preventivo.
  - Cartongesso visibile in stato fatto (filtro basato su phase, non più su kind)
  - Tool "Demolisci pavimento %": prompt per percentuale 1-100% area
  - Tool "Demolisci pavimento totale": ora è toggle (secondo click rimuove)
  - Tool "Testo": annotazioni libere sulle piante (drag, edit testo)
  - Porte blindate Classe 3 / Classe 4 (rimosso "premium")
  - Direzionalità (Cardine + Apertura) ora ANCHE per porte interne e finestre (esclusi scorrevole/vasistas)
  - Aggiunto tipo finestra "Vasistas" sia in drawing toolbar che in pannello selezionato
  - HVAC sub-kind picker arricchito: Caldaia condensazione, Caldaia ibrida, Canalizzato Unità interna, Canalizzato Canale (auto plenum), VMC
  - Nuove voci pricing: porta_blindata_cl3, porta_blindata_cl4, caldaia_condensazione, canalizzato_unita_interna, canalizzato_canale_ml
- **UI configuratore infissi (PreventivoInfissi + InfissoQuickConfigurator)**:
  - Layout grid ora responsive sm/md/lg (era fisso col-span-1 troppo stretto)
  - Input misure h-10 + font-mono font-bold + text-base, box colore non più tagliato
  - Box dimensioni nello SVG con riquadri bianchi font 14px ad alto contrasto
- **Workflow Commessa Infissi (P1)**:
  - POST /api/commesse/from-preventivo: se il preventivo ha infissi (tipo='infissi' o items.from_infissi=true o infissi_extras non vuoto), aggiunge automaticamente nella checklist la voce "Conferma rilievo misure infissi" con campo `rilievo_misure` popolato (L_originale, H_originale, L_definitiva=null, H_definitiva=null, tolleranza_pct=null, stato='da_rilevare'). Posizione: prima di 'produzione'/'ordine'.

## Changelog (precedente)
  - Misure leggibili: dimensioni in riquadri bianchi font 14px ad alto contrasto
  - Scelta libera ante 1/2/3/4 (rimosso il blocco automatico per misure piccole)
  - Mini-configuratore tapparelle (colore, motorizzazione +60%) e zanzariere (avvolgibile/plissettata/fissa) per ogni infisso
  - Pricing aggiornato: tapparella 120€/m² × motore 1.6, zanzariera 80€/m², maggiorazione 5% per anta extra
- **Lotto B — Voci Backoffice migliorate**:
  - Formato prezzi uniforme: `€ X,XX / unità` (acquisto, rivendita) ovunque (admin tabella, modal nuova/edit)
  - Nuovi flag: `modificabile_dal_venditore` (bool) + `soglia_inclusa` (€ per unit) — sopra soglia il prezzo diventa extra
  - Migrato DB: voce-tapparelle, voce-zanzariere, voce-infissi-pvc/alluminio/legno passati da `pz`/`forfait` a `m²` con prezzi al mq corretti (PVC 280, AL 460, LEGNO 620, tapp 120, zanz 80)
- **Lotto C — Configuratore infissi nei pacchetti/composite**:
  - Nuovo componente riusabile `/components/InfissoQuickConfigurator.jsx` (Dialog modal full-feature)
  - PreventivoPacchetto step 2: bottone "+ Aggiungi infissi (extra)" → infissi vengono inseriti come categoria EXTRA
  - PreventivoComposite: sezione "Infissi (configuratore)" nella sidebar che apre il modal e gestisce subtotale separato
- **Lotto D — Direzionalità porte CAD**: già esistente — verificato pannello proprietà con Cardine (Sx/Dx) + Apertura (Interno/Esterno) e rendering arc swing nello SVG
- **Lotto E — Materiali con AI**:
  - Nuovo endpoint `POST /api/materials/ai-generate` con Gemini text (gemini-2.5-flash) + Nano Banana (gemini-3.1-flash-image-preview)
  - Genera nome, descrizione, categoria, unità, prezzo realistico, colore, foto prodotto
  - Resilience: se Nano Banana fallisce, ritorna comunque material text valido (image_data_url=null)
  - UI: bottone violetto "✨ Genera con AI" con dialog inline preview + edit prima del save
  - Endpoint POST /api/materials per creazione singola (gestisce ObjectId stripping)
  - Tabella materiali ora mostra thumbnail dell'immagine se presente
- **Bug fix testing iteration 4**: POST /api/materials ObjectId leak → 500. Fix 1-riga (escludere `_id` insieme a `user_id`).

## Changelog (precedente)
- **Fix bug critico Configuratore → Preventivo (Feb 2026)**:
  - Risolto: extras del Configuratore Esigenze NON venivano iniettati nel preventivo
  - Causa root: React StrictMode (dev) provoca double-mount + double-invocation dei functional updaters di setState. Il primo mount cancellava `sessionStorage`, il secondo non trovava più i dati. Inoltre l'updater mutava `prefillRef.current.applied` rendendolo impuro.
  - Soluzione: `useRef` con flag `loaded`, gating su `?prefill=1` URL param, NO removeItem in load (cleanup spostato al success del save POST), updater puro che rileva `applied` via presenza di items con `from_configuratore: true`, preservazione delle EXTRA rows tra recompute.
  - Bonus fix: `bathroom_surcharge` calcolata a 0 quando `bathroom_tier=null` (prima calcolava un valore negativo). `anno_costruzione=""` causava 422 sul POST /leads → ora sanitizzato lato client.
  - Aggiunta categoria "EXTRA · Configuratore Esigenze" nel render Lavorazioni (prima il render era limitato a DEMOLIZIONI/MURATURA/IMPIANTI/INFISSI/SERVIZI, escludendo gli extras dal configuratore).
  - Badge "✓ Conforme al pacchetto X scelto in fase di consulenza" sia in UI riepilogo che nel PDF generato.
- **Prospetti pareti: editing 2D completo**:
  - Drag XY dei punti (non più solo verticale): cambia posizione orizzontale `t` lungo la parete + altezza `h`
  - Input numerici per editing preciso di `h` (altezza in cm) e `x` (posizione orizzontale in cm dal lato sinistro)
  - Persistenza su `prospetti_positions` accanto a `prospetti_heights`
  - Quote sotto ogni punto in modalità edit
- **CAD UX fixes (current session)**:
  - Fix bug doppio-click chiusura stanza (timeout-based per evitare punto vagante)
  - Pareti automatiche e quotate sui bordi della stanza al doppio click
  - Sidebar destra collassabile (toggle ChevronLeft/Right)
  - Fix inserimento porte/finestre: i muri/stanze non bloccano più il click
  - Pannello parametri porta/finestra (tipo: interna/blindata/scorrevole · finestra/porta-finestra/scorrevole + larghezza/altezza/parapetto + materiale PVC/Alluminio/Legno)
- **CAD avanzato (current session)**:
  - Tool gruppi: BASE / DEMOLIZIONI / IMPIANTI / FINITURE
  - Demolizioni: muri (toggle flag rosso tratteggiato), pavimenti, controsoffitti
  - Costruzioni: muri mattone vs cartongesso (stile diverso)
  - Impianti elettrico: quadro Q, scatole derivazione, prese, interruttori, punti luce
  - Impianti idraulico: acqua fredda F, calda C, scarico S
  - Gas + Condizionamento (split / unità esterna / predisposizione)
  - Schema posa piastrelle: 30x60, 60x60, 60x120, 80x80, 22.5x90, 25x150 + angolo + punto di partenza (algoritmo poligono clipPath)
  - **Sincronizzazione live preventivo ↔ Voci Backoffice**: ogni elemento CAD aggiorna automaticamente il computo metrico (mq/ml/punto/pz). Mappa 25+ chiavi → voce backoffice via `VOCE_MAP`.
  - **Pacchetto attivo**: selettore in alto. Calcola "incluso" vs "extra" per ogni voce. UI: incluso in verde, extra in rosso.
  - **Tavole di Progetto**: 8 piante (Stato di Fatto, Stato di Progetto, Demolizioni/Costruzioni, Imp. Elettrico, Idraulico, Gas, Condizionamento, Schema Posa) + **Prospetti pareti automatici** (vista frontale 2D delle pareti che hanno impianti/scarichi/split entro 80cm, con porte/finestre quotate e elementi a quote standard: presa 30cm, interruttore 110cm, luce 220cm, scarico 30cm, gas 40cm, split 220cm)
  - **Editing prospetti**: toggle "Modifica altezze" → drag verticale dei punti per regolare altezza, "Salva altezze" persiste su `prospetti_heights`
  - **Conferma in Commessa**: picker commessa nel modal Tavole. Click "Conferma" → push entries `tipo: tavola_progetto` su `commesse.documenti`, badge verde "CONFERMATE" nel tab Documenti di DettaglioCommessa
  - Anteprime grid con tab Piante/Prospetti, **export PDF A3 multipagina** (piante + prospetti)
  - **AI Floorplan Import**: upload immagine pianta → POST `/api/ai/floorplan-import` → Gemini 2.5 Pro Vision estrae JSON stanze (cm) → progetto 2D/3D auto-generato modificabile
- **Abaco Infissi visuale** in PreventivoInfissi: SVG schematico con telaio colorato, vetro, anta, maniglia, quote, materiale/vetro/colore/misura. Aggiunto campo Colore (bianco/antracite/grigio/marrone/noce/rovere)
- Full base44 replica implemented in one session
- Sidebar teal persistente con 4 sezioni + ruoli-based nav
- 4 wizard preventivi completi con calcoli live
- CRM pipeline + tabella + ConfiguratoreEsigenze con scoring
- Commesse con 8 tab e 18 fasi default
- 12 pagine admin complete
- Backend tests: 28/28 PASS (routes_biz) + 15/15 PASS (core)
- Rinomina pacchetti: SOFT/EASY/PLUS/TOP → BASIC/SMART/PREMIUM/ELITE
- Fix bug: /api/commesse/{id}/stato 404 handling, role-gating su POST commesse

## Backlog (P0/P1/P2)
- **P0 (RESOLVED)**:
  - ✅ Fix Configuratore Esigenze → Preventivo: extras correttamente iniettati via sessionStorage prefill, useRef + from_configuratore flag per gestire StrictMode dev double-mount
  - ✅ Fix toast "Errore salvataggio" falso (era saveLead lead 422 per anno_costruzione vuoto)
  - ✅ Fix bagno surcharge negativo quando bathroom_tier null
  - ✅ Render categoria EXTRA nel tab Lavorazioni
  - ✅ Badge "Conforme al pacchetto X" in UI riepilogo + PDF
  - ✅ Editing posizione orizzontale (XY) e altezza dei punti nei Prospetti
- **P1**:
  - Abaco infissi visuale in PreventivoInfissi (anteprima grafica per finestra / porta-finestra / colore / vetro / dimensioni)
  - Schema posa piastrelle: 30x60, 60x60, 60x120, 80x80 (effetto marmo/cemento), 22.5x90, 25x150 (effetto legno) + scelta punto di partenza e direzione/angolo
  - Impianti dettagliati in CAD: quadro elettrico, scatole derivazione, prese, idrici, gas, split condizionamento
- **P1** Drag-and-drop riordino fasi in AdminFasiCommessa
- **P1** Chart reale (Recharts)
- **P1** Invio email SendGrid/Resend
- **P2** Sub-contractor assignment voci commessa
- **P2** Upload logo via object storage
- **P2** PDF export commesse
- **P2** CAD: undo/redo, drag-to-move

## Testing
- Backend: 43 pytest totali PASS (28 biz + 15 core). Endpoints: auth, preventivi 4-types, commesse+checklist, leads, voci-backoffice, fasi, template-email, negozi, subappaltatori, dati-azienda, impostazioni, composite/infissi/bagno config, stats/dashboard.
- Frontend: smoke E2E verificato su dashboard, nuovopreventivo, commesse, crm, adminpacchetti. No console errors.
- Credentials admin: `admin@ristruttura.app` / `Admin12345!` (in `/app/memory/test_credentials.md`)
