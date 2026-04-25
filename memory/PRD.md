# Ristruttura.CAD / Configuratore — Product Requirements Document

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
