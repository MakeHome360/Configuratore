"""
50 articoli SEO-ottimizzati per il blog di SadiCasa.
Ogni articolo: title, slug, excerpt, content_md (~250-400 parole), category, tags, seo_keywords, hero_emoji.
Focus keyword: ristrutturazione, bagno, cucina, preventivo, bonus, costi, idee, materiali, casa.
"""
from datetime import datetime, timezone, timedelta

# Base date: spread articles over last 90 days for natural look
NOW = datetime.now(timezone.utc)


def _d(days_ago: int) -> str:
    return (NOW - timedelta(days=days_ago)).isoformat()


BLOG_POSTS = [
    # ============ RISTRUTTURAZIONE COMPLETA (1-5) ============
    {
        "slug": "quanto-costa-ristrutturare-casa-2026",
        "title": "Quanto costa ristrutturare casa nel 2026? Guida completa ai prezzi reali al m²",
        "category": "Costi e Preventivi",
        "tags": ["ristrutturazione", "costi", "prezzi", "preventivo"],
        "seo_keywords": "quanto costa ristrutturare casa, prezzo ristrutturazione al metro quadro, preventivo ristrutturazione 2026",
        "excerpt": "Il prezzo medio di una ristrutturazione completa nel 2026 oscilla tra 380€ e 1.180€ al m². Vediamo cosa incide davvero sul preventivo e come risparmiare senza compromettere la qualità.",
        "hero_emoji": "🏠",
        "content_md": """## Il prezzo della ristrutturazione nel 2026

Ristrutturare casa nel 2026 ha un costo che varia molto in base al livello di finitura scelto. I prezzi al metro quadro più realistici, IVA inclusa e con manodopera qualificata, sono:

- **Ristrutturazione economica (SOFT)**: 380€/m² — adatta a chi vuole rinfrescare casa con pavimenti, pittura, impianto elettrico base e qualche ritocco.
- **Ristrutturazione standard (SMART)**: 490€/m² — sostituzione completa di pavimenti e rivestimenti, rifacimento impianti, porte interne nuove.
- **Ristrutturazione premium**: 790€/m² — finiture di pregio, parquet, sanitari sospesi, domotica base, controsoffitti decorativi.
- **Ristrutturazione ELITE**: 1.180€/m² — materiali top di gamma, design su misura, illuminazione architetturale, domotica completa.

## Cosa incide davvero sul costo

Il prezzo finale dipende da: metratura, stato dell'immobile (più è degradato, più costa la demolizione), zona geografica (Milano-Roma costano 15-20% in più rispetto al sud), scelta dei materiali e tempistiche richieste.

## Come ottenere un preventivo serio

Diffida dei preventivi "a corpo" senza dettaglio voce per voce. Un preventivo trasparente deve elencare ogni intervento: demolizioni, impianti, intonaci, pavimentazioni, rivestimenti, sanitari, porte, manodopera. Con il nostro configuratore online puoi avere in 3 minuti un preventivo dettagliato con marginalità chiara.

## Il valore aggiunto del bonus ristrutturazioni

Nel 2026 è ancora attivo il **bonus 50%** sulle ristrutturazioni con tetto a 96.000€. Significa che su 50.000€ di lavori puoi recuperare fino a 25.000€ in 10 anni di detrazioni IRPEF. Tienilo presente quando confronti i preventivi.
""",
    },
    {
        "slug": "ristrutturazione-chiavi-in-mano-guida",
        "title": "Ristrutturazione chiavi in mano: vantaggi, rischi e cosa controllare prima di firmare",
        "category": "Ristrutturazione",
        "tags": ["chiavi in mano", "guida", "contratto"],
        "seo_keywords": "ristrutturazione chiavi in mano, contratto ristrutturazione, impresa edile",
        "excerpt": "La formula chiavi in mano è la più richiesta dai clienti che vogliono un unico interlocutore. Ma attenzione ai contratti vaghi: ecco le 7 clausole che devi pretendere.",
        "hero_emoji": "🔑",
        "content_md": """## Cosa significa "chiavi in mano"

La formula chiavi in mano prevede che un'unica impresa si occupi di tutto: progettazione, demolizioni, impianti, finiture, pulizia finale. Il cliente firma un contratto a corpo, paga in tranches e a fine lavori riceve le chiavi di un appartamento pronto da abitare.

## I vantaggi

- **Un solo interlocutore**: niente rimpalli tra elettricista, idraulico, piastrellista.
- **Prezzo bloccato**: il preventivo iniziale non si gonfia in corso d'opera (se il contratto è ben scritto).
- **Tempistiche garantite**: penalità in caso di ritardo.
- **Garanzia decennale** su strutture e impianti.

## Le 7 clausole da pretendere

1. **Computo metrico dettagliato** voce per voce, non "a corpo".
2. **Capitolato tecnico** che specifica marca e modello dei materiali (sanitari, piastrelle, porte).
3. **Cronoprogramma** con date di inizio e fine per ogni fase.
4. **Penali per ritardo** (es. 100€/giorno).
5. **Modalità di pagamento** vincolate al SAL (Stato Avanzamento Lavori), mai oltre il 30% di anticipo.
6. **Subappalti dichiarati**: chi farà cosa.
7. **Polizza assicurativa CAR** dell'impresa per danni a terzi.

## I rischi da evitare

Non firmare contratti senza capitolato dettagliato. Non pagare in contanti. Non accettare aumenti del prezzo senza una perizia tecnica scritta. E ricorda: se l'impresa ti sembra troppo economica rispetto agli altri preventivi, c'è probabilmente qualcosa che non torna.
""",
    },
    {
        "slug": "tempi-ristrutturazione-appartamento-quanto-dura",
        "title": "Quanto dura una ristrutturazione? Tempi reali stanza per stanza",
        "category": "Ristrutturazione",
        "tags": ["tempi", "cronoprogramma", "fasi cantiere"],
        "seo_keywords": "quanto dura ristrutturazione, tempi ristrutturazione appartamento, fasi cantiere",
        "excerpt": "Una ristrutturazione completa di un trilocale dura mediamente 60-90 giorni. Vediamo la durata reale di ogni fase, da demolizioni a consegna chiavi.",
        "hero_emoji": "⏱️",
        "content_md": """## La durata realistica fase per fase

Un cantiere ben organizzato segue questa successione, sovrapponendo alcune lavorazioni:

- **Demolizioni e smaltimento**: 5-10 giorni
- **Tracce impianti elettrici e idraulici**: 7-15 giorni
- **Posa nuovi impianti**: 10-15 giorni
- **Massetto autolivellante**: 3 giorni + 20 giorni di stagionatura
- **Intonaci interni**: 5-10 giorni
- **Posa piastrelle pavimenti e rivestimenti**: 10-15 giorni
- **Tinteggiatura e finiture**: 5-7 giorni
- **Posa sanitari e porte**: 5-7 giorni
- **Pulizia e consegna**: 2-3 giorni

**Totale stimato per un 80 m²**: 60-75 giorni lavorativi (~3 mesi di calendario).

## I fattori che allungano i tempi

- Ritardi nelle consegne dei materiali (problema cronico post-2022)
- Imprevisti strutturali (cavedi, tubi rotti, pavimentazioni non documentate)
- Modifiche al progetto in corso d'opera
- Variazione del numero di squadre disponibili

## Come accelerare il cantiere

Il vero acceleratore è la **pianificazione**. Avere già scelto tutti i materiali PRIMA di iniziare (piastrelle, sanitari, porte, finiture) evita i tempi morti di attesa fornitori. Con il nostro modulo di gestione cantieri puoi monitorare in tempo reale lo stato avanzamento di ogni fase.
""",
    },
    {
        "slug": "ristrutturazione-prima-casa-cosa-sapere",
        "title": "Ristrutturazione prima casa: 10 cose da sapere prima di iniziare",
        "category": "Ristrutturazione",
        "tags": ["prima casa", "guida", "novità"],
        "seo_keywords": "ristrutturazione prima casa, bonus prima casa, ristrutturare appartamento appena acquistato",
        "excerpt": "Hai appena comprato casa? Prima di buttare giù un muro o cambiare l'impianto elettrico, leggi queste 10 cose che fanno la differenza tra un cantiere riuscito e un disastro.",
        "hero_emoji": "📋",
        "content_md": """## Le 10 cose da sapere prima di iniziare

**1. Recupera la documentazione catastale e urbanistica**. Verifica che la planimetria depositata in Comune corrisponda allo stato di fatto. Difformità anche piccole possono bloccare il cantiere.

**2. Fai un sopralluogo tecnico approfondito** con un professionista (geometra o ingegnere) prima di firmare qualunque contratto.

**3. Verifica i regolamenti condominiali** per orari di lavoro, smaltimento macerie, uso ascensore.

**4. Distingui ristrutturazione da manutenzione straordinaria** — le pratiche edilizie cambiano (CILA vs SCIA).

**5. Prevedi sempre un fondo imprevisti** del 10-15% sul preventivo iniziale.

**6. Scegli i materiali PRIMA** di iniziare, non in corso d'opera. Risparmi tempo e dispute.

**7. Pretendi un capitolato firmato** che specifichi marche e modelli, non solo descrizioni generiche.

**8. Documenta tutto con foto** durante demolizioni e tracce impianti. Saranno preziose per future manutenzioni.

**9. Non pagare mai più del 30% di anticipo**. I pagamenti devono essere legati al SAL.

**10. Conserva ogni fattura** per il bonus ristrutturazioni 50% — devono essere bonifici parlanti tracciabili.

## L'errore più comune

L'errore numero uno dei neoproprietari è iniziare i lavori senza un progetto completo. Iniziare a demolire e poi decidere strada facendo è la ricetta per sforare budget e tempi. Investi 2 settimane in pianificazione: ti risparmieranno 2 mesi di problemi.
""",
    },
    {
        "slug": "ristrutturazione-piccolo-appartamento-50mq",
        "title": "Ristrutturare un appartamento di 50 m²: idee, costi e trucchi per ottimizzare lo spazio",
        "category": "Ristrutturazione",
        "tags": ["mini appartamento", "50mq", "ottimizzazione spazio"],
        "seo_keywords": "ristrutturare bilocale 50 mq, idee mini appartamento, ottimizzare spazio piccolo",
        "excerpt": "50 m² ben progettati valgono 70 m² caotici. Ecco le tecniche professionali per moltiplicare lo spazio percepito senza demolire.",
        "hero_emoji": "📐",
        "content_md": """## Il problema dei piccoli appartamenti

Spesso bilocali e monolocali sono progettati male: corridoi inutili, bagni grandi, cucine separate. Bastano poche scelte progettuali per raddoppiare la sensazione di spazio.

## Le 7 tecniche dei professionisti

**1. Cucina a vista** verso il soggiorno — niente più muro divisorio, guadagni 3-4 m² visivi.

**2. Porte scorrevoli a scomparsa** invece di battenti tradizionali — recuperi 0,8 m² per ogni porta.

**3. Pavimento uniforme** in tutta la casa (anche bagno e cucina con gres effetto legno o cemento) — l'occhio non viene "stoppato" dai cambi.

**4. Pareti chiare** (bianco, beige, grigio perla) — riflettono più luce.

**5. Specchi grandi** strategicamente posizionati di fronte alle finestre — raddoppiano la luce.

**6. Soffitti alti rivalutati**: se hai più di 2,80m, evita controsoffitti generosi; usa solo nelle zone tecniche.

**7. Mobili su misura fino al soffitto** — sfrutti volumi che con mobili standard restano vuoti.

## I costi tipici

Una ristrutturazione completa di 50 m² in formula SMART (490€/m²) si attesta sui **24.500€**. Aggiungendo arredi su misura, design d'autore e domotica si arriva intorno ai 35.000€. Detratto il bonus 50%, l'esborso reale è circa 17.500€.

## Il tempo di rientro economico

Un piccolo appartamento ristrutturato bene vede il suo valore di mercato salire del 15-25% al m². In zone centrali, il rientro dell'investimento è completo in 5-7 anni anche solo come rivalutazione patrimoniale.
""",
    },

    # ============ BAGNO (6-10) ============
    {
        "slug": "quanto-costa-rifare-bagno-2026",
        "title": "Quanto costa rifare un bagno nel 2026? Prezzi reali e voci dettagliate",
        "category": "Bagno",
        "tags": ["bagno", "costi", "rifacimento"],
        "seo_keywords": "quanto costa rifare bagno, preventivo bagno, prezzo ristrutturazione bagno",
        "excerpt": "Rifare un bagno di 5 m² nel 2026 costa tra 4.800€ e 12.500€ a seconda delle finiture. Vediamo il dettaglio voce per voce per non farti spennare.",
        "hero_emoji": "🛁",
        "content_md": """## I prezzi reali del bagno 2026

Per un bagno standard di 4-6 m², ecco le 3 fasce di prezzo realistiche:

**Bagno Silver — 4.800-6.500€**
- Demolizione completa, smaltimento
- Rifacimento impianto idraulico ed elettrico
- Piastrelle pavimento e parete in gres standard
- Sanitari serie economica (lavandino con colonna, WC a pavimento, bidet, vasca o piatto doccia base)
- Box doccia in alluminio bianco
- Miscelatori cromati base

**Bagno Gold — 7.000-9.500€**
- Tutto Silver +
- Piastrelle effetto pietra/marmo
- Sanitari sospesi (cassetta incasso)
- Mobile bagno laccato 80-100 cm con specchio
- Piatto doccia in pietra ricomposta
- Box doccia in cristallo 8mm
- Miscelatori a parete

**Bagno Premium — 10.000-12.500€**
- Tutto Gold +
- Grandi formati 60×120 o 120×120
- Sanitari di marca (Catalano, Flaminia)
- Mobile bagno su misura con piano in marmo o quarzo
- Doccia walk-in senza piatto, soffione 30×30 incasso
- Rubinetterie design (Gessi, Fantini)
- Illuminazione LED architetturale

## Cosa incide di più

Le voci che fanno volare il preventivo sono: piastrelle grandi formati (+30-40% rispetto a 30×60), demolizione e rifacimento totale degli impianti (+25%), sanitari sospesi vs a pavimento (+800-1.200€ totali).

## Il consiglio del professionista

Risparmia sulla rubinetteria (le linee medie durano 15+ anni), non risparmiare sull'impermeabilizzazione del piatto doccia. Una perdita d'acqua a 5 anni dalla ristrutturazione ti costa 3.000€ di lavori riparatori.
""",
    },
    {
        "slug": "doccia-o-vasca-cosa-scegliere",
        "title": "Doccia o vasca? Pro, contro e quando ha senso una contro l'altra",
        "category": "Bagno",
        "tags": ["doccia", "vasca", "scelta"],
        "seo_keywords": "doccia o vasca, sostituire vasca con doccia, vasca da bagno conviene",
        "excerpt": "Sostituire la vasca con una doccia walk-in è il trend del decennio. Ma in alcuni casi conviene tenere la vasca. Ecco la guida definitiva.",
        "hero_emoji": "🚿",
        "content_md": """## Il dilemma classico

Nel 75% delle ristrutturazioni italiane la vasca viene sostituita da una doccia. Ma è sempre la scelta giusta?

## Perché preferire la doccia

- **Risparmio idrico**: 30-50 litri per doccia di 5 minuti vs 150-200 litri per un bagno in vasca.
- **Accessibilità**: senza scalini per anziani e disabili.
- **Pulizia più rapida**: meno superficie da pulire.
- **Estetica moderna**: vetri trasparenti danno arieggia visiva.
- **Valore immobiliare**: un bagno con doccia walk-in vale il 5-8% in più al m².

## Perché tenere (o mettere) la vasca

- Hai bambini piccoli sotto i 5 anni — molto più comodo lavarli.
- Vasca rilassante a fine giornata, hai un budget benessere alto.
- Vuoi vendere casa a famiglie giovani: cercano spesso la vasca per i figli.
- Hai un bagno di servizio + un bagno padronale: tieni la vasca nel principale, doccia nel secondario.

## Il costo della sostituzione

Sostituire una vasca standard con un piatto doccia 80×120 cm con box in cristallo costa **1.200-2.000€** (manodopera inclusa). Se invece vuoi una doccia walk-in senza piatto, con rivestimento totale a pavimento, il costo sale a **2.500-3.500€** per via dell'impermeabilizzazione professionale richiesta.

## L'opzione ibrida: la vasca con porta

Per gli anziani che amano il bagno in vasca ma faticano a entrare/uscire, esistono vasche con sportello laterale ermetico. Costano 2.500-4.000€ ma rappresentano una soluzione intelligente prima di passare definitivamente alla doccia.
""",
    },
    {
        "slug": "errori-da-evitare-rifacimento-bagno",
        "title": "I 7 errori più costosi nel rifacimento del bagno (e come evitarli)",
        "category": "Bagno",
        "tags": ["errori", "bagno", "guida"],
        "seo_keywords": "errori rifacimento bagno, consigli ristrutturazione bagno, problemi bagno",
        "excerpt": "Un bagno fatto male si paga per 20 anni. Ecco i 7 errori che vediamo più spesso nei cantieri non seguiti da un PM esperto.",
        "hero_emoji": "⚠️",
        "content_md": """## Errore 1: pendenza piatto doccia insufficiente

La pendenza minima è dell'1,5%, idealmente 2%. Sotto, l'acqua ristagna e nel tempo provoca muffa nelle fughe e infiltrazioni. **Conseguenza**: rifacimento completo a 5-8 anni.

## Errore 2: skipping impermeabilizzazione box doccia

Risparmiare 200€ di guaina cementizia significa rischiare 3.000€ di danni al piano di sotto. Sempre Mapegum, Kerakoll o equivalenti su tutto il piatto e per 30 cm in altezza sulle pareti.

## Errore 3: presa elettrica vicino al lavabo senza isolamento IP44

Le norme CEI 64-8 impongono distanze e gradi di protezione precisi. Una presa standard a 50 cm dal lavabo è fuori norma e può essere causa di NON conformità nella certificazione impianto.

## Errore 4: cassetta wc incasso senza vano di ispezione

Quando si guasta lo scarico (cosa che succede dopo 10-15 anni), se non c'è il vano d'ispezione devi smurare. Lasciare un pannello rimovibile costa 50€, smurare costa 500€.

## Errore 5: ventilazione naturale insufficiente

Un bagno senza finestra DEVE avere un aspiratore meccanico con timer e portata > 90 m³/h. Aspiratori cinesi da 30€ si rompono dopo 2 anni e provocano muffa diffusa.

## Errore 6: rivestimento solo nella zona doccia

Le pareti di un bagno schizzano ovunque, non solo nella doccia. Rivestire anche dietro lavabo (almeno 1,2 m) e dietro wc (almeno 1 m) costa il 15% in più ma protegge le pareti per 30 anni.

## Errore 7: scegliere sanitari prima delle piastrelle

Le piastrelle determinano lo stile del bagno. Scegliere prima i sanitari significa rischiare combinazioni di colori orribili. **Ordine corretto**: piastrelle → mobile/sanitari → rubinetteria → accessori.

## La regola d'oro

Il bagno è la stanza più tecnica della casa. Spendere il 10% in più per avere un professionista che segue il cantiere è un'assicurazione contro errori che costerebbero il 200% in più da riparare.
""",
    },
    {
        "slug": "bagno-cieco-soluzioni-progettuali",
        "title": "Bagno cieco senza finestra: 6 soluzioni progettuali per renderlo bellissimo",
        "category": "Bagno",
        "tags": ["bagno cieco", "progettazione", "ventilazione"],
        "seo_keywords": "bagno cieco progetto, bagno senza finestra, ventilazione bagno cieco",
        "excerpt": "Il bagno cieco è una sfida ma anche un'opportunità: senza vincoli di finestra puoi progettare composizioni più libere. Le 6 strategie dei migliori interior designer.",
        "hero_emoji": "💡",
        "content_md": """## La sfida del bagno cieco

Un bagno senza finestra deve risolvere 3 problemi: ventilazione obbligatoria, illuminazione artificiale di qualità e percezione di spazio. Ecco come affrontarli.

## 1. Ventilazione meccanica forzata

Installa un aspiratore con timer e sensore di umidità (es. Vortice Punto Evo) con portata 90-120 m³/h. Costo 150-250€. Esce direttamente all'esterno o in cavedio tecnico ventilato.

## 2. Illuminazione a strati

- **Luce ambiente** a soffitto: faretti LED 4000K, 80+ CRI
- **Luce specchio** integrata: bianca neutra per un trucco realistico
- **Luce d'atmosfera**: strip LED dietro lo specchio o sotto il mobile (3000K, dimmerabile)

## 3. Materiali chiari e riflettenti

Piastrelle effetto marmo bianco o beige chiaro, eventualmente lucide nella zona lavabo per moltiplicare la luce.

## 4. Specchio extra-large

Uno specchio che copre tutta la parete sopra il lavabo trasforma la percezione dello spazio. Costo 200-400€ in più rispetto a uno standard, ma effetto raddoppio dell'ambiente.

## 5. Doccia trasparente

Box doccia in cristallo trasparente 8mm — niente più muro o tenda che spezza la visuale. Il bagno appare 2 m² più grande.

## 6. Verde acquatico

Una pianta tropicale ad alta umidità (felce, monstera, sansevieria) porta vita e migliora l'aria. Sceglie specie che amano l'ambiente umido.

## Il bonus design

Aggiungi un dettaglio scenografico: una parete in resina effetto cemento, un mosaico vetroso nella nicchia doccia, un lavabo in pietra lavica. Sono dettagli che fanno la differenza tra "bagno qualunque" e "bagno da rivista".
""",
    },
    {
        "slug": "trend-bagno-2026-stili-piu-richiesti",
        "title": "I 5 stili di bagno più richiesti nel 2026 (con esempi e prezzi)",
        "category": "Bagno",
        "tags": ["trend", "stili", "design"],
        "seo_keywords": "trend bagno 2026, stili bagno moderno, design bagno",
        "excerpt": "Dal Japandi al Brutalist Chic, scopri quali stili di bagno stanno spopolando nel 2026 e quanto costa realizzarli senza scendere a compromessi.",
        "hero_emoji": "✨",
        "content_md": """## I 5 stili dominanti

**1. Japandi minimal — 7.500-9.500€**
Tonalità beige sabbia, legno chiaro, sanitari sospesi essenziali, vetro satinato. Asciuga lo sguardo, calma la mente.

**2. Industrial caldo — 8.000-11.000€**
Resina effetto cemento a pavimento e parete doccia, dettagli in ottone brunito, rubinetterie a parete nero opaco. Maschile, contemporaneo.

**3. Marmo continuo — 11.000-15.000€**
Grandi lastre 120×280 effetto marmo (Calacatta, Statuario, Nero Marquinia) su tutte le pareti e a pavimento. Effetto hotel di lusso.

**4. Boho chic mediterraneo — 7.000-9.000€**
Zelliges 10×10 colorate, finiture in terracotta, legno di teak per accessori. Caldo, vacanziero, vivace.

**5. Brutalist chic — 9.000-12.000€**
Microcemento a parete e pavimento, sanitari di colore nero o antracite, box doccia con profili neri, illuminazione drammatica. Architettonico.

## Come scegliere il tuo stile

Considera tre fattori: la luce naturale disponibile, lo stile del resto della casa, e quanto tempo intendi viverci. Per chi vuole vendere o affittare entro 3-5 anni, i trend internazionali (Japandi, Marmo) hanno la migliore tenuta di valore. Per chi resta a vita, vai sul gusto personale.

## L'errore da evitare

Non mescolare 3 stili diversi nello stesso bagno. Scegline uno e portalo coerentemente in ogni elemento: piastrelle, sanitari, rubinetterie, illuminazione, accessori. La coerenza vale più della bellezza dei singoli pezzi.
""",
    },

    # ============ CUCINA (11-15) ============
    {
        "slug": "rifacimento-cucina-quanto-costa",
        "title": "Rifacimento cucina: quanto costa nel 2026 e dove conviene risparmiare",
        "category": "Cucina",
        "tags": ["cucina", "costi", "rifacimento"],
        "seo_keywords": "rifare cucina quanto costa, prezzi cucina nuova, ristrutturazione cucina",
        "excerpt": "Una cucina nuova di 12 m² costa tra 8.000€ (economica) e 35.000€ (alto di gamma). Vediamo il break-down completo e dove ha senso spendere o tagliare.",
        "hero_emoji": "🍳",
        "content_md": """## Cucina nuova: cosa entra nel preventivo

Una cucina completa include 6 macro-voci:

1. **Demolizione vecchia cucina + smaltimento**: 400-700€
2. **Modifica impianti** (elettrico, idrico, gas, scarico): 800-1.500€
3. **Pavimentazione nuova** se rifatta: 1.000-2.500€
4. **Rivestimento parete cottura/lavello**: 300-1.200€
5. **Mobili cucina completi** (base, pensili, isola, top): 4.000-22.000€
6. **Elettrodomestici** (frigorifero, forno, piano cottura, lavastoviglie, cappa): 1.500-8.000€

## Le 3 fasce di prezzo realistiche

**Cucina economica — 8.000-12.000€**
Anta laminato, top laminato hpl, elettrodomestici classe A medi (Beko, Indesit), maniglie a gola.

**Cucina media — 13.000-22.000€**
Anta laccato opaco o impiallacciato legno, top in quarzo, elettrodomestici classe A++ (Bosch, AEG), illuminazione integrata.

**Cucina alta — 23.000-35.000€**
Top in granito, marmo o Dekton, elettrodomestici incasso (Miele, Smeg), isola con piano cottura, cappa filtrante a soffitto, gole illuminate.

## Dove ha senso risparmiare

- **Anta**: il laminato moderno è quasi indistinguibile dal laccato a tatto, costa il 40% in meno e dura 20+ anni.
- **Maniglie**: stesso design top brand vs no-brand cinese, ma costo 1/3.
- **Elettrodomestici**: marchi medi (Hisense, Beko) sono qualitativamente paragonabili ai top a metà prezzo.

## Dove NON tagliare

- **Top di lavoro**: il quarzo o granito durano per sempre; il laminato si rovina in 5 anni se cucini ogni giorno.
- **Cassetti**: meccanismi soft-close e binari Blum sono un investimento.
- **Lavello e miscelatore**: usati 10 volte al giorno, vale la pena prenderli di qualità.
""",
    },
    {
        "slug": "cucina-aperta-o-chiusa-pro-contro",
        "title": "Cucina aperta o chiusa? Pro e contro reali per scegliere senza pentirsi",
        "category": "Cucina",
        "tags": ["cucina aperta", "open space", "progettazione"],
        "seo_keywords": "cucina aperta vantaggi, cucina open space, cucina chiusa o aperta",
        "excerpt": "L'open space è il sogno di molti, ma chi cucina davvero a volte si pente di aver buttato giù il muro. La guida onesta per scegliere bene.",
        "hero_emoji": "🪟",
        "content_md": """## Il fascino dell'open space

Una cucina aperta sul soggiorno crea continuità visiva, fa sembrare la casa più grande, facilita la socialità durante le cene e permette a chi cucina di non isolarsi.

## I lati negativi che nessuno racconta

1. **Odori ovunque**: una cappa anche potente non elimina tutto. Il divano e le tende assorbono.
2. **Rumore**: cappa, lavastoviglie, robot da cucina diventano colonna sonora del salotto.
3. **Sporco visibile**: se hai ospiti improvvisi, la cucina disordinata è davanti a tutti.
4. **Vapore in soggiorno**: friggendo molto, le superfici del living si "incollano" col tempo.

## Quando ha senso aprire la cucina

- Vivi da solo o in coppia senza figli piccoli
- Cucini principalmente piatti che non producono molti odori (insalate, pasta, forno)
- Hai una casa < 80 m² dove servono metri quadri visivi
- Hai una buona cappa con motore esterno (non filtrante)

## Quando ha senso tenerla chiusa

- Famiglia numerosa che cucina ogni giorno con fritture, sughi, soffritti
- Cucina etnica (asiatica, mediorientale, indiana) con spezie forti
- Hai bisogno di un ambiente caldo (la cucina chiusa trattiene il calore in inverno)
- Vuoi un soggiorno sempre presentabile per ospiti improvvisi

## La via di mezzo: cucina living chiudibile

La soluzione più intelligente sono **vetrate scorrevoli** (vetro temperato o industrial chic stile loft) che separano fisicamente quando serve, ma scorrono e spariscono quando non serve. Costo 1.500-3.500€ per una porta scorrevole di qualità con guida a soffitto.
""",
    },
    {
        "slug": "isola-cucina-quanto-spazio-serve",
        "title": "Isola in cucina: quanto spazio serve davvero e come progettarla bene",
        "category": "Cucina",
        "tags": ["isola cucina", "progettazione", "spazi"],
        "seo_keywords": "isola cucina dimensioni minime, quanto spazio per isola cucina, progettare isola",
        "excerpt": "L'isola è l'elemento più desiderato in cucina, ma in molte case è un errore. Le distanze minime, le funzioni e quando non farla.",
        "hero_emoji": "🏝️",
        "content_md": """## Le distanze minime non negoziabili

Per avere un'isola funzionale devi rispettare 4 distanze:

- **Dietro l'isola (passaggio principale)**: minimo 120 cm
- **Lato dell'isola (passaggio secondario)**: minimo 90 cm
- **Tra isola e altri elettrodomestici**: minimo 110 cm
- **Lunghezza minima dell'isola**: 180 cm (sotto perde di senso)

Se la tua cucina è larga meno di 360 cm (cioè 120 + 120 di isola + 120 retro), un'isola non ci sta. Considera invece una penisola.

## Le 3 funzioni dell'isola

**1. Isola operativa**: con piano cottura o lavello — richiede impianto elettrico/gas + scarico + cappa a soffitto. Costo aggiuntivo 1.500-2.500€.

**2. Isola snack**: solo piano + sgabelli — costo basso, massima flessibilità. Ideale per famiglie.

**3. Isola contenitiva**: cassettoni + cestoni + dispense — perfetta dove serve molto storage.

## I materiali del top

- **Quarzo (Silestone, Caesarstone)**: 250-400€/m². Resistente, non poroso, igienico.
- **Granito**: 200-350€/m². Più tradizionale, qualche manutenzione.
- **Dekton/Neolith**: 350-500€/m². Top di gamma, resistenze elevatissime.
- **Marmo**: 300-600€/m². Bellissimo ma macchia (usalo solo se sei consapevole).
- **Acciaio inox**: 250-400€/m². Industrial, pratico, graffia visibilmente.

## L'errore più comune

Inserire un'isola in una cucina troppo stretta. Il risultato è che ci si scontra ogni volta che si apre il forno o si passa con un piatto. Meglio una bella penisola in linea che un'isola sacrificata.
""",
    },
    {
        "slug": "cucina-in-muratura-vs-modulare",
        "title": "Cucina in muratura vs modulare: quale conviene davvero?",
        "category": "Cucina",
        "tags": ["cucina muratura", "cucina modulare", "confronto"],
        "seo_keywords": "cucina muratura prezzo, cucina muratura conviene, modulare o muratura",
        "excerpt": "La cucina in muratura ha un fascino romantico ma vincola le scelte future. Quando conviene davvero e quando è meglio una modulare standard.",
        "hero_emoji": "🧱",
        "content_md": """## La cucina in muratura: cos'è davvero

Una cucina in muratura ha la struttura portante costruita in mattoni o blocchi di cemento cellulare (es. Gasbeton, Ytong), rivestita in piastrelle o microcemento, con i piani di lavoro in marmo o granito. I mobili (ante, cassetti) sono inseriti negli alloggiamenti murari.

## I vantaggi

- **Carattere unico**: nessuna cucina è uguale a un'altra
- **Durata illimitata**: la struttura non si rovina
- **Personalizzazione massima**: ogni cm su misura per le tue abitudini
- **Look mediterraneo**: perfetta per casali, masserie, ville al mare

## Gli svantaggi (che pesano molto)

- **Costo elevato**: 30-50% più di una modulare di pari livello
- **Tempi lunghi**: 6-8 settimane vs 2-3 settimane per montaggio modulare
- **Inflessibilità**: non puoi spostarla né riconfigurarla
- **Manutenzione**: ante in legno vanno trattate, fughe vanno pulite
- **Valore immobiliare**: piace a meno persone (è un gusto specifico)

## Quando ha senso

- Casa nel sud Italia con vocazione mediterranea
- Stai per vivere a lungo nella casa (10+ anni)
- Vuoi una cucina che diventi il "cuore" della casa
- Hai budget per fare le cose per bene (non risparmiare sui materiali, distrugge il fascino)

## Quando NON ha senso

- Appartamento in città di taglio moderno
- Casa che potresti vendere/affittare in 3-5 anni
- Budget contenuto (una muratura mediocre è peggio di una modulare bella)
- Vuoi cambiare cucina ogni 10 anni come fanno molti

## La via di mezzo

Esistono cucine modulari in finitura legno massello con piani in marmo che danno il look della muratura ma con la flessibilità della modulare. Brand come Officine Gullo, Tartufi, La Cornue offrono questa soluzione per 18.000-35.000€.
""",
    },
    {
        "slug": "elettrodomestici-cucina-quali-scegliere",
        "title": "Elettrodomestici per la cucina nuova: quali scegliere senza buttare soldi",
        "category": "Cucina",
        "tags": ["elettrodomestici", "scelta", "marche"],
        "seo_keywords": "migliori elettrodomestici cucina, frigorifero quale comprare, forno migliore qualità prezzo",
        "excerpt": "La regola d'oro: spendere bene sul piano cottura e sul frigorifero, risparmiare su forno e lavastoviglie. Ecco perché.",
        "hero_emoji": "🔌",
        "content_md": """## La regola del 60-20-20

Quando metti su budget per gli elettrodomestici, segui questa proporzione:

- **60% del budget**: frigorifero e piano cottura
- **20%**: forno
- **20%**: cappa, lavastoviglie, microonde

Perché? Frigo e piano cottura li usi quotidianamente. Forno e lavastoviglie hanno qualità relativamente standardizzata anche nei marchi medi.

## Frigorifero: la scelta strategica

- **Capacità minima per coppia**: 300 litri
- **Famiglia 4 persone**: 400-500 litri
- **No frost obbligatorio**: niente più sbrinatura manuale
- **Classe energetica A+**: paga la differenza, recuperi in 3 anni
- **Marchi consigliati**: Bosch (rapporto QP), Liebherr (top di gamma), Samsung (innovazione)

## Piano cottura: induzione o gas?

**Induzione**: più veloce, sicura, energeticamente efficiente, facile da pulire. Costo 600-1.500€. Richiede contatore enel da 4,5 kW minimo (verifica!).

**Gas**: tradizionale, fiamma viva, controllo immediato, ma più sporca e meno sicura con bambini. Costo 200-500€.

**Vincitore 2026**: induzione, in particolare i nuovi modelli flex-zone (Bosch Serie 8, Miele KM7898) che riconoscono qualsiasi pentola in qualsiasi posizione.

## Forno: dove risparmiare

Un forno Beko o Bosch Serie 4 da 400€ cuoce praticamente identico a un Miele da 2.500€. Le differenze sono nei dettagli (cottura pilotata, sensori, vapore) ma per uso domestico standard sono superflui.

## Lavastoviglie: il segreto delle marche

I gruppi industriali (BSH = Bosch+Siemens, Whirlpool, Electrolux) producono motori identici per marchi diversi. Una Bosch e una Siemens sono "gemelle" con prezzo diverso. Verifica modello e specifiche tecniche, non il logo.

## Cappa: efficienza prima dell'estetica

Una cappa esterna (motore in sottotetto o esterno) è 3 volte più efficiente di una filtrante. Se puoi forare il muro o passare un cavedio, fallo sempre.
""",
    },

    # ============ BONUS E DETRAZIONI (16-20) ============
    {
        "slug": "bonus-ristrutturazioni-2026-guida",
        "title": "Bonus ristrutturazioni 2026: tutte le detrazioni attive e come ottenerle",
        "category": "Bonus e Detrazioni",
        "tags": ["bonus", "detrazioni", "agevolazioni"],
        "seo_keywords": "bonus ristrutturazione 2026, detrazioni fiscali casa, agevolazioni edilizia",
        "excerpt": "Nel 2026 sono ancora attivi 6 bonus per la casa. Vediamo quali, su quali importi, e come fare i bonifici parlanti per non perdere la detrazione.",
        "hero_emoji": "💰",
        "content_md": """## I 6 bonus attivi nel 2026

**1. Bonus ristrutturazioni 50%** — fino a 96.000€ di lavori. Detrazione IRPEF in 10 anni.

**2. Ecobonus 50-65%** — per interventi di efficientamento energetico (cappotto, infissi, caldaie a condensazione).

**3. Bonus mobili 50%** — fino a 5.000€ per mobili ed elettrodomestici classe A acquistati per case ristrutturate.

**4. Sismabonus 50-85%** — per interventi antisismici, fino a 96.000€ per unità.

**5. Bonus barriere architettoniche 75%** — per ascensori, montascale, rampe.

**6. Bonus verde 36%** — fino a 5.000€ per sistemazione di giardini e terrazzi.

## La regola d'oro: bonifico parlante

Tutti i bonifici per i lavori che vuoi detrarre DEVONO essere "parlanti", cioè contenere:
- Causale: "Lavori di ristrutturazione edilizia art. 16-bis DPR 917/1986"
- Codice fiscale del beneficiario detrazione
- P.IVA o C.F. dell'impresa esecutrice

Senza queste 3 informazioni, **perdi la detrazione** anche se i lavori sono regolarmente fatti.

## I documenti da conservare

- Pratica edilizia (CILA, SCIA o PdC)
- Fatture intestate al richiedente
- Bonifici parlanti
- Comunicazione preliminare ASL (per cantieri > 4 lavoratori)
- Asseverazione tecnica (per bonus 65%)

## L'errore che vediamo spesso

Pagare in contanti "per risparmiare l'IVA". Non solo è illegale, ma cancella ogni possibilità di detrazione. Pagare 100€ in nero significa rinunciare a 50€ di detrazione: stai regalando soldi all'idraulico.

## Come pianificare la massima detrazione

Frazionare gli interventi su più anni può aiutare a sfruttare meglio i tetti. Esempio: bagno nel 2026 + cucina nel 2027 = due tetti di detrazione anziché uno unico. Parla con un commercialista o usa il nostro configuratore con simulazione bonus integrata.
""",
    },
    {
        "slug": "ecobonus-65-quali-lavori",
        "title": "Ecobonus 65%: quali lavori rientrano davvero e quali no",
        "category": "Bonus e Detrazioni",
        "tags": ["ecobonus", "65", "efficienza energetica"],
        "seo_keywords": "ecobonus 65 lavori ammessi, ecobonus 2026, detrazione efficienza energetica",
        "excerpt": "L'ecobonus 65% premia i lavori che riducono il consumo energetico. Ma attenzione: molti lavori che sembrano \"green\" non rientrano. La lista ufficiale.",
        "hero_emoji": "🌱",
        "content_md": """## Cos'è l'Ecobonus

Il bonus 65% (o 50% per alcuni interventi) si applica a lavori che migliorano la classe energetica dell'immobile, attestati da un tecnico abilitato (asseverazione).

## Lavori che rientrano al 65%

- Coibentazione del tetto e delle pareti perimetrali (cappotto termico)
- Sostituzione di infissi (finestre, porte finestre, persiane) con vetri basso emissivi
- Pannelli solari termici per produzione acqua calda
- Schermature solari (tende esterne, pergolati con vetri)
- Sistemi di building automation per gestione climatica

## Lavori al 50%

- Sostituzione caldaia con caldaia a condensazione classe A
- Sostituzione climatizzatore con pompa di calore classe A+
- Generatori a biomassa (caldaie a pellet/legna)
- Impianti di micro-cogenerazione

## Cosa NON rientra (anche se sembra)

- Pannelli fotovoltaici (rientrano in altre detrazioni)
- Pavimenti radianti se non parte di una caldaia a condensazione
- Caldaie standard (classe inferiore alla A)
- Stufe a pellet senza caldaia integrata

## L'asseverazione tecnica

Per ottenere il 65% serve un'asseverazione di un tecnico abilitato (ingegnere, architetto, geometra, perito) che certifichi:
1. Stato pre-intervento (classe energetica iniziale)
2. Intervento eseguito a regola d'arte
3. Risparmio energetico atteso
4. Documentazione tecnica (schede prodotti, asse-y certificazione)

Costo asseverazione: 400-1.200€ a seconda della complessità.

## La trappola dei tetti

Ogni intervento ha un tetto massimo detraibile:
- Coibentazione tetto/pareti: 60.000€ per unità immobiliare
- Sostituzione infissi: 60.000€
- Caldaia a condensazione: 30.000€
- Schermature solari: 60.000€

Superare il tetto significa che l'eccedenza non è detratta. Pianifica i lavori per ottimizzare.
""",
    },
    {
        "slug": "cila-scia-quando-servono",
        "title": "CILA, SCIA o permesso di costruire? Quando servono e quanto costano",
        "category": "Bonus e Detrazioni",
        "tags": ["pratiche edilizie", "CILA", "SCIA"],
        "seo_keywords": "cila o scia ristrutturazione, quando serve permesso costruire, pratica edilizia casa",
        "excerpt": "Sbagliare la pratica edilizia significa rischiare multe da 1.000€ a 10.000€. Vediamo quando basta una CILA e quando serve la SCIA o il permesso di costruire.",
        "hero_emoji": "📑",
        "content_md": """## CILA — Comunicazione Inizio Lavori Asseverata

La CILA si usa per **manutenzione straordinaria leggera**: rifare bagno, sostituire pavimenti, cambiare gli impianti, spostare tramezzi NON portanti.

**Costo**: 250-500€ per il geometra + 80-150€ di oneri comunali.

**Tempi**: lavori iniziano subito dopo il deposito, non serve attendere autorizzazione.

## SCIA — Segnalazione Certificata di Inizio Attività

La SCIA serve per **interventi più consistenti**: modifica della planimetria, cambio destinazione d'uso (ufficio → abitazione), ristrutturazione pesante che cambia volumi.

**Costo**: 500-1.200€ pratica + oneri urbanizzazione (calcolati sui m²).

**Tempi**: i lavori iniziano dal deposito ma il Comune può chiedere integrazioni nei 30 giorni successivi.

## Permesso di Costruire (PdC)

Serve per **costruzioni nuove**, **ampliamenti** che cambiano volumetria, modifiche strutturali portanti, demolizioni con ricostruzione.

**Costo**: 1.500-3.500€ pratica + oneri proporzionali al volume.

**Tempi**: 60-90 giorni di istruttoria comunale prima di poter iniziare.

## I rischi del fai-da-te edilizio

Iniziare lavori senza pratica = abuso edilizio. Le conseguenze:
- Multa di 1.000-10.000€ (in base al Comune e all'entità)
- Obbligo di ripristino dello stato precedente
- Possibile sanatoria con costi alti (oblazione + diritti)
- Difficoltà in caso di compravendita futura (l'immobile risulta non conforme)

## Il caso tipico che inganna

"Sposto solo un tramezzo, sono lavori interni, non serve la CILA". **FALSO**. Anche spostare un tramezzo non portante richiede CILA con planimetria aggiornata. Costa 300€ farla, costa 3.000€ sanarla dopo.

## Il consiglio finale

Prima di iniziare qualunque lavoro che modifichi la planimetria o gli impianti, parla con un geometra di fiducia. Per 100-200€ di consulenza iniziale ti dice esattamente cosa serve e ti evita sorprese.
""",
    },
    {
        "slug": "sismabonus-come-funziona",
        "title": "Sismabonus 50-85%: come funziona e perché conviene anche se non sei in zona sismica",
        "category": "Bonus e Detrazioni",
        "tags": ["sismabonus", "antisismico", "consolidamento"],
        "seo_keywords": "sismabonus 2026, sismabonus 85, antisismico detrazione",
        "excerpt": "Il sismabonus arriva fino all'85% ed è valido anche per consolidamenti non strettamente antisismici. Una guida pratica per ottenere il massimo.",
        "hero_emoji": "🏗️",
        "content_md": """## Le 3 fasce di detrazione

Il sismabonus si articola così:
- **50%**: interventi senza riduzione di classe sismica
- **70-75%**: interventi con riduzione di 1 classe (75% se condominio)
- **80-85%**: interventi con riduzione di 2 classi (85% se condominio)

Il tetto è 96.000€ per unità immobiliare.

## Quali interventi rientrano

- Consolidamento di fondazioni, solai, tetti
- Ringrosso di pilastri e travi portanti
- Iniezioni di malta o resine epossidiche
- Tirantature, catene, telai metallici
- Rinforzo con FRP (fibre di carbonio o vetro)
- Riparazione di lesioni strutturali
- Sostituzione di solai in legno deteriorati

## Anche fuori zona sismica

Molti pensano che il sismabonus serva solo nelle zone classificate 1 e 2. **NON è vero**: in zona 3 (la più diffusa in Italia, copre quasi tutto il Nord) i lavori antisismici sono comunque agevolati al 50-85%.

## L'iter pratico

1. **Classificazione sismica iniziale**: un ingegnere strutturista classifica l'edificio (lettera da A a G).
2. **Progetto di adeguamento**: definisce gli interventi e la classe finale prevista.
3. **Esecuzione lavori**: deve essere fatta da impresa con SOA OG1 o OG2.
4. **Asseverazione finale**: il tecnico certifica la classe sismica raggiunta.
5. **Detrazione in 5 anni** (più rapida del bonus ristrutturazioni standard).

## Quando conviene davvero

- Edificio anni 60-70 con cemento armato di qualità incerta
- Casa in muratura ad un piano con tetto in legno antico
- Villette indipendenti in zone 2-3
- Condomini storici che vogliono migliorare il rating immobiliare

## Il costo professionale

L'asseverazione strutturale + perizia + classificazione costa 2.500-6.000€ a seconda della complessità. È un investimento che si recupera 10 volte nei lavori detratti.
""",
    },
    {
        "slug": "bonus-mobili-come-funziona",
        "title": "Bonus mobili 50%: cosa puoi comprare e quanto risparmi davvero",
        "category": "Bonus e Detrazioni",
        "tags": ["bonus mobili", "elettrodomestici", "detrazione"],
        "seo_keywords": "bonus mobili 2026, bonus elettrodomestici, mobili detraibili",
        "excerpt": "Il bonus mobili al 50% vale fino a 5.000€ per chi sta ristrutturando casa. Ma solo certi acquisti rientrano. Vediamo cosa SI e cosa NO.",
        "hero_emoji": "🛋️",
        "content_md": """## Cos'è il bonus mobili

Chi sta facendo lavori di ristrutturazione (CILA, SCIA o PdC depositati) può detrarre al 50% l'acquisto di mobili nuovi e grandi elettrodomestici, con tetto a 5.000€.

**Sconto reale**: 2.500€ massimi in 10 anni di detrazioni IRPEF.

## Cosa rientra

**Mobili**: letti, armadi, cassettiere, comò, sedie, sgabelli, tavoli, divani, librerie, scrivanie, materassi, apparecchi di illuminazione.

**Elettrodomestici classe A+** o superiore: frigorifero, freezer, lavatrice, lavasciuga, asciugatrice, lavastoviglie, forno, piano cottura, cappa, microonde, climatizzatore (per quest'ultimo serve classe energetica specifica).

## Cosa NON rientra

- Tende, tappeti, complementi tessili
- Articoli da bagno (piatti doccia, sanitari, miscelatori — questi rientrano nel 50% ristrutturazioni)
- Piccoli elettrodomestici (frullatori, robot, ferri da stiro)
- Mobili usati o di seconda mano
- Mobili acquistati prima dell'inizio lavori

## La regola del legame coi lavori

Il bonus mobili è legato a un cantiere reale. Devi avere:
- CILA, SCIA o PdC depositati e inizio lavori COMUNICATO
- Acquisti DOPO l'inizio dei lavori
- Pagamento tracciabile (carta, bonifico, anche bancomat — NON contanti)
- Fattura intestata al richiedente la detrazione

## Strategia per massimizzare

Se stai per fare ristrutturazione:
1. Deposita la pratica in Comune
2. Inizia anche solo simbolicamente i lavori (smontaggio sanitari)
3. Inizia a comprare i mobili nei mesi successivi
4. Conserva ogni documento

Una famiglia che rifa casa può portare a detrazione 5.000€ di mobili + 5.000€ di elettrodomestici per **doppia detrazione** se entrambi i coniugi pagano metà ciascuno.

## L'errore classico

Comprare i mobili PRIMA di depositare la pratica edilizia. In questo caso il bonus mobili è perso. Prima pratica, poi acquisto.
""",
    },

    # ============ MATERIALI E FINITURE (21-25) ============
    {
        "slug": "parquet-o-gres-effetto-legno",
        "title": "Parquet o gres effetto legno? Confronto onesto su prezzi, durata e estetica",
        "category": "Materiali",
        "tags": ["parquet", "gres", "pavimenti"],
        "seo_keywords": "parquet o gres porcellanato, gres effetto legno opinioni, pavimento più resistente",
        "excerpt": "Il gres effetto legno è il pavimento più venduto negli ultimi 5 anni perché costa meno del parquet e dura di più. Ma il parquet vero ha ancora margini. Vediamo i pro e contro.",
        "hero_emoji": "🪵",
        "content_md": """## Il gres effetto legno: i pro

- **Resistenza altissima** a graffi, urti, umidità
- **Prezzo**: 25-50€/m² per qualità ottime
- **Posa rapida**: 30-50€/m² incollato
- **Manutenzione zero**: si lava con acqua e detergente neutro
- **Adatto al riscaldamento a pavimento** senza accorgimenti
- **Compatibile con bagno e cucina** (non teme l'acqua)

## I contro del gres

- Sensazione al tatto fredda (anche se con riscaldamento meno avvertibile)
- Effetto realistico ma "perfetto" — manca il calore vero del legno
- Non si può levigare/restaurare: se danneggiato va sostituito
- Acusticamente più freddo (più riflessione del suono)

## Il parquet vero: i pro

- **Calore tattile e visivo** ineguagliabile
- **Restaurabile**: una lamatura ogni 15-20 anni e torna come nuovo
- **Valore immobiliare**: aumenta il valore percepito dell'immobile
- **Sensazione di lusso** e raffinatezza
- **Migliora acusticamente** l'ambiente (assorbe più del gres)

## I contro del parquet

- **Prezzo**: 60-200€/m² per prefiniti, 100-300€/m² per massello
- **Manutenzione**: richiede oli o vernici protettive ogni 5-10 anni
- **Sensibile all'umidità**: non ideale in bagno
- **Posa più costosa**: 35-60€/m² (incollato o flottante)
- **Soggetto a graffi** da animali, sedie senza feltrini

## Il verdetto

**Scegli gres effetto legno se**:
- Hai bambini piccoli e animali
- Hai riscaldamento a pavimento
- Vuoi posa unica anche in bagno/cucina
- Cerchi durata massima con manutenzione zero

**Scegli parquet vero se**:
- Vivi in una casa di pregio
- Apprezzi i materiali naturali
- Hai un budget alto e vuoi valore aggiunto immobiliare
- Sei disposto a curare la manutenzione

**La scelta più frequente del 2026**: gres effetto legno grande formato 30×120 o 20×120, posa a correre, fuga 2mm tono colore. Costo finito 70-90€/m².
""",
    },
    {
        "slug": "tinteggiatura-pareti-come-scegliere-colori",
        "title": "Tinteggiatura pareti: come scegliere i colori senza sbagliare (regole d'oro degli interior)",
        "category": "Materiali",
        "tags": ["pittura", "colori", "interior design"],
        "seo_keywords": "scegliere colore pareti, tinteggiatura casa, colori pareti soggiorno",
        "excerpt": "Sbagliare il colore delle pareti costa tinteggiare di nuovo dopo 2 anni. Le 5 regole degli interior designer e i 10 colori vincenti del 2026.",
        "hero_emoji": "🎨",
        "content_md": """## Le 5 regole d'oro

**1. Testa il colore in casa, non solo in cartella**
Compra un campione da 200ml, dipingi un quadrato 50×50 su una parete. Guardalo con luce diurna e con luce artificiale serale. I colori cambiano drasticamente.

**2. Pareti chiare ingrandiscono lo spazio**
Bianco, beige, tortora, grigio perla, azzurro polvere — moltiplicano la luce e fanno sembrare la stanza più grande.

**3. Una parete d'accento, mai più di una**
Se vuoi un colore forte, mettilo su UNA sola parete (di solito quella alle spalle del divano o della testata del letto). Tutte e 4 le pareti colorate = ambiente claustrofobico.

**4. Considera l'esposizione**
- **Stanze esposte a Nord**: vai sui caldi (giallo paglierino, rosa cipria, beige caldo).
- **Stanze a Sud**: puoi osare i freddi (grigi, blu, verdi salvia).

**5. Coordina con i pavimenti**
- Pavimenti chiari (rovere sbiancato, beige): puoi osare pareti più scure.
- Pavimenti scuri (noce, wengé, parquet scuro): tieni le pareti chiare.

## I 10 colori vincenti del 2026

1. **Bianco caldo (Off-White)** — Benjamin Moore Simply White
2. **Beige sabbia** — perfetto per soggiorni nordici
3. **Grigio perla** — base neutra elegante
4. **Verde salvia** — il colore dell'anno per camere
5. **Terracotta tenue** — mediterraneo, accogliente
6. **Blu Mykonos** — profondità senza pesare
7. **Tortora** — classico che non stanca mai
8. **Albicocca smorto** — caldo, sofisticato
9. **Antracite** — drammatico, solo come parete d'accento
10. **Bianco panna** — alternativa romantica al bianco puro

## Quanto costa tinteggiare

- Mano di fondo + 2 mani di idropittura traspirante: **8-12€/m²**
- Sgrassaggio, stuccatura buchi e crepe: incluso nel prezzo
- Per appartamento 80 m² (con superficie pareti ~200 m²): **1.600-2.400€**
- Aggiungi 1-2€/m² per pitture decorative speciali (effetto velluto, sabbiato)
""",
    },
    {
        "slug": "carta-da-parati-trend-quando-usarla",
        "title": "Carta da parati: dove ha senso usarla nel 2026 (e dove ti pentirai)",
        "category": "Materiali",
        "tags": ["carta da parati", "decorazione", "trend"],
        "seo_keywords": "carta da parati 2026, dove mettere carta parati, alternative pittura",
        "excerpt": "La carta da parati è tornata di moda ma con regole diverse dagli anni '90. I posti dove funziona alla grande, e quelli dove crea problemi.",
        "hero_emoji": "🖼️",
        "content_md": """## Il ritorno della carta da parati

Dopo 20 anni di "solo pittura", la carta da parati è di nuovo amata. I prodotti moderni sono lavabili, traspiranti, anti-muffa e si rimuovono senza distruggere l'intonaco.

## Dove ha senso usarla

**1. Parete d'accento dietro letto o divano**
Crea un focus visivo. Stampe geometriche, floreali o panoramiche.

**2. Ingresso e disimpegni**
Spazi piccoli dove un'esplosione di pattern fa scena senza saturare la casa.

**3. Camera bambini**
Cartoni, animali, mappe — vita di pochi anni ma effetto adorabile.

**4. Studio o stanza hobby**
Pattern audaci stimolano la creatività.

## Dove NON usarla

**1. Bagno cieco con doccia**
L'umidità anche con carte resistenti si insinua nelle giunture in 3-5 anni.

**2. Cucina vicino ai piani cottura**
Vapori grassi macchiano permanentemente.

**3. Pareti che ricevono sole diretto tutto il giorno**
Sbiadiscono in modo non uniforme.

**4. Casa che potresti rivendere a breve**
La carta è un gusto specifico — fa fatica a piacere a tutti i potenziali acquirenti.

## I costi reali

- Carta da parati di qualità: **30-150€/rotolo** (5 m² circa)
- Posa professionale: **15-25€/m²**
- Su una parete 4m × 2.7m: **150-400€** di carta + 200€ di posa = **350-600€**

## Le 3 tipologie principali

**Carta vinilica**: lavabile, resistente, perfetta per ingressi e disimpegni. Più economica (15-40€/rotolo).

**Carta non tessuta (TNT)**: traspirante, facile da posare e rimuovere, top di gamma. 50-150€/rotolo.

**Murales fotografici**: pattern unico stampato a misura. 80-300€ per parete intera. Effetto wow garantito.

## Il consiglio dei pro

Mai posare la carta su pareti non perfettamente rasate. Ogni imperfezione si nota tantissimo. Spendi 200€ extra di rasatura, eviterai delusioni.
""",
    },
    {
        "slug": "porte-interne-quali-scegliere",
        "title": "Porte interne: liscia, pantografata, vetrata o scorrevole? Come scegliere",
        "category": "Materiali",
        "tags": ["porte interne", "scelta", "design"],
        "seo_keywords": "porte interne quali scegliere, porte scorrevoli o battenti, porte vetrate",
        "excerpt": "Le porte interne sono come gli occhi della casa: trasformano l'aspetto degli ambienti. Vediamo i 4 stili principali e quando conviene ciascuno.",
        "hero_emoji": "🚪",
        "content_md": """## Le 4 famiglie di porte

**1. Lisce moderne**
Anta laccata bianca o colorata, niente decori. Pulite, minimal, adatte a qualsiasi stile. **Costo**: 250-450€ porta + 100-150€ posa.

**2. Pantografate classiche**
Anta con scanalature decorative, perfette per case classiche o in stile inglese. **Costo**: 350-600€ porta + 100-150€ posa.

**3. Vetrate**
Con uno o più riquadri di vetro (trasparente, satinato, decorato). Portano luce. **Costo**: 400-800€ porta + 150-200€ posa.

**4. Scorrevoli**
Esterno muro (su binario a vista) o a scomparsa nel muro (controtelaio). Risparmiano spazio. **Costo**: 350-700€ porta + 250-450€ posa (controtelaio incluso).

## Quando scegliere quale

**Liscia bianca**: case moderne, vuoi un effetto pulito, budget medio. Scelta più sicura.

**Pantografata**: case classiche, case storiche, vuoi valore tradizionale.

**Vetrata**: corridoi bui, separare ambienti mantenendo continuità visiva (es. cucina/soggiorno).

**Scorrevole**: bagno piccolo, lavanderia, camera con poco spazio per il battente.

## I dettagli che fanno la differenza

- **Cerniere anuba a scomparsa**: invisibili da chiuse, look pulito (+30€/porta)
- **Soft close**: chiusura ammortizzata, no più sbattute (+40€/porta)
- **Coprifili a filo muro**: linee minimal, costa lavoro extra (+80€/porta)
- **Maniglia di design**: una buona maniglia (Olivari, Colombo) costa 60-150€ e fa la differenza al tatto

## L'errore da evitare

Mescolare stili diversi nelle porte della stessa casa. Tutte lisce moderne O tutte pantografate. Mai metà liscia metà classica — sembra incoerente e si nota tantissimo.

## Il dimensionamento

Porta standard 80x210 va bene per la maggior parte degli usi. Per cucine e bagni grandi considera 90x210 (passi meglio con vassoi). Le porte cieche stanza ripostiglio possono restare 70x210.
""",
    },
    {
        "slug": "pavimenti-effetto-marmo-prezzi",
        "title": "Pavimenti effetto marmo: il lusso accessibile del gres porcellanato (con prezzi)",
        "category": "Materiali",
        "tags": ["marmo", "gres", "pavimenti"],
        "seo_keywords": "gres effetto marmo prezzo, marmo finto pavimento, marmo o gres",
        "excerpt": "Il marmo vero costa 5-10 volte il gres effetto marmo. Ma il gres moderno è quasi indistinguibile. Confronto onesto tra realtà e fattezze.",
        "hero_emoji": "🏛️",
        "content_md": """## Il gres effetto marmo: la rivoluzione

Negli ultimi 8 anni la tecnologia di stampa digitale ha trasformato il gres effetto marmo da imitazione goffa a riproduzione fedelissima. Le grandi lastre 120×120 o 60×120 sono praticamente indistinguibili a occhio nudo da un Calacatta o uno Statuario veri.

## I vantaggi vs marmo vero

- **Prezzo**: 40-90€/m² gres vs 250-600€/m² marmo
- **Manutenzione**: gres impermeabile, marmo poroso che macchia
- **Resistenza acida**: il gres resiste a aceto e limone, il marmo no
- **Durezza**: gres 7-8 Mohs, marmo 3-4 Mohs (graffia più facilmente)
- **Posa**: il gres si taglia più facilmente, posa più rapida

## Quando il marmo vero ha ancora senso

- **Case di alto pregio** dove ogni dettaglio conta
- **Mausolei e ambienti istituzionali** dove la materialità è valore
- **Tagli scenografici unici** che il gres non può replicare (es. lastre da 3m)
- **Ambienti sacri o storici** che richiedono autenticità

## I 5 effetti marmo più richiesti

1. **Calacatta Oro** (bianco con venature dorate) — eleganza neutra
2. **Statuario** (bianco con venature grigie/nere) — classico timeless
3. **Carrara** (bianco con venature delicate) — il più diffuso, italianissimo
4. **Nero Marquinia** (nero con venature bianche) — drammatico, scenografico
5. **Emperador** (marrone con venature dorate) — caldo, mediterraneo

## I formati che funzionano

- **30×60**: economico, posa facile, ideale per piccole superfici
- **60×60**: equilibrio tra realismo e costo
- **60×120**: il più realistico (le lastre lunghe ricordano il marmo vero)
- **120×120 / 120×280**: top di gamma, posa specializzata, effetto da magazine

## I costi reali finiti

- Gres 30×60: **35-50€/m²** finito (mat + posa)
- Gres 60×60: **50-70€/m²** finito
- Gres 60×120: **70-100€/m²** finito
- Gres 120×280 grandi lastre: **120-180€/m²** finito

## La regola da non infrangere

Il posatore conta più del materiale. Una lastra 120×120 mal posata (livella sbagliata, fughe storte) annulla l'effetto wow. Spendi sul posatore quanto risparmi sul materiale.
""",
    },

    # ============ RISPARMIO ENERGETICO (26-30) ============
    {
        "slug": "cappotto-termico-quanto-risparmio",
        "title": "Cappotto termico: quanto fa risparmiare davvero in bolletta?",
        "category": "Risparmio Energetico",
        "tags": ["cappotto", "risparmio", "isolamento"],
        "seo_keywords": "cappotto termico risparmio, quanto costa cappotto termico, isolamento esterno casa",
        "excerpt": "Il cappotto termico riduce i consumi del 30-50%. Ma costa 80-150€/m² di parete. Quando si ripaga davvero e quando è un investimento perso.",
        "hero_emoji": "🏘️",
        "content_md": """## Cos'è il cappotto termico

Il cappotto è un sistema di isolamento applicato all'esterno delle pareti perimetrali. Pannelli di EPS, lana di roccia o sughero (8-16 cm di spessore) vengono incollati e tassellati, poi rasati e tinteggiati con tinte ai silicati.

## Il risparmio reale in bolletta

Su una casa di 100 m² mal coibentata (anni 70-80), un cappotto da 12 cm riduce:
- Consumo gas/riscaldamento: **-35-45%**
- Consumo climatizzazione estiva: **-20-30%**
- Risparmio annuo medio: **800-1.500€**

## Quanto costa

- **Cappotto in EPS** (polistirene): 80-110€/m² incluso ponteggio
- **Cappotto in lana di roccia**: 100-130€/m² (più traspirante, meglio per umidità)
- **Cappotto in sughero**: 130-170€/m² (naturale, durevole, costoso)

Su una facciata di 200 m²: **16.000-30.000€** totali.

## Quando si ripaga

Con i bonus 65% in vigore nel 2026, il netto pagato è **5.600-10.500€**. Con risparmio annuo di 1.200€ medio, il rientro è di **5-9 anni**. Dopo è tutto guadagno.

## Quando NON ha senso

- Villetta in zona climatica E (centro-sud) con bollette già basse — rientro 15+ anni
- Edificio storico vincolato in centro (non puoi fare cappotto esterno)
- Casa che venderai entro 5 anni (non recuperi l'investimento)
- Pareti già in buone condizioni con coibentazione interna esistente

## Le 4 cose da pretendere

1. **Diagnosi energetica preventiva** (APE iniziale + simulazione APE finale)
2. **Materiali certificati** (marchio CE + scheda tecnica)
3. **Posa secondo UNI 6946** (sistemi a cappotto certificati)
4. **Garanzia 10 anni** sull'isolante e sulla finitura

## Errore tipico

Risparmiare sullo spessore. Un cappotto da 6 cm in zona climatica E è praticamente inutile, devi andare a 10-12 cm minimo. Risparmiare 2.000€ sullo spessore significa rinunciare a 400€ di risparmio annuo per sempre.
""",
    },
    {
        "slug": "infissi-pvc-alluminio-legno",
        "title": "Infissi: PVC, alluminio o legno? Confronto su prezzi, isolamento e durata",
        "category": "Risparmio Energetico",
        "tags": ["infissi", "finestre", "isolamento"],
        "seo_keywords": "infissi pvc o alluminio, finestre quali scegliere, infissi a taglio termico",
        "excerpt": "Le finestre giuste fanno risparmiare 600€ di bollette l'anno. Vediamo i 3 materiali principali con tutti i pro e contro.",
        "hero_emoji": "🪟",
        "content_md": """## I 3 materiali principali

**1. PVC**
- Prezzo: 300-500€ per finestra standard (120×150)
- Isolamento termico: ottimo (Uw 1.0-1.2 W/m²K)
- Manutenzione: zero
- Estetica: limitata, colori standard
- Durata: 25-30 anni

**2. Alluminio a taglio termico**
- Prezzo: 500-800€ per finestra standard
- Isolamento: buono (Uw 1.2-1.5 W/m²K)
- Manutenzione: zero
- Estetica: telai sottili, look moderno, molti colori
- Durata: 40+ anni

**3. Legno**
- Prezzo: 700-1.200€ per finestra standard
- Isolamento: ottimo (Uw 1.0-1.3 W/m²K)
- Manutenzione: verniciatura ogni 7-10 anni
- Estetica: calda, naturale, classica
- Durata: 50+ anni se manutenuto

## I vetri: la parte più importante

Più dell'80% della dispersione termica passa dal vetro, non dal telaio. Le 3 opzioni:

- **Vetro singolo**: dispersione altissima, da non usare più
- **Vetro doppio basso emissivo 4-16-4**: standard moderno, Ug 1.1
- **Vetro triplo 4-12-4-12-4**: alto livello, Ug 0.6, indicato in zona F (montana)

## Il calcolo del risparmio

Su una casa di 100 m² con 8 finestre, sostituire infissi anni 80 a vetro singolo con PVC a doppio vetro basso emissivo riduce i consumi del 25-35%. **Risparmio annuo**: 500-800€.

## I costi totali medi

Per 8 finestre di una casa standard:
- **PVC**: 3.500-5.000€
- **Alluminio**: 5.500-8.500€
- **Legno**: 7.500-12.000€

Con ecobonus 65% nel 2026, il costo netto si riduce a:
- **PVC**: 1.200-1.700€
- **Alluminio**: 1.900-3.000€
- **Legno**: 2.600-4.200€

## La scelta consigliata per maggior parte dei casi

**Alluminio a taglio termico verniciato**: equilibrio tra prestazioni, estetica moderna, durata, manutenzione zero. Costo medio ma rientro veloce.

## L'errore da evitare

Sostituire infissi senza controllare la posa. Una finestra premium mal posata (senza nastri termoespandenti, senza schiumatura corretta) disperde quanto una finestra vecchia. Pretendi la **posa qualificata UNI 11673**.
""",
    },
    {
        "slug": "pompa-di-calore-conviene",
        "title": "Pompa di calore: conviene sostituire la caldaia a gas?",
        "category": "Risparmio Energetico",
        "tags": ["pompa di calore", "caldaia", "elettrica"],
        "seo_keywords": "pompa di calore conviene, sostituire caldaia gas, costo pompa calore",
        "excerpt": "Le pompe di calore moderne riscaldano casa con 1/3 dell'energia di una caldaia a gas. Ma serve l'impianto giusto. Quando conviene davvero.",
        "hero_emoji": "🌡️",
        "content_md": """## Come funziona una pompa di calore

Una pompa di calore aria-acqua o aria-aria estrae calore dall'aria esterna (anche a 0°C ce n'è!) e lo trasferisce all'interno. Per ogni 1 kWh elettrico consumato, ne restituisce 3-4 kWh termici. Questo rapporto si chiama COP.

## Quando conviene davvero

**Condizione 1: impianto a bassa temperatura**
Pavimento radiante o radiatori bassi (45-55°C). Le pompe di calore lavorano male a temperature alte tipiche dei termosifoni vecchi (70°C).

**Condizione 2: casa ben coibentata**
Senza buon isolamento, in giornate molto fredde la pompa va in deficit e attiva la resistenza elettrica (costosissima).

**Condizione 3: fotovoltaico**
Se hai pannelli FV con surplus diurno, la pompa di calore consuma "gratis" e taglia la bolletta drasticamente.

## I costi

- Pompa di calore aria-acqua per casa 100 m²: **6.000-9.000€** + installazione **2.000-3.500€**
- Bollitore per acqua sanitaria integrato: **+1.500-2.500€**
- Totale: **9.500-15.000€**

Con ecobonus 50% nel 2026: netto **4.750-7.500€**.

## Il risparmio annuo

Su un consumo annuo di 1.500 m³ di gas (casa 100 m²):
- Costo gas: **1.200€/anno**
- Stessa energia con pompa di calore COP 3.5: **600-700€/anno** di elettricità
- Risparmio: **500-600€/anno**

Con fotovoltaico abbinato il risparmio sale a **800-1.000€/anno**.

## Quando NON conviene

- Vivi in zona climatica F (montagna) con inverni rigidi sotto -5°C costanti
- Hai radiatori vecchi ad alta temperatura e non puoi sostituirli
- Casa scarsamente coibentata senza piano di efficientamento
- Vivi in casa < 50 m² (la dimensione dell'unità esterna pesa sulla facciata)

## La trappola tecnica

Non confondere pompa di calore (per riscaldamento + raffrescamento + acqua sanitaria) con climatizzatore (solo aria-aria). Sono parenti ma diversi. Una vera pompa di calore aria-acqua riscalda anche acqua sanitaria e radiatori, un climatizzatore no.
""",
    },
    {
        "slug": "fotovoltaico-conviene-davvero",
        "title": "Fotovoltaico domestico: conviene davvero nel 2026?",
        "category": "Risparmio Energetico",
        "tags": ["fotovoltaico", "energia", "pannelli solari"],
        "seo_keywords": "fotovoltaico conviene 2026, costo pannelli solari casa, accumulo fotovoltaico",
        "excerpt": "Con i prezzi dei pannelli scesi del 60% in 10 anni e l'energia elettrica alle stelle, il fotovoltaico domestico ha un rientro ridotto a 4-6 anni. Tutti i numeri.",
        "hero_emoji": "☀️",
        "content_md": """## La situazione 2026

Il prezzo dei pannelli solari è sceso del 60% negli ultimi 10 anni. Allo stesso tempo l'energia elettrica costa 0,30-0,40€/kWh in molte fasce orarie. Risultato: il fotovoltaico è economicamente molto più conveniente di 10 anni fa.

## I costi reali chiavi-in-mano

- **Impianto 3 kWp** (per famiglia 2-3 persone): **6.500-8.500€**
- **Impianto 5 kWp** (famiglia 4 persone): **9.500-12.500€**
- **Impianto 6 kWp + accumulo 5 kWh**: **15.000-19.000€**

Con detrazione 50% (bonus ristrutturazioni), il netto è circa la metà.

## La produzione annuale

In Italia:
- Nord (Lombardia, Veneto, Piemonte): 1.100-1.250 kWh/kWp/anno
- Centro: 1.300-1.450 kWh/kWp/anno
- Sud (Sicilia, Calabria, Sardegna): 1.500-1.700 kWh/kWp/anno

Esempio: impianto 5 kWp a Roma produce circa **6.500 kWh/anno**.

## Il rientro economico

Una famiglia 4 persone consuma circa 3.500 kWh/anno. Con un 5 kWp:
- Autoconsumo: 1.800-2.200 kWh/anno (risparmio 700€)
- Surplus venduto (scambio sul posto): 4.500 kWh/anno (introito 250-400€)
- Risparmio totale: **950-1.100€/anno**

Investimento netto 5.500€ / risparmio 1.000€ = **rientro in 5,5 anni**. Poi 20+ anni di energia gratuita.

## L'accumulo: serve davvero?

Una batteria di accumulo (5-10 kWh) costa 4.000-7.000€. Permette di consumare la sera quello che produci di giorno. **Conviene se**:
- Sei spesso a casa di giorno con pochi consumi
- Vivi in zone con interruzioni elettriche frequenti
- Vuoi indipendenza energetica massima

Se passi tutto il giorno fuori (lavoro), l'accumulo si ripaga in 10-12 anni — al limite del senso economico.

## L'aspetto fiscale

- **Detrazione 50%** in 10 anni (bonus ristrutturazioni)
- **Scambio sul posto** (vendi GSE l'energia in surplus)
- **Cessione del credito** disponibile per chi non ha capienza fiscale

## L'errore da evitare

Comprare il fotovoltaico "fai-da-te" senza progetto integrato. Un installatore certificato fa il calcolo dell'orientamento ottimale, della pendenza, dell'inverter giusto. Risparmiare 1.000€ sull'installatore può costarti 200€/anno di produzione persa.
""",
    },
    {
        "slug": "riscaldamento-a-pavimento-pro-contro",
        "title": "Riscaldamento a pavimento: pro, contro e quando vale la pena installarlo",
        "category": "Risparmio Energetico",
        "tags": ["riscaldamento pavimento", "impianti", "comfort"],
        "seo_keywords": "riscaldamento pavimento conviene, riscaldamento radiante costi, riscaldamento a pavimento opinioni",
        "excerpt": "Il riscaldamento a pavimento è il top del comfort termico. Ma costa il doppio dei radiatori e ha vincoli. Vediamo quando conviene davvero.",
        "hero_emoji": "🦶",
        "content_md": """## Perché il pavimento radiante è il top

Il calore irradia dal basso uniformemente. Niente più zone fredde, niente più radiatori che occupano pareti, temperatura più bassa (33-35°C dell'acqua) con stesso comfort di un radiatore a 65°C. Risultato: ambienti più sani (no movimento polvere) e bollette ridotte del 15-25%.

## Quando ha senso installarlo

- **Ristrutturazione totale** con rifacimento pavimenti
- **Casa nuova** già progettata per il radiante
- **Casa ben coibentata** (cappotto, infissi performanti)
- **Pompa di calore** abbinata (sinergia perfetta)
- **Climatizzazione estiva integrata** (alcune varianti raffrescano)

## Quando NON conviene

- Vuoi solo cambiare la caldaia (i radiatori esistenti vanno bene)
- Non puoi alzare il pavimento di 8-12 cm (servono per il massetto)
- Casa con destinazione affitto turistico (regolazione manuale meno reattiva)

## I costi reali

Per una casa di 100 m²:
- **Pannelli isolanti + tubi PEX-A + collettori**: 25-40€/m² = 2.500-4.000€
- **Massetto fluido autolivellante** (5 cm sopra i pannelli): 15-25€/m² = 1.500-2.500€
- **Centralina elettronica + termostati ambiente**: 800-1.500€
- **Sostituzione caldaia con caldaia condensazione o pompa di calore**: 4.000-8.000€
- **Totale chiavi in mano**: **9.000-16.000€**

Con ecobonus 65% nel 2026: netto **3.150-5.600€**.

## I tempi reali del cantiere

- Posa pannelli e tubi: 2-3 giorni
- Massetto: 1 giorno di posa + **20 giorni di stagionatura obbligatori**
- Posa pavimento finale: 3-5 giorni
- Avviamento centralina: 1 giorno

**Totale fermo cantiere**: 25-30 giorni. È il vincolo principale.

## Le 3 cose da pretendere

1. **Test di tenuta** prima di colare il massetto (pressione 6 bar per 24h)
2. **Documento di collaudo** del massetto (CT-C25 minimo per resistenza)
3. **Avviamento progressivo** scalando le temperature (no shock termico al pavimento)

## Il pavimento giusto

- ✅ Gres porcellanato: conducibilità eccellente
- ✅ Pietra naturale: conducibilità ottima
- ⚠️ Parquet prefinito (max 15mm): OK se certificato per radiante
- ❌ Parquet massello spesso: isola troppo, rendimento crollato
- ❌ Moquette spessa: dispersione enorme

Scegli sempre materiali con marchio "compatibile riscaldamento a pavimento" sull'etichetta.
""",
    },

    # ============ DESIGN & IDEE (31-35) ============
    {
        "slug": "stile-japandi-cose-da-sapere",
        "title": "Stile Japandi: cos'è davvero e come applicarlo in casa (con foto e prezzi)",
        "category": "Design",
        "tags": ["japandi", "stile", "design"],
        "seo_keywords": "stile japandi cosa significa, arredamento japandi, casa japandi",
        "excerpt": "Il Japandi unisce minimalismo giapponese e calore scandinavo. È lo stile più cercato del 2026. Vediamo i 5 principi e i materiali chiave.",
        "hero_emoji": "🌸",
        "content_md": """## I 5 principi del Japandi

**1. Less is more (assoluto)**
Niente oggetti superflui. Ogni cosa ha uno scopo. Le superfici libere sono parte della bellezza, non vuoti da riempire.

**2. Palette naturale**
Beige sabbia, bianco caldo, grigio pietra, marrone legno chiaro, tocchi di nero opaco. Mai colori brillanti o saturati.

**3. Materiali onesti**
Legno chiaro non verniciato (rovere, frassino, pino), pietra naturale, lino, cotone grezzo, carta di riso. Mai plastica o materiali sintetici a vista.

**4. Linee pulite, ma con calore**
Mobili dalle forme semplici (squadrate o leggermente curve) ma sempre con dettagli artigianali — incastri a vista, finiture a mano, asimmetrie naturali.

**5. Quiet luxury**
La ricchezza non urla. Pezzi pochi ma di altissima qualità. Una poltrona giapponese di Hans Wegner vale 20 sedie IKEA.

## Cosa serve per una stanza Japandi

- **Pavimento in legno chiaro** o gres effetto rovere sbiancato
- **Pareti bianco caldo** (Benjamin Moore "Simply White" o equivalente)
- **Un mobile lineare basso** in rovere o frassino
- **Una poltrona** dalle linee orientali (Wishbone Chair, Hans Wegner)
- **Tappeto in juta o lana** color sabbia
- **Lampada da terra in legno e carta** (stile Akari di Noguchi)
- **2 piante grandi**: un bonsai o una felce
- **Tessile**: tende in lino crudo, divano in tessuto grezzo

## I costi orientativi

Per una stanza 25 m² in pieno stile Japandi:
- Finiture (pavimento + pareti): **3.500-5.000€**
- Mobili principali (3-4 pezzi): **3.500-7.000€**
- Illuminazione: **600-1.200€**
- Tessili e accessori: **800-1.500€**
- **Totale**: 8.400-14.700€

## Gli errori da evitare

**1. Mescolare con il rustico**: il Japandi è elegante e essenziale, il country è caldo e affollato. Non si mescolano.

**2. Riempire troppo**: il vuoto è parte dello stile. Se ti sembra che manchi qualcosa, è fatto bene.

**3. Mobili dark**: il legno scuro non c'entra. Resta sui chiari.

**4. Acquistare al supermercato**: il Japandi vive di pezzi unici, non di catene mass-market. Vai dall'artigiano locale o nei negozi di design indipendenti.

## La filosofia di fondo

Lo stile Japandi non è solo estetica: è un modo di vivere lo spazio con meno cose, più qualità, e una calma profonda. Pensa al wabi-sabi giapponese (bellezza dell'imperfezione naturale) sposato all'hygge danese (comfort e accoglienza).
""",
    },
    {
        "slug": "illuminazione-casa-come-progettare",
        "title": "Illuminazione casa: come progettarla bene (regole degli interior designer)",
        "category": "Design",
        "tags": ["illuminazione", "luce", "led"],
        "seo_keywords": "illuminazione casa progettazione, luci led casa, illuminazione soggiorno",
        "excerpt": "Una buona illuminazione cambia totalmente la percezione di casa. Le 5 regole base per fare luce bene senza spendere una fortuna.",
        "hero_emoji": "💡",
        "content_md": """## Le 5 regole base

**1. Luce a strati (layered lighting)**
Mai una sola fonte centrale. Combina:
- Luce ambiente (generale, soffitto)
- Luce funzionale (lettura, lavoro, cottura)
- Luce d'atmosfera (mood, decorativa)

Una stanza ha bisogno di **almeno 3 punti luce diversi**.

**2. Temperatura colore corretta per stanza**
- Soggiorno: 2700-3000K (caldo, rilassante)
- Cucina: 3000-4000K (neutro, funzionale)
- Bagno: 3500-4000K (neutro, trucco preciso)
- Studio: 4000-4500K (freddo, concentrazione)
- Camera da letto: 2200-2700K (molto caldo, romantico)

**3. CRI alto (Color Rendering Index)**
Le luci con CRI > 90 mostrano i colori veri (i tessuti, la pelle, i cibi). Le luci CRI 70 di IKEA mostrano colori sbiaditi e poco realistici. Costo extra: 20-30%.

**4. Sempre dimmerabile in soggiorno e camera**
Avere variabilità di intensità è 10 volte più importante che avere tanti punti luce. Investi in dimmer di qualità (LeGrand, Vimar, Lutron).

**5. Niente faretti puntiformi sulle attività**
Evita il faretto unico sopra il tavolo da pranzo: fa ombre sul viso e sui piatti. Sempre lampada a sospensione larga (60-80 cm dal tavolo).

## I costi tipici

**Punto luce a soffitto con plafoniera LED 24W dimmerabile**: 80-200€
**Lampada da terra di design**: 200-1.500€
**Strip LED sotto pensili cucina (3m)**: 100-300€
**Faretto orientabile incasso**: 30-80€ + posa
**Lampadario di design soggiorno**: 400-3.000€

Una casa di 100 m² ben illuminata richiede un budget di **2.500-6.000€** per illuminazione, incluso impianto.

## L'illuminazione naturale

Prima di pensare ad aggiungere luci artificiali, **massimizza la luce naturale**:
- Tende leggere (lino, cotone) invece di pesanti
- Specchi posizionati di fronte alle finestre
- Pareti chiare
- Mobili bassi che non bloccano la diffusione
- Eventuale apertura di lucernari (in casa indipendente)

## L'errore tipico

Mettere tanti faretti uguali a soffitto pensando di "fare luce". Risultato: ambienti stile sala operatoria, freddi e piatti. Mescola SEMPRE faretti + sospensioni + lampade.
""",
    },
    {
        "slug": "camera-da-letto-progettare",
        "title": "Camera da letto: come progettarla per dormire bene e svegliarsi felici",
        "category": "Design",
        "tags": ["camera da letto", "sonno", "progettazione"],
        "seo_keywords": "progettare camera da letto, camera matrimoniale ideale, dormire bene casa",
        "excerpt": "La qualità del sonno dipende dall'ambiente prima che dal materasso. Le regole oggettive per progettare una camera da letto che fa dormire davvero bene.",
        "hero_emoji": "🛏️",
        "content_md": """## I 5 fattori che migliorano il sonno

**1. Posizione del letto**
Mai sotto la finestra (spifferi, rumori, freddo). Mai con i piedi rivolti alla porta (concetto Feng Shui ma anche pratico — vedi chi entra). La testata appoggiata a un muro pieno, idealmente quello in cui non c'è alcun tubo o impianto.

**2. Buio totale**
Tende oscuranti reali (lined blackout) o persiane esterne. Anche piccole luci LED (router, sveglie) vanno coperte o oscurate.

**3. Temperatura 17-19°C**
La temperatura ottimale per dormire è bassa. Cassetto termostato dedicato alla camera, programmato per scendere alle 22.

**4. Silenzio**
Pareti perimetrali ben coibentate. Finestre con doppio vetro acustico (Rw > 35 dB). Pavimento in legno o tappetti per smorzare i suoni.

**5. Aria pulita**
Niente piante che producono CO2 di notte. Aerare bene mattina e sera. Eventualmente un purificatore HEPA se vivi in zona trafficata.

## Le misure ideali

- Camera matrimoniale: **minimo 12 m²** (idealmente 14-16)
- Distanza dal letto a parete: minimo 60 cm per lato + 70 cm ai piedi
- Larghezza letto consigliata: 160-180 cm
- Armadio: minimo 60 cm di profondità, 200 cm in larghezza per due
- Bagno in camera (en suite): bonus prezioso, alza il valore immobiliare del 5-8%

## I materiali ideali

- **Pavimento**: parquet o gres effetto legno (caldo al tatto)
- **Pareti**: tinta calda (beige, tortora, verde salvia) — niente bianchi freddi
- **Tessili**: lino, cotone, lana — niente fibre sintetiche che fanno sudare
- **Materasso**: memory, lattice o molle insacchettate di qualità medio-alta

## L'illuminazione perfetta

- **Lampada centrale**: dimmerabile, 2700K, mai accesa al massimo dopo le 21
- **2 lampade da comodino**: 2200K (super calde), per leggere
- **Strip LED sotto il letto**: per la notte, attivata da sensore — niente più accensione plafoniera
- **NO TV in camera** (ricerche dimostrano peggior qualità del sonno)

## L'errore da evitare

Trattare la camera come "spazio di servizio" buttandoci dentro mobili avanzati e oggetti inutili. La camera dovrebbe essere il santuario del sonno. Pochi mobili, ordine, calma. Tutto il resto (vestiti accumulati, computer, materiale studio) va altrove.
""",
    },
    {
        "slug": "soggiorno-perfetto-regole-progettazione",
        "title": "Soggiorno perfetto: le regole che usano tutti gli architetti famosi",
        "category": "Design",
        "tags": ["soggiorno", "living", "progettazione"],
        "seo_keywords": "soggiorno perfetto come arredare, soggiorno moderno, progettare living",
        "excerpt": "Il soggiorno è il cuore della casa. Le 7 regole che fanno la differenza tra un living \"qualsiasi\" e uno da rivista di architettura.",
        "hero_emoji": "🛋️",
        "content_md": """## Le 7 regole

**1. Definisci un focal point**
Ogni soggiorno deve avere un punto focale che attira l'occhio: un grande quadro, un camino, una libreria piena, una TV grande. Ma UNO solo — più focal points = confusione.

**2. Divano: dimensione e posizione**
Un divano deve essere proporzionato alla stanza, non al budget. Regola: lato del divano = 1/2 della larghezza della parete. Posizione: mai contro tutte le pareti (galleggia un po' nello spazio), idealmente con altre sedute di fronte per creare conversazione.

**3. Tavolino: distanza giusta**
Il tavolino deve essere a 40-50 cm dal divano. Niente più tavolini incollati al divano (sbatti le ginocchia) o troppo lontani (non li raggiungi).

**4. Tappeto: la regola dei 2/3**
Il tappeto deve coprire almeno 2/3 della disposizione delle sedute. Mai un tappetino piccolo "isolotto" sotto al tavolino con divano fuori — sembra accidentale.

**5. Illuminazione a 3 livelli**
- Soffitto (luce ambiente)
- Lampade da terra accanto al divano (luce di lettura)
- Lampade da tavolo su consolle/mobili (luce d'atmosfera)

**6. Massimo 3 materiali principali**
Es: legno chiaro + lino chiaro + ottone. Oppure: pelle marrone + lana grigia + legno scuro. Aggiungere un 4° materiale crea confusione visiva.

**7. Un pezzo "personale"**
Una poltrona vintage, un quadro fatto da te, una collezione di libri di viaggio. Qualcosa che racconti chi sei. Senza questo, il soggiorno sembra una stanza d'hotel.

## I costi di un buon soggiorno

Per 30 m² di soggiorno medio:
- **Divano di qualità** (3 posti + chaise): 1.800-4.500€
- **Tavolino di design**: 400-1.500€
- **Tappeto** (240×340): 600-2.000€
- **Mobile TV/Libreria**: 800-2.500€
- **Lampade** (2-3 pezzi): 600-2.000€
- **Quadri/Decorazioni**: 400-1.500€
- **TOTALE**: 4.600-14.000€

## Gli errori più comuni

**1. TV sopra il camino**: troppo alta, ti fa male al collo guardarla, è anche brutta esteticamente.

**2. Divani in microfibra colorata**: si rovinano in 3-5 anni, datano in stile. Vai sempre su tinte neutre (grigio, beige, blu navy, verde foresta).

**3. Specchi grandi sul muro principale dietro al divano**: riflettono ogni cosa, il salotto sembra il doppio ma anche il doppio confuso. Mai più di un grande specchio per stanza.

**4. Cuscini "in tema"**: 30 cuscini coordinati col divano = stile bed&breakfast anni 2000. Massimo 4 cuscini, di colori e materiali diversi.
""",
    },
    {
        "slug": "studio-in-casa-progettare",
        "title": "Studio in casa: come progettarlo per essere davvero produttivo (e bello)",
        "category": "Design",
        "tags": ["studio", "smart working", "home office"],
        "seo_keywords": "studio in casa progettare, home office come arredare, angolo lavoro casa",
        "excerpt": "Con lo smart working diventato standard, avere uno studio funzionale a casa è un investimento sulla qualità della vita. Le 8 regole del perfetto home office.",
        "hero_emoji": "💻",
        "content_md": """## Le 8 regole per un home office efficace

**1. Stanza separata o angolo dedicato?**
Stanza separata > angolo separato > corner senza separazione. Se hai una stanza extra, dedicala. Se hai solo un angolo, almeno separalo con una libreria, una scrivania a parete a 90°, o pavimento diverso.

**2. Luce naturale: scrivania perpendicolare alla finestra**
Se la finestra è dietro al monitor, hai riflessi. Se è di fronte, sei controluce. Posiziona la scrivania **perpendicolare** alla finestra — luce sul lato.

**3. Illuminazione artificiale: 500-750 lux**
Una lampada da scrivania a braccio articolato (LED, 4000K, dimmerabile) è obbligatoria. Mai lavorare solo con plafoniera centrale: fa ombre sul tuo lavoro.

**4. Sedia ergonomica: investi**
Una sedia di qualità (Herman Miller, Steelcase, IKEA Markus) costa 300-1.500€ ma ti salva la schiena. È l'oggetto a cui dai più ore della tua vita. Non risparmiare.

**5. Scrivania ad altezza giusta (regolabile sit-stand è meglio)**
Altezza standard 73 cm, regolabile elettrica 64-130 cm (lavoro in piedi alternato). Un sit-stand desk costa 400-1.500€ ma trasforma la giornata lavorativa.

**6. Doppio monitor**
Aumenta produttività del 25-30% secondo Microsoft Research. 2 monitor 24" o 1 ultrawide 34". Posizione a 50-70 cm dagli occhi.

**7. Acustica: importante!**
Se fai videocall: tappeto a terra, pannelli fonoassorbenti dietro alle spalle (sembrano quadri ma assorbono). Niente muri vuoti riverberanti.

**8. Sfondo videocall curato**
Studia cosa si vede dietro di te in videocall. Una parete con libreria, una pianta, un quadro — non muro bianco vuoto. Influenza la percezione di chi parla con te.

## I costi di un home office serio

- **Scrivania sit-stand**: 600-1.500€
- **Sedia ergonomica**: 400-1.200€
- **Doppio monitor 24-27"**: 500-1.500€
- **Webcam HD + microfono**: 200-500€
- **Lampada da scrivania**: 100-400€
- **Libreria/Storage**: 400-1.500€
- **Tessili (tappeto, tende)**: 300-800€
- **TOTALE**: 2.500-7.400€

## Gli errori da evitare

**1. Improvvisare**: lavorare sul tavolo della cucina o sul divano. Dopo 1 mese hai mal di schiena cronico e produttività dimezzata.

**2. Scrivere in faccia alla parete bianca**: senza profondità visiva, il cervello si stanca prima.

**3. Senza pause attive**: ogni 50 minuti alzati, cammina, guarda fuori dalla finestra. Lo studio progettato bene invita a muoversi (sedia comoda significa anche poltrona vicino per leggere).

**4. Stanza condivisa coi figli/coniuge**: impossibile concentrarsi. Se non puoi avere stanza dedicata, almeno cuffie anti-rumore (Sony WH-1000XM5 sono il top).

## Bonus: la cabina-studio

Sempre più richieste sono le cabine acustiche da giardino/balcone: 4-6 m² isolate acusticamente che si installano in 1 giorno. Costo 8.000-18.000€. Soluzione perfetta per chi non ha spazio dentro casa.
""",
    },

    # ============ ERRORI E GUIDE (36-40) ============
    {
        "slug": "errori-comuni-ristrutturazione",
        "title": "I 10 errori più comuni in ristrutturazione (e come evitarli)",
        "category": "Errori da evitare",
        "tags": ["errori", "consigli", "guida"],
        "seo_keywords": "errori ristrutturazione casa, cosa non fare ristrutturazione, consigli ristrutturare",
        "excerpt": "L'80% delle ristrutturazioni problematiche soffre degli stessi 10 errori. Conoscerli prima ti risparmia tempo, soldi e nervi.",
        "hero_emoji": "❌",
        "content_md": """## I 10 errori più comuni

**1. Iniziare senza un progetto completo**
"Decidiamo strada facendo" è la frase più costosa in edilizia. Senza progetto definito i tempi raddoppiano e i costi salgono del 30-50%.

**2. Scegliere l'impresa solo sul prezzo**
Il preventivo più basso è quasi sempre il più caro alla fine. O ti aumenta in corso d'opera, o sceglie materiali scadenti, o sparisce a metà cantiere.

**3. Pagare in contanti**
Perdi la detrazione fiscale (50-65%) e non hai tracciabilità. Su 30.000€ di lavori = 15.000€ di "regalo" all'idraulico.

**4. Non controllare i materiali in cantiere**
Pretendi sempre l'ordine al fornitore, conferma la marca/modello del capitolato. Spesso vengono usati materiali equivalenti più economici senza dirlo.

**5. Modificare il progetto in corso d'opera**
Ogni variazione costa 3-5 volte di più di quanto era preventivata inizialmente. Cambia subito o tieni il progetto originale.

**6. Saltare i sopralluoghi**
Vai in cantiere ogni 3-4 giorni. Vedrai dettagli che le foto WhatsApp non mostrano. Errori bloccati in tempo costano 1/10.

**7. Non avere riserva del 10-15%**
Imprevisti capitano sempre: muri portanti dove non te lo aspetti, tubi rotti dietro le piastrelle. Senza riserva, ti bloccchi a metà cantiere.

**8. Acquistare le piastrelle senza vederle in cantiere**
I colori in negozio sono diversi dai colori in casa con la tua luce. Sempre campionatura a casa prima dell'ordine.

**9. Sottovalutare le pratiche edilizie**
CILA, SCIA, permessi — non sono optional. Le sanzioni partono da 1.000€ e arrivano a impedirti la rivendita.

**10. Trascurare l'impianto elettrico**
È invisibile ma fondamentale. Spendere 15-20% in più per impianto a regola d'arte (sezione cavi adeguata, prese sufficienti, predisposizione domotica) è un investimento che ripaga 30 anni.

## Come prevenirli

- Lavora con professionisti certificati (architetto + impresa con SOA)
- Pretendi capitolato dettagliato firmato
- Pagamenti vincolati al SAL (Stato Avanzamento Lavori)
- Foto e documenti di ogni fase
- Usa il nostro sistema di gestione commessa per monitorare tutto

## L'errore numero 1 in assoluto

Iniziare lavori senza aver definito chi è il **Project Manager** del cantiere. Senza una persona di riferimento che coordina, le maestranze si autogestiscono e ognuno fa il proprio comodo. Il PM costa 3-5% del cantiere ma ne salva il 20-30%.
""",
    },
    {
        "slug": "muffa-pareti-cause-soluzioni",
        "title": "Muffa sulle pareti: cause vere e soluzioni definitive (non solo coprire)",
        "category": "Guide pratiche",
        "tags": ["muffa", "umidità", "problemi"],
        "seo_keywords": "muffa pareti rimedi definitivi, come eliminare muffa casa, perché si forma muffa",
        "excerpt": "Coprire la muffa con pittura non funziona: torna in 6 mesi. Vediamo le cause reali (sono 5) e i veri rimedi.",
        "hero_emoji": "🦠",
        "content_md": """## Le 5 cause reali della muffa

**1. Ponti termici**
Punti freddi della parete dove l'umidità condensa. Tipico negli angoli, su pareti che danno su esterno, dietro mobili appoggiati.

**2. Infiltrazioni**
Da tubazioni rotte, da tetti malandati, da grondaie intasate. Macchia che si espande e bagna l'intonaco.

**3. Aerazione insufficiente**
Case troppo isolate (infissi nuovi senza VMC) trattengono umidità interna. L'umidità relativa sale sopra il 65% e attiva le spore.

**4. Risalita capillare**
Tipica nelle case vecchie senza guaina al piede del muro. L'acqua del terreno sale lungo i muri per capillarità. Macchia il primo metro di parete con efflorescenze saline + muffa.

**5. Cattive abitudini domestiche**
Stendere panni in casa, doccia senza ventilazione, cucinare senza cappa, non aprire mai le finestre.

## Le soluzioni DEFINITIVE (non i palliativi)

**Per ponti termici → cappotto interno o esterno**
12-15€/m² interno (lana di roccia + lastra cartongesso). 80-150€/m² esterno (cappotto completo). Risolve definitivamente.

**Per infiltrazioni → riparazione alla fonte**
Geologi, idraulici, impermeabilizzatori. Mai imbiancare prima di aver risolto la fonte d'acqua.

**Per aerazione → VMC (Ventilazione Meccanica Controllata)**
1.500-4.000€ installata. Rinnova l'aria 6-8 volte al giorno. Risolve definitivamente l'umidità interna.

**Per risalita capillare → barriera chimica**
Resine epossidiche iniettate alla base del muro. Costo 100-200€/m lineare. Garanzia 25 anni dai migliori produttori (Mapei, Kerakoll).

**Per abitudini → installare deumidificatore + cappa cucina**
Umidità interna sotto il 60% sempre. Cappa accesa quando cucini.

## Cosa NON fare (i finti rimedi)

❌ **Pittura antimuffa sopra la muffa esistente**: copre 6 mesi, poi torna peggio.
❌ **Candeggina sui muri**: igienizza superficialmente ma non rimuove le spore profonde.
❌ **Vasi di sale assorbente**: aspirano poca umidità, sono cosmetici.
❌ **Anti-muffa spray "miracolosi" da supermercato**: principi attivi efficaci 3-6 mesi.

## Il protocollo professionale

1. **Diagnosi**: termocamera + igrometro per individuare ponti termici e zone umide
2. **Asportazione**: rimozione intonaco ammuffito + brushing antibatterico
3. **Trattamento**: prodotto sporicida professionale (Kerakoll Biocalce, Mapei Antimuffa Pro)
4. **Soluzione causa**: cappotto, VMC, barriera, riparazione
5. **Ricostruzione**: intonaco traspirante calce-canapa + pittura traspirante ai silicati

Costo totale per parete 4×3m completamente trattata: **600-1.200€**. Investimento che dura 20+ anni vs trattamenti palliativi ogni 6 mesi.
""",
    },
    {
        "slug": "valutare-preventivo-ristrutturazione",
        "title": "Come valutare un preventivo di ristrutturazione (le 8 cose da controllare riga per riga)",
        "category": "Guide pratiche",
        "tags": ["preventivo", "valutazione", "guida"],
        "seo_keywords": "come leggere preventivo ristrutturazione, valutare preventivo edile, preventivo confronto",
        "excerpt": "Un preventivo generico di 2 pagine è una trappola. Quello vero ne ha 8-12 di dettaglio voce per voce. Le 8 cose che DEVI controllare prima di firmare.",
        "hero_emoji": "🔍",
        "content_md": """## Le 8 cose da controllare

**1. Computo metrico dettagliato**
Ogni voce con: descrizione, unità di misura (m², m, n°), quantità, prezzo unitario, prezzo totale. Se manca anche solo uno di questi elementi, è un preventivo "a corpo" da rifiutare.

**2. Capitolato tecnico con marche e modelli**
- "Sanitari linea media" ❌
- "WC sospeso Catalano Zero 55, Cassetta Geberit Sigma 12 cm" ✅

Senza marche e modelli, l'impresa metterà ciò che gli costa meno.

**3. Esclusioni dichiarate**
Cosa NON è incluso: arredi, allacci, opere strutturali extra, pratiche edilizie, smaltimenti speciali (amianto), ecc. Le sorprese vengono da qui.

**4. Cronoprogramma**
Date di inizio fase per fase con date di fine. Pretendi anche le **penali per ritardo** (50-100€/giorno) — sono il vero deterrente.

**5. Modalità di pagamento legate al SAL**
- 10% all'ordine
- 20% inizio lavori
- 25% completamento impianti
- 25% completamento pavimenti/rivestimenti
- 15% completamento finiture
- 5% saldo dopo collaudo

Niente saldo prima del collaudo finale!

**6. Garanzie esplicite**
- Garanzia 10 anni strutture (ex art. 1669 c.c.)
- Garanzia 2 anni finiture (ex art. 1495 c.c.)
- Garanzia 5 anni impianti

**7. Subappalti dichiarati**
Quali parti vengono date in subappalto a chi. Dovresti sapere chi farà il tuo impianto elettrico, idraulico, posa piastrelle. Pretendi i nominativi.

**8. Polizza CAR / RCT**
La polizza Construction All Risk + RC Terzi dell'impresa. Senza, in caso di danni sei scoperto totalmente.

## I prezzi sospetti

Se vedi voci come:
- "Demolizione tramezzi: a corpo 500€"  
- "Impianto elettrico: a corpo 5.000€"
- "Posa piastrelle: a corpo 2.000€"

…hai un preventivo da rifiutare. Ogni voce deve avere quantità misurate dal vivo.

## Il prezzo "troppo basso"

Se ricevi 3 preventivi:
- Impresa A: 28.000€
- Impresa B: 31.000€
- Impresa C: 18.000€

Diffida di C. È quasi certamente uno di questi 3 scenari:
1. Manca metà del lavoro (esclusioni nascoste)
2. Userà materiali scadenti non capitolati
3. Aumenterà del 60-80% in corso d'opera

## Come confrontare 3 preventivi

Crea una **tabella di confronto** con tutte le 50-100 voci dei 3 preventivi affiancate. I prezzi unitari devono essere comparabili. Se un'impresa mette "porta interna 250€" e un'altra "porta interna 480€", chiedi che marche e modelli sono. Spesso scopri che 250€ è scadente, 480€ è di marca.

## Il timing giusto

Mai accettare il primo preventivo "appena caldo". Lascia almeno 5-7 giorni di riflessione, confronta, fai mille domande. Le imprese serie apprezzano clienti attenti.
""",
    },
    {
        "slug": "scegliere-impresa-edile-affidabile",
        "title": "Come scegliere un'impresa edile affidabile (le 7 verifiche da fare prima di firmare)",
        "category": "Guide pratiche",
        "tags": ["impresa edile", "affidabilità", "scelta"],
        "seo_keywords": "come scegliere impresa edile, impresa edile affidabile, controlli prima ristrutturazione",
        "excerpt": "Il 30% delle imprese edili italiane non è affidabile. Ecco le 7 verifiche oggettive che separano i professionisti dagli improvvisatori.",
        "hero_emoji": "✅",
        "content_md": """## Le 7 verifiche pre-firma

**1. Visura camerale**
Vai sul sito della Camera di Commercio (registroimprese.it) e cerca la ragione sociale. Verifica:
- Da quanti anni è iscritta (meglio 10+ anni)
- Codice ATECO corretto (43.xx per edilizia)
- Capitale sociale (non società con 1€ di capitale, meglio almeno 10.000€)
- Procedure concorsuali (fallimenti, concordati): se ci sono, evita.

**2. DURC online**
Il Documento Unico di Regolarità Contributiva attesta che l'impresa paga regolarmente INPS e INAIL. Pretendi una copia recente (massimo 3 mesi). Se non te lo dà, è già un segnale di allarme.

**3. SOA (per lavori sopra 150.000€)**
Per cantieri grandi serve l'attestazione SOA. Verifica categoria (OG1 generale, OG2 restauri, OS28 impianti) e classifica adeguate al tuo lavoro.

**4. Referenze e Google Reviews**
Cerca su Google "[nome impresa] + recensioni" + "[nome impresa] + problemi". Le 5 stelle non bastano: leggi le recensioni dettagliate, soprattutto le 1-3 stelle. Se ricorrono ritardi, polvere, scarsa cura, fuggi.

**5. Visita un cantiere in corso**
Pretendi di visitare un loro cantiere attivo. Osserva:
- Pulizia (cantiere ordinato = lavoro ordinato)
- Sicurezza (caschi, ponteggi a norma)
- Atteggiamento operai (rispettosi del cliente?)
- Materiali in cantiere (di marca o scadenti?)

**6. Polizza assicurativa**
Pretendi copia della polizza CAR (Construction All Risk) + RCT (Responsabilità Civile Terzi). Massimali consigliati:
- CAR: 500.000€
- RCT: 2.000.000€

**7. Iscrizione Cassa Edile**
Le imprese serie sono iscritte alla Cassa Edile della loro provincia. Costa, ma assicura i lavoratori e copre indennità di ferie/malattia. Imprese in nero non lo sono.

## Segnali di allarme da NON ignorare

🚩 Vuole pagamento in contanti
🚩 Non rilascia preventivo dettagliato
🚩 Promesse temporali troppo brevi (1 settimana per rifare un bagno = scadente)
🚩 Niente partita IVA o partita IVA recente (< 2 anni)
🚩 Operai cambiano ogni giorno (segno di alta rotazione, qualità scadente)
🚩 Non ha sede fisica (solo un cellulare)
🚩 Vuole iniziare "subito subito" senza progetto

## La domanda risolutiva

Chiedi: "Posso chiamare 3 vostri clienti recenti per chiedere come è andata?". Un'impresa seria ti dà subito i nomi e i numeri. Un'impresa scadente cambia discorso, glissa, o ti dice che "la privacy non lo permette".

## Il prezzo della tranquillità

Lavorare con un'impresa qualificata può costare il 15-20% in più di una "informale". Ma:
- Tempi rispettati
- Materiali di qualità
- Garanzie reali
- Pratiche edilizie a posto
- Detrazioni fiscali rispettate

Significa che alla fine spendi MENO. Le imprese economiche costano caro alla fine, sempre.
""",
    },
    {
        "slug": "checklist-fine-cantiere",
        "title": "Checklist fine cantiere: i 30 controlli da fare prima del saldo",
        "category": "Guide pratiche",
        "tags": ["fine lavori", "controllo", "checklist"],
        "seo_keywords": "checklist fine lavori, controllo fine cantiere, collaudo ristrutturazione",
        "excerpt": "Una volta firmato il saldo non torni indietro. Ecco la checklist completa dei 30 controlli che devi fare prima di consegnare l'assegno finale.",
        "hero_emoji": "📝",
        "content_md": """## La checklist completa

### Impianto elettrico (6 controlli)
1. Tutte le prese funzionano? Provale una per una
2. Tutti gli interruttori comandano la luce giusta?
3. Il quadro elettrico è etichettato (luce cucina, luce bagno, presa frigo, ecc.)?
4. Hai ricevuto la **certificazione di conformità (DM 37/08)**?
5. Salvavita testato (premi il pulsante TEST, deve scattare)?
6. Messa a terra collaudata?

### Impianto idraulico (5 controlli)
7. Pressione acqua corretta a tutti i rubinetti?
8. Acqua calda arriva in tempi normali (< 30 sec ai punti più lontani)?
9. Scarichi non gocciolano (controlla lavandino, doccia, wc, lavatrice)?
10. Nessuna perdita visibile sotto i sifoni dopo 1 ora di flusso?
11. Hai la **dichiarazione di conformità impianto idraulico**?

### Sanitari e rubinetterie (4 controlli)
12. Tutti i sanitari sono fissati saldamente (non oscillano)?
13. Box doccia chiude ermeticamente? Test versando acqua e cercando gocce all'esterno
14. Cassetta wc carica entro 60 secondi e svuota correttamente?
15. Miscelatori girano fluidamente, senza grattare?

### Pavimenti e rivestimenti (5 controlli)
16. Nessuna piastrella suona "a vuoto" quando ci batti sopra (uso una moneta)?
17. Fughe pari e dello stesso colore in tutta la posa?
18. Battiscopa montati e silicone applicato bordi muro?
19. Pavimento livella ovunque (uso una livella di 2m)?
20. Niente piastrelle scheggiate o crepate visibili?

### Pareti e tinteggiatura (4 controlli)
21. Pareti perfettamente lisce, senza grumi o ondulazioni?
22. Colori uniformi sotto luce naturale (controlla in 3 momenti del giorno)?
23. Tutti gli angoli a 90° (non tondeggianti dove non doveva)?
24. Niente macchie o aloni di umidità residua?

### Porte e infissi (4 controlli)
25. Tutte le porte chiudono senza forzare?
26. Maniglie e serrature funzionano fluidamente?
27. Finestre aprono in tutte le posizioni (anta, ribalta, scorrimento)?
28. Cerniere lubrificate, niente cigolii?

### Generali (2 controlli)
29. Pulizia generale (no polvere su mobili, no residui in cantiere, no rifiuti)?
30. Hai ricevuto: planimetria as-built aggiornata, manuali di tutti gli elettrodomestici, certificazioni impianti, fatture, garanzie?

## Cosa fare se trovi problemi

**Difetti minori (estetici)**: lista scritta firmata da entrambi, da risolvere prima del saldo (5-7 giorni).

**Difetti gravi (funzionali)**: trattenere 10-20% del saldo come "ritenuta" fino a risoluzione.

**Vizi occulti**: hai 10 anni di tempo per farli rilevare (1 anno se sono evidenti).

## Il documento di collaudo

Pretendi un **verbale di collaudo firmato** che dica:
- Cantiere completato in data XX/XX/2026
- Difetti rilevati: NESSUNO oppure (elenco)
- Saldo versato: XXX€
- Garanzie attivate e durata
- Documenti consegnati al committente

Questo verbale ti salva la vita in caso di contenzioso futuro.
""",
    },

    # ============ SPECIFICI / VARIE (41-50) ============
    {
        "slug": "smaltimento-macerie-quanto-costa",
        "title": "Smaltimento macerie: quanto costa davvero e come non farsi spennare",
        "category": "Costi e Preventivi",
        "tags": ["smaltimento", "macerie", "ambientale"],
        "seo_keywords": "smaltimento macerie costi, smaltimento calcinacci, prezzo discarica",
        "excerpt": "Lo smaltimento macerie pesa il 5-10% del costo totale di una ristrutturazione. Vediamo come funziona e quando è facile farsi gonfiare il prezzo.",
        "hero_emoji": "🚛",
        "content_md": """## Quanto materiale si genera

Una ristrutturazione completa di 100 m² produce in media:
- **Calcinacci e mattoni**: 3-6 m³
- **Pavimenti e piastrelle**: 1-2 m³
- **Sanitari e ceramica bagno**: 0,5 m³
- **Cartongesso e materiali misti**: 1-2 m³
- **Imballaggi nuovo materiale**: 1-2 m³

**Totale**: 6-12 m³ di rifiuti speciali (peso 8-15 tonnellate).

## I prezzi reali di smaltimento

- **Costo per m³**: 35-60€ alla discarica autorizzata (variabile per regione)
- **Container 4 m³**: 200-350€ noleggio + trasporto + smaltimento
- **Container 7 m³**: 350-550€ tutto incluso
- **Container 10 m³**: 500-750€ tutto incluso

Su una ristrutturazione 100 m²: **1.500-3.500€** di smaltimento.

## Come si calcola sul preventivo

Le imprese serie inseriscono lo smaltimento come voce separata: "Smaltimento rifiuti edili presso discarica autorizzata, codice CER 17.09.04 — €XX/m³ × stima m³".

## Le trappole da evitare

❌ **"Smaltimento incluso a corpo"**: vago. Quanto pagheresti se generi il doppio del previsto?

❌ **Impresa che porta via i materiali con il furgone proprio**: dovrebbe darti il **formulario rifiuti** firmato dalla discarica. Senza, è smaltimento illegale (multe a TE come committente).

❌ **Prezzi sospettosamente bassi (15-20€/m³)**: indica probabilmente discarica illegale. In Italia la legge è chiara: il committente è co-responsabile se l'impresa fa smaltimento illegale.

## I documenti obbligatori da pretendere

Per ogni viaggio in discarica devi ricevere copia del **FIR — Formulario Identificazione Rifiuti**. Contiene:
- Codice CER (Catalogo Europeo Rifiuti, es. 17.09.04 per inerti misti)
- Peso o m³ smaltiti
- Targa automezzo
- Destinazione (nome e indirizzo discarica)
- Firma del gestore discarica

Conserva questi documenti per 5 anni. Sono richiesti in caso di verifiche ARPA o Guardia di Finanza.

## I codici CER più comuni in ristrutturazione

- **17.01.01**: cemento, malta, intonaci
- **17.01.02**: mattoni
- **17.01.03**: tegole, materiali ceramici (piastrelle)
- **17.02.01**: legno (porte, mobili demoliti)
- **17.02.02**: vetro (vetrate vecchie)
- **17.04.05**: ferro e acciaio (vecchie ringhiere, infissi alluminio)
- **17.09.04**: rifiuti misti dell'attività di costruzione e demolizione

## Risparmiare legalmente

- **Separare i materiali**: legno e metalli vanno in container separati a costo zero (in molte regioni sono valorizzabili)
- **Vendere mobili e sanitari usati**: alcuni demolitori specializzati pagano per ritirarli (mercato dell'antiquariato edile)
- **Donare materiali utilizzabili**: parquet, marmi, porte di pregio possono andare a chi fa restauri
""",
    },
    {
        "slug": "domotica-base-quanto-costa",
        "title": "Domotica base: quanto costa rendere smart la casa (senza esagerare)",
        "category": "Tecnologia casa",
        "tags": ["domotica", "smart home", "tecnologia"],
        "seo_keywords": "domotica casa quanto costa, smart home prezzi, predisposizione domotica",
        "excerpt": "La domotica costa 800-2.500€ in più rispetto a un impianto tradizionale. Vediamo i 4 livelli di smart home e dove conviene fermarsi.",
        "hero_emoji": "📱",
        "content_md": """## I 4 livelli di domotica

**Livello 1 — Smart base (800-1.500€)**
- Luci wifi (Philips Hue, Yeelight)
- Termostato smart (Tado, Nest)
- Serratura smart porta d'ingresso
- Telecamera ingresso
- App unica per tutto

**Livello 2 — Smart medio (1.500-3.500€)**
- Tutto del livello 1 +
- Tapparelle elettriche con telecomando/app
- Scene preimpostate (uscita, notte, cena, film)
- Assistente vocale (Alexa, Google Home) integrato
- Allarme antintrusione smart

**Livello 3 — Smart avanzato (3.500-8.000€)**
- Tutto del livello 2 +
- Bus KNX o sistema cablato (Vimar, BTicino Living Now)
- Controllo climatizzazione zona per zona
- Diffusione audio multi-stanza
- Riconoscimento targhe cancello
- Sensori allagamento e fumo collegati a chiusura valvole

**Livello 4 — Domotica integrale (10.000-25.000€)**
- KNX completo
- Touchpanel a parete in ogni stanza
- Tende motorizzate
- Climatizzazione VRV per stanza
- Riconoscimento volti
- Sicurezza perimetrale completa
- Energia ottimizzata (fotovoltaico + accumulo + carica auto)

## Cosa serve davvero

Per una famiglia normale, il **Livello 2** copre il 95% delle utility reali:
- Comodità (luci con voce, accensione da app)
- Risparmio (termostato programma riscalda solo quando serve)
- Sicurezza (telecamere, allarme)

Salire al Livello 3-4 è giustificato solo per case di pregio o per chi ama davvero la tecnologia.

## La regola della "predisposizione"

Anche se non installi domotica subito, in ristrutturazione pretendi sempre **predisposizione cablata**:
- Cavi Cat6 in ogni stanza
- Cavi schermati per allarme e citofonia
- Tubazioni vuote 25mm di scorta
- Quadro elettrico con 30% di spazio libero

Costo predisposizione: **300-800€**. Senza, aggiungere domotica in futuro costa 3-5 volte tanto.

## I rischi della domotica wireless

- **Dipendenza dal Wi-Fi**: se cade la connessione, niente funziona
- **Aggiornamenti firmware** che cambiano funzionalità senza preavviso
- **Obsolescenza rapida**: marchi consumer durano 3-5 anni di supporto
- **Sicurezza**: dispositivi cinesi economici sono spesso vulnerabili

## I sistemi cablati professionali

Per investimenti seri, sceglie sistemi cablati standard:
- **KNX** (standard internazionale, garantito 20+ anni)
- **Vimar View Wireless / View Pro**
- **BTicino Living Now**
- **Schneider Wiser**

Più caro ma duraturo, indipendente da internet, manutenibile in futuro.

## L'errore numero 1

Mescolare 5 ecosistemi diversi (Philips per luci, Bosch per allarme, Tado per termostato, ecc.) crea il caos. Scegli **una piattaforma di integrazione** (HomeKit, Google Home, Home Assistant) e compra solo prodotti compatibili.
""",
    },
    {
        "slug": "ristrutturare-casa-affittare",
        "title": "Ristrutturare casa per affittarla: dove conviene investire e dove tagliare",
        "category": "Investimenti immobiliari",
        "tags": ["investimento", "affitto", "rendita"],
        "seo_keywords": "ristrutturare per affittare conviene, casa investimento affitto, ristrutturazione locazione",
        "excerpt": "Una casa ristrutturata bene rende il 30-50% in più di affitto. Ma non tutti i lavori si ripagano. Vediamo dove conviene investire per massimizzare la rendita.",
        "hero_emoji": "💵",
        "content_md": """## La logica dell'investimento

Quando ristrutturi per affittare (o vendere) devi pensare diversamente da quando ristrutturi per te. Il principio è: **ogni euro speso deve produrre rendita ricorrente o rivalutazione capitale**.

## Dove conviene investire pesantemente

**1. Bagno** — Un bagno bello aumenta il canone del 10-15%
Spesa: 6.000-10.000€ per un bagno gold
Ritorno: 60-100€/mese in più di canone = 720-1.200€/anno = rientro 6-8 anni

**2. Cucina open-space** — Apre lo spazio, modernizza
Spesa: 4.000-8.000€ per buttare giù muro + nuova cucina
Ritorno: 50-100€/mese di canone in più

**3. Pavimenti uniformi** — Stesso gres in tutta la casa
Spesa: 3.000-5.000€ per 80 m²
Ritorno: percezione di casa moderna, riduce sfitto

**4. Infissi efficienti** — Riducono la tua quota di spese
Spesa: 4.000-8.000€
Ritorno: -30% bollette per inquilino = canone più alto + bonus 65%

## Dove NON investire (lavoro a perdere)

❌ **Pavimenti di pregio** (marmo, parquet a doghe larghe) — l'inquilino non li apprezza, anzi li rovina
❌ **Mobili di design** se affitti vuoto — non producono rendita
❌ **Domotica avanzata** — l'inquilino non sa usarla e se si rompe è un problema
❌ **Tinteggiature decorative speciali** — vengono rovinate al cambio inquilino
❌ **Verde curato/giardino raffinato** — manutenzione carico al proprietario

## La strategia "comfort & robust"

Per case in affitto, scegli sempre:
- Pavimenti in gres effetto legno (sembrano parquet, durano per sempre)
- Pareti bianco neutro lavabile
- Sanitari sospesi (più igienici, lasciano vedere pavimento)
- Box doccia in cristallo (no muffa nella tenda)
- Cucina con anta laminato bianco/grigio (resistente)
- Elettrodomestici classe A da incasso

## I numeri della rendita

Casa 80 m² a Milano:
- **Pre-ristrutturazione (anni 80, mai toccata)**: affitto 800-900€/mese
- **Post-ristrutturazione completa SMART (490€/m² = 39.000€)**: affitto 1.200-1.400€/mese

Incremento: 350-500€/mese = 4.200-6.000€/anno

Con bonus 50% sui 39.000€ recuperi 19.500€ in 10 anni.

**Costo netto reale**: 19.500€
**Rientro tramite incremento canone**: 19.500€ / 5.000€ annui = **4 anni**

Dopo 4 anni la ristrutturazione è "gratis" e continui a incassare canone superiore per 30+ anni.

## L'affitto turistico

Per case su Airbnb/Booking, la regola cambia: PUOI permetterti finiture più di pregio perché il guadagno per notte sale molto. Ma considera l'usura altissima e i costi di manutenzione frequenti.

## La regola del 10-15% di rendimento

Una ristrutturazione per affitto deve produrre incremento di canone tale da rendere **almeno il 10-15% annuo** sull'investimento netto (post-bonus). Sotto questa soglia non vale la pena.
""",
    },
    {
        "slug": "monolocale-ristrutturare-30mq",
        "title": "Ristrutturare un monolocale da 30 m²: idee pratiche per moltiplicare lo spazio",
        "category": "Mini appartamenti",
        "tags": ["monolocale", "30mq", "ottimizzazione"],
        "seo_keywords": "ristrutturare monolocale 30 mq, monolocale soluzioni salvaspazio, idee monolocale moderno",
        "excerpt": "30 m² ben progettati possono ospitare zona living + zona notte + bagno + cucinetta in modo confortevole. Le tecniche dei migliori interior designer.",
        "hero_emoji": "🏠",
        "content_md": """## I 4 tipi di monolocali

**1. Quadrato puro 30 m²** (5x6m circa) — il più flessibile
**2. Rettangolo lungo** (4x7,5m) — sfida proporzionali
**3. L-shape** — naturalmente divisibile
**4. Monolocale con piano alto** — può ospitare loft

## Le 5 zone obbligatorie

Anche in 30 m² devi avere:
1. **Ingresso** con armadio scarpe (mini disimpegno)
2. **Cucinetta funzionale** (anche se ridotta)
3. **Zona pranzo/lavoro** (tavolo che cambia funzione)
4. **Zona giorno/notte** (letto + divano in modo intelligente)
5. **Bagno** (compatto ma completo)

## Le tecniche salvaspazio top

**1. Letto a scomparsa orizzontale**
Resoluble da $1.500€ a 5.000€ in versione completa di mobili contenitivi. Recupera 4-6 m² di calpestio durante il giorno.

**2. Letto matrimoniale in alto + divano sotto**
Solo se hai soffitti > 2,90m. Soluzione "loft" con scala (gradini contenitivi). Recupera 5-7 m².

**3. Cucinetta a scomparsa dietro ante**
Ante a tutta altezza che nascondono cucina compatta quando non in uso. Costo 4.000-8.000€.

**4. Tavolo abbattibile a muro o estraibile**
Tipo Mottura, IKEA "Norden". Tavolo pranzo per 4 persone che si chiude a parete.

**5. Pareti contenitive a tutta altezza**
Libreria/armadio dal pavimento al soffitto che fa da divisorio e contenitore.

## Le scelte di colore strategiche

In 30 m² è fondamentale:
- **Tutte le pareti bianco caldo** o tono unico chiaro
- **Pavimento unico** in tutta la casa (anche bagno, se possibile gres effetto legno)
- **Massimo 2 colori** di accento (es. legno chiaro + nero opaco per dettagli)

Niente colori contrastanti che spezzano lo spazio.

## L'illuminazione (cruciale!)

- Una sola plafoniera generale non basta
- **6-8 punti luce a soffitto** (faretti incasso) creano profondità
- Luce dimmerabile assoluta — la stessa stanza è vivibile diversamente in modi diversi
- Strisce LED a soffitto perimetrali = sembra che il soffitto galleggi (effetto open)

## I costi tipici per 30 m²

Ristrutturazione standard:
- Demolizioni totali: 1.500-2.500€
- Impianti nuovi (elet + idro): 3.000-4.500€
- Massetto + pavimento gres: 2.500-3.500€
- Pareti + finiture: 1.500-2.500€
- Bagno completo: 4.500-6.500€
- Cucinetta + arredo: 4.000-7.000€
- Letto a scomparsa: 1.500-3.500€
- Illuminazione: 800-1.500€

**Totale**: 19.300-31.500€

Con bonus 50%: netto **9.600-15.700€**.

## Il valore di rivendita

Un monolocale 30 m² in centro città dopo ristrutturazione mirata aumenta del 30-40% di valore (al m²). In zone come Milano centro, da 4.500€/m² pre a 6.000€/m² post = +45.000€ di valore. Investimento più che ripagato dalla sola rivalutazione, prima ancora di pensare ad affitti o godimento personale.
""",
    },
    {
        "slug": "lavanderia-progettare-casa",
        "title": "Lavanderia in casa: come progettare uno spazio funzionale anche piccolo",
        "category": "Progettazione",
        "tags": ["lavanderia", "ripostiglio", "stenditoio"],
        "seo_keywords": "lavanderia in casa progettazione, ricavare lavanderia, lavanderia piccola",
        "excerpt": "Una lavanderia separata dal bagno trasforma la quotidianità. Servono solo 2-4 m² e una buona progettazione. Vediamo come ricavarla.",
        "hero_emoji": "🧺",
        "content_md": """## Perché conviene una lavanderia separata

- Niente più stendini in mezzo casa
- Bagno sempre pulito (senza polvere di asciugatrice)
- Asciugamani, lenzuola, biancheria sempre in ordine
- Aspirapolvere, scopa, prodotti pulizia in un posto solo
- Maggiore valore immobiliare (+3-5%)

## Le dimensioni minime

**Lavanderia minima funzionale**: 1,5 × 1,8 m = 2,7 m²
Ci stanno: lavatrice + asciugatrice (sovrapposte o affiancate) + 1 mensola sopra + portascopa.

**Lavanderia comoda**: 2 × 2,2 m = 4,4 m²
Aggiungi: piano di lavoro per stirare, lavatoio per lavaggio a mano, armadio chiuso per detersivi.

**Lavanderia top**: 2,5 × 3 m = 7,5 m²
Aggiungi: stenditoio appeso, area cesti biancheria, asse da stiro in piedi pronto all'uso.

## Dove ricavarla

- **Ripostiglio esistente** che si svuota (caso più comune)
- **Veranda chiusa** (con coibentazione adeguata)
- **Sottoscala** (se ha almeno 1,5m di altezza nel punto più basso)
- **Angolo della cucina** con anta a scomparsa
- **Disimpegno o corridoio** ampliato

## Cosa serve impiantisticamente

- **Allaccio acqua fredda e calda** (per lavatoio)
- **Scarico** (sifonato e ispezionabile)
- **Aerazione** (finestra esterna o aspiratore meccanico)
- **3 prese elettriche** (lavatrice, asciugatrice, asse stiro)
- **Pavimento impermeabile** (gres con piletta di raccolta acqua sul pavimento)

## I prodotti chiave

**Mobili lavanderia su misura**: 1.500-4.000€ per 4 metri lineari di mobili dal pavimento al soffitto

**Lavatoio in ceramica con piano**: 250-600€

**Stendibiancheria a soffitto retraibile**: 80-200€

**Asse da stiro estraibile o richiudibile**: 150-400€

**Lavatrice + asciugatrice qualità (Bosch, Siemens, Miele)**: 800-2.500€

## I costi totali

Ricavare una lavanderia funzionale da 2-3 m²:
- **Demolizione muri e nuova distribuzione**: 500-1.500€
- **Impianti idrico + elettrico**: 800-1.500€
- **Pavimento e rivestimento**: 600-1.200€
- **Mobili su misura**: 1.500-3.500€
- **Elettrodomestici**: 800-2.500€
- **Accessori (stenditoi, asse stiro)**: 300-700€

**Totale**: 4.500-10.900€

## L'errore tipico

Mettere la lavatrice in bagno per risparmiare. Risultato: bagno sempre disordinato, asciugamani umidi, biancheria sporca esposta, rumore in mezzo casa quando centrifuga. Vale la pena trovare i 2-3 m² altrove.

## Le accortezze acustiche

Per evitare rumori in tutta casa:
- **Massetto fonoassorbente** sotto la pavimentazione
- **Tappetini antivibrazione** sotto lavatrice e asciugatrice
- **Porta a tenuta acustica** (con guarnizioni in gomma)

Costo extra: 300-600€. Tranquillità: enorme.
""",
    },
    {
        "slug": "balcone-terrazzo-trasformare",
        "title": "Balcone o terrazzo: come trasformarlo in uno spazio vivibile (tutto l'anno)",
        "category": "Esterni",
        "tags": ["balcone", "terrazzo", "outdoor"],
        "seo_keywords": "balcone come arredare, terrazzo trasformare in stanza, veranda balcone",
        "excerpt": "Un balcone abbandonato è spazio sprecato. Con il giusto progetto può diventare stanza in più 8-9 mesi l'anno. Le idee e i costi.",
        "hero_emoji": "🌿",
        "content_md": """## I 4 livelli di trasformazione

**Livello 1 — Salotto outdoor (1.500-3.500€)**
- Pavimento in WPC (legno composito) o gres da esterno
- Mobili da giardino in alluminio o teak
- Vasi grandi con piante mediterranee
- Tenda da sole o ombrellone
- Illuminazione LED esterno

**Livello 2 — Pergolato bioclimatico (5.000-12.000€)**
- Pergola in alluminio con lame orientabili
- Tende laterali avvolgibili
- Riscaldatori a parete
- Ventilatore a soffitto
- Quasi una stanza in più

**Livello 3 — Veranda chiusa con vetrate (8.000-18.000€)**
- Vetrate scorrevoli a tutto vetro
- Pavimento esterno coibentato
- Termoarredo + climatizzatore
- Solitamente serve pratica edilizia (CILA o SCIA)

**Livello 4 — Conversione in stanza interna (15.000-35.000€)**
- Demolizione parapetto vecchio
- Costruzione muri perimetrali coibentati
- Vetrate fisse + serramenti
- Riscaldamento integrato all'impianto casa
- Diventa parte abitabile a tutti gli effetti (richiede PdC)

## Le verifiche da fare prima

**1. Regolamento condominiale**
Vetrate, pergolati, tende devono spesso essere autorizzati dall'assemblea. Verifica prima di spendere.

**2. Vincoli paesaggistici**
Se sei in zona vincolata (centro storico, parco), serve autorizzazione paesaggistica. Tempi: 60-120 giorni.

**3. Strutturale**
Un terrazzo non è progettato per sopportare carichi elevati. Verificare con tecnico la portata prima di mettere vasi grandi, vasche idromassaggio, pavimentazioni pesanti.

**4. Impermeabilizzazione**
Prima di posare pavimento nuovo, verifica la guaina sottostante. Una pavimentazione su guaina vecchia può scoprire infiltrazioni di sotto.

## Il pavimento giusto

- **WPC (legno composito)**: 40-80€/m² posato — il più diffuso, caldo al tatto, durata 15-20 anni
- **Gres porcellanato da esterno**: 50-100€/m² posato — durata illimitata, antiscivolo R11
- **Decking in IPE o Teak**: 120-200€/m² — top di gamma, dura 30+ anni con manutenzione
- **Resina drenante**: 60-100€/m² — moderna, drenante, look unico

Mai più mattonelle vecchie da 30×30 anni 70 con malta in vista.

## I costi dei vari elementi

**Tenda da sole a bracci 4×3m**: 800-2.500€
**Pergolato bioclimatico 4×3m**: 4.000-9.000€
**Vetrate panoramiche 6m lineari**: 5.000-12.000€
**Climatizzatore esterno a parete**: 1.200-2.500€

## L'errore numero 1

Mettere mobili da giardino IKEA su un pavimento vecchio. Risultato: l'occhio si concentra sul brutto. Prima il pavimento, poi i mobili. Sempre.

## Il bonus piante

Un balcone con 5-10 vasi grandi di piante mediterranee (limone, alloro, gelsomino, rosmarino, lavanda, agave) trasforma percezione e profumo. Investimento iniziale 300-600€, manutenzione 10 min/settimana. Effetto wow garantito.
""",
    },
    {
        "slug": "scegliere-piastrelle-formato-colori",
        "title": "Come scegliere le piastrelle: formato, colore, stile (la guida completa)",
        "category": "Materiali",
        "tags": ["piastrelle", "scelta", "gres"],
        "seo_keywords": "come scegliere piastrelle, formato piastrelle pavimento, piastrelle moderne",
        "excerpt": "Le piastrelle determinano l'80% dell'estetica di bagno e cucina. Scegliere bene è un'arte. Vediamo formati, colori e abbinamenti che funzionano.",
        "hero_emoji": "🟨",
        "content_md": """## I formati e il loro effetto visivo

**30×60** — Standard, sempre sicuro, posa rapida, costo basso
**45×90** — Più moderno, sembra una via di mezzo, top per piccole stanze
**60×60** — Quadrato classico, monumentale, ottimo per pavimenti
**60×120** — Effetto "premium", sembra di vivere in un hotel
**80×80 / 90×90** — Grande quadrato, per stanze grandi e moderne
**20×120 / 30×120** — Effetto listoni (parquet)
**120×280** — Grandi lastre, top di gamma, posa specialistica

**Regola d'oro**: più grande è il formato, più la stanza sembra grande (meno fughe = meno "spezzature" visive).

## I colori che funzionano

**Sempre vincenti**:
- Bianco caldo
- Beige sabbia
- Grigio chiaro
- Grigio scuro
- Effetto pietra naturale
- Effetto cemento

**Tendenza 2026**:
- Verde salvia (per pareti)
- Terracotta tenue
- Blu polvere
- Effetto marmo Calacatta
- Antracite metallizzato

**Da evitare**:
- Beige rosato anni 90
- Verde acqua acceso
- Marroni "caffè"
- Decori barocchi

## Pavimento vs Parete: la regola dei contrasti

- **Pavimento scuro + parete chiara** = dinamico, moderno
- **Pavimento chiaro + parete scura** = elegante, sofisticato
- **Tutto stesso tono** = minimal, spazio amplificato
- **Tutto contrasto forte** = caotico, da evitare

## I costi per fascia

**Gres economico (Cina, Spagna)**: 12-25€/m² — qualità media, vita 15 anni
**Gres medio italiano**: 25-50€/m² — top rapport qualità/prezzo
**Gres premium italiano (Florim, Mirage, Cotto d'Este)**: 50-100€/m²
**Gres effetto marmo top**: 80-150€/m²
**Mosaico vetroso**: 40-200€/m² in base alla composizione

## La posa: spesso più cara delle piastrelle

- **Posa classica 30×60**: 20-30€/m²
- **Posa diagonale**: +20% (più sfrido)
- **Grande formato 60×120**: 30-45€/m²
- **Grandi lastre 120×280**: 60-100€/m² (servono attrezzature speciali, 2 posatori)
- **Posa a correre (sfalsata)**: +10%
- **Posa a spina di pesce**: +50%

## Le 5 regole dei pro

**1. Acquista 10% in più per sfridi**
Mai esattamente la quantità: tagli, rotture, future sostituzioni richiedono scorta.

**2. Stesso lotto per stessa stanza**
Lotti diversi possono avere leggere differenze tonali. Verifica all'ordine.

**3. Campionatura a casa**
Mai decidere in negozio. Porta a casa, vedi con la TUA luce, decidi.

**4. Fuga di 2mm minimo**
Più piccole sono spettacolari ma anche più costose (precisione assoluta richiesta).

**5. Posa diagonale per stanze strette**
Una stanza lunga e stretta posata in diagonale sembra più larga.

## L'errore numero 1

Comprare piastrelle in saldo senza un progetto. Se le metti in una stanza con luce e materiali sbagliati, sono sprecate. Prima il progetto, poi l'acquisto.
""",
    },
    {
        "slug": "ristrutturare-cucina-budget-basso",
        "title": "Rinnovare la cucina con budget basso: 8 idee da 200€ a 2.000€",
        "category": "Ristrutturazione low-cost",
        "tags": ["budget", "cucina", "rinnovamento"],
        "seo_keywords": "rinnovare cucina poco budget, cucina low cost, rinnovare cucina senza demolire",
        "excerpt": "Non puoi spendere 15.000€ per rifare cucina? Ecco 8 interventi mirati che fanno sembrare la cucina nuova con budget contenuti.",
        "hero_emoji": "💸",
        "content_md": """## Le 8 idee per budget

**1. Verniciare le ante della cucina (200-500€)**
Smontare ante, levigarle, applicare 2 mani di laccatura sintetica all'acqua. Cambi colore e look. Materiali: 100€. Tempo: 1 weekend. Se affidi a verniciatore professionista: 400-500€.

**2. Cambiare solo le maniglie (50-200€)**
Maniglie nuove di design (lunghe a tubo, integrate, geometriche) trasformano un'estetica anni 90 in moderna in 1 ora. Set 10 maniglie design: 80-150€.

**3. Nuovo top di lavoro (400-1.200€)**
Sostituire solo il piano in laminato vecchio con un quarzo o effetto marmo cambia totalmente l'aspetto. Costo posato: 250-450€/m².

**4. Paraschizzi parete cottura (300-800€)**
Una nuova fascia di piastrelle subway (10×30 bianche, costo 15€/m²), o pannello in vetro retroverniciato, o effetto marmo dietro al piano cottura. Trasforma l'estetica.

**5. Cambio rubinetteria + lavello (200-600€)**
Lavello in acciaio o effetto pietra (150-300€) + miscelatore design con doccia estraibile (100-300€) = sensazione di cucina nuova ogni volta che la usi.

**6. Riverniciare le pareti con colori freschi (200-400€)**
Salviare verde salvia, bianco caldo, grigio perla. Cambio totale di mood in 2 giorni.

**7. Sostituire l'illuminazione (300-1.000€)**
Plafoniera vecchia → strisce LED sotto pensili + lampada a sospensione design sopra l'isola/tavolo. Cucina che sembra di un magazine.

**8. Aggiungere isola/penisola autonoma (1.000-2.500€)**
Senza demolire, aggiungere una penisola con piano in legno o quarzo + sgabelli. Cambia totalmente la fruizione dello spazio.

## La combo vincente

Con **1.500€ ben spesi** puoi:
- Verniciare ante (300€)
- Cambiare maniglie (100€)
- Nuovo top in quarzo (500€)
- Paraschizzi subway (300€)
- Nuova rubinetteria (250€)

Risultato: cucina che sembra di rifatta a 6.000€. Effetto wow garantito.

## Cosa NON conviene fare a budget basso

❌ **Cambiare gli elettrodomestici di pochi anni** — perdi soldi inutili
❌ **Posare nuovo pavimento solo in cucina** — crea attacco visivo brutto col resto casa
❌ **Buttare giù muro per cucina open** — il prezzo del lavoro vero è di 4.000-8.000€, non si fa in modo low cost senza danni

## Quando invece serve una vera ristrutturazione

Se la cucina:
- Ha più di 25 anni con impianti vecchi
- Ha rubinetteria che perde da tempo
- Ha mobili in compensato che si sfaldano
- Non funziona come spazi (es. lavello lontano dalle pentole)

…allora il budget basso non basta. Conviene una vera ristrutturazione 8.000-12.000€ piuttosto che 3 patch successivi.

## Il consiglio finale

Il low cost intelligente funziona se i mobili sono ancora **strutturalmente sani**. Le ante si possono verniciare, il top si cambia, le maniglie si sostituiscono — ma se i cassetti escono dai binari e i pensili stanno per cadere, è il momento di investire in una cucina nuova.
""",
    },
    {
        "slug": "casa-anziani-progettare-accessibile",
        "title": "Casa per anziani: come progettare un ambiente sicuro e accessibile",
        "category": "Accessibilità",
        "tags": ["anziani", "accessibilità", "barriere"],
        "seo_keywords": "casa per anziani sicura, ristrutturazione anziani, barriere architettoniche casa",
        "excerpt": "Una casa pensata per anziani non è una casa triste: è una casa più sicura, comoda e ampia che apprezziamo tutti. Le 10 modifiche fondamentali.",
        "hero_emoji": "👴",
        "content_md": """## Le 10 modifiche fondamentali

**1. Eliminare gradini interni**
Anche dislivelli di 2-3 cm tra ambienti sono cause di cadute. Pavimentazione uniforme in tutta casa, senza soglie tra le stanze.

**2. Doccia walk-in senza piatto**
Niente vasca da scavalcare, niente piatto rialzato. Doccia a filo pavimento, con piletta lineare. Maniglione di sicurezza a parete obbligatorio.

**3. Maniglioni nel bagno**
- Vicino al WC (lato preferito)
- Nella doccia (verticale + orizzontale)
- Vicino al lavabo

Costo: 50-150€ ognuno. Vita: salvata.

**4. Sanitari rialzati**
WC con seduta a 48-50 cm (anziché 40 standard). Maniglione di sostegno. Lavabo con spazio sotto per sedia a rotelle (opzionale).

**5. Maniglie a leva ovunque**
Sostituire pomelli rotondi con maniglie a leva (porte, finestre, rubinetteria). Movimento più facile per articolazioni rigide.

**6. Interruttori grandi e illuminati**
Interruttori "comfort" 4×4 con LED notturno integrato. Vedi subito anche di notte.

**7. Pavimento antiscivolo**
- Gres con coefficiente R10 minimo (R11 in bagno)
- Evitare pavimenti lucidi o marmi levigati
- Test scivolosità con scarpe da casa

**8. Corrimano nei corridoi**
Un corrimano a 90cm di altezza lungo i corridoi e nelle stanze grandi è uno specchio salvavita.

**9. Illuminazione adeguata**
Anziani vedono il 30-40% meno bene di un giovane. Servono:
- 50% più di luce ai pavimenti
- Luci notturne automatiche (sensori movimento) in corridoio e bagno
- No abbaglianti

**10. Domotica essenziale**
- Allarme caduta (wearable o sensore movimento)
- Luce automatica al passaggio
- Termostato programmato (anziani sentono meno la temperatura)
- Telesoccorso o smart device per chiamate aiuto

## I costi delle modifiche

- **Sostituzione vasca con doccia walk-in**: 2.500-4.500€
- **Pacchetto maniglioni bagno completo**: 200-500€
- **WC e lavabo rialzati**: 400-1.000€
- **Pavimento antiscivolo nuovo**: 30-60€/m²
- **Sistema domotica anziani**: 800-3.000€
- **Pacchetto completo casa**: 8.000-20.000€

## Il bonus barriere architettoniche al 75%

Tutti questi interventi sono detraibili al **75% in 5 anni** grazie al bonus barriere. Su 20.000€ di lavori → 15.000€ di sconto fiscale. Costo netto: 5.000€.

**Documenti necessari**:
- Asseverazione di tecnico abilitato che attesti riduzione barriere
- Conformità DM 236/89 e Legge 13/89
- Bonifici parlanti

## L'impatto reale

Una casa modificata bene riduce del 70% le cadute domestiche tra gli over 70. Considerando che ogni caduta con frattura costa al sistema sanitario 8.000-20.000€ e all'individuo mesi di sofferenza, l'investimento è 100 volte ripagato.

## La casa intergenerazionale

Modifiche per anziani migliorano la vita anche a giovani con bambini, mamme in stato interessante, atleti con infortuni temporanei. È **design universale**: bello per tutti, indispensabile per alcuni.
""",
    },
    {
        "slug": "ristrutturazione-condominio-permessi",
        "title": "Ristrutturazione in condominio: i permessi necessari e gli orari da rispettare",
        "category": "Burocrazia",
        "tags": ["condominio", "permessi", "vicini"],
        "seo_keywords": "ristrutturazione condominio orari, permessi condominio lavori, regolamento condominiale",
        "excerpt": "Lavorare in condominio significa rispettare regolamento e vicini. Ecco i 7 punti da chiarire prima di iniziare per non finire in causa.",
        "hero_emoji": "🏢",
        "content_md": """## I 7 punti da chiarire

**1. Regolamento condominiale**
Leggi quello del tuo edificio. Spesso contiene:
- Orari di lavoro consentiti (es. 8-12 e 14-18 nei giorni feriali)
- Divieto sabato pomeriggio e festivi
- Obbligo di pulizia scale ogni sera
- Eventuali periodi vietati (agosto, festività)

**2. Comunicazione preventiva**
Anche se non obbligatoria, **comunicare per iscritto** all'amministratore l'inizio lavori, la durata prevista e l'impresa che opera. Lettera ai vicini diretti = gesto di cortesia che evita tensioni.

**3. Permessi assemblea**
Quando servono:
- Modificare facciata (cappotto esterno, tende sole, condizionatori)
- Modificare cancelli, balconi, vetrate
- Spostare antenne TV, parabole
- Cambiare colore esterno persiane

Non serve assemblea per modifiche interne (CILA in Comune basta).

**4. Uso dell'ascensore**
Verifica il regolamento sull'uso ascensore per portare materiali. Spesso:
- Coprire pavimento con cartone obbligatorio
- Solo carichi sotto 200 kg
- Solo orari concordati

**5. Smaltimento macerie**
Le macerie NON vanno nei cassonetti condominiali. Servono container privati su strada (con autorizzazione comunale per occupazione suolo pubblico) o ritiro diretto da camion al cantiere.

**6. Polvere e vibrazioni**
- Sigillare bene la porta d'ingresso del proprio appartamento (polvere non in tromba scale)
- Demolizioni pesanti solo orari 9-12 (per minimizzare disturbo)
- Vibrazioni intense (martello demolitore) NON in pranzo/cena

**7. Assicurazione danni**
Pretendi che l'impresa abbia polizza RCT con copertura danni a parti comuni e ad appartamenti vicini. Massimale minimo 2 milioni di euro.

## Gli orari standard (Codice Civile + giurisprudenza)

In assenza di regolamento condominiale specifico:
- **Feriali (lun-ven)**: 8:00-13:00 e 15:00-19:00
- **Sabato**: 8:00-13:00 (alcuni regolamenti vietano del tutto)
- **Domenica e festivi**: vietato lavorare

Multe per disturbo della quiete pubblica: 100-500€ a episodio.

## La gestione dei conflitti

**1. Vicino che protesta**
Comunica subito le date di inizio/fine. Offri info dettagliate. Spesso basta la cortesia. Se persiste, sentenze recenti danno ragione al ristrutturante se rispetta orari e regolamento.

**2. Amministratore che blocca lavori**
Solo l'assemblea può bloccare lavori interni regolari. L'amministratore può chiedere documenti ma non vietare.

**3. Condomino che chiede risarcimento polvere**
Documenta con foto la pulizia quotidiana. La polvere è naturale, non un danno. Solo se polvere entra nel suo appartamento per negligenza ha base di causa.

## Le buone pratiche che evitano problemi

✅ Lettera nei portoni di tutti i piani 1 settimana prima
✅ Pulizia scale ogni sera fatta dall'impresa
✅ Materiali coperti con teli protettivi nei pianerottoli
✅ Rispetto rigoroso orari
✅ Disponibilità a parlare se qualcuno ha richieste
✅ Cantiere chiuso entro 30 giorni dalla data dichiarata

Una ristrutturazione "ben gestita" è la chiave per non rovinare i rapporti con i vicini.
""",
    },
]


# Helper: generates posts ready for DB insertion
def get_seed_posts():
    """Ritorna i post pronti per essere inseriti nella collection blog_posts."""
    posts = []
    for i, p in enumerate(BLOG_POSTS):
        days_ago = i * 2 + 3  # 3, 5, 7, 9... giorni fa per spread temporale
        post = {
            **p,
            "id": f"blog-{p['slug']}",
            "published": True,
            "published_at": _d(days_ago),
            "created_at": _d(days_ago),
            "updated_at": _d(days_ago),
            "views": 0,
            "author": "Redazione SadiCasa",
        }
        # Meta description: usa excerpt se non specificato (max 160 char)
        post.setdefault("meta_description", p["excerpt"][:160])
        posts.append(post)
    return posts
