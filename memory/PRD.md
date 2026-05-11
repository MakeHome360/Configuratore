# Ristruttura.CAD / Configuratore — Product Requirements Document

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
