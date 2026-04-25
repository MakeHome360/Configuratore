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
  demolizione_muro: "Demolizione e smaltimento",
  demolizione_pavimento: "Demolizione e smaltimento",
  demolizione_rivestimento: "Demolizione e smaltimento",
  costruzione_muro_mattone: "Muro mattone",
  costruzione_muro_cartongesso: "Muro cartongesso",
  controsoffitto: "Controparete / controsoffitto",
  pavimento_piastrelle: "Piastrelle pavimento",
  pavimento_parquet: "Parquet",
  pavimento_pvc: "Pavimento PVC/laminato",
  rivestimento_piastrelle: "Piastrelle rivestimento",
  pittura_pareti: "Pittura prima mano",
  battiscopa: "Posa Battiscopa",
  impianto_elettrico_mq: "Impianto elettrico completo",
  punto_luce: "Punto luce LED",
  punto_presa: "Punto presa",
  punto_interruttore: "Punto interruttore",
  quadro_elettrico: "Quadro elettrico",
  impianto_idraulico_mq: "Impianto idraulico completo",
  punto_acqua: "Punto acqua",
  punto_scarico: "Punto scarico",
  punto_gas: "Punto gas",
  riscaldamento_radiatori: "Impianto riscaldamento radiatori",
  riscaldamento_pavimento: "Impianto riscaldamento a pavimento",
  predisposizione_clima: "Predisposizione climatizzatore",
  climatizzatore_dual: "Climatizzatore dual split",
  climatizzatore_trial: "Climatizzatore trial split",
  caldaia_condensazione: "Caldaia a condensazione",
  caldaia_ibrida: "Caldaia ibrida (pompa di calore)",
  canalizzato_unita_interna: "Canalizzato · Unità interna",
  canalizzato_canale_ml: "Canalizzato · Canale aria con plenum",
  vmc: "VMC ventilazione meccanica",
  porta_interna: "Porte interne serie standard",
  porta_blindata_cl3: "Porta blindata Classe 3",
  porta_blindata_cl4: "Porta blindata Classe 4",
  porta_blindata: "Pannello porta blindata",
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
  // FIX CRITICO: fatturare SOLO elementi del Progetto (phase==="progetto"). Tutto ciò che è
  // 'fatto' o legacy (no phase) NON entra nel preventivo. Cartongesso/demolizioni hanno il loro
  // filtro specifico (sempre progetto perché operativamente sono interventi nuovi).
  const isProgetto = (el) => el?.phase === "progetto";
  const rooms = (data.rooms || []).filter(isProgetto);

  // Aggregate quantities
  const qtyByKey = {};
  const add = (k, n) => { qtyByKey[k] = (qtyByKey[k] || 0) + n; };

  // Floors / Ceilings / Walls (by room)
  rooms.forEach((r) => {
    const areaM2 = polygonArea(r.points) / 10000;
    const perimM = polygonPerimeter(r.points) / 100;
    const wallAreaM2 = perimM * (height / 100);
    // pavimento by material id heuristic
    const fm = (r.floorMaterial || "").toLowerCase();
    if (fm.includes("parquet")) add("pavimento_parquet", areaM2);
    else if (fm.includes("pvc") || fm.includes("laminat")) add("pavimento_pvc", areaM2);
    else add("pavimento_piastrelle", areaM2);
    // pittura pareti
    add("pittura_pareti", wallAreaM2);
    // battiscopa
    add("battiscopa", perimM);
    // rivestimento bagno (se plumbing)
    if (r.plumbing) add("rivestimento_piastrelle", wallAreaM2 * 0.5);
    // impianto elettrico/idraulico per mq
    if (r.electrical) add("impianto_elettrico_mq", areaM2);
    if (r.plumbing) add("impianto_idraulico_mq", areaM2);
    // controsoffitto se flaggato
    if (r.controsoffitto) add("controsoffitto", areaM2);
  });

  // Walls: fatturare SOLO se phase==="progetto". (cartongesso o kind="nuovo" senza phase = legacy → trattati come progetto)
  (data.walls || []).forEach((w) => {
    const lenM = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) / 100;
    const aM2 = lenM * (height / 100);
    if (w.demolito) {
      add("demolizione_muro", aM2);
      return;
    }
    if (w.demolito_partial && w.demolito_partial.to > w.demolito_partial.from) {
      const portionM = lenM * (w.demolito_partial.to - w.demolito_partial.from);
      const hM = (w.demolito_partial.height || height) / 100;
      add("demolizione_muro", portionM * hM);
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

  // Demolizioni esplicite (sempre progetto)
  (data.demolitions || []).forEach((d) => {
    let area = d.areaM2 || 0;
    // Se è poligono area free-form, ricalcola area dal polygon
    if (d.polygon && d.polygon.length >= 3) {
      area = polygonArea(d.polygon) / 10000;
    }
    if (d.kind === "pavimento") add("demolizione_pavimento", area);
    if (d.kind === "rivestimento") add("demolizione_rivestimento", area);
  });

  // Doors / Windows — solo nuovi (phase==="progetto")
  (data.doors || []).filter(isProgetto).forEach((d) => {
    if (d.type === "blindata-cl4") add("porta_blindata_cl4", 1);
    else if (d.type === "blindata-cl3" || d.type === "blindata") add("porta_blindata_cl3", 1);
    else add("porta_interna", 1);
  });
  (data.windows || []).filter(isProgetto).forEach((w) => {
    const mat = w.material || "pvc";
    if (mat === "alluminio") add("finestre_alluminio", 1);
    else if (mat === "legno") add("finestre_legno", 1);
    else add("finestre_pvc", 1);
  });

  // Impianti dettagliati — solo nuovi
  (data.electrical || []).filter(isProgetto).forEach((e) => {
    if (e.type === "presa") add("punto_presa", 1);
    else if (e.type === "interruttore") add("punto_interruttore", 1);
    else if (e.type === "luce") add("punto_luce", 1);
    else if (e.type === "quadro" || e.type === "quadro-elettrico") add("quadro_elettrico", 1);
    else add("punto_luce", 1); // fallback per altri tipi
  });
  (data.plumbing || []).filter(isProgetto).forEach((p) => {
    if (p.type === "scarico" || p.type === "acqua-scarico") add("punto_scarico", 1);
    else add("punto_acqua", 1);
  });
  (data.gas || []).filter(isProgetto).forEach(() => add("punto_gas", 1));
  (data.hvac || []).filter(isProgetto).forEach((h) => {
    if (h.type === "predisposizione") add("predisposizione_clima", 1);
    else if (h.type === "caldaia") add("caldaia_condensazione", 1);
    else if (h.type === "caldaia-ibrida") add("caldaia_ibrida", 1);
    else if (h.type === "canalizzato-ui") add("canalizzato_unita_interna", 1);
    else if (h.type === "canalizzato-canale") add("canalizzato_canale_ml", h.lengthMl || 1);
    else if (h.type === "vmc") add("vmc", 1);
    else if (h.kind === "dual") add("climatizzatore_dual", 1);
    else if (h.kind === "trial") add("climatizzatore_trial", 1);
    else add("predisposizione_clima", 1);
  });
  // Scale
  (data.stairs || []).filter(isProgetto).forEach((s) => {
    if (s.type === "chiocciola") add("scala_chiocciola", 1);
    else if (s.type === "muratura") add("scala_muratura", 1);
    else if (s.type === "legno") add("scala_legno", 1);
  });

  // Sanitari: count fixture items
  (data.items || []).forEach((it) => {
    if (it.materialId === "fix-shower") add("box_doccia", 1);
    if (it.materialId === "fix-toilet") add("sanitari_bagno", 1);
  });

  // Build itemized list
  const items = [];
  const byCat = {};
  let totalExtra = 0;
  let totalIncluded = 0;
  const includedMap = {};
  if (packageRef && Array.isArray(packageRef.voci_incluse)) {
    packageRef.voci_incluse.forEach((v) => { includedMap[v.key] = (includedMap[v.key] || 0) + (v.qty_inclusa || 0); });
  }

  Object.keys(qtyByKey).forEach((key) => {
    const qty = qtyByKey[key];
    if (qty <= 0) return;
    const voceName = VOCE_MAP[key];
    const voce = findVoce(voci, voceName);
    if (!voce) return;
    const unitPrice = priceOf(voce);
    const inclusa = includedMap[key] || 0;
    const extra = Math.max(0, qty - inclusa);
    const totalRow = extra * unitPrice;
    const incTotalRow = Math.min(qty, inclusa) * unitPrice;
    totalExtra += totalRow;
    totalIncluded += incTotalRow;
    const item = {
      key, name: voce.name, unit: voce.unit, qty: round2(qty),
      qty_inclusa: round2(inclusa),
      qty_extra: round2(extra),
      unit_price: round2(unitPrice),
      total: round2(totalRow),
      voce_id: voce.id,
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

  return {
    items,
    total: round2(totalExtra + totalIncluded),
    extra_total: round2(totalExtra),
    included_total: round2(totalIncluded),
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

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

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
 * splitRoomByWall: given a room polygon (array of points) and a wall segment (W1..W2),
 * if the wall fully crosses the polygon entering and exiting through two edges,
 * return TWO polygons resulting from the split. Otherwise return null.
 */
export function splitRoomByWall(points, W1, W2) {
  if (!points || points.length < 3) return null;
  // Find intersections of the wall segment with each edge of the polygon
  const hits = []; // {edgeIdx, x, y, u (on edge)}
  for (let i = 0; i < points.length; i++) {
    const A = points[i], B = points[(i + 1) % points.length];
    const inter = segmentIntersect(W1, W2, A, B);
    if (inter && inter.u > 1e-3 && inter.u < 1 - 1e-3) {
      hits.push({ edgeIdx: i, x: inter.x, y: inter.y, u: inter.u, t: inter.t });
    }
  }
  // Need exactly 2 hits with t inside [0,1] (full crossing)
  const valid = hits.filter((h) => h.t > 1e-3 && h.t < 1 - 1e-3);
  if (valid.length !== 2) return null;
  // Sort by edge index then u
  valid.sort((a, b) => a.t - b.t);
  const [H1, H2] = valid;
  // Build poly1: vertices from H1 to H2 going forward along polygon
  // Insert H1 after edge H1.edgeIdx, H2 after edge H2.edgeIdx
  const poly1 = [];
  const poly2 = [];
  // Walk vertices: include vertex i+1 between hits depending on edge index ordering
  const i1 = H1.edgeIdx, i2 = H2.edgeIdx;
  if (i1 === i2) return null; // hit same edge → no split
  // poly1: H1 → vertices in (i1, i2] → H2 → close back to H1
  poly1.push({ x: H1.x, y: H1.y });
  let i = (i1 + 1) % points.length;
  while (true) {
    poly1.push({ x: points[i].x, y: points[i].y });
    if (i === i2) break;
    i = (i + 1) % points.length;
    if (i === i1) return null; // safety
  }
  poly1.push({ x: H2.x, y: H2.y });
  // poly2: H2 → vertices in (i2, i1] → H1
  poly2.push({ x: H2.x, y: H2.y });
  i = (i2 + 1) % points.length;
  while (true) {
    poly2.push({ x: points[i].x, y: points[i].y });
    if (i === i1) break;
    i = (i + 1) % points.length;
    if (i === i2) return null;
  }
  poly2.push({ x: H1.x, y: H1.y });
  if (poly1.length < 3 || poly2.length < 3) return null;
  // Validate areas non-zero
  if (polygonArea(poly1) < 100 || polygonArea(poly2) < 100) return null;
  return [poly1, poly2];
}

export const uid = () => Math.random().toString(36).slice(2, 10);
