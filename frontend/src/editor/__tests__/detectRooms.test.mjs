/**
 * Test unitari per detectRoomsFromWalls e roomPolygonAlreadyExists
 * Eseguire con: node /app/frontend/src/editor/__tests__/detectRooms.test.mjs
 */
import { detectRoomsFromWalls, roomPolygonAlreadyExists, polygonArea } from "../utils.js";

let pass = 0, fail = 0;
const assert = (cond, msg) => {
  if (cond) { pass++; console.log("  ✓", msg); }
  else { fail++; console.error("  ✗", msg); }
};
const approx = (a, b, eps = 0.01) => Math.abs(a - b) < eps;

// Test 1: 4 muri che formano un rettangolo chiuso → 1 stanza, area corretta
console.log("Test 1: rettangolo 400×300 cm chiuso");
{
  const walls = [
    { id: "w1", x1: 0, y1: 0, x2: 400, y2: 0 },
    { id: "w2", x1: 400, y1: 0, x2: 400, y2: 300 },
    { id: "w3", x1: 400, y1: 300, x2: 0, y2: 300 },
    { id: "w4", x1: 0, y1: 300, x2: 0, y2: 0 },
  ];
  const rooms = detectRoomsFromWalls(walls);
  assert(rooms.length === 1, `rilevata 1 stanza (trovate: ${rooms.length})`);
  assert(rooms[0] && approx(rooms[0].area_m2, 12, 0.1), `area ≈ 12m² (effettiva: ${rooms[0]?.area_m2?.toFixed(2)})`);
}

// Test 2: 3 muri (triangolo aperto in fondo) → nessuna stanza
console.log("Test 2: triangolo APERTO (3 muri non chiusi)");
{
  const walls = [
    { id: "w1", x1: 0, y1: 0, x2: 400, y2: 0 },
    { id: "w2", x1: 400, y1: 0, x2: 200, y2: 300 },
    // manca il muro di chiusura
  ];
  const rooms = detectRoomsFromWalls(walls);
  assert(rooms.length === 0, `nessuna stanza (trovate: ${rooms.length})`);
}

// Test 3: 2 rettangoli adiacenti che condividono un muro → 2 stanze
console.log("Test 3: 2 rettangoli adiacenti");
{
  const walls = [
    // Rettangolo sx (400×300)
    { id: "a1", x1: 0, y1: 0, x2: 400, y2: 0 },
    { id: "a2", x1: 400, y1: 0, x2: 400, y2: 300 },
    { id: "a3", x1: 400, y1: 300, x2: 0, y2: 300 },
    { id: "a4", x1: 0, y1: 300, x2: 0, y2: 0 },
    // Rettangolo dx (400×300) condivide x=400
    { id: "b1", x1: 400, y1: 0, x2: 800, y2: 0 },
    { id: "b2", x1: 800, y1: 0, x2: 800, y2: 300 },
    { id: "b3", x1: 800, y1: 300, x2: 400, y2: 300 },
  ];
  const rooms = detectRoomsFromWalls(walls);
  assert(rooms.length === 2, `rilevate 2 stanze (trovate: ${rooms.length})`);
  const totArea = rooms.reduce((s, r) => s + r.area_m2, 0);
  assert(approx(totArea, 24, 0.2), `area totale ≈ 24m² (effettiva: ${totArea.toFixed(2)})`);
}

// Test 4: muri demoliti vengono ignorati
console.log("Test 4: muro demolito esclude la stanza");
{
  const walls = [
    { id: "w1", x1: 0, y1: 0, x2: 400, y2: 0 },
    { id: "w2", x1: 400, y1: 0, x2: 400, y2: 300 },
    { id: "w3", x1: 400, y1: 300, x2: 0, y2: 300 },
    { id: "w4", x1: 0, y1: 300, x2: 0, y2: 0, demolito: true },
  ];
  const rooms = detectRoomsFromWalls(walls);
  assert(rooms.length === 0, `0 stanze quando 1 muro è demolito (trovate: ${rooms.length})`);
}

// Test 5: snap di endpoint quasi coincidenti (tolleranza 8 cm)
console.log("Test 5: snap endpoint a tolleranza 8cm");
{
  const walls = [
    { id: "w1", x1: 0, y1: 0, x2: 400, y2: 0 },
    { id: "w2", x1: 403, y1: 2, x2: 400, y2: 300 }, // start spostato di 3-4cm
    { id: "w3", x1: 400, y1: 303, x2: 1, y2: 297 }, // shifted
    { id: "w4", x1: 0, y1: 300, x2: -2, y2: -1 },
  ];
  const rooms = detectRoomsFromWalls(walls, { tol: 10 });
  assert(rooms.length >= 1, `≥1 stanza con snap tollerante (trovate: ${rooms.length})`);
}

// Test 6: roomPolygonAlreadyExists riconosce stanza già presente
console.log("Test 6: dedup stanza già esistente");
{
  const cand = [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }, { x: 0, y: 300 }];
  const existing = [{ id: "r1", points: [{ x: 2, y: -1 }, { x: 402, y: 2 }, { x: 401, y: 298 }, { x: -1, y: 302 }] }];
  assert(roomPolygonAlreadyExists(cand, existing) === true, "stanza simile riconosciuta come esistente");
  const newCand = [{ x: 1000, y: 1000 }, { x: 1400, y: 1000 }, { x: 1400, y: 1300 }, { x: 1000, y: 1300 }];
  assert(roomPolygonAlreadyExists(newCand, existing) === false, "stanza diversa riconosciuta come NUOVA");
}

console.log(`\nRisultato: ${pass} ok, ${fail} fail.`);
process.exit(fail === 0 ? 0 : 1);
