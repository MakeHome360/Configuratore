// Geometry + cost helpers (units: cm in DB, pixels via scale)

// pixels-per-cm on the canvas
export const PX_PER_CM = 2; // so 100cm = 200px, grid 20px = 10cm

export const snap = (v, step = 10) => Math.round(v / step) * step;

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const cmToM = (v) => v / 100;

// Shoelace formula for polygon area (cm²)
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

export function estimateProject(project, catalog) {
  const byId = Object.fromEntries((catalog || []).map((m) => [m.id, m]));
  const out = { total: 0, rooms: [], items: [], systems: 0 };

  const rooms = project.rooms || [];
  const height = project.roomHeight || 270; // cm

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
      id: r.id,
      name: r.name,
      areaM2,
      wallAreaM2,
      floorCost, wallCost, ceilCost, elec, plumb, total,
      floorName: floorMat?.name, wallName: wallMat?.name, ceilName: ceilMat?.name,
    });
  });

  // Items (furniture/fixtures/appliances/lights)
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

export const fmtEuro = (n) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
export const fmtNum = (n, d = 2) =>
  new Intl.NumberFormat("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n || 0);

export function emptyProjectData() {
  return {
    walls: [],       // {id, x1,y1,x2,y2, thickness}
    doors: [],       // {id, wallId, t (0..1), width, height}
    windows: [],     // {id, wallId, t (0..1), width, height, sillHeight}
    rooms: [],       // {id, name, points:[{x,y}], floorMaterial, wallMaterial, ceilingMaterial, electrical, plumbing}
    items: [],       // {id, type:furniture|fixture|appliance|light, materialId, x, y, rotation, width, depth, qty}
    roomHeight: 270,
    currency: "EUR",
  };
}

// Utility for unique ids
export const uid = () => Math.random().toString(36).slice(2, 10);
