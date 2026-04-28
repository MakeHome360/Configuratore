// Geometry + cost helpers (units: cm in DB, pixels via scale)

export const PX_PER_CM = 2;
export const snap = (v, step = 10) => Math.round(v / step) * step;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const cmToM = (v) => v / 100;

export function polygonArea(points) {
  if (!points || points.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    a += points[i].x * points[j].y;
    a -= points[j].x * points[i].y;
  }
  return Math.abs(a) / 2;
}

export function polygonPerimeter(points) {
  if (!points || points.length < 2) return 0;
  let p = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    p += dist(points[i], points[j]);
  }
  return p;
}

export function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Legacy estimator (catalog-based, kept for backward compat with material catalog)
export function estimateProject(project, catalog) {
  const byId = Object.fromEntries((catalog || []).map((m) => [m.id, m]));
  const out = { total: 0, rooms: [], items: [], systems: 0 };

  const rooms = project.rooms || [];
  const height = project.roomHeight || 270;

  rooms.forEach((r) => {
    const areaCm2 = polygonArea(r.points);
    const perimeterCm = polygonPerimeter(r.points);
    const areaM2 = areaCm2 / 10000;
    const wallAreaM2 = (perimeterCm / 100) * (height / 100);
    const ceilingM2 = areaM2;
    const floorMat = byId[r.floorMaterial];
    const wallMat = byId[r.wallMaterial];
    const ceilMat = byId[r.ceilingMaterial];
    const floorCost = floorMat ? areaM2 * floorMat.price : 0;
    const wallCost = wallMat ? wallAreaM2 * wallMat.price : 0;
    const ceilCost = ceilMat ? ceilingM2 * ceilMat.price : 0;
    const elec = r.electrical && byId["sys-electrical"] ? areaM2 * byId["sys-electrical"].price : 0;
    const plumb = r.plumbing && byId["sys-plumbing"] ? areaM2 * byId["sys-plumbing"].price : 0;
    const total = floorCost + wallCost + ceilCost + elec + plumb;
    out.total += total;
    out.rooms.push({
      id: r.id, name: r.name, areaM2, wallAreaM2,
      floorCost, wallCost, ceilCost, elec, plumb, total,
      floorName: floorMat?.name, wallName: wallMat?.name, ceilName: ceilMat?.name,
    });
  });

  (project.items || []).forEach((it) => {
    const m = byId[it.materialId];
    if (!m) return;
    const qty = it.qty || 1;
    const cost = m.price * qty;
    out.total += cost;
    out.items.push({ id: it.id, name: m.name, category: m.category, qty, unit: m.unit, unitPrice: m.price, total: cost });
  });

  return out;
}

// Map of CAD action key → matching voce_backoffice name (substring match)
// This is the SOURCE OF TRUTH that links CAD geometry to live quote.
export const VOCE_MAP = {
  demolizione_smaltimento: "Demolizione e smaltimento",
  demolizione_muro: "Demolizione muri (specifica)",
  demolizione_pavimento: "Demolizione pavimento (specifica)",
  demolizione_rivestimento: "Demolizione rivestimento pareti (specifica)",
  demolizione_controsoffitto: "Demolizione controsoffitto (specifica)",
  costruzione_muro_mattone: "Muro mattone",
  costruzione_muro_cartongesso: "Muro cartongesso",
  controsoffitto: "Controparete / controsoffitto",
  pavimento_piastrelle: "Piastrelle pavimento",
  posa_pavimento_piastrelle: "Posa piastrelle pavimento",
  massetto: "Massetto cementizio",
  pavimento_parquet: "Parquet",
  posa_pavimento_parquet: "Posa parquet",
  pavimento_pvc: "Pavimento PVC/laminato",
  posa_pavimento_pvc: "Posa pavimento PVC/laminato",
  rivestimento_piastrelle: "Piastrelle rivestimento",
  posa_rivestimento_piastrelle: "Posa piastrelle rivestimento",
  pittura_pareti: "Pittura prima mano",
  battiscopa: "Posa Battiscopa",
  impianto_elettrico_mq: "Impianto elettrico completo",
  punto_luce: "Punto luce LED",
  punto_presa: "Punto presa",
  punto_interruttore: "Punto interruttore",
  quadro_elettrico: "Quadro elettrico",
  impianto_idraulico_mq: "Impianto idraulico completo",
  punto_acqua: "Punto acqua",
  punto_acqua_completo: "Punto acqua completo (F+C+S)",
  punto_scarico: "Punto scarico",
  punto_gas: "Punto gas",
  riscaldamento_radiatori: "Impianto riscaldamento radiatori",
  riscaldamento_pavimento: "Impianto riscaldamento a pavimento",
  predisposizione_clima: "Predisposizione climatizzatore",
  climatizzatore_mono: "Climatizzatore mono split",
  climatizzatore_dual: "Climatizzatore dual split",
  climatizzatore_trial: "Climatizzatore trial split",
  climatizzatore_quadri: "Climatizzatore quadri-split (4 split + 1 UE)",
  climatizzatore_canalizzato: "Climatizzatore canalizzato (controsoffitto)",
  caldaia_condensazione: "Caldaia a condensazione",
  caldaia_ibrida: "Caldaia ibrida (pompa di calore)",
  pompa_calore: "Pompa di calore aria/acqua",
  scaldabagno: "Scaldabagno (boiler elettrico)",
  termoarredo: "Termoarredo bagno",
  termosifone: "Termosifone alluminio (5 elementi)",
  fotovoltaico: "Pannello fotovoltaico (modulo)",
  unita_esterna: "Unità esterna climatizzatore (UE)",
  canalizzato_unita_interna: "Canalizzato · Unità interna",
  canalizzato_canale_ml: "Canalizzato · Canale aria con plenum",
  vmc: "Ventilazione meccanica controllata (VMC)",
  pavimento_radiante: "Impianto riscaldamento a pavimento",
  soffitto_radiante: "Impianto riscaldamento a soffitto",
  porta_interna: "Porte interne serie standard",
  porta_blindata_cl3: "Porta blindata Classe 3",
  porta_blindata_cl4: "Porta blindata Classe 4",
  porta_blindata: "Pannello porta blindata",
  posa_porta_blindata: "Posa porta blindata",
  finestre_pvc: "Infissi PVC bianchi (esterni)",
  finestre_alluminio: "Infissi alluminio taglio termico (esterni)",
  finestre_legno: "Infissi legno/alluminio (esterni)",
  sanitari_bagno: "Sanitari bagno (WC+bidet+lavabo)",
  box_doccia: "Box doccia",
  mobile_bagno: "Mobile bagno",
  scala_chiocciola: "Scala a chiocciola",
  scala_muratura: "Scala in muratura",
  scala_legno: "Scala in legno",
};

// Inverse map: nome voce backoffice (lowercase) → CAD key
export const NAME_TO_CAD_KEY = Object.fromEntries(
  Object.entries(VOCE_MAP).map(([k, v]) => [(v || "").trim().toLowerCase(), k])
);

// Voci PACCHETTO che coprono MULTIPLE CAD keys (con budget condiviso) o aliases.
// shared=true significa che la qty_inclusa è un budget condiviso tra le keys (es. "Demolizione e smaltimento" copre muri+pavimento+riv. cumulati).
// shared=false significa che la qty_inclusa va applicata a OGNI key separatamente (alias).
// fullCoverage=true significa che la voce inclusa nel pacchetto COPRE INTERAMENTE la qty CAD effettiva
// (per voci forfait pacchetto come "Decorazione" — è inclusa per tutta la casa, NON limitata da ratio×mq).
export const PACKAGE_VOCE_GROUPS = {
  "demolizione e smaltimento": { keys: ["demolizione_smaltimento", "demolizione_pavimento", "demolizione_muro", "demolizione_rivestimento", "demolizione_controsoffitto"], shared: true, fullCoverage: true },
  "decorazione": { keys: ["pittura_pareti"], shared: false, fullCoverage: true },
  "pittura prima mano": { keys: ["pittura_pareti"], shared: false, fullCoverage: true },
  "rasatura pareti": { keys: ["pittura_pareti"], shared: false, fullCoverage: true },
  "posa massetto": { keys: ["massetto"], shared: false, fullCoverage: true },
  "massetto cementizio": { keys: ["massetto"], shared: false, fullCoverage: true },
  "massetto autolivellante": { keys: ["massetto"], shared: false, fullCoverage: true },
  "posa pavimento ceramica": { keys: ["posa_pavimento_piastrelle"], shared: false, fullCoverage: true },
  "posa piastrelle pavimento": { keys: ["posa_pavimento_piastrelle"], shared: false, fullCoverage: true },
  "posa rivestimento ceramica": { keys: ["posa_rivestimento_piastrelle"], shared: false, fullCoverage: true },
  "posa piastrelle rivestimento": { keys: ["posa_rivestimento_piastrelle"], shared: false, fullCoverage: true },
  "posa parquet": { keys: ["posa_pavimento_parquet"], shared: false, fullCoverage: true },
  "posa battiscopa": { keys: ["battiscopa"], shared: false, fullCoverage: true },
};

/**
 * Builds a packageRef for estimateProjectV2 from a backend package and a project.
 * mq_progetto = somma stanze STATO DI PROGETTO (e quelle di fatto con override progetto)
 * Se project.data.packageArea è settato (poligono), mq_progetto = area del poligono.
 * voci_incluse: per ogni package.items[] calcola qty_inclusa in base a qty_mode,
 * espandendo nomi generici (es. "Demolizione e smaltimento") in più CAD keys.
 */
export function buildPackageRef(pkg, projectData) {
  if (!pkg || !projectData) return null;
  let mq = 0;
  const pa = projectData.packageArea;
  if (pa && Array.isArray(pa.polygon) && pa.polygon.length >= 3) {
    mq = polygonArea(pa.polygon) / 10000;
  } else {
    (projectData.rooms || []).forEach((r) => {
      const isFatto = (r.phase || "fatto") === "fatto";
      if (!isFatto || (r.progetto && (r.progetto.floorMaterial || r.progetto.wallMaterial || r.progetto.controsoffitto || r.progetto.electrical || r.progetto.plumbing))) {
        mq += polygonArea(r.points) / 10000;
      }
    });
  }
  mq = round2(mq);
  const price = pkg.price_per_m2 || 0;
  const package_base_total = round2(price * mq);
  const voci_incluse = [];
  (pkg.items || []).forEach((it) => {
    const nameLow = (it.name || "").trim().toLowerCase();
    let qty_inclusa = 0;
    if (it.qty_mode === "fissa" || it.qty_mode === "fixed" || it.qty_mode === "pz") {
      qty_inclusa = it.qty_value || it.qty_ratio || 0;
    } else {
      qty_inclusa = (it.qty_ratio || 0) * mq;
    }
    qty_inclusa = round2(qty_inclusa);
    if (qty_inclusa <= 0) return;
    // 1. Esatto match VOCE_MAP
    const exactKey = NAME_TO_CAD_KEY[nameLow];
    if (exactKey) {
      // Anche le voci esatte come "Decorazione" / "Pittura prima mano" / "Massetto" devono essere fullCoverage
      // se appaiono ANCHE nei PACKAGE_VOCE_GROUPS con quella flag.
      const grpExact = PACKAGE_VOCE_GROUPS[nameLow];
      const fc = grpExact?.fullCoverage === true;
      voci_incluse.push({ keys: [exactKey], qty_inclusa, shared: false, fullCoverage: fc, name: it.name, voce_id: it.voce_id, ref_unit_price: it.unit_price_pkg || it.prezzo_rivendita || 0 });
      return;
    }
    // 2. Group/alias generico
    const grp = PACKAGE_VOCE_GROUPS[nameLow];
    if (grp) {
      voci_incluse.push({ keys: grp.keys, qty_inclusa, shared: grp.shared, fullCoverage: grp.fullCoverage === true, name: it.name, voce_id: it.voce_id, ref_unit_price: it.unit_price_pkg || it.prezzo_rivendita || 0 });
    }
    // Sennò la voce è administrativa (CILA, APE, Direzione lavori) → ignorata sul CAD ma il forfait la copre.
  });
  return {
    package_id: pkg.id,
    name: pkg.name,
    price_per_m2: price,
    mq_inclusi: mq,
    package_base_total,
    voci_incluse,
    package_area_polygon: pa?.polygon || null,
  };
}

// Ordine lavorazioni basato su listinoMh.pdf:
// 1. Modulistica/Cantiere → 2. Demolizioni/Muratura → 3-4. Impianti idraulici/elettrici
// → 5. Intonaci/rasatura/decorazioni → 6. Serramenti → 7. Collaudo/Pulizia
export const ORDINE_LAVORAZIONI = {
  // 1. Modulistica/Sicurezza cantiere
  "Sicurezza cantiere": 10,
  "Pratiche edilizie": 11,
  "Allestimento cantiere": 12,
  // 2. Demolizioni
  "Demolizione e smaltimento": 20,
  "Autolivellante": 21,
  // 3. Muratura/costruzioni
  "Muro mattone": 30,
  "Muro cartongesso": 31,
  "Controparete / controsoffitto": 32,
  // 4. Impianti
  "Impianto idraulico completo": 40,
  "Punto acqua": 41,
  "Impianto riscaldamento radiatori": 42,
  "Impianto riscaldamento a pavimento": 43,
  "Caldaia a condensazione": 44,
  "Predisposizione climatizzatore": 45,
  "Climatizzatore dual split": 46,
  "Climatizzatore trial split": 47,
  "Impianto elettrico completo": 50,
  "Punto luce LED": 51,
  // 5. Intonaci/rivestimenti/pittura
  "Intonaco": 60,
  "Rasatura": 61,
  "Piastrelle rivestimento": 62,
  "Piastrelle pavimento": 63,
  "Parquet": 64,
  "Pavimento PVC/laminato": 65,
  "Pittura prima mano": 70,
  "Posa Battiscopa": 71,
  // 6. Serramenti / Infissi
  "Infissi PVC bianchi": 80,
  "Infissi alluminio taglio termico": 81,
  "Infissi legno/alluminio": 82,
  "Porte interne serie standard": 83,
  "Pannello porta blindata": 84,
  // 7. Sanitari & arredo
  "Sanitari bagno (WC+bidet+lavabo)": 90,
  "Box doccia": 91,
  "Mobile bagno": 92,
  // 8. Collaudo e pulizia finale
  "Collaudo": 99,
  "Pulizia finale": 100,
};

export function ordineFor(voceName) {
  if (!voceName) return 999;
  if (ORDINE_LAVORAZIONI[voceName] !== undefined) return ORDINE_LAVORAZIONI[voceName];
  // fallback by category keyword
  const n = voceName.toLowerCase();
  if (n.includes("demoliz")) return 20;
  if (n.includes("muro")) return 30;
  if (n.includes("idraul") || n.includes("acqua") || n.includes("scarico")) return 40;
  if (n.includes("riscald") || n.includes("caldaia") || n.includes("clima")) return 45;
  if (n.includes("elettric") || n.includes("luce") || n.includes("presa")) return 50;
  if (n.includes("intonac") || n.includes("rasatur") || n.includes("pittur")) return 65;
  if (n.includes("piastrell") || n.includes("parquet") || n.includes("pavim")) return 63;
  if (n.includes("battiscop")) return 71;
  if (n.includes("infiss") || n.includes("finestr") || n.includes("porta")) return 80;
  if (n.includes("sanitar") || n.includes("doccia") || n.includes("bagno")) return 90;
  return 500;
}

function findVoce(voci, name) {
  if (!voci) return null;
  return voci.find((v) => (v.name || "").trim().toLowerCase() === (name || "").trim().toLowerCase()) || null;
}

function priceOf(voce) {
  if (!voce) return 0;
  const ric = voce.ricarico ?? 1.8;
  return (voce.prezzo_acquisto || 0) * ric;
}

/**
 * estimateProjectV2: derives quantities from CAD geometry & maps them to voci_backoffice.
 * If packageRef is set with included quantities, only the EXTRA is charged.
 *
 * @returns { items: [{key,name,unit,qty,qty_inclusa,qty_extra,unit_price,total,voce_id}], total, included_total, extra_total, byCategory }
 */
export function estimateProjectV2(project, voci, packageRef) {
  const data = project || {};
  const height = data.roomHeight || 270;
  // Aggregate quantities
  const qtyByKey = {};
  const add = (k, n) => { qtyByKey[k] = (qtyByKey[k] || 0) + n; };

  // Floors / Ceilings / Walls (by room): considera STANZE PROGETTO + STANZE FATTO con override progetto
  const allRoomsForBilling = [];
  (data.rooms || []).forEach((r) => {
    const isFatto = (r.phase || "fatto") === "fatto";
    if (!isFatto) {
      // Stanza nuova di progetto: usa direttamente le sue proprietà
      allRoomsForBilling.push({ room: r, fm: r.floorMaterial, wm: r.wallMaterial, ctr: r.controsoffitto, elec: r.electrical, plumb: r.plumbing, pittura: true });
    } else if (r.progetto) {
      // Stanza esistente con modifiche di progetto: usa SOLO gli override
      const p = r.progetto;
      allRoomsForBilling.push({
        room: r,
        fm: p.floorMaterial || null,
        wm: p.wallMaterial || null,
        ctr: !!p.controsoffitto,
        elec: !!p.electrical,
        plumb: !!p.plumbing,
        pittura: p.pittura !== false && (!!p.wallMaterial || !!p.floorMaterial || !!p.controsoffitto || !!p.electrical || !!p.plumbing),
      });
    }
  });

  // Tiling rooms: anche stanze "fatto" senza progetto overrides ma con un tiling specifico
  // devono entrare nel computo (l'utente ha applicato piastrelle a TUTTE le stanze).
  const tilingRoomIds = new Set((data.tiling || []).filter((t) => t.voceId).map((t) => t.roomId));
  const billedRoomIds = new Set(allRoomsForBilling.map((b) => b.room.id));
  (data.rooms || []).forEach((r) => {
    if (billedRoomIds.has(r.id)) return;
    if (tilingRoomIds.has(r.id)) {
      // Aggiungi billing minimo per pavimento (piastrelle) anche su stanza "fatto" senza progetto
      allRoomsForBilling.push({ room: r, fm: "floor-ceramic", wm: null, ctr: false, elec: false, plumb: false, pittura: false });
    }
  });

  allRoomsForBilling.forEach(({ room: r, fm, wm, ctr, elec, plumb, pittura }) => {
    const areaM2 = polygonArea(r.points) / 10000;
    const perimM = polygonPerimeter(r.points) / 100;
    const wallAreaM2 = perimM * (height / 100);
    // Force floor materiale a "piastrelle" se nella stanza è stato applicato un tiling specifico
    const hasTilingHere = tilingRoomIds.has(r.id);
    if (fm || hasTilingHere) {
      const f = (fm || "").toLowerCase();
      if (!hasTilingHere && f.includes("parquet")) add("pavimento_parquet", areaM2);
      else if (!hasTilingHere && (f.includes("pvc") || f.includes("laminat"))) add("pavimento_pvc", areaM2);
      else add("pavimento_piastrelle", areaM2);
      add("battiscopa", perimM);
    }
    if (wm) {
      const w = (wm || "").toLowerCase();
      if (w.includes("piastrell") || w.includes("tile") || w.includes("ceramic")) add("rivestimento_piastrelle", wallAreaM2 * 0.5);
    }
    if (pittura) add("pittura_pareti", wallAreaM2);
    if (elec) add("impianto_elettrico_mq", areaM2);
    if (plumb) {
      add("impianto_idraulico_mq", areaM2);
      if (!wm) add("rivestimento_piastrelle", wallAreaM2 * 0.5);
    }
    if (ctr) add("controsoffitto", areaM2);
  });

  // helper isProgetto per gli ELEMENTI (porte, finestre, items, impianti, scale)
  const isProgetto = (el) => el?.phase === "progetto";

  // DECORAZIONE/VOCE PARETE: voce_id specifica scelta dal venditore per una parete (override prezzo).
  // wallDecorOverridesByVoce: per ogni voce_id usata su qualche parete, accumula area mq totale.
  const wallDecorAreaByVoceId = {}; // { voceId: { area, name, price } }
  (data.walls || []).forEach((w) => {
    if (w.demolito) return;
    const lenM = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) / 100;
    const aM2 = lenM * (height / 100);
    if (w.decorVoceId && w.decorVocePrice) {
      const cur = wallDecorAreaByVoceId[w.decorVoceId] || { area: 0, name: w.decorVoceName || "Decorazione", price: w.decorVocePrice };
      cur.area += aM2;
      wallDecorAreaByVoceId[w.decorVoceId] = cur;
    }
  });

  // Walls: fatturare SOLO se phase==="progetto". (cartongesso o kind="nuovo" senza phase = legacy → trattati come progetto)
  (data.walls || []).forEach((w) => {
    const lenM = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) / 100;
    const aM2 = lenM * (height / 100);
    if (w.demolito) {
      // VOCE UNIFICATA "Demolizione e smaltimento" (mq) + voce specifica per dettaglio
      add("demolizione_smaltimento", aM2);
      return;
    }
    if (w.demolito_partial && w.demolito_partial.to > w.demolito_partial.from) {
      const portionM = lenM * (w.demolito_partial.to - w.demolito_partial.from);
      const hM = (w.demolito_partial.height || height) / 100;
      add("demolizione_smaltimento", portionM * hM);
    }
    // Se phase è settata e !== "progetto" → SKIP (è stato di fatto, non si fattura)
    if (w.phase && w.phase !== "progetto") return;
    // Se non ha phase, considera phase implicita basata su kind
    const isProgWall = w.kind === "cartongesso" || w.kind === "nuovo";
    if (isProgWall) {
      if (w.kind === "cartongesso") add("costruzione_muro_cartongesso", aM2);
      else add("costruzione_muro_mattone", aM2);
    }
  });

  // Demolizioni esplicite (sempre progetto) — VOCE UNIFICATA "Demolizione e smaltimento"
  (data.demolitions || []).forEach((d) => {
    let area = d.areaM2 || 0;
    // Se è poligono area free-form, ricalcola area dal polygon
    if (d.polygon && d.polygon.length >= 3) {
      area = polygonArea(d.polygon) / 10000;
    }
    // Pavimento: opzione "solo pavimento" (1× area) vs "pavimento + massetto" (2× area, perché è doppio lavoro)
    if (d.kind === "pavimento") {
      const mult = d.with_massetto ? 2 : 1;
      add("demolizione_smaltimento", area * mult);
    } else if (d.kind === "rivestimento" || d.kind === "cartongesso" || d.kind === "controsoffitto") {
      add("demolizione_smaltimento", area);
    } else {
      add("demolizione_smaltimento", area);
    }
  });

  // Doors / Windows — solo nuovi (phase==="progetto")
  (data.doors || []).filter(isProgetto).forEach((d) => {
    if (d.type === "blindata-cl4") {
      add("porta_blindata_cl4", 1);
      // POSA blindata aggiunta DI DEFAULT (a meno che il pacchetto la includa)
      if (!packageRef) add("posa_porta_blindata", 1);
    } else if (d.type === "blindata-cl3" || d.type === "blindata") {
      add("porta_blindata_cl3", 1);
      if (!packageRef) add("posa_porta_blindata", 1);
    } else {
      add("porta_interna", 1);
    }
  });
  (data.windows || []).filter(isProgetto).forEach((w) => {
    const mat = w.material || "pvc";
    if (mat === "alluminio") add("finestre_alluminio", 1);
    else if (mat === "legno") add("finestre_legno", 1);
    else {
      add("finestre_pvc", 1);
      // PVC pellicolato: maggiorazione % se richiesta dall'utente
      if (w.pellicolato) {
        // La maggiorazione è una % del prezzo dell'infisso pvc → la mostriamo come riga separata
        // Verrà calcolata in lump items dopo
      }
    }
  });

  // Impianti dettagliati — tutti contati per billing (anche se phase=fatto: l'impianto è sempre nuova fornitura)
  (data.electrical || []).forEach((e) => {
    if (e.type === "presa") add("punto_presa", 1);
    else if (e.type === "interruttore") add("punto_interruttore", 1);
    else if (e.type === "luce" || e.type === "punto-luce") add("punto_luce", 1);
    else if (e.type === "quadro" || e.type === "quadro-elettrico") add("quadro_elettrico", 1);
    else add("punto_luce", 1); // fallback per altri tipi
  });
  (data.plumbing || []).forEach((p) => {
    if (p.type === "punto-completo" || p.type === "acqua-completo") {
      add("punto_acqua_completo", 1);
    } else if (p.type === "scarico" || p.type === "acqua-scarico") {
      add("punto_scarico", 1);
    } else {
      add("punto_acqua", 1);
    }
  });
  (data.gas || []).forEach(() => add("punto_gas", 1));
  (data.hvac || []).forEach((h) => {
    const t = h.type || "split";
    // Per multi-split (gruppi): quadri/trial/dual sono fatturati una volta come voce-condiz-* (sul UE).
    // Gli split del gruppo non aggiungono ulteriore prezzo singolo (sono inclusi nel pacchetto).
    if (h.group_id && h.group_kind && t === "split") return; // Split del gruppo: skip (già contato sull'UE)
    if (h.group_id && h.group_kind === "quadri-split" && t === "esterna") { add("climatizzatore_quadri", 1); return; }
    if (h.group_id && h.group_kind === "trial-split" && t === "esterna") { add("climatizzatore_trial", 1); return; }
    if (h.group_id && h.group_kind === "dual-split" && t === "esterna") { add("climatizzatore_dual", 1); return; }
    if (t === "predisposizione") add("predisposizione_clima", 1);
    else if (t === "caldaia") add("caldaia_condensazione", 1);
    else if (t === "caldaia-ibrida") add("caldaia_ibrida", 1);
    else if (t === "pompa-calore") add("pompa_calore", 1);
    else if (t === "scaldabagno") add("scaldabagno", 1);
    else if (t === "termoarredo") add("termoarredo", 1);
    else if (t === "termosifone" || t === "radiatore") add("termosifone", 1);
    else if (t === "fotovoltaico") add("fotovoltaico", 1);
    else if (t === "esterna" || t === "ue") add("unita_esterna", 1);
    else if (t === "canalizzato" || t === "canalizzato-ui") add("climatizzatore_canalizzato", 1);
    else if (t === "canalizzato-canale") add("canalizzato_canale_ml", h.lengthMl || 1);
    else if (t === "vmc") add("vmc", 1);
    else if (t === "dual-split" || h.kind === "dual") add("climatizzatore_dual", 1);
    else if (t === "trial-split" || h.kind === "trial") add("climatizzatore_trial", 1);
    else if (t === "pavimento-radiante") add("pavimento_radiante", h.areaM2 || 1);
    else if (t === "soffitto-radiante") add("soffitto_radiante", h.areaM2 || 1);
    else add("climatizzatore_mono", 1);
  });
  // Scale
  (data.stairs || []).filter(isProgetto).forEach((s) => {
    if (s.priceLump > 0) return; // gestito separatamente come item a corpo
    if (s.type === "chiocciola") add("scala_chiocciola", 1);
    else if (s.type === "muratura") add("scala_muratura", 1);
    else if (s.type === "legno") add("scala_legno", 1);
  });

  // Sanitari: count fixture items
  (data.items || []).forEach((it) => {
    if (it.materialId === "fix-shower") add("box_doccia", 1);
    if (it.materialId === "fix-toilet") add("sanitari_bagno", 1);
  });

  // Controsoffitti AD AREA (poligoni custom)
  (data.controsoffitti || []).forEach((c) => {
    if (c.areaM2 > 0) add("controsoffitto", c.areaM2);
  });

  // AUTO-AGGIUNTA voci di POSA e MASSETTO accoppiate al materiale (posa = sempre).
  // Quando il CAD genera una qty di pavimento/rivestimento, aggiungo automaticamente la posa relativa
  // in modo che il preventivo CAD includa SEMPRE materiale + posa.
  const PAIRED_LABOR = {
    pavimento_piastrelle: ["posa_pavimento_piastrelle", "massetto"],
    pavimento_parquet: ["posa_pavimento_parquet", "massetto"],
    pavimento_pvc: ["posa_pavimento_pvc"],
    rivestimento_piastrelle: ["posa_rivestimento_piastrelle"],
  };
  Object.entries(PAIRED_LABOR).forEach(([trigger, paired]) => {
    const q = qtyByKey[trigger] || 0;
    if (q > 0) paired.forEach((p) => add(p, q));
  });

  // TILING CON VOCE SPECIFICA: se l'utente ha scelto una piastrella specifica dal catalogo
  // tramite il tool "Schema piastrelle", la trattiamo come override del prezzo della voce
  // pavimento_piastrelle SENZA sottrarre l'area (così il pacchetto può includerla normalmente
  // e l'eventuale eccedenza prezzo viene calcolata correttamente).
  // Ricaviamo il prezzo medio ponderato per area del tiling specifico, e marchiamo nel
  // priceOverrides la voce_id mapped (= voce di pavimento_piastrelle) con il prezzo voce scelto.
  // Inoltre teniamo traccia della voce specifica per mostrarla in computo.
  let tilingTotalAreaM2 = 0;
  let tilingWeightedPrice = 0;
  let tilingVoceLabels = [];
  let tilingVoceIdSelected = null;
  (data.tiling || []).forEach((t) => {
    if (!t.voceId || !t.vocePrice) return;
    const r = (data.rooms || []).find((rr) => rr.id === t.roomId);
    if (!r) return;
    const areaM2 = polygonArea(r.points) / 10000;
    if (areaM2 <= 0) return;
    tilingTotalAreaM2 += areaM2;
    tilingWeightedPrice += areaM2 * t.vocePrice;
    tilingVoceLabels.push(`${t.voceName || "piastrella"} (${r.name || ""})`);
    tilingVoceIdSelected = t.voceId; // l'ultimo wins per il display
  });
  // Se l'utente ha scelto piastrelle specifiche, override il prezzo della voce "Piastrelle pavimento"
  // del pacchetto/standard usando il prezzo medio ponderato (quando ci sono tipi diversi per stanza).
  const tilingAvgPrice = tilingTotalAreaM2 > 0 ? round2(tilingWeightedPrice / tilingTotalAreaM2) : 0;

  // Build itemized list
  const items = [];
  const byCat = {};
  let totalExtra = 0;
  let totalIncluded = 0;
  const includedMap = {}; // qty coperta dal pacchetto, per CAD key
  const refPriceMap = {}; // prezzo di riferimento del pacchetto, per CAD key (per calcolo eccedenza override)
  if (packageRef && Array.isArray(packageRef.voci_incluse)) {
    packageRef.voci_incluse.forEach((vi) => {
      const keys = Array.isArray(vi.keys) ? vi.keys : (vi.key ? [vi.key] : []);
      const totalQty = vi.qty_inclusa || 0;
      // FULL COVERAGE: la voce inclusa nel pacchetto copre INTERAMENTE il consumo CAD effettivo.
      // Usato per voci forfait pacchetto come "Decorazione/Pittura/Massetto/Posa" che il pacchetto
      // include "tutto" (NON limitato da ratio×mq pavimento).
      if (vi.fullCoverage) {
        keys.forEach((k) => {
          includedMap[k] = qtyByKey[k] || 0;
          if (vi.ref_unit_price) refPriceMap[k] = vi.ref_unit_price;
        });
        return;
      }
      if (vi.shared) {
        // Budget condiviso: distribuisco nell'ordine delle keys consumando le quantità presenti
        let budget = totalQty;
        keys.forEach((k) => {
          if (budget <= 0) return;
          const have = qtyByKey[k] || 0;
          const remaining = have - (includedMap[k] || 0);
          if (remaining <= 0) return;
          const used = Math.min(remaining, budget);
          includedMap[k] = (includedMap[k] || 0) + used;
          if (vi.ref_unit_price) refPriceMap[k] = vi.ref_unit_price;
          budget -= used;
        });
      } else {
        keys.forEach((k) => {
          includedMap[k] = (includedMap[k] || 0) + totalQty;
          if (vi.ref_unit_price) refPriceMap[k] = vi.ref_unit_price;
        });
      }
    });
  }

  // priceOverrides applicati dal venditore: { voce_id: customUnitPrice }
  const priceOverrides = data.priceOverrides || {};

  Object.keys(qtyByKey).forEach((key) => {
    const qty = qtyByKey[key];
    if (qty <= 0) return;
    const voceName = VOCE_MAP[key];
    const voce = findVoce(voci, voceName);
    if (!voce) return;
    const basePrice = priceOf(voce);
    let overridePrice = priceOverrides[voce.id];
    // TILING SPECIFICO: se l'utente ha scelto piastrelle dal catalogo nel CAD,
    // usiamo il prezzo medio ponderato come override del prezzo della voce pavimento_piastrelle.
    // Il listino personalizzato dell'utente (priceOverrides) ha PRECEDENZA se presente.
    if (key === "pavimento_piastrelle" && tilingAvgPrice > 0 && !(typeof overridePrice === "number" && overridePrice > 0)) {
      overridePrice = tilingAvgPrice;
    }
    const useOverride = typeof overridePrice === "number" && overridePrice > 0;
    const unitPrice = useOverride ? overridePrice : basePrice;
    const inclusa = includedMap[key] || 0;
    const refPrice = refPriceMap[key] || 0;
    const extra = Math.max(0, qty - inclusa);
    let totalRow = extra * unitPrice;
    let priceDelta = 0;
    // ECCEDENZA materiale: se la voce è coperta dal pacchetto e l'override prezzo > prezzo riferimento,
    // l'eccedenza unitaria sulla quantità INCLUSA si aggiunge come extra (richiesta utente: "se supera quel prezzo viene contato come extra l'eccedenza").
    if (useOverride && refPrice > 0 && overridePrice > refPrice && inclusa > 0) {
      const coveredQty = Math.min(qty, inclusa);
      priceDelta = round2((overridePrice - refPrice) * coveredQty);
      totalRow += priceDelta;
    }
    const incTotalRow = Math.min(qty, inclusa) * unitPrice;
    totalExtra += totalRow;
    totalIncluded += incTotalRow;
    // Per pavimento_piastrelle con tiling-specific, mostriamo il nome della voce scelta
    let displayName = voce.name;
    if (key === "pavimento_piastrelle" && tilingVoceLabels.length > 0) {
      displayName = tilingVoceLabels.length === 1
        ? tilingVoceLabels[0]
        : `Piastrelle pavimento (mix: ${tilingVoceLabels.length} tipi)`;
    }
    const item = {
      key, name: displayName, unit: voce.unit, qty: round2(qty),
      qty_inclusa: round2(inclusa),
      qty_extra: round2(extra),
      unit_price: round2(unitPrice),
      ref_unit_price: round2(refPrice),
      price_override: useOverride ? round2(overridePrice) : null,
      price_delta_extra: priceDelta,
      total: round2(totalRow),
      voce_id: (key === "pavimento_piastrelle" && tilingVoceIdSelected) ? tilingVoceIdSelected : voce.id,
      category: voce.category,
    };
    items.push(item);
    byCat[voce.category] = (byCat[voce.category] || 0) + totalRow;
  });

  // Sort by ordine_lavorazione (PDF order), poi categoria, poi nome
  items.sort((a, b) => {
    const da = ordineFor(a.name), db = ordineFor(b.name);
    if (da !== db) return da - db;
    return (a.category || "").localeCompare(b.category || "") || a.name.localeCompare(b.name);
  });

  // Voci a CORPO: scale con priceLump + manualItems aggiunti dall'utente dal catalogo voci backoffice.
  const lumpItems = [];
  (data.stairs || []).filter(isProgetto).forEach((s) => {
    if (!(s.priceLump > 0)) return;
    const t = s.type === "chiocciola" ? "Scala a chiocciola" : s.type === "legno" ? "Scala in legno" : "Scala in muratura";
    lumpItems.push({
      key: `stairs-lump-${s.id}`, name: `${t} (a corpo)`, unit: "corpo",
      qty: 1, qty_inclusa: 0, qty_extra: 1,
      unit_price: s.priceLump, total: s.priceLump,
      voce_id: null, category: "Scale", lump: true,
    });
  });
  (data.manualItems || []).forEach((mi) => {
    const qty = mi.qty || 1;
    const unitPrice = mi.unit_price_override != null ? mi.unit_price_override : (mi.unit_price || 0);
    const totalRow = qty * unitPrice;
    lumpItems.push({
      key: `manual-${mi.id}`, name: mi.name + (mi.descrizione ? ` · ${mi.descrizione}` : ""),
      unit: mi.unit || "pz",
      qty, qty_inclusa: 0, qty_extra: qty,
      unit_price: unitPrice, total: totalRow,
      voce_id: mi.voce_id || null, category: mi.category || "Manuale", manual: true,
    });
  });
  // Decorazioni parete con voce specifica (per-parete o globali): un riga per voce_id
  Object.entries(wallDecorAreaByVoceId).forEach(([voceId, info]) => {
    const totalRow = round2(info.area * info.price);
    lumpItems.push({
      key: `walldecor-${voceId}`, name: `${info.name} (decorazione/rivestimento parete)`,
      unit: "m²",
      qty: round2(info.area), qty_inclusa: 0, qty_extra: round2(info.area),
      unit_price: info.price, total: totalRow,
      voce_id: voceId, category: "Decorazioni pareti", manual: true,
    });
  });
  // PELLICOLATURA INFISSI PVC — maggiorazione % per finestre con flag pellicolato=true
  // Cerca la voce maggiorazione_pct nelle voci backoffice (fallback 25%)
  const pellicolatura = (voci || []).find((v) => v.id === "voce-pellicolatura-pvc");
  const pellicolaturaPct = (pellicolatura?.maggiorazione_pct ?? 25) / 100;
  const pvcWindows = (data.windows || []).filter((w) => w.phase === "progetto" && (w.material || "pvc") === "pvc" && w.pellicolato);
  if (pvcWindows.length > 0) {
    const pvcVoce = (voci || []).find((v) => v.id === "voce-infissi-pvc");
    const basePvcUnit = pvcVoce ? (pvcVoce.prezzo_acquisto * (pvcVoce.ricarico || 1.8)) : 504;
    const groups = {};
    pvcWindows.forEach((w) => {
      const tex = (w.pellicolato_texture || "Standard").trim() || "Standard";
      const k = `pellicolatura-${tex.replace(/\s+/g, "-").toLowerCase()}`;
      if (!groups[k]) groups[k] = { texture: tex, count: 0 };
      groups[k].count += 1;
    });
    Object.entries(groups).forEach(([k, info]) => {
      const totalRow = round2(info.count * basePvcUnit * pellicolaturaPct);
      lumpItems.push({
        key: k, name: `Pellicolatura PVC ${pellicolaturaPct * 100}% · texture "${info.texture}"`,
        unit: "pz",
        qty: info.count, qty_inclusa: 0, qty_extra: info.count,
        unit_price: round2(basePvcUnit * pellicolaturaPct), total: totalRow,
        voce_id: "voce-pellicolatura-pvc", category: "INFISSI", manual: true,
      });
    });
  }
  lumpItems.forEach((it) => { totalExtra += it.total; });
  items.push(...lumpItems);

  // EXCLUDED_KEYS: l'utente ha cliccato la "X" di rimozione su queste righe → escludi dal computo.
  const excludedKeys = new Set(data.excluded_keys || []);
  let removedExtra = 0;
  let removedIncluded = 0;
  const finalItems = items.filter((it) => {
    if (!excludedKeys.has(it.key)) return true;
    // Sottrai il contributo di questa riga ai totali
    if (it.manual || it.lump) {
      removedExtra += it.total;
    } else {
      // riga computata: extra_unit_price * qty_extra + delta + included_unit_price * inclusa
      const extraRow = (it.qty_extra || 0) * (it.unit_price || 0) + (it.price_delta_extra || 0);
      const inclRow = (it.qty_inclusa || 0) * (it.unit_price || 0);
      removedExtra += extraRow;
      removedIncluded += inclRow;
    }
    return false;
  });
  totalExtra -= removedExtra;
  totalIncluded -= removedIncluded;

  return {
    items: finalItems,
    total: round2(totalExtra + (packageRef?.package_base_total || totalIncluded)),
    extra_total: round2(totalExtra),
    included_total: round2(totalIncluded),
    package_base: round2(packageRef?.package_base_total || 0),
    byCategory: byCat,
    package_name: packageRef?.name || null,
  };
}

// Mapping: per ogni voce backoffice (per nome o keyword), quale chiave esigenze
// deve essere "attiva" per giustificarne l'inclusione tra gli extra.
// Ritorna true se la voce è giustificata dalle risposte del cliente.
function voceJustifiedByEsigenze(voceName, esigenze) {
  const n = (voceName || "").toLowerCase();
  // Default: voce inclusa solo se chiaramente collegata
  if (n.includes("demoliz")) return ["Si, rivoluziono", "Qualche modifica", "Tutto nuovo", "Solo bagni"].some((v) => Object.values(esigenze).includes(v));
  if (n.includes("muro mattone") || n.includes("muro cartongesso")) return ["Si, rivoluziono", "Qualche modifica"].includes(esigenze.muratura);
  if (n.includes("controsoff")) return ["Si, rivoluziono", "Qualche modifica"].includes(esigenze.muratura) || esigenze.finiture === "Premium" || esigenze.finiture === "Luxury";
  if (n.includes("piastrelle pavim")) return ["Tutto nuovo", "Solo zone"].includes(esigenze.pavimenti);
  if (n.includes("parquet")) return ["Tutto nuovo", "Solo zone"].includes(esigenze.pavimenti);
  if (n.includes("pvc/laminat")) return esigenze.pavimenti === "Sopra";
  if (n.includes("piastrelle rivestim")) return ["Tutto", "Solo bagni"].includes(esigenze.rivestimenti);
  if (n.includes("pittur")) return true; // pittura quasi sempre necessaria
  if (n.includes("battiscop")) return ["Tutto nuovo", "Solo zone"].includes(esigenze.pavimenti);
  if (n.includes("impianto elettrico")) return ["Tutto nuovo", "Adeguamento"].includes(esigenze.elettrico);
  if (n.includes("punto luce")) return ["Tutto nuovo", "Adeguamento"].includes(esigenze.elettrico);
  if (n.includes("impianto idraulico")) return ["Tutto nuovo", "Solo bagni"].includes(esigenze.idraulico);
  if (n.includes("punto acqua")) return ["Tutto nuovo", "Solo bagni"].includes(esigenze.idraulico);
  if (n.includes("riscaldamento radiator")) return esigenze.termico === "Radiatori";
  if (n.includes("riscaldamento a pavim")) return esigenze.termico === "Pavimento";
  if (n.includes("predisposizione climat")) return esigenze.clima === "Predisposizione" || esigenze.clima === "Sì installato";
  if (n.includes("climatizzatore dual")) return esigenze.clima === "Sì installato" && (esigenze.bagni === "1" || esigenze.bagni === "2");
  if (n.includes("climatizzatore trial")) return esigenze.clima === "Sì installato" && (esigenze.bagni === "2" || esigenze.bagni === "3+");
  if (n.includes("caldaia")) return ["Solo caldaia", "Radiatori", "Pavimento"].includes(esigenze.termico);
  if (n.includes("porte interne")) return esigenze.porte_interne && esigenze.porte_interne !== "0";
  if (n.includes("blindata")) return esigenze.blindata === "Sì" || esigenze.blindata === "Standard";
  if (n.includes("infissi pvc")) return esigenze.infissi_esterni !== "No" && (esigenze.infissi_materiale === "PVC" || esigenze.infissi_materiale === "Indeciso");
  if (n.includes("infissi alluminio")) return esigenze.infissi_esterni !== "No" && esigenze.infissi_materiale === "Alluminio";
  if (n.includes("infissi legno") || n.includes("legno/alluminio")) return esigenze.infissi_esterni !== "No" && esigenze.infissi_materiale === "Legno";
  if (n.includes("sanitari bagno") || n.includes("box doccia") || n.includes("mobile bagno")) return esigenze.bagni && esigenze.bagni !== "0";
  if (n.includes("autolivell")) return ["Tutto nuovo", "Solo zone"].includes(esigenze.pavimenti);
  if (n.includes("massetto")) return ["Tutto nuovo", "Solo zone"].includes(esigenze.pavimenti) || esigenze.termico === "Pavimento";
  if (n.includes("posa rivest") || n.includes("posa-riv")) return ["Tutto", "Solo bagni"].includes(esigenze.rivestimenti);
  if (n.includes("posa") && (n.includes("ceramica") || n.includes("piastrell"))) return ["Tutto", "Solo bagni"].includes(esigenze.rivestimenti) || ["Tutto nuovo", "Solo zone"].includes(esigenze.pavimenti);
  if (n.includes("decoraz") || n.includes("idropittur")) return true;
  if (n.includes("cila") || n.includes("scia") || n.includes("pratich")) return true; // pratiche edilizie sempre
  if (n.includes("intonac") || n.includes("rasatur")) return ["Si, rivoluziono", "Qualche modifica"].includes(esigenze.muratura) || esigenze.finiture !== "Essenziale";
  if (n.includes("sicurezza cantier")) return true; // sempre presente
  return false;
}

function computeQtyForVoce(voce, packageItem, mq) {
  if (!packageItem) return 1;
  const mode = packageItem.qty_mode || "fissa";
  if (mode === "mq") return mq * (packageItem.qty_ratio || 1);
  if (mode === "ml") return mq * (packageItem.qty_ratio || 0.4); // approx perimetro/mq
  if (mode === "mq_coeff") return mq * (packageItem.qty_ratio || 1);
  return packageItem.qty_value || 1;
}

/**
 * Compute realistic extras between two packages based on customer needs.
 * Returns: { extras: [{name, unit, qty, unit_price, total}], total }
 */
export function computeRealisticExtras(recommendedPkg, alternativePkg, esigenze, mq, voci) {
  if (!recommendedPkg || !alternativePkg) return { extras: [], total: 0 };
  const recItems = recommendedPkg.items || [];
  const altVoceIds = new Set((alternativePkg.items || []).map((i) => i.voce_id));
  const extras = [];
  let total = 0;
  for (const recItem of recItems) {
    if (altVoceIds.has(recItem.voce_id)) continue; // già nel pacchetto alternativo
    const voce = (voci || []).find((v) => v.id === recItem.voce_id);
    if (!voce) continue;
    if (!voceJustifiedByEsigenze(voce.name, esigenze)) continue;
    const qty = computeQtyForVoce(voce, recItem, mq);
    const unitPrice = (voce.prezzo_acquisto || 0) * (voce.ricarico || 1.8);
    const lineTotal = qty * unitPrice;
    extras.push({
      voce_id: voce.id,
      name: voce.name,
      unit: voce.unit,
      qty: Math.round(qty * 100) / 100,
      unit_price: Math.round(unitPrice * 100) / 100,
      total: Math.round(lineTotal * 100) / 100,
    });
    total += lineTotal;
  }
  return { extras, total: Math.round(total * 100) / 100 };
}

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

export const fmtEuro = (n) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
export const fmtEuro2 = (n) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
export const fmtNum = (n, d = 2) =>
  new Intl.NumberFormat("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n || 0);

export function emptyProjectData() {
  return {
    walls: [],          // {id, x1,y1,x2,y2, thickness, kind?, demolito?}
    doors: [],          // {id, wallId, t, width, height, type}
    windows: [],        // {id, wallId, t, width, height, sillHeight, type, material?}
    rooms: [],          // {id, name, points, floorMaterial, wallMaterial, ceilingMaterial, electrical, plumbing, controsoffitto?}
    items: [],          // {id, type, materialId, x, y, rotation, width, depth, qty}
    electrical: [],     // {id, type:"quadro"|"scatola"|"presa"|"interruttore"|"luce", x, y, label?}
    plumbing: [],       // {id, type:"acqua-fredda"|"acqua-calda"|"scarico", x, y}
    gas: [],            // {id, x, y}
    hvac: [],           // {id, type:"split"|"esterna"|"predisposizione", x, y, kind?:"dual"|"trial"}
    demolitions: [],    // {id, kind:"pavimento", x, y, areaM2, polygon?:[{x,y}]}
    tiling: [],         // {id, roomId, size:"60x60"|..., startPoint:{x,y}, angle, finish?}
    stairs: [],         // {id, type:"chiocciola"|"muratura"|"legno", x, y, rotation, width, depth, phase}
    texts: [],
    packageRef: null,   // {package_id, name, mq_inclusi, voci_incluse:[{key, qty_inclusa}]}
    roomHeight: 270,
    currency: "EUR",
  };
}

/**
 * segmentIntersect: returns intersection point of segments AB and CD if exists, else null.
 * Returns {x, y, t (on AB), u (on CD)}.
 */
export function segmentIntersect(A, B, C, D, eps = 1e-6) {
  const dxAB = B.x - A.x, dyAB = B.y - A.y;
  const dxCD = D.x - C.x, dyCD = D.y - C.y;
  const denom = dxAB * dyCD - dyAB * dxCD;
  if (Math.abs(denom) < eps) return null;
  const t = ((C.x - A.x) * dyCD - (C.y - A.y) * dxCD) / denom;
  const u = ((C.x - A.x) * dyAB - (C.y - A.y) * dxAB) / denom;
  if (t < -eps || t > 1 + eps || u < -eps || u > 1 + eps) return null;
  return { x: A.x + t * dxAB, y: A.y + t * dyAB, t: Math.max(0, Math.min(1, t)), u: Math.max(0, Math.min(1, u)) };
}

/**
 * splitRoomByWall: data una stanza (poligono) e un muro (segmento), se la LINEA
 * del muro attraversa la stanza entrando ed uscendo da 2 lati distinti, restituisce
 * 2 nuovi poligoni risultanti dallo split. Robusto rispetto a snap-grid (t=0/1 esatti
 * sono accettati) e rispetto a muri completamente interni (linea estesa).
 */
export function splitRoomByWall(points, W1, W2) {
  if (!points || points.length < 3) return null;
  if (Math.hypot(W2.x - W1.x, W2.y - W1.y) < 1) return null;
  // Trova intersezioni della LINEA infinita del muro con ciascun lato del poligono
  const hits = [];
  const dxAB = W2.x - W1.x, dyAB = W2.y - W1.y;
  for (let i = 0; i < points.length; i++) {
    const A = points[i], B = points[(i + 1) % points.length];
    const dxCD = B.x - A.x, dyCD = B.y - A.y;
    const denom = dxAB * dyCD - dyAB * dxCD;
    if (Math.abs(denom) < 1e-6) continue; // paralleli
    const t = ((A.x - W1.x) * dyCD - (A.y - W1.y) * dxCD) / denom;
    const u = ((A.x - W1.x) * dyAB - (A.y - W1.y) * dxAB) / denom;
    if (u < -1e-3 || u > 1 + 1e-3) continue; // intersezione fuori dal lato
    const x = W1.x + t * dxAB, y = W1.y + t * dyAB;
    hits.push({ edgeIdx: i, x, y, u: Math.max(0, Math.min(1, u)), t });
  }
  // Dedup intersezioni vicine (vertici condivisi tra 2 lati)
  const dedup = [];
  hits.forEach((h) => {
    const dup = dedup.find((d) => Math.hypot(d.x - h.x, d.y - h.y) < 1.5);
    if (!dup) dedup.push(h);
  });
  if (dedup.length < 2) return null;
  // Prendi le 2 intersezioni più vicine al SEGMENTO del muro (per t ~ in [0,1])
  // Se il muro è interamente dentro: t fuori da [0,1] ma comunque dividiamo lungo la linea
  dedup.sort((a, b) => a.t - b.t);
  // Se ho >2 hits (caso di poligoni concavi), prendi i 2 che attraversano effettivamente
  // l'interno: il midpoint del segmento tra le 2 deve essere dentro il poligono
  let H1 = null, H2 = null;
  for (let i = 0; i < dedup.length - 1; i++) {
    const a = dedup[i], b = dedup[i + 1];
    if (a.edgeIdx === b.edgeIdx) continue; // stesso lato (non separa)
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (pointInPolygon(mid, points)) { H1 = a; H2 = b; break; }
  }
  if (!H1 || !H2) return null;
  // Verifica che il muro reale (segmento W1-W2) sovrapponga almeno parzialmente l'intervallo [H1,H2]
  // (cioè il muro deve davvero toccare/attraversare la zona divisoria, non essere a metri di distanza)
  const tMin = Math.min(H1.t, H2.t), tMax = Math.max(H1.t, H2.t);
  if (tMax < -0.05 || tMin > 1.05) return null;
  // Costruisci i 2 poligoni
  const i1 = H1.edgeIdx, i2 = H2.edgeIdx;
  const poly1 = [{ x: H1.x, y: H1.y }];
  let i = (i1 + 1) % points.length;
  let safety = points.length + 2;
  while (safety-- > 0) {
    poly1.push({ x: points[i].x, y: points[i].y });
    if (i === i2) break;
    i = (i + 1) % points.length;
  }
  poly1.push({ x: H2.x, y: H2.y });
  const poly2 = [{ x: H2.x, y: H2.y }];
  i = (i2 + 1) % points.length;
  safety = points.length + 2;
  while (safety-- > 0) {
    poly2.push({ x: points[i].x, y: points[i].y });
    if (i === i1) break;
    i = (i + 1) % points.length;
  }
  poly2.push({ x: H1.x, y: H1.y });
  if (poly1.length < 3 || poly2.length < 3) return null;
  if (polygonArea(poly1) < 100 || polygonArea(poly2) < 100) return null;
  return [poly1, poly2];
}

export const uid = () => Math.random().toString(36).slice(2, 10);
