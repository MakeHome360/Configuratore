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
  impianto_idraulico_mq: "Impianto idraulico completo",
  punto_acqua: "Punto acqua",
  riscaldamento_radiatori: "Impianto riscaldamento radiatori",
  riscaldamento_pavimento: "Impianto riscaldamento a pavimento",
  predisposizione_clima: "Predisposizione climatizzatore",
  climatizzatore_dual: "Climatizzatore dual split",
  climatizzatore_trial: "Climatizzatore trial split",
  caldaia: "Caldaia a condensazione",
  porta_interna: "Porte interne serie standard",
  porta_blindata: "Pannello porta blindata",
  finestre_pvc: "Infissi PVC bianchi",
  finestre_alluminio: "Infissi alluminio taglio termico",
  finestre_legno: "Infissi legno/alluminio",
  sanitari_bagno: "Sanitari bagno (WC+bidet+lavabo)",
  box_doccia: "Box doccia",
  mobile_bagno: "Mobile bagno",
};

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
  const rooms = data.rooms || [];

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

  // Walls (built m²)
  (data.walls || []).forEach((w) => {
    const lenM = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) / 100;
    const aM2 = lenM * (height / 100);
    if (w.demolito) {
      add("demolizione_muro", aM2);
    } else if (w.kind === "cartongesso") {
      add("costruzione_muro_cartongesso", aM2);
    } else if (w.kind === "mattone") {
      add("costruzione_muro_mattone", aM2);
    }
  });

  // Demolizioni esplicite (pavimento/altro)
  (data.demolitions || []).forEach((d) => {
    if (d.kind === "pavimento") add("demolizione_pavimento", d.areaM2 || 0);
  });

  // Doors / Windows
  (data.doors || []).forEach((d) => {
    if (d.type === "blindata") add("porta_blindata", 1);
    else add("porta_interna", 1);
  });
  (data.windows || []).forEach((w) => {
    const mat = w.material || "pvc";
    if (mat === "alluminio") add("finestre_alluminio", 1);
    else if (mat === "legno") add("finestre_legno", 1);
    else add("finestre_pvc", 1);
  });

  // Impianti dettagliati
  (data.electrical || []).forEach((e) => {
    if (e.type === "presa" || e.type === "interruttore" || e.type === "luce") add("punto_luce", 1);
  });
  (data.plumbing || []).forEach((p) => add("punto_acqua", 1));
  (data.hvac || []).forEach((h) => {
    if (h.type === "predisposizione") add("predisposizione_clima", 1);
    else if (h.kind === "dual") add("climatizzatore_dual", 1);
    else if (h.kind === "trial") add("climatizzatore_trial", 1);
    else add("predisposizione_clima", 1);
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

  // Sort by category, then name
  items.sort((a, b) => (a.category || "").localeCompare(b.category || "") || a.name.localeCompare(b.name));

  return {
    items,
    total: round2(totalExtra + totalIncluded),
    extra_total: round2(totalExtra),
    included_total: round2(totalIncluded),
    byCategory: byCat,
    package_name: packageRef?.name || null,
  };
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
    demolitions: [],    // {id, kind:"pavimento", x, y, areaM2}
    tiling: [],         // {id, roomId, size:"60x60"|..., startPoint:{x,y}, angle, finish?}
    packageRef: null,   // {package_id, name, mq_inclusi, voci_incluse:[{key, qty_inclusa}]}
    roomHeight: 270,
    currency: "EUR",
  };
}

export const uid = () => Math.random().toString(36).slice(2, 10);
