import React, { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { snap, uid, polygonArea, polygonPerimeter, fmtNum, pointInPolygon, splitRoomByWall } from "./utils";

const GRID = 10;
const INITIAL_VIEW = { x: -300, y: -200, w: 2200, h: 1600 };

function Measurement({ x1, y1, x2, y2, big = false, color = "#0A0A0A" }) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const nx = -dy / (len || 1), ny = dx / (len || 1);
  const off = big ? 38 : 24;
  const lx = mx + nx * off, ly = my + ny * off;
  const fs = big ? 28 : 18;
  const padY = big ? 14 : 9;
  const padX = big ? 32 : 20;
  const txt = `${(len / 100).toFixed(2)} m`;
  return (
    <g pointerEvents="none">
      <line x1={mx} y1={my} x2={lx} y2={ly} stroke={color} strokeWidth={big ? 1.5 : 1} strokeDasharray="3,3" opacity="0.6" />
      <rect x={lx - padX} y={ly - padY} width={padX * 2} height={padY * 2} rx={6} fill="white" stroke={color} strokeWidth={big ? 2.5 : 1.5} opacity={0.97} />
      <text x={lx} y={ly + 6} textAnchor="middle" fontSize={fs} fontFamily="JetBrains Mono" fontWeight="800" fill={color}>{txt}</text>
    </g>
  );
}

// Impianti symbol renderers
function ElectricalSymbol({ e, isSel }) {
  const c = isSel ? "#2563EB" : "#7C3AED";
  if (e.type === "quadro" || e.type === "quadro-elettrico") {
    return <g><rect x={-22} y={-15} width={44} height={30} fill="white" stroke={c} strokeWidth="2" /><text x={0} y={5} fontSize="13" textAnchor="middle" fontWeight="900" fill={c}>Q</text><text x={0} y={28} fontSize="8" textAnchor="middle" fontFamily="JetBrains Mono" fontWeight="700" fill={c}>QUADRO</text></g>;
  }
  if (e.type === "scatola") {
    return <g><rect x={-10} y={-10} width={20} height={20} fill="white" stroke={c} strokeWidth="1.5" strokeDasharray="2,2" /><text x={0} y={4} fontSize="9" textAnchor="middle" fontWeight="700" fill={c}>D</text></g>;
  }
  if (e.type === "presa") {
    return <g><circle cx={0} cy={0} r={12} fill="white" stroke={c} strokeWidth="2" /><line x1={-4} y1={-4} x2={-4} y2={4} stroke={c} strokeWidth="2" /><line x1={4} y1={-4} x2={4} y2={4} stroke={c} strokeWidth="2" /><text x={0} y={22} fontSize="8" textAnchor="middle" fontFamily="JetBrains Mono" fontWeight="700" fill={c}>PRESA</text></g>;
  }
  if (e.type === "interruttore") {
    return <g><circle cx={0} cy={0} r={10} fill="white" stroke={c} strokeWidth="2" /><line x1={-4} y1={4} x2={4} y2={-4} stroke={c} strokeWidth="2" /><text x={0} y={20} fontSize="8" textAnchor="middle" fontFamily="JetBrains Mono" fontWeight="700" fill={c}>INT</text></g>;
  }
  if (e.type === "luce" || e.type === "punto-luce") {
    return <g><circle cx={0} cy={0} r={12} fill="white" stroke={c} strokeWidth="2" /><line x1={-8} y1={-8} x2={8} y2={8} stroke={c} strokeWidth="1.5" /><line x1={-8} y1={8} x2={8} y2={-8} stroke={c} strokeWidth="1.5" /><text x={0} y={22} fontSize="8" textAnchor="middle" fontFamily="JetBrains Mono" fontWeight="700" fill={c}>LUCE</text></g>;
  }
  return null;
}

function PlumbingSymbol({ p, isSel }) {
  if (p.type === "punto-completo" || p.type === "acqua-completo") {
    // Composite: 3 cerchi affiancati
    const cF = isSel ? "#2563EB" : "#0EA5E9";
    const cC = isSel ? "#2563EB" : "#DC2626";
    const cS = isSel ? "#2563EB" : "#0891B2";
    const items = [];
    if (p.has_fredda !== false) items.push({ c: cF, lbl: "F" });
    if (p.has_calda !== false) items.push({ c: cC, lbl: "C" });
    if (p.has_scarico !== false) items.push({ c: cS, lbl: "S" });
    const N = items.length || 3;
    const W = 30;
    const startX = -((N - 1) * W) / 2;
    return (
      <g>
        {items.map((it, i) => (
          <g key={i} transform={`translate(${startX + i * W}, 0)`}>
            <circle cx={0} cy={0} r={11} fill="white" stroke={it.c} strokeWidth="2" />
            <text x={0} y={4} fontSize="11" textAnchor="middle" fontWeight="900" fill={it.c}>{it.lbl}</text>
          </g>
        ))}
        <text x={0} y={26} fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono" fontWeight="700" fill="#525252">PUNTO ACQUA</text>
      </g>
    );
  }
  const c = isSel ? "#2563EB" : (p.type === "scarico" ? "#0891B2" : (p.type === "acqua-calda" ? "#DC2626" : "#0EA5E9"));
  const lbl = p.type === "scarico" ? "SCARICO" : (p.type === "acqua-calda" ? "C. CALDA" : "C. FREDDA");
  const sym = p.type === "scarico" ? "S" : (p.type === "acqua-calda" ? "C" : "F");
  return (
    <g>
      <circle cx={0} cy={0} r={12} fill="white" stroke={c} strokeWidth="2" />
      <text x={0} y={5} fontSize="13" textAnchor="middle" fontWeight="900" fill={c}>{sym}</text>
      <text x={0} y={24} fontSize="8" textAnchor="middle" fontFamily="JetBrains Mono" fontWeight="700" fill={c}>{lbl}</text>
    </g>
  );
}

function GasSymbol({ g, isSel }) {
  const c = isSel ? "#2563EB" : "#EAB308";
  return (
    <g>
      {/* Background contrast halo */}
      <circle cx={0} cy={0} r={16} fill="#FEF9C3" stroke={c} strokeWidth="2.5" />
      {/* Inner flame icon */}
      <text x={0} y={3} fontSize="14" textAnchor="middle" fontWeight="900" fill={c}>G</text>
      {/* Label below for prints */}
      <text x={0} y={28} fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono" fontWeight="700" fill="#854D0E">GAS</text>
    </g>
  );
}

function HvacSymbol({ h, isSel }) {
  const c = isSel ? "#2563EB" : "#0F766E";
  const t = h.type || "split";
  if (t === "esterna" || t === "ue") {
    return <g><rect x={-22} y={-14} width={44} height={28} fill="white" stroke={c} strokeWidth="1.5" /><text x={0} y={4} fontSize="9" textAnchor="middle" fontWeight="700" fill={c}>UE</text></g>;
  }
  if (t === "caldaia") {
    return <g>
      <rect x={-22} y={-22} width={44} height={44} rx={2} fill="#FEF3C7" stroke="#B91C1C" strokeWidth="1.5" />
      <circle cx={0} cy={-4} r={5} fill="#B91C1C" />
      <text x={0} y={16} fontSize="8" textAnchor="middle" fontWeight="700" fill="#B91C1C">CALDAIA</text>
    </g>;
  }
  if (t === "pompa-calore") {
    return <g>
      <rect x={-26} y={-16} width={52} height={32} rx={3} fill="#DBEAFE" stroke="#1D4ED8" strokeWidth="1.5" />
      <text x={0} y={4} fontSize="8" textAnchor="middle" fontWeight="700" fill="#1D4ED8">P.CALORE</text>
    </g>;
  }
  if (t === "scaldabagno") {
    return <g>
      <circle cx={0} cy={0} r={14} fill="#FEE2E2" stroke="#B91C1C" strokeWidth="1.5" />
      <text x={0} y={3} fontSize="8" textAnchor="middle" fontWeight="700" fill="#B91C1C">SB</text>
      <text x={0} y={22} fontSize="7" textAnchor="middle" fill="#B91C1C">SCALDABAGNO</text>
    </g>;
  }
  if (t === "vmc") {
    return <g>
      <rect x={-20} y={-12} width={40} height={24} fill="#E0E7FF" stroke="#4338CA" strokeWidth="1.5" />
      <text x={0} y={3} fontSize="8" textAnchor="middle" fontWeight="700" fill="#4338CA">VMC</text>
    </g>;
  }
  if (t === "fotovoltaico") {
    return <g>
      <rect x={-22} y={-14} width={44} height={28} fill="#1E293B" stroke="#0F172A" strokeWidth="1.5" />
      {[-10,0,10].map(x => [-7,7].map(y => <rect key={`${x},${y}`} x={x-4} y={y-4} width={8} height={8} fill="#3B82F6" stroke="#0F172A" strokeWidth="0.5" />))}
      <text x={0} y={26} fontSize="7" textAnchor="middle" fontWeight="700" fill="#0F172A">FV</text>
    </g>;
  }
  if (t === "termoarredo") {
    return <g>
      <rect x={-8} y={-20} width={16} height={40} fill="white" stroke="#7C3AED" strokeWidth="1.5" />
      {[-14,-7,0,7,14].map(y => <line key={y} x1={-8} y1={y} x2={8} y2={y} stroke="#7C3AED" strokeWidth="0.6" />)}
      <text x={0} y={32} fontSize="7" textAnchor="middle" fontWeight="700" fill="#7C3AED">TERMOA.</text>
    </g>;
  }
  if (t === "termosifone" || t === "radiatore") {
    return <g>
      <rect x={-22} y={-7} width={44} height={14} fill="white" stroke={c} strokeWidth="1.5" />
      {[-16,-8,0,8,16].map(x => <line key={x} x1={x} y1={-7} x2={x} y2={7} stroke={c} strokeWidth="0.6" />)}
      <text x={0} y={18} fontSize="7" textAnchor="middle" fontWeight="700" fill={c}>RADIAT.</text>
    </g>;
  }
  if (t === "canalizzato") {
    return <g>
      <rect x={-32} y={-10} width={64} height={20} rx={3} fill="white" stroke={c} strokeWidth="1.5" strokeDasharray="3,2" />
      <text x={0} y={4} fontSize="9" textAnchor="middle" fontWeight="700" fill={c}>CANALIZZ.</text>
    </g>;
  }
  if (t === "dual-split") {
    return <g><rect x={-32} y={-9} width={64} height={18} rx={3} fill="white" stroke={c} strokeWidth="1.5" /><text x={0} y={4} fontSize="10" textAnchor="middle" fontWeight="700" fill={c}>DUAL SPL.</text></g>;
  }
  if (t === "trial-split") {
    return <g><rect x={-34} y={-9} width={68} height={18} rx={3} fill="white" stroke={c} strokeWidth="1.5" /><text x={0} y={4} fontSize="10" textAnchor="middle" fontWeight="700" fill={c}>TRIAL SPL.</text></g>;
  }
  if (t === "quadri-split") {
    return <g><rect x={-36} y={-9} width={72} height={18} rx={3} fill="white" stroke={c} strokeWidth="1.5" /><text x={0} y={4} fontSize="10" textAnchor="middle" fontWeight="700" fill={c}>QUADRI SPL.</text></g>;
  }
  // default split
  return <g><rect x={-30} y={-9} width={60} height={18} rx={3} fill="white" stroke={c} strokeWidth="1.5" /><text x={0} y={4} fontSize="10" textAnchor="middle" fontWeight="700" fill={c}>SPLIT</text></g>;
}

// Stair symbol renderer (chiocciola/muratura/legno)
function StairSymbol({ s, isSel }) {
  const c = isSel ? "#2563EB" : "#92400E";
  const w = s.width || 100, d = s.depth || 200;
  if (s.type === "chiocciola") {
    // Spirale circolare con gradini radiali
    const r = Math.min(w, d) / 2;
    const steps = 12;
    return (
      <g>
        <circle cx={0} cy={0} r={r} fill="white" stroke={c} strokeWidth="1.5" />
        <circle cx={0} cy={0} r={r * 0.25} fill={c} opacity="0.2" stroke={c} strokeWidth="1" />
        {Array.from({ length: steps }).map((_, i) => {
          const ang = (i * 2 * Math.PI) / steps;
          return <line key={i} x1={Math.cos(ang) * r * 0.25} y1={Math.sin(ang) * r * 0.25} x2={Math.cos(ang) * r} y2={Math.sin(ang) * r} stroke={c} strokeWidth="0.8" />;
        })}
        <text x={0} y={r + 16} textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono" fontWeight="700" fill={c}>SCALA CHIOCCIOLA</text>
      </g>
    );
  }
  // Rampa rettangolare con gradini
  const stepCount = Math.max(6, Math.floor(d / 25));
  const stepDepth = d / stepCount;
  const fillCol = s.type === "legno" ? "#FBBF24" : (s.type === "muratura" ? "#D6D3D1" : "#FEF3C7");
  return (
    <g>
      <rect x={-w / 2} y={-d / 2} width={w} height={d} fill={fillCol} fillOpacity="0.4" stroke={c} strokeWidth="1.5" />
      {Array.from({ length: stepCount }).map((_, i) => (
        <line key={i} x1={-w / 2} y1={-d / 2 + i * stepDepth} x2={w / 2} y2={-d / 2 + i * stepDepth} stroke={c} strokeWidth="0.8" />
      ))}
      {/* freccia salita */}
      <line x1={0} y1={d / 2 - 8} x2={0} y2={-d / 2 + 12} stroke={c} strokeWidth="2" />
      <polygon points={`0,${-d / 2 + 12} -6,${-d / 2 + 22} 6,${-d / 2 + 22}`} fill={c} />
      <text x={0} y={d / 2 + 14} textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono" fontWeight="700" fill={c}>SCALA · {(s.type || "muratura").toUpperCase()}</text>
    </g>
  );
}

function TilingPattern({ t, room }) {
  if (!room) return null;
  const sizes = { "30x60": [30, 60], "60x60": [60, 60], "60x120": [60, 120], "80x80": [80, 80], "22.5x90": [22.5, 90], "25x150": [25, 150] };
  const [tw, th] = sizes[t.size] || [60, 60];
  const angle = t.angle || 0;
  const rad = angle * Math.PI / 180;
  const cosA = Math.cos(rad), sinA = Math.sin(rad);
  const sx = t.startPoint?.x ?? room.points[0].x;
  const sy = t.startPoint?.y ?? room.points[0].y;
  // bounding box of room
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  room.points.forEach((p) => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
  const tiles = [];
  const cols = Math.ceil((maxX - minX + 200) / Math.min(tw, th));
  const rows = Math.ceil((maxY - minY + 200) / Math.min(tw, th));
  for (let i = -cols; i < cols; i++) {
    for (let j = -rows; j < rows; j++) {
      const lx = i * tw, ly = j * th;
      // rotate corners
      const corners = [[lx, ly], [lx + tw, ly], [lx + tw, ly + th], [lx, ly + th]].map(([x, y]) => ({
        x: sx + x * cosA - y * sinA,
        y: sy + x * sinA + y * cosA,
      }));
      // include if center inside polygon
      const cx = (corners[0].x + corners[2].x) / 2;
      const cy = (corners[0].y + corners[2].y) / 2;
      if (pointInPolygon({ x: cx, y: cy }, room.points)) {
        tiles.push(corners);
      }
    }
  }
  const clipId = `clip-${room.id}`;
  return (
    <g pointerEvents="none">
      <defs>
        <clipPath id={clipId}>
          <polygon points={room.points.map((p) => `${p.x},${p.y}`).join(" ")} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {tiles.map((c, i) => (
          <polygon key={i} points={c.map((q) => `${q.x},${q.y}`).join(" ")} fill="#FAFAF9" fillOpacity="0.55" stroke="#525252" strokeWidth="1.2" />
        ))}
      </g>
      {/* start point marker */}
      <circle cx={sx} cy={sy} r={7} fill="#16A34A" stroke="white" strokeWidth="2.5" />
    </g>
  );
}

export default function Canvas2D({
  project, setProject, tool, setTool, selected, setSelected,
  selectedMaterial, catalog,
  doorParams, windowParams, electricalKind, plumbingKind, gasKind, hvacKind, tilingParams, stairsKind,
  layers, viewMode, autoFit,
}) {
  const svgRef = useRef(null);
  const [wallDraft, setWallDraft] = useState(null);
  const [roomDraft, setRoomDraft] = useState([]);
  const [demoAreaDraft, setDemoAreaDraft] = useState([]);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [viewBox, setViewBox] = useState(INITIAL_VIEW);
  const [pan, setPan] = useState(null);
  const [drag, setDrag] = useState(null); // {kind, id, sub?: 'p1'|'p2'|'t'|'pos', start:{x,y}, orig}
  const pendingRoomClickRef = useRef(null);
  const pendingWallClickRef = useRef(null);

  // AUTO-FIT viewBox: per le tavole di anteprima/PDF, calcola un bbox attorno a tutto il contenuto
  // e usa quello come viewBox (così non viene tagliato nemmeno se il progetto è grande).
  const computedViewBox = useMemo(() => {
    if (!autoFit || !project) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const include = (x, y) => { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; };
    (project.rooms || []).forEach((r) => (r.points || []).forEach((p) => include(p.x, p.y)));
    (project.walls || []).forEach((w) => { include(w.x1, w.y1); include(w.x2, w.y2); });
    (project.electrical || []).forEach((e) => include(e.x, e.y));
    (project.plumbing || []).forEach((p) => include(p.x, p.y));
    (project.gas || []).forEach((g) => include(g.x, g.y));
    (project.hvac || []).forEach((h) => include(h.x, h.y));
    if (!isFinite(minX)) return null;
    // Pad per quote/etichette
    const PAD = 220;
    return { x: minX - PAD, y: minY - PAD, w: (maxX - minX) + PAD * 2, h: (maxY - minY) + PAD * 2 };
  }, [autoFit, project]);
  const effectiveViewBox = computedViewBox || viewBox;

  const catalogById = useMemo(() => Object.fromEntries((catalog || []).map((m) => [m.id, m])), [catalog]);

  const L = layers || { walls: true, doors: true, windows: true, rooms: true, items: true, electrical: true, plumbing: true, gas: true, hvac: true, demolitions: true, tiling: true, dimensions: true, floors: true };
  const VM = viewMode || "progetto"; // "fatto" | "progetto" | "demolizioni" | "costruzioni"

  useEffect(() => () => {
    if (pendingRoomClickRef.current) clearTimeout(pendingRoomClickRef.current);
    if (pendingWallClickRef.current) clearTimeout(pendingWallClickRef.current);
  }, []);

  // Cambio di tool: reset di tutti i draft pendenti per evitare di creare elementi fantasma
  // (es. l'utente passa da "wall" a "tiling" e un click pendente del wallDraft creava muri inattesi).
  useEffect(() => {
    if (pendingWallClickRef.current) { clearTimeout(pendingWallClickRef.current); pendingWallClickRef.current = null; }
    if (pendingRoomClickRef.current) { clearTimeout(pendingRoomClickRef.current); pendingRoomClickRef.current = null; }
    setWallDraft(null);
    setRoomDraft([]);
    setDemoAreaDraft([]);
  }, [tool]);

  const toWorld = useCallback((evt) => {
    const svg = svgRef.current; if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  const snapPt = (p) => ({ x: snap(p.x, GRID), y: snap(p.y, GRID) });

  const onMouseMove = (e) => {
    const p = snapPt(toWorld(e));
    setCursor(p);
    if (pan) {
      const dx = (e.clientX - pan.sx) * (viewBox.w / svgRef.current.clientWidth);
      const dy = (e.clientY - pan.sy) * (viewBox.h / svgRef.current.clientHeight);
      setViewBox({ ...pan.vb, x: pan.vb.x - dx, y: pan.vb.y - dy });
    }
    if (drag) {
      const startPt = drag.start || p;
      const dx = p.x - startPt.x, dy = p.y - startPt.y;
      if (drag.kind === "wall-end") {
        // drag wall endpoint p1 or p2
        setProject((prj) => ({
          ...prj,
          walls: (prj.walls || []).map((w) => {
            if (w.id !== drag.id) return w;
            if (drag.sub === "p1") return { ...w, x1: drag.orig.x1 + dx, y1: drag.orig.y1 + dy };
            return { ...w, x2: drag.orig.x2 + dx, y2: drag.orig.y2 + dy };
          }),
        }));
      } else if (drag.kind === "door-t" || drag.kind === "window-t") {
        // drag door/window along its wall
        const arrKey = drag.kind === "door-t" ? "doors" : "windows";
        setProject((prj) => {
          const arr = prj[arrKey] || [];
          const item = arr.find((x) => x.id === drag.id);
          if (!item) return prj;
          const w = (prj.walls || []).find((ww) => ww.id === item.wallId);
          if (!w) return prj;
          const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1;
          const dirX = (w.x2 - w.x1) / len, dirY = (w.y2 - w.y1) / len;
          const proj = ((p.x - w.x1) * dirX + (p.y - w.y1) * dirY) / len;
          const tNew = Math.max(0.05, Math.min(0.95, proj));
          return { ...prj, [arrKey]: arr.map((x) => x.id === drag.id ? { ...x, t: tNew } : x) };
        });
      } else if (drag.kind === "item-pos" || drag.kind === "elec-pos" || drag.kind === "plumb-pos" || drag.kind === "gas-pos" || drag.kind === "hvac-pos" || drag.kind === "text-pos" || drag.kind === "stairs-pos") {
        const arrKey = drag.kind === "item-pos" ? "items" : drag.kind === "elec-pos" ? "electrical" : drag.kind === "plumb-pos" ? "plumbing" : drag.kind === "gas-pos" ? "gas" : drag.kind === "hvac-pos" ? "hvac" : drag.kind === "stairs-pos" ? "stairs" : "texts";
        setProject((prj) => ({
          ...prj,
          [arrKey]: (prj[arrKey] || []).map((x) => x.id === drag.id ? { ...x, x: drag.orig.x + dx, y: drag.orig.y + dy } : x),
        }));
      } else if (drag.kind === "demo-partial-drag") {
        // Trascina lungo il muro per estendere la zona demolita
        setProject((prj) => {
          const w = (prj.walls || []).find((ww) => ww.id === drag.id);
          if (!w) return prj;
          const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1;
          const dirX = (w.x2 - w.x1) / len, dirY = (w.y2 - w.y1) / len;
          const proj = ((p.x - w.x1) * dirX + (p.y - w.y1) * dirY) / len;
          const tNow = Math.max(0, Math.min(1, proj));
          const fromT = Math.min(drag.startT, tNow);
          const toT = Math.max(drag.startT, tNow);
          return { ...prj, walls: (prj.walls || []).map((x) => x.id === drag.id ? { ...x, demolito_partial: { ...(x.demolito_partial || { height: prj.roomHeight || 270 }), from: fromT, to: toT } } : x) };
        });
      } else if (drag.kind === "demo-handle") {
        // Drag di una delle maniglie (from/to) di una demolizione parziale esistente
        setProject((prj) => {
          const w = (prj.walls || []).find((ww) => ww.id === drag.id);
          if (!w) return prj;
          const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1;
          const dirX = (w.x2 - w.x1) / len, dirY = (w.y2 - w.y1) / len;
          const proj = ((p.x - w.x1) * dirX + (p.y - w.y1) * dirY) / len;
          const tNow = Math.max(0, Math.min(1, proj));
          const partial = w.demolito_partial || { from: 0, to: 0, height: prj.roomHeight || 270 };
          let from = partial.from, to = partial.to;
          if (drag.side === "from") from = Math.min(tNow, partial.to);
          else to = Math.max(tNow, partial.from);
          return { ...prj, walls: (prj.walls || []).map((x) => x.id === drag.id ? { ...x, demolito_partial: { ...partial, from, to } } : x) };
        });
      }
    }
  };
  const stopDrag = () => {
    if (drag?.kind === "demo-partial-drag") {
      // Switch to select per consentire il refining via pannello proprietà
      setTool("select");
    }
    if (drag) setDrag(null);
    setPan(null);
  };

  const findRoomAt = (p) => {
    const rooms = project.rooms || [];
    return rooms.find((r) => pointInPolygon(p, r.points));
  };

  const placeDoorOrWindow = (p) => {
    const walls = project.walls || [];
    let best = null; let bestD = 1e9;
    walls.forEach((w) => {
      const t = projectPointOnSegment(p, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
      const cx = w.x1 + t.t * (w.x2 - w.x1);
      const cy = w.y1 + t.t * (w.y2 - w.y1);
      const d = Math.hypot(cx - p.x, cy - p.y);
      if (d < bestD) { bestD = d; best = { w, t: t.t }; }
    });
    if (best && bestD < 80) {
      if (tool === "door") {
        const dp = doorParams || { width: 80, height: 210, type: "interna" };
        const op = { id: uid(), wallId: best.w.id, t: best.t, width: dp.width || 80, height: dp.height || 210, type: dp.type || "interna", hinge: dp.hinge || "left", swing: dp.swing || "in", phase: VM };
        setProject((prj) => ({ ...prj, doors: [...(prj.doors || []), op] }));
      } else {
        const wp = windowParams || { width: 120, height: 140, sillHeight: 90, type: "finestra", material: "pvc" };
        const op = { id: uid(), wallId: best.w.id, t: best.t, width: wp.width || 120, height: wp.height || 140, sillHeight: wp.sillHeight ?? 90, type: wp.type || "finestra", material: wp.material || "pvc", hinge: wp.hinge || "left", swing: wp.swing || "in", phase: VM };
        setProject((prj) => ({ ...prj, windows: [...(prj.windows || []), op] }));
      }
    }
  };

  const onMouseDown = (e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setPan({ sx: e.clientX, sy: e.clientY, vb: { ...viewBox } });
      return;
    }
    const p = snapPt(toWorld(e));

    if (tool === "wall") {
      if (e.detail >= 2) return;
      if (pendingWallClickRef.current) clearTimeout(pendingWallClickRef.current);
      pendingWallClickRef.current = setTimeout(() => {
        pendingWallClickRef.current = null;
        if (!wallDraft) { setWallDraft(p); return; }
        if (Math.hypot(p.x - wallDraft.x, p.y - wallDraft.y) < 8) { setWallDraft(null); return; }
        const newWall = { id: uid(), x1: wallDraft.x, y1: wallDraft.y, x2: p.x, y2: p.y, thickness: 10, kind: VM === "fatto" ? "esistente" : "nuovo", phase: VM };
        setProject((prj) => applyWallAddWithSplit(prj, newWall));
        setWallDraft(p);
      }, 230);
      return;
    }
    if (tool === "wall-cartongesso") {
      if (e.detail >= 2) return;
      if (pendingWallClickRef.current) clearTimeout(pendingWallClickRef.current);
      pendingWallClickRef.current = setTimeout(() => {
        pendingWallClickRef.current = null;
        if (!wallDraft) { setWallDraft(p); return; }
        if (Math.hypot(p.x - wallDraft.x, p.y - wallDraft.y) < 8) { setWallDraft(null); return; }
        const newWall = { id: uid(), x1: wallDraft.x, y1: wallDraft.y, x2: p.x, y2: p.y, thickness: 8, kind: "cartongesso", phase: VM };
        setProject((prj) => applyWallAddWithSplit(prj, newWall));
        setWallDraft(p);
      }, 230);
      return;
    }
    if (tool === "room") {
      if (e.detail >= 2) return;
      if (pendingRoomClickRef.current) clearTimeout(pendingRoomClickRef.current);
      pendingRoomClickRef.current = setTimeout(() => {
        pendingRoomClickRef.current = null;
        setRoomDraft((arr) => {
          const last = arr[arr.length - 1];
          if (last && Math.hypot(p.x - last.x, p.y - last.y) < 8) return arr;
          return [...arr, p];
        });
      }, 230);
      return;
    }
    if (tool === "door" || tool === "window") {
      placeDoorOrWindow(p);
      return;
    }
    if (tool === "demolish-wall") {
      // demolisci muro: click vicino ad un muro lo segna come demolito (TOTALE).
      // Per demolizione parziale usa il pannello proprietà (selettore Da/A/Altezza).
      const walls = project.walls || [];
      let best = null, bestD = 1e9;
      walls.forEach((w) => {
        const t = projectPointOnSegment(p, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
        const cx = w.x1 + t.t * (w.x2 - w.x1);
        const cy = w.y1 + t.t * (w.y2 - w.y1);
        const d = Math.hypot(cx - p.x, cy - p.y);
        if (d < bestD) { bestD = d; best = w; }
      });
      if (best && bestD < 30) {
        setProject((prj) => ({ ...prj, walls: (prj.walls || []).map((x) => x.id === best.id ? { ...x, demolito: !x.demolito } : x) }));
      }
      return;
    }
    if (tool === "demolish-wall-partial") {
      // click vicino al muro → seleziona il muro e attiva pannello proprietà per demolizione parziale
      const walls = project.walls || [];
      let best = null, bestD = 1e9;
      walls.forEach((w) => {
        const t = projectPointOnSegment(p, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
        const cx = w.x1 + t.t * (w.x2 - w.x1);
        const cy = w.y1 + t.t * (w.y2 - w.y1);
        const d = Math.hypot(cx - p.x, cy - p.y);
        if (d < bestD) { bestD = d; best = { w, tHit: t.t }; }
      });
      if (best && bestD < 30) {
        // Inizializza un drag per definire l'estensione della demolizione: from = tHit, to = tHit
        // Su mousemove l'utente "trascina" lungo il muro per allargare la zona; al rilascio commit
        const W = best.w;
        setProject((prj) => ({ ...prj, walls: (prj.walls || []).map((x) => x.id === W.id ? { ...x, demolito_partial: { from: best.tHit, to: best.tHit, height: prj.roomHeight || 270 } } : x) }));
        setSelected({ kind: "walls", id: W.id });
        setDrag({ kind: "demo-partial-drag", id: W.id, startT: best.tHit, start: p });
      }
      return;
    }
    if (tool === "demolish-floor") {
      const r = findRoomAt(p);
      if (r) {
        const areaM2 = polygonArea(r.points) / 10000;
        // toggle: se esiste già una demolizione pavimento per questa stanza, la rimuovo
        const existing = (project.demolitions || []).find((d) => d.kind === "pavimento" && d.roomId === r.id);
        if (existing) {
          setProject((prj) => ({ ...prj, demolitions: (prj.demolitions || []).filter((d) => d.id !== existing.id) }));
        } else {
          setProject((prj) => ({
            ...prj,
            demolitions: [...(prj.demolitions || []), { id: uid(), kind: "pavimento", x: p.x, y: p.y, roomId: r.id, areaM2, partial: false, phase: "progetto" }],
          }));
        }
      }
      return;
    }
    if (tool === "demolish-floor-partial") {
      // demolizione pavimento ad AREA: disegna un poligono con click multipli, doppio click chiude
      if (e.detail >= 2) return;
      setDemoAreaDraft((arr) => {
        const last = arr[arr.length - 1];
        if (last && Math.hypot(p.x - last.x, p.y - last.y) < 8) return arr;
        return [...arr, p];
      });
      return;
    }
    if (tool === "controsoffitto-area") {
      // Controsoffitto AD AREA: disegna un poligono con click multipli, doppio click chiude
      if (e.detail >= 2) return;
      setDemoAreaDraft((arr) => {
        const last = arr[arr.length - 1];
        if (last && Math.hypot(p.x - last.x, p.y - last.y) < 8) return arr;
        return [...arr, p];
      });
      return;
    }
    if (tool === "package-area") {
      // Disegna l'area su cui calcolare il pacchetto: poligono libero, doppio click chiude.
      if (e.detail >= 2) return;
      setDemoAreaDraft((arr) => {
        const last = arr[arr.length - 1];
        if (last && Math.hypot(p.x - last.x, p.y - last.y) < 8) return arr;
        return [...arr, p];
      });
      return;
    }
    if (tool === "demolish-rivestimento") {
      // Click vicino al muro più prossimo: crea una demolizione rivestimento ZONA da ridefinire nel pannello proprietà.
      const walls = project.walls || [];
      let best = null, bestD = 1e9;
      walls.forEach((w) => {
        const t = projectPointOnSegment(p, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
        const cx = w.x1 + t.t * (w.x2 - w.x1);
        const cy = w.y1 + t.t * (w.y2 - w.y1);
        const d = Math.hypot(cx - p.x, cy - p.y);
        if (d < bestD) { bestD = d; best = { w, tHit: t.t }; }
      });
      if (best && bestD < 50) {
        const w = best.w;
        const lenCm = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
        // default: demolizione sull'intera larghezza, dal pavimento (h_from=0) per 200cm
        const xFromCm = 0;
        const xToCm = Math.round(lenCm);
        const hFromCm = 0;
        const hToCm = 200;
        const areaM2 = ((xToCm - xFromCm) / 100) * ((hToCm - hFromCm) / 100);
        const newId = uid();
        setProject((prj) => ({
          ...prj,
          demolitions: [...(prj.demolitions || []), {
            id: newId, kind: "rivestimento", x: p.x, y: p.y,
            wallId: w.id, areaM2,
            xFromCm, xToCm, hFromCm, hToCm,
            heightCm: hToCm - hFromCm,
            phase: "progetto",
          }],
        }));
        setSelected({ kind: "demolitions", id: newId });
        if (typeof window !== "undefined" && window.console) console.info("Demolizione rivestimento creata: regola posizione e dimensioni nel pannello a destra");
      }
      return;
    }
    if (tool === "controsoffitto") {
      const r = findRoomAt(p);
      if (r) {
        const isFattoRoom = (r.phase || "fatto") === "fatto";
        if (VM === "progetto" && isFattoRoom) {
          // In modalità Progetto su stanza fatto: usa override progetto.controsoffitto
          setProject((prj) => ({
            ...prj,
            rooms: (prj.rooms || []).map((x) => x.id === r.id ? { ...x, progetto: { ...(x.progetto || {}), controsoffitto: !((x.progetto || {}).controsoffitto) } } : x),
          }));
        } else {
          // In modalità Fatto o stanza progetto: modifica diretta
          setProject((prj) => ({
            ...prj,
            rooms: (prj.rooms || []).map((x) => x.id === r.id ? { ...x, controsoffitto: !x.controsoffitto } : x),
          }));
        }
      }
      return;
    }
    if (tool === "electrical") {
      const kind = electricalKind || "presa";
      setProject((prj) => ({ ...prj, electrical: [...(prj.electrical || []), { id: uid(), type: kind, x: p.x, y: p.y, phase: VM }] }));
      return;
    }
    if (tool === "plumbing") {
      const kind = plumbingKind || "acqua-fredda";
      const extra = (kind === "punto-completo")
        ? { has_fredda: true, has_calda: true, has_scarico: true }
        : {};
      setProject((prj) => ({ ...prj, plumbing: [...(prj.plumbing || []), { id: uid(), type: kind, x: p.x, y: p.y, phase: VM, ...extra }] }));
      return;
    }
    if (tool === "gas") {
      setProject((prj) => ({ ...prj, gas: [...(prj.gas || []), { id: uid(), x: p.x, y: p.y, phase: VM }] }));
      return;
    }
    if (tool === "hvac") {
      const kind = hvacKind || "split";
      // Multi-split: quadri = 4 split, trial = 3 split, dual = 2 split. Posiziona uno alla volta.
      // Conta gli split già piazzati appartenenti al gruppo corrente (group_id condiviso)
      if (kind === "trial-split" || kind === "dual-split" || kind === "quadri-split") {
        const expected = kind === "quadri-split" ? 4 : (kind === "trial-split" ? 3 : 2);
        const labelPrefix = kind === "quadri-split" ? "Quadri" : (kind === "trial-split" ? "Trial" : "Dual");
        // Reset gruppo se ultimo gruppo è completo o non esiste
        const groupId = (() => {
          const all = (project.hvac || []).filter(h => h.group_kind === kind && h.phase === VM);
          if (all.length === 0) return uid();
          // raggruppa per group_id e prendi il più recente
          const lastGid = all[all.length - 1].group_id;
          const sameGroup = all.filter(h => h.group_id === lastGid);
          if (sameGroup.length >= expected + 1) return uid(); // +1 per UE
          return lastGid || uid();
        })();
        setProject((prj) => {
          const sameGroup = (prj.hvac || []).filter(h => h.group_id === groupId);
          const has_ue = sameGroup.some(h => h.type === "esterna");
          const splitsCount = sameGroup.filter(h => h.type === "split").length;
          // Primo click: crea UE
          if (!has_ue) {
            return { ...prj, hvac: [...(prj.hvac || []), { id: uid(), type: "esterna", x: p.x, y: p.y, phase: VM, group_id: groupId, group_kind: kind, group_label: `${labelPrefix} - UE` }] };
          }
          // Click successivi: aggiungi split (fino a expected)
          if (splitsCount < expected) {
            return { ...prj, hvac: [...(prj.hvac || []), { id: uid(), type: "split", x: p.x, y: p.y, phase: VM, group_id: groupId, group_kind: kind, group_label: `${labelPrefix} - Split ${splitsCount + 1}/${expected}` }] };
          }
          return prj;
        });
        return;
      }
      // Single placement (split/canalizzato/caldaia/etc.)
      setProject((prj) => ({ ...prj, hvac: [...(prj.hvac || []), { id: uid(), type: kind, x: p.x, y: p.y, phase: VM }] }));
      return;
    }
    if (tool === "text") {
      const txt = window.prompt("Testo da inserire sulla pianta:", "");
      if (txt && txt.trim()) {
        setProject((prj) => ({ ...prj, texts: [...(prj.texts || []), { id: uid(), text: txt.trim(), x: p.x, y: p.y, fontSize: 14, color: "#0A0A0A" }] }));
      }
      return;
    }
    if (tool === "stairs") {
      const kind = stairsKind || "muratura";
      const presets = { chiocciola: { width: 160, depth: 160 }, muratura: { width: 100, depth: 280 }, legno: { width: 90, depth: 240 } };
      const sz = presets[kind] || presets.muratura;
      setProject((prj) => ({ ...prj, stairs: [...(prj.stairs || []), { id: uid(), type: kind, x: p.x, y: p.y, rotation: 0, width: sz.width, depth: sz.depth, phase: VM }] }));
      return;
    }
    if (tool === "tiling") {
      const r = findRoomAt(p);
      if (r) {
        const tp = tilingParams || { size: "60x60", angle: 0 };
        setProject((prj) => ({
          ...prj,
          tiling: [...(prj.tiling || []).filter((x) => x.roomId !== r.id), { id: uid(), roomId: r.id, size: tp.size, angle: tp.angle, startPoint: p, voceId: tp.voceId || null, vocePrice: tp.vocePrice || 0, voceName: tp.voceName || "" }],
        }));
      }
      return;
    }
    if (tool === "item" && selectedMaterial) {
      const m = catalogById[selectedMaterial];
      if (!m) return;
      const typeByCat = { furniture: "furniture", fixture: "fixture", appliance: "appliance", light: "light" };
      const t = typeByCat[m.category]; if (!t) return;
      const defaults = defaultItemSize(m);
      setProject((prj) => ({
        ...prj,
        items: [...(prj.items || []), { id: uid(), type: t, materialId: m.id, x: p.x, y: p.y, rotation: 0, qty: 1, phase: VM, ...defaults }],
      }));
      return;
    }
    if (tool === "select") setSelected(null);
  };

  const onDblClick = () => {
    if (tool === "wall" || tool === "wall-cartongesso") {
      if (pendingWallClickRef.current) { clearTimeout(pendingWallClickRef.current); pendingWallClickRef.current = null; }
      setWallDraft(null);
    }
    if (tool === "demolish-floor-partial") {
      if (demoAreaDraft.length >= 3) {
        const poly = demoAreaDraft.slice();
        const areaM2 = polygonArea(poly) / 10000;
        const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
        const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
        // Cerca eventuale stanza che contiene il centroide (per associazione)
        const r = findRoomAt({ x: cx, y: cy });
        setProject((prj) => ({
          ...prj,
          demolitions: [...(prj.demolitions || []), { id: uid(), kind: "pavimento", x: cx, y: cy, roomId: r?.id, areaM2, partial: true, polygon: poly, phase: "progetto" }],
        }));
      }
      setDemoAreaDraft([]);
      return;
    }
    if (tool === "controsoffitto-area") {
      if (demoAreaDraft.length >= 3) {
        const poly = demoAreaDraft.slice();
        const areaM2 = polygonArea(poly) / 10000;
        const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
        const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
        const r = findRoomAt({ x: cx, y: cy });
        setProject((prj) => ({
          ...prj,
          controsoffitti: [...(prj.controsoffitti || []), { id: uid(), x: cx, y: cy, roomId: r?.id, areaM2, polygon: poly, phase: "progetto" }],
        }));
      }
      setDemoAreaDraft([]);
      return;
    }
    if (tool === "package-area") {
      if (demoAreaDraft.length >= 3) {
        const poly = demoAreaDraft.slice();
        setProject((prj) => ({ ...prj, packageArea: { polygon: poly } }));
      }
      setDemoAreaDraft([]);
      setTool("select");
      return;
    }
    if (tool === "room") {
      if (pendingRoomClickRef.current) { clearTimeout(pendingRoomClickRef.current); pendingRoomClickRef.current = null; }
      if (roomDraft.length >= 3) {
        const newWalls = roomDraft.map((pt, i) => {
          const next = roomDraft[(i + 1) % roomDraft.length];
          return { id: uid(), x1: pt.x, y1: pt.y, x2: next.x, y2: next.y, thickness: 10, kind: VM === "fatto" ? "esistente" : "nuovo", phase: VM };
        });
        const newRoom = {
          id: uid(),
          name: `Stanza ${(project.rooms || []).length + 1}`,
          points: roomDraft,
          floorMaterial: "floor-ceramic",
          wallMaterial: "wall-paint",
          ceilingMaterial: "ceil-paint",
          electrical: false,
          plumbing: false,
          phase: VM,
        };
        setProject((prj) => ({
          ...prj,
          rooms: [...(prj.rooms || []), newRoom],
          walls: [...(prj.walls || []), ...newWalls],
        }));
        setRoomDraft([]);
      }
    }
  };

  const onWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    const p = toWorld(e);
    setViewBox({
      x: p.x - (p.x - viewBox.x) * factor,
      y: p.y - (p.y - viewBox.y) * factor,
      w: viewBox.w * factor, h: viewBox.h * factor,
    });
  };

  const handleElementClick = (kind, id) => {
    if (tool === "delete") {
      setProject((prj) => ({ ...prj, [kind]: (prj[kind] || []).filter((x) => x.id !== id) }));
      return;
    }
    setSelected({ kind, id });
  };

  const isPlacementTool = ["door", "window", "wall", "wall-cartongesso", "room", "item", "text", "stairs",
    "demolish-wall", "demolish-wall-partial", "demolish-floor", "demolish-floor-partial", "demolish-rivestimento", "controsoffitto", "controsoffitto-area",
    "electrical", "plumbing", "gas", "hvac", "tiling", "package-area"].includes(tool);

  const allWalls = project.walls || [];
  // Walls visibili sul canvas (filtrati per VM)
  const walls = allWalls.filter((w) => {
    const phase = w.phase || (w.kind === "nuovo" || w.kind === "cartongesso" ? "progetto" : "fatto");
    if (VM === "fatto") return phase === "fatto"; // mostra tutti i muri esistenti, anche cartongesso
    if (VM === "demolizioni") return w.demolito;
    if (VM === "costruzioni") return phase === "progetto"; // tutti i muri di progetto
    // progetto: tutti tranne demoliti
    return !w.demolito;
  });
  // Walls "ghost" (riferimento perimetrale) — visibili come riferimento nelle viste tavole specifiche
  let ghostWalls = [];
  if (VM === "demolizioni") {
    // Demolizioni: mostra i muri NON demoliti (sia fatto che progetto) come riferimento
    ghostWalls = allWalls.filter((w) => !w.demolito);
  } else if (VM === "costruzioni") {
    // Costruzioni: mostra i muri esistenti (fatto) come riferimento del contesto
    ghostWalls = allWalls.filter((w) => {
      const ph = w.phase || "fatto";
      return ph === "fatto" && !w.demolito;
    });
  }
  const allDoors = project.doors || [];
  const allWindows = project.windows || [];
  const validWallIds = new Set(walls.map((w) => w.id));
  // Filtro per phase: in stato fatto vedi solo esistenti, in costruzioni solo progetto, in progetto tutto
  const phaseOK = (el) => {
    const ph = el.phase || "fatto";
    if (VM === "fatto") return ph === "fatto";
    if (VM === "costruzioni") return ph === "progetto";
    return true;
  };
  const doors = allDoors.filter((d) => validWallIds.has(d.wallId) && phaseOK(d));
  const windows = allWindows.filter((d) => validWallIds.has(d.wallId) && phaseOK(d));
  const rooms = (project.rooms || []).filter(phaseOK);
  const items = (project.items || []).filter(phaseOK);
  const electrical = (project.electrical || []).filter(phaseOK);
  const plumbing = (project.plumbing || []).filter(phaseOK);
  const gas = (project.gas || []).filter(phaseOK);
  const hvac = (project.hvac || []).filter(phaseOK);
  const stairs = (project.stairs || []).filter(phaseOK);
  const tiling = project.tiling || [];
  const demolitions = project.demolitions || [];

  return (
    <div className="relative w-full h-full bg-[#FAFAFA]">
      <svg
        ref={svgRef}
        viewBox={`${effectiveViewBox.x} ${effectiveViewBox.y} ${effectiveViewBox.w} ${effectiveViewBox.h}`}
        className="w-full h-full select-none"
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onDoubleClick={onDblClick}
        onWheel={onWheel}
        data-testid="canvas-2d"
      >
        <defs>
          <pattern id="grid-small" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#E4E4E7" strokeWidth="0.3" />
          </pattern>
          <pattern id="grid-big" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#grid-small)" />
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#D4D4D8" strokeWidth="0.6" />
          </pattern>
          <pattern id="hatch-demo" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={14} stroke="#DC2626" strokeWidth="2.5" />
          </pattern>
          <pattern id="hatch-rivest" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(135)">
            <line x1={0} y1={0} x2={0} y2={14} stroke="#F97316" strokeWidth="2" />
          </pattern>
          <pattern id="hatch-controsoff" width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx={6} cy={6} r="1.5" fill="#0F766E" />
          </pattern>
          <pattern id="hatch-new" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line x1={0} y1={0} x2={0} y2={10} stroke="#EAB308" strokeWidth="2" />
          </pattern>
        </defs>
        <rect x={effectiveViewBox.x} y={effectiveViewBox.y} width={effectiveViewBox.w} height={effectiveViewBox.h} fill="url(#grid-big)" pointerEvents="none" />

        {/* QUOTE DIMENSIONALI ESTERNE (stile architettonico) — bbox totale su TUTTI i 4 lati */}
        {L.dimensions && rooms.length > 0 && (() => {
          const allPts = rooms.flatMap((r) => r.points || []);
          if (allPts.length < 2) return null;
          const minX = Math.min(...allPts.map((p) => p.x));
          const maxX = Math.max(...allPts.map((p) => p.x));
          const minY = Math.min(...allPts.map((p) => p.y));
          const maxY = Math.max(...allPts.map((p) => p.y));
          const off = 50;
          // Linea catena posizioni
          const yBot = maxY + off; // catena sotto
          const yTop = minY - off; // catena sopra
          const xLeft = minX - off; // catena sinistra
          const xRight = maxX + off; // catena destra
          const totW = (maxX - minX) / 100;
          const totH = (maxY - minY) / 100;
          // Catena: punti X unici (ordinati) per quote parziali
          const xs = Array.from(new Set(allPts.map((p) => Math.round(p.x)))).sort((a, b) => a - b);
          const ys = Array.from(new Set(allPts.map((p) => Math.round(p.y)))).sort((a, b) => a - b);
          const stroke = "#1F2937", thin = 1;
          return (
            <g pointerEvents="none">
              {/* === ORIZZONTALE — SOTTO === */}
              <line x1={minX} y1={yBot} x2={maxX} y2={yBot} stroke={stroke} strokeWidth={thin} />
              {xs.map((x, i) => (
                <g key={`xtick-bot-${i}`}>
                  <line x1={x} y1={yBot - 5} x2={x} y2={yBot + 5} stroke={stroke} strokeWidth={thin} />
                  <line x1={x} y1={maxY + 5} x2={x} y2={yBot - 5} stroke={stroke} strokeWidth={0.5} strokeDasharray="2,2" opacity="0.4" />
                  {i < xs.length - 1 && (
                    <text x={(x + xs[i + 1]) / 2} y={yBot + 18} textAnchor="middle" fontSize="11" fontFamily="JetBrains Mono" fill={stroke}>
                      {fmtNum((xs[i + 1] - x) / 100, 2)}
                    </text>
                  )}
                </g>
              ))}
              <line x1={minX} y1={yBot + 32} x2={maxX} y2={yBot + 32} stroke={stroke} strokeWidth={thin + 0.5} />
              <text x={(minX + maxX) / 2} y={yBot + 48} textAnchor="middle" fontSize="13" fontFamily="JetBrains Mono" fontWeight="700" fill={stroke}>{fmtNum(totW, 2)} m</text>

              {/* === ORIZZONTALE — SOPRA === */}
              <line x1={minX} y1={yTop} x2={maxX} y2={yTop} stroke={stroke} strokeWidth={thin} />
              {xs.map((x, i) => (
                <g key={`xtick-top-${i}`}>
                  <line x1={x} y1={yTop - 5} x2={x} y2={yTop + 5} stroke={stroke} strokeWidth={thin} />
                  <line x1={x} y1={yTop + 5} x2={x} y2={minY - 5} stroke={stroke} strokeWidth={0.5} strokeDasharray="2,2" opacity="0.4" />
                  {i < xs.length - 1 && (
                    <text x={(x + xs[i + 1]) / 2} y={yTop - 8} textAnchor="middle" fontSize="11" fontFamily="JetBrains Mono" fill={stroke}>
                      {fmtNum((xs[i + 1] - x) / 100, 2)}
                    </text>
                  )}
                </g>
              ))}
              <line x1={minX} y1={yTop - 32} x2={maxX} y2={yTop - 32} stroke={stroke} strokeWidth={thin + 0.5} />
              <text x={(minX + maxX) / 2} y={yTop - 38} textAnchor="middle" fontSize="13" fontFamily="JetBrains Mono" fontWeight="700" fill={stroke}>{fmtNum(totW, 2)} m</text>

              {/* === VERTICALE — SINISTRA === */}
              <line x1={xLeft} y1={minY} x2={xLeft} y2={maxY} stroke={stroke} strokeWidth={thin} />
              {ys.map((y, i) => (
                <g key={`ytick-l-${i}`}>
                  <line x1={xLeft - 5} y1={y} x2={xLeft + 5} y2={y} stroke={stroke} strokeWidth={thin} />
                  <line x1={xLeft + 5} y1={y} x2={minX - 5} y2={y} stroke={stroke} strokeWidth={0.5} strokeDasharray="2,2" opacity="0.4" />
                  {i < ys.length - 1 && (
                    <text x={xLeft - 10} y={(y + ys[i + 1]) / 2 + 4} textAnchor="end" fontSize="11" fontFamily="JetBrains Mono" fill={stroke}>
                      {fmtNum((ys[i + 1] - y) / 100, 2)}
                    </text>
                  )}
                </g>
              ))}
              <line x1={xLeft - 32} y1={minY} x2={xLeft - 32} y2={maxY} stroke={stroke} strokeWidth={thin + 0.5} />
              <text x={xLeft - 48} y={(minY + maxY) / 2 + 4} textAnchor="middle" fontSize="13" fontFamily="JetBrains Mono" fontWeight="700" fill={stroke} transform={`rotate(-90, ${xLeft - 48}, ${(minY + maxY) / 2 + 4})`}>{fmtNum(totH, 2)} m</text>

              {/* === VERTICALE — DESTRA === */}
              <line x1={xRight} y1={minY} x2={xRight} y2={maxY} stroke={stroke} strokeWidth={thin} />
              {ys.map((y, i) => (
                <g key={`ytick-r-${i}`}>
                  <line x1={xRight - 5} y1={y} x2={xRight + 5} y2={y} stroke={stroke} strokeWidth={thin} />
                  <line x1={maxX + 5} y1={y} x2={xRight - 5} y2={y} stroke={stroke} strokeWidth={0.5} strokeDasharray="2,2" opacity="0.4" />
                  {i < ys.length - 1 && (
                    <text x={xRight + 10} y={(y + ys[i + 1]) / 2 + 4} textAnchor="start" fontSize="11" fontFamily="JetBrains Mono" fill={stroke}>
                      {fmtNum((ys[i + 1] - y) / 100, 2)}
                    </text>
                  )}
                </g>
              ))}
              <line x1={xRight + 32} y1={minY} x2={xRight + 32} y2={maxY} stroke={stroke} strokeWidth={thin + 0.5} />
              <text x={xRight + 48} y={(minY + maxY) / 2 + 4} textAnchor="middle" fontSize="13" fontFamily="JetBrains Mono" fontWeight="700" fill={stroke} transform={`rotate(90, ${xRight + 48}, ${(minY + maxY) / 2 + 4})`}>{fmtNum(totH, 2)} m</text>
            </g>
          );
        })()}

        {/* rooms */}
        {L.rooms && rooms.map((r) => {
          const mat = catalogById[r.floorMaterial];
          const pts = r.points.map((p) => `${p.x},${p.y}`).join(" ");
          const isSel = selected?.kind === "rooms" && selected.id === r.id;
          const cx = r.points.reduce((s, p) => s + p.x, 0) / r.points.length;
          const cy = r.points.reduce((s, p) => s + p.y, 0) / r.points.length;
          const areaM2 = polygonArea(r.points) / 10000;
          const isFullFloorDemolito = demolitions.some((d) => d.kind === "pavimento" && d.roomId === r.id && !d.partial && !d.polygon);
          const isRivestDemolito = demolitions.some((d) => d.kind === "rivestimento" && d.roomId === r.id && !d.wallId);
          const showFloor = L.floors !== false && !isFullFloorDemolito;
          const hasProgettoMods = !!r.progetto && (r.progetto.floorMaterial || r.progetto.wallMaterial || r.progetto.ceilingMaterial || r.progetto.controsoffitto || r.progetto.electrical || r.progetto.plumbing);
          return (
            <g key={r.id}
              onMouseDown={(e) => { if (isPlacementTool) return; e.stopPropagation(); handleElementClick("rooms", r.id); }}
              onDoubleClick={(e) => {
                if (isPlacementTool) return;
                e.stopPropagation();
                const newName = window.prompt("Nome stanza:", r.name || "");
                if (newName !== null) setProject((prj) => ({ ...prj, rooms: (prj.rooms || []).map((x) => x.id === r.id ? { ...x, name: newName } : x) }));
              }}
              style={{ cursor: isPlacementTool ? "crosshair" : "pointer" }}
              data-testid={`room-${r.id}`}
            >
              {/* floor (default if no demolition) — override color se presente */}
              <polygon points={pts} fill={showFloor ? (r.floorTileColor || mat?.color || "#F5E9D8") : "#FAFAFA"} fillOpacity={isSel ? 0.65 : (showFloor ? 0.55 : 0.2)} stroke={isSel ? "#2563EB" : "transparent"} strokeWidth={isSel ? 2 : 0} />
              {/* demolizione pavimento totale overlay (solo se TOTALE, non parziale/area) */}
              {isFullFloorDemolito && (
                <>
                  <polygon points={pts} fill="url(#hatch-demo)" fillOpacity="0.45" />
                  <polygon points={pts} fill="none" stroke="#DC2626" strokeWidth="2" strokeDasharray="6,4" />
                </>
              )}
              {/* demolizione rivestimento overlay (solo se TUTTI i muri della stanza, non per parete singola) */}
              {isRivestDemolito && (
                <polygon points={pts} fill="none" stroke="#F97316" strokeWidth="6" strokeDasharray="3,3" opacity="0.85" />
              )}
              {/* controsoffitto overlay */}
              {r.controsoffitto && (
                <polygon points={pts} fill="url(#hatch-controsoff)" fillOpacity="0.4" />
              )}
              <text x={cx} y={cy - 6} fontSize="18" textAnchor="middle" fontFamily="Outfit" fill="#0A0A0A" fontWeight="700" letterSpacing="1.5" pointerEvents="none" style={{ textTransform: "uppercase" }}>{(r.name || "").toUpperCase()}</text>
              <text x={cx} y={cy + 14} fontSize="11" textAnchor="middle" fontFamily="JetBrains Mono" fill="#71717A" pointerEvents="none">{fmtNum(areaM2, 2)} m²</text>
              {/* QUOTE INTERNE: ogni lato del poligono stanza ottiene la sua quota */}
              {L.dimensions && r.points.map((pt, i) => {
                const next = r.points[(i + 1) % r.points.length];
                const dxs = next.x - pt.x, dys = next.y - pt.y;
                const lenSeg = Math.hypot(dxs, dys);
                if (lenSeg < 30) return null;
                const mxs = (pt.x + next.x) / 2, mys = (pt.y + next.y) / 2;
                // normal pointing INSIDE the room (verso il centroide)
                const inside = { x: cx - mxs, y: cy - mys };
                const dot = inside.x * (-dys) + inside.y * (dxs);
                const dir = dot > 0 ? 1 : -1;
                const nx = (-dys / (lenSeg || 1)) * dir;
                const ny = ( dxs / (lenSeg || 1)) * dir;
                const off = 22;
                const lx = mxs + nx * off, ly = mys + ny * off;
                const txt = `${(lenSeg / 100).toFixed(2)} m`;
                const padX = 28, padY = 10;
                return (
                  <g key={`edge-q-${i}`} pointerEvents="none">
                    <rect x={lx - padX} y={ly - padY} width={padX * 2} height={padY * 2} rx={2} fill="white" stroke="#0A0A0A" strokeWidth="1" />
                    <text x={lx} y={ly + 5} textAnchor="middle" fontSize="12" fontFamily="JetBrains Mono" fontWeight="700" fill="#0A0A0A">{txt}</text>
                  </g>
                );
              })}
              {r.controsoffitto && <text x={cx} y={cy + 28} fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono" fill="#0F766E" fontWeight="700" pointerEvents="none">CTRSF</text>}
              {isFullFloorDemolito && <text x={cx} y={cy + 28} fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono" fill="#DC2626" fontWeight="700" pointerEvents="none">DEMO PAV. TOTALE</text>}
              {isRivestDemolito && <text x={cx} y={cy + 42} fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono" fill="#F97316" fontWeight="700" pointerEvents="none">DEMO RIV. TOTALE</text>}
              {/* Indicatore modifiche di progetto stanza */}
              {hasProgettoMods && VM !== "fatto" && (
                <>
                  <polygon points={pts} fill="#FBBF24" fillOpacity="0.10" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="2,3" pointerEvents="none" />
                  <text x={cx} y={cy + 56} fontSize="8" textAnchor="middle" fontFamily="JetBrains Mono" fill="#B45309" fontWeight="700" pointerEvents="none">⚒ MODIFICHE PROGETTO</text>
                </>
              )}
              {/* Controsoffitto: bordo interno tratteggiato */}
              {(r.controsoffitto || (r.progetto && r.progetto.controsoffitto)) && (
                <g pointerEvents="none">
                  <polygon points={r.points.map(p => `${p.x + (cx > p.x ? 8 : -8)},${p.y + (cy > p.y ? 8 : -8)}`).join(" ")} fill="none" stroke="#0EA5E9" strokeWidth="1.2" strokeDasharray="6,3" opacity="0.7" />
                  <text x={cx} y={cy + 70} fontSize="8" textAnchor="middle" fontFamily="JetBrains Mono" fill="#0369A1" fontWeight="700">CONTROSOFFITTO</text>
                </g>
              )}
              {/* corner dots + angle labels (fuori-quadro detection) */}
              {r.points.map((pt, i) => {
                const prev = r.points[(i - 1 + r.points.length) % r.points.length];
                const next = r.points[(i + 1) % r.points.length];
                const v1x = prev.x - pt.x, v1y = prev.y - pt.y;
                const v2x = next.x - pt.x, v2y = next.y - pt.y;
                const dot = v1x * v2x + v1y * v2y;
                const m1 = Math.hypot(v1x, v1y), m2 = Math.hypot(v2x, v2y);
                const ang = Math.acos(Math.max(-1, Math.min(1, dot / (m1 * m2 || 1)))) * 180 / Math.PI;
                const fuoriQuadro = Math.abs(ang - 90) > 3;
                const colorAng = fuoriQuadro ? "#DC2626" : "#16A34A";
                return (
                  <g key={i} pointerEvents="none">
                    <circle cx={pt.x} cy={pt.y} r="3" fill="#0A0A0A" />
                    {L.dimensions && (
                      <>
                        <rect x={pt.x - 16} y={pt.y - 28} width={32} height={14} rx={3} fill="white" stroke={colorAng} strokeWidth="1" />
                        <text x={pt.x} y={pt.y - 18} textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono" fontWeight="700" fill={colorAng}>{ang.toFixed(0)}°</text>
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* tiling layers (under walls) */}
        {L.tiling && tiling.map((t) => {
          const room = rooms.find((r) => r.id === t.roomId);
          if (!room) return null;
          return <TilingPattern key={t.id} t={t} room={room} />;
        })}

        {/* ghost walls (perimetro stato di fatto) — visibili come riferimento in vista Demolizioni */}
        {ghostWalls.map((w) => (
          <g key={`ghost-${w.id}`} pointerEvents="none">
            <line x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="#A1A1AA" strokeWidth={(w.thickness || 10) * 0.8} strokeDasharray="3,4" opacity="0.55" strokeLinecap="round" />
          </g>
        ))}

        {/* walls */}
        {L.walls && walls.map((w) => {
          const isSel = selected?.kind === "walls" && selected.id === w.id;
          const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
          const isNuovo = w.kind === "nuovo" || w.kind === "cartongesso";
          let stroke = isSel ? "#2563EB" : "#0A0A0A";
          if (w.demolito) stroke = "#DC2626";
          else if (w.kind === "cartongesso") stroke = "#525252";
          else if (w.kind === "nuovo") stroke = "#EAB308";
          // Partial demolition: a sub-section of the wall
          const partial = w.demolito_partial;
          return (
            <g key={w.id}
              onMouseDown={(e) => { if (isPlacementTool) return; e.stopPropagation(); handleElementClick("walls", w.id); }}
              style={{ cursor: isPlacementTool ? "crosshair" : "pointer" }}
              data-testid={`wall-${w.id}`}
            >
              <line x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}
                stroke={stroke} strokeWidth={w.thickness || 10} strokeLinecap="round"
                strokeDasharray={w.demolito ? "8,5" : (w.kind === "cartongesso" ? "12,4" : undefined)}
                opacity={w.demolito ? 0.65 : 1}
              />
              {/* paint color overlay (decorazione parete) */}
              {w.paintColor && !w.demolito && (
                <line x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}
                  stroke={w.paintColor} strokeWidth={(w.thickness || 10) - 3} strokeLinecap="round" opacity="0.85" />
              )}
              {/* corner cap */}
              <circle cx={w.x1} cy={w.y1} r={(w.thickness || 10) / 2} fill={stroke} pointerEvents="none" />
              <circle cx={w.x2} cy={w.y2} r={(w.thickness || 10) / 2} fill={stroke} pointerEvents="none" />
              {/* partial demolition overlay */}
              {!w.demolito && partial && partial.to > partial.from && (
                <line
                  x1={w.x1 + partial.from * (w.x2 - w.x1)}
                  y1={w.y1 + partial.from * (w.y2 - w.y1)}
                  x2={w.x1 + partial.to * (w.x2 - w.x1)}
                  y2={w.y1 + partial.to * (w.y2 - w.y1)}
                  stroke="#DC2626" strokeWidth={(w.thickness || 10) + 2} strokeDasharray="6,4" strokeLinecap="butt" opacity="0.85"
                />
              )}
              {isNuovo && !w.demolito && (
                <line x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="url(#hatch-new)" strokeWidth={(w.thickness || 10) - 4} strokeLinecap="butt" opacity="0.6" />
              )}
              <line x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="transparent" strokeWidth="20" />
              {L.dimensions && len > 30 && <Measurement x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} big color={w.demolito ? "#DC2626" : "#16A34A"} />}
              {!w.demolito && partial && partial.to > partial.from && L.dimensions && (
                <text
                  x={w.x1 + ((partial.from + partial.to) / 2) * (w.x2 - w.x1)}
                  y={w.y1 + ((partial.from + partial.to) / 2) * (w.y2 - w.y1) - 16}
                  fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono" fontWeight="700" fill="#DC2626"
                  pointerEvents="none"
                >DEMO {Math.round((partial.to - partial.from) * len)}cm × h{partial.height || 270}cm</text>
              )}
              {/* drag handles when selected */}
              {isSel && tool === "select" && (
                <>
                  <circle cx={w.x1} cy={w.y1} r="9" fill="white" stroke="#2563EB" strokeWidth="2.5"
                    style={{ cursor: "move" }}
                    onMouseDown={(e) => { e.stopPropagation(); setDrag({ kind: "wall-end", id: w.id, sub: "p1", start: snapPt(toWorld(e)), orig: { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 } }); }}
                    data-testid={`wall-handle-p1-${w.id}`}
                  />
                  <circle cx={w.x2} cy={w.y2} r="9" fill="white" stroke="#2563EB" strokeWidth="2.5"
                    style={{ cursor: "move" }}
                    onMouseDown={(e) => { e.stopPropagation(); setDrag({ kind: "wall-end", id: w.id, sub: "p2", start: snapPt(toWorld(e)), orig: { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 } }); }}
                    data-testid={`wall-handle-p2-${w.id}`}
                  />
                </>
              )}
              {/* drag handles for PARTIAL DEMOLITION (resize from/to along wall) */}
              {isSel && tool === "select" && !w.demolito && partial && partial.to > partial.from && (
                <>
                  <circle
                    cx={w.x1 + partial.from * (w.x2 - w.x1)}
                    cy={w.y1 + partial.from * (w.y2 - w.y1)}
                    r="11" fill="white" stroke="#DC2626" strokeWidth="3"
                    style={{ cursor: "ew-resize" }}
                    onMouseDown={(e) => { e.stopPropagation(); setDrag({ kind: "demo-handle", id: w.id, side: "from", start: toWorld(e) }); }}
                    data-testid={`wall-demo-handle-from-${w.id}`}
                  />
                  <circle
                    cx={w.x1 + partial.to * (w.x2 - w.x1)}
                    cy={w.y1 + partial.to * (w.y2 - w.y1)}
                    r="11" fill="white" stroke="#DC2626" strokeWidth="3"
                    style={{ cursor: "ew-resize" }}
                    onMouseDown={(e) => { e.stopPropagation(); setDrag({ kind: "demo-handle", id: w.id, side: "to", start: toWorld(e) }); }}
                    data-testid={`wall-demo-handle-to-${w.id}`}
                  />
                </>
              )}
            </g>
          );
        })}

        {/* doors */}
        {L.doors && doors.map((d) => {
          const w = walls.find((ww) => ww.id === d.wallId); if (!w) return null;
          const cx = w.x1 + d.t * (w.x2 - w.x1);
          const cy = w.y1 + d.t * (w.y2 - w.y1);
          const angle = Math.atan2(w.y2 - w.y1, w.x2 - w.x1) * 180 / Math.PI;
          const isSel = selected?.kind === "doors" && selected.id === d.id;
          const isBlindata = d.type === "blindata" || d.type === "blindata-cl3" || d.type === "blindata-cl4";
          const isScorrevole = d.type === "scorrevole";
          const stroke = isSel ? "#2563EB" : (isBlindata ? "#7C2D12" : "#2563EB");
          const hinge = d.hinge || "left"; // 'left' | 'right'
          const swing = d.swing || "in"; // 'in' | 'out'
          const sw = swing === "out" ? -1 : 1;
          // Door drawing centered: width starts at -w/2, ends at +w/2
          // hinge=left → pivot at -w/2; hinge=right → pivot at +w/2
          // swing=in (default) → arc on +y side; out → arc on -y side
          let arcD;
          if (hinge === "left") {
            arcD = `M ${-d.width / 2} 0 A ${d.width} ${d.width} 0 0 ${sw === 1 ? 1 : 0} ${d.width / 2} ${sw * d.width / 2}`;
          } else {
            arcD = `M ${d.width / 2} 0 A ${d.width} ${d.width} 0 0 ${sw === 1 ? 0 : 1} ${-d.width / 2} ${sw * d.width / 2}`;
          }
          const leafEndX = hinge === "left" ? -d.width / 2 + d.width * Math.cos(Math.PI / 4) : d.width / 2 - d.width * Math.cos(Math.PI / 4);
          const leafEndY = sw * d.width * Math.sin(Math.PI / 4);
          return (
            <g key={d.id} transform={`translate(${cx},${cy}) rotate(${angle})`}
              onMouseDown={(e) => { if (isPlacementTool) return; e.stopPropagation(); handleElementClick("doors", d.id); }}
              style={{ cursor: isPlacementTool ? "crosshair" : "pointer" }}
              data-testid={`door-${d.id}`}
            >
              <rect x={-d.width / 2 - 2} y={-7} width={d.width + 4} height={14} fill="#FAFAFA" stroke="none" />
              {!isScorrevole && (
                <>
                  <path d={arcD} fill="none" stroke={stroke} strokeWidth="1.2" strokeDasharray="3,3" opacity="0.7" />
                  <line x1={hinge === "left" ? -d.width / 2 : d.width / 2} y1={0}
                        x2={hinge === "left" ? -d.width / 2 + d.width * Math.cos(Math.PI / 6) : d.width / 2 - d.width * Math.cos(Math.PI / 6)}
                        y2={sw * d.width * Math.sin(Math.PI / 6)}
                        stroke={stroke} strokeWidth={isBlindata ? 3 : 2} />
                </>
              )}
              {isScorrevole && (
                <>
                  <line x1={-d.width / 2} y1={-3} x2={d.width / 2} y2={-3} stroke={stroke} strokeWidth="1.5" />
                  <line x1={-d.width / 2} y1={3} x2={d.width / 2} y2={3} stroke={stroke} strokeWidth="1.5" />
                  <text x={0} y={2} fontSize="9" textAnchor="middle" fill={stroke}>↔</text>
                </>
              )}
              <text x={0} y={-12} fontSize="12" textAnchor="middle" fontFamily="JetBrains Mono" fontWeight="700" fill={stroke} pointerEvents="none">{d.width}</text>
              {/* drag handle */}
              {isSel && tool === "select" && (
                <circle cx={0} cy={0} r="7" fill="white" stroke="#2563EB" strokeWidth="2"
                  style={{ cursor: "ew-resize" }}
                  onMouseDown={(e) => { e.stopPropagation(); setDrag({ kind: "door-t", id: d.id, start: snapPt(toWorld(e)), orig: { t: d.t } }); }}
                  data-testid={`door-handle-${d.id}`}
                />
              )}
            </g>
          );
        })}

        {/* windows */}
        {L.windows && windows.map((wn) => {
          const w = walls.find((ww) => ww.id === wn.wallId); if (!w) return null;
          const cx = w.x1 + wn.t * (w.x2 - w.x1);
          const cy = w.y1 + wn.t * (w.y2 - w.y1);
          const angle = Math.atan2(w.y2 - w.y1, w.x2 - w.x1) * 180 / Math.PI;
          const isSel = selected?.kind === "windows" && selected.id === wn.id;
          const stroke = isSel ? "#2563EB" : "#0A0A0A";
          const isPF = wn.type === "porta-finestra";
          return (
            <g key={wn.id} transform={`translate(${cx},${cy}) rotate(${angle})`}
              onMouseDown={(e) => { if (isPlacementTool) return; e.stopPropagation(); handleElementClick("windows", wn.id); }}
              style={{ cursor: isPlacementTool ? "crosshair" : "pointer" }}
              data-testid={`window-${wn.id}`}
            >
              <rect x={-wn.width / 2} y={-7} width={wn.width} height={14} fill="#FAFAFA" />
              <rect x={-wn.width / 2} y={-3} width={wn.width} height={6} fill="none" stroke={stroke} strokeWidth={isPF ? 1.6 : 1} />
              <line x1={-wn.width / 2} y1={0} x2={wn.width / 2} y2={0} stroke={stroke} strokeWidth="1" />
              {isPF && <line x1={0} y1={-3} x2={0} y2={3} stroke={stroke} strokeWidth="1.2" />}
              <text x={0} y={-12} fontSize="12" textAnchor="middle" fontFamily="JetBrains Mono" fontWeight="700" fill={stroke} pointerEvents="none">{wn.width}</text>
              {isSel && tool === "select" && (
                <circle cx={0} cy={0} r="7" fill="white" stroke="#2563EB" strokeWidth="2"
                  style={{ cursor: "ew-resize" }}
                  onMouseDown={(e) => { e.stopPropagation(); setDrag({ kind: "window-t", id: wn.id, start: snapPt(toWorld(e)), orig: { t: wn.t } }); }}
                  data-testid={`window-handle-${wn.id}`}
                />
              )}
            </g>
          );
        })}

        {/* items */}
        {L.items && items.map((it) => {
          const m = catalogById[it.materialId];
          const color = m?.color || "#71717A";
          const isSel = selected?.kind === "items" && selected.id === it.id;
          const w = it.width || 60, d = it.depth || 60;
          return (
            <g key={it.id} transform={`translate(${it.x},${it.y}) rotate(${it.rotation || 0})`}
              onMouseDown={(e) => {
                if (isPlacementTool) return;
                e.stopPropagation();
                handleElementClick("items", it.id);
                if (selected?.kind === "items" && selected.id === it.id) {
                  setDrag({ kind: "item-pos", id: it.id, start: snapPt(toWorld(e)), orig: { x: it.x, y: it.y } });
                }
              }}
              style={{ cursor: isPlacementTool ? "crosshair" : (isSel ? "move" : "pointer") }}
              data-testid={`item-${it.id}`}
            >
              <rect x={-w / 2} y={-d / 2} width={w} height={d} fill={color} fillOpacity="0.85" stroke={isSel ? "#2563EB" : "#3F3F46"} strokeWidth={isSel ? 1.5 : 0.6} />
              <text x={0} y={4} fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono" fill="#0A0A0A" pointerEvents="none">{(m?.name || "item").slice(0, 12)}</text>
            </g>
          );
        })}

        {/* electrical */}
        {L.electrical && electrical.map((e) => {
          const isSel = selected?.kind === "electrical" && selected.id === e.id;
          return (
            <g key={e.id} transform={`translate(${e.x},${e.y}) rotate(${e.rotation || 0})`}
              onMouseDown={(ev) => {
                if (isPlacementTool) return;
                ev.stopPropagation();
                handleElementClick("electrical", e.id);
                if (selected?.kind === "electrical" && selected.id === e.id) {
                  setDrag({ kind: "elec-pos", id: e.id, start: snapPt(toWorld(ev)), orig: { x: e.x, y: e.y } });
                }
              }}
              style={{ cursor: isPlacementTool ? "crosshair" : (isSel ? "move" : "pointer") }}
              data-testid={`elec-${e.id}`}
            ><ElectricalSymbol e={e} isSel={isSel} /></g>
          );
        })}

        {/* plumbing */}
        {L.plumbing && plumbing.map((p) => {
          const isSel = selected?.kind === "plumbing" && selected.id === p.id;
          return (
            <g key={p.id} transform={`translate(${p.x},${p.y})`}
              onMouseDown={(ev) => {
                if (isPlacementTool) return;
                ev.stopPropagation();
                handleElementClick("plumbing", p.id);
                if (selected?.kind === "plumbing" && selected.id === p.id) {
                  setDrag({ kind: "plumb-pos", id: p.id, start: snapPt(toWorld(ev)), orig: { x: p.x, y: p.y } });
                }
              }}
              style={{ cursor: isPlacementTool ? "crosshair" : (isSel ? "move" : "pointer") }}
              data-testid={`plumb-${p.id}`}
            ><PlumbingSymbol p={p} isSel={isSel} /></g>
          );
        })}

        {/* gas */}
        {L.gas && gas.map((g) => {
          const isSel = selected?.kind === "gas" && selected.id === g.id;
          return (
            <g key={g.id} transform={`translate(${g.x},${g.y})`}
              onMouseDown={(ev) => {
                if (isPlacementTool) return;
                ev.stopPropagation();
                handleElementClick("gas", g.id);
                if (selected?.kind === "gas" && selected.id === g.id) {
                  setDrag({ kind: "gas-pos", id: g.id, start: snapPt(toWorld(ev)), orig: { x: g.x, y: g.y } });
                }
              }}
              style={{ cursor: isPlacementTool ? "crosshair" : (isSel ? "move" : "pointer") }}
              data-testid={`gas-${g.id}`}
            ><GasSymbol g={g} isSel={isSel} /></g>
          );
        })}

        {/* hvac */}
        {L.hvac && hvac.map((h) => {
          const isSel = selected?.kind === "hvac" && selected.id === h.id;
          return (
            <g key={h.id} transform={`translate(${h.x},${h.y}) rotate(${h.rotation || 0})`}
              onMouseDown={(ev) => {
                if (isPlacementTool) return;
                ev.stopPropagation();
                handleElementClick("hvac", h.id);
                if (selected?.kind === "hvac" && selected.id === h.id) {
                  setDrag({ kind: "hvac-pos", id: h.id, start: snapPt(toWorld(ev)), orig: { x: h.x, y: h.y } });
                }
              }}
              style={{ cursor: isPlacementTool ? "crosshair" : (isSel ? "move" : "pointer") }}
              data-testid={`hvac-${h.id}`}
            ><HvacSymbol h={h} isSel={isSel} /></g>
          );
        })}

        {/* stairs (scale: chiocciola, muratura, legno) */}
        {stairs.map((s) => {
          const isSel = selected?.kind === "stairs" && selected.id === s.id;
          return (
            <g key={s.id} transform={`translate(${s.x},${s.y}) rotate(${s.rotation || 0})`}
              onMouseDown={(ev) => {
                if (isPlacementTool) return;
                ev.stopPropagation();
                handleElementClick("stairs", s.id);
                if (selected?.kind === "stairs" && selected.id === s.id) {
                  setDrag({ kind: "stairs-pos", id: s.id, start: snapPt(toWorld(ev)), orig: { x: s.x, y: s.y } });
                }
              }}
              style={{ cursor: isPlacementTool ? "crosshair" : (isSel ? "move" : "pointer") }}
              data-testid={`stairs-${s.id}`}
            ><StairSymbol s={s} isSel={isSel} /></g>
          );
        })}

        {/* demolizione rivestimento per parete singola: rettangolo arancione tratteggiato (zona precisa) */}
        {(project.demolitions || []).filter((d) => d.kind === "rivestimento" && d.wallId).map((d) => {
          const w = (project.walls || []).find((wx) => wx.id === d.wallId);
          if (!w) return null;
          const lenCm = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
          const xFrom = d.xFromCm != null ? d.xFromCm : 0;
          const xTo = d.xToCm != null ? d.xToCm : Math.round(lenCm);
          const tFrom = Math.max(0, Math.min(1, lenCm > 0 ? xFrom / lenCm : 0));
          const tTo = Math.max(0, Math.min(1, lenCm > 0 ? xTo / lenCm : 1));
          const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
          const x1 = w.x1 + tFrom * dx, y1 = w.y1 + tFrom * dy;
          const x2 = w.x1 + tTo * dx, y2 = w.y1 + tTo * dy;
          const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
          const isSel = selected?.kind === "demolitions" && selected.id === d.id;
          return (
            <g key={`demo-riv-wall-${d.id}`}
              onMouseDown={(ev) => { if (isPlacementTool) return; ev.stopPropagation(); handleElementClick("demolitions", d.id); }}
              style={{ cursor: isPlacementTool ? "crosshair" : "pointer" }}
              data-testid={`demolition-rivestimento-${d.id}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#F97316" strokeWidth={(w.thickness || 10) + 6} strokeDasharray="3,3" opacity={isSel ? 0.95 : 0.7} strokeLinecap="butt" />
              <text x={cx} y={cy - 14} textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono" fontWeight="700" fill="#F97316">
                DEMO RIV. {Math.round(xTo - xFrom)}×{Math.round((d.hToCm != null ? d.hToCm : (d.heightCm || 200)) - (d.hFromCm || 0))}cm @ h{d.hFromCm || 0}cm
              </text>
            </g>
          );
        })}

        {/* demolizione pavimento parziale: poligono area free-form */}
        {(project.demolitions || []).filter((d) => d.kind === "pavimento" && d.polygon && d.polygon.length >= 3).map((d) => (
          <g key={`demo-poly-${d.id}`} pointerEvents="none">
            <polygon points={d.polygon.map((p) => `${p.x},${p.y}`).join(" ")} fill="url(#hatch-demo)" fillOpacity="0.55" stroke="#DC2626" strokeWidth="2" strokeDasharray="5,4" />
            <text x={d.x} y={d.y} textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono" fontWeight="700" fill="#DC2626">{`DEMO ${fmtNum((polygonArea(d.polygon) / 10000), 2)} m²`}</text>
          </g>
        ))}

        {/* testi liberi sulla pianta */}
        {(project.texts || []).map((tx) => {
          const isSel = selected?.kind === "texts" && selected.id === tx.id;
          return (
            <g key={tx.id} transform={`translate(${tx.x},${tx.y}) rotate(${tx.rotation || 0})`}
              onMouseDown={(ev) => {
                if (isPlacementTool) return;
                ev.stopPropagation();
                handleElementClick("texts", tx.id);
                if (selected?.kind === "texts" && selected.id === tx.id) {
                  setDrag({ kind: "text-pos", id: tx.id, start: snapPt(toWorld(ev)), orig: { x: tx.x, y: tx.y } });
                }
              }}
              style={{ cursor: isPlacementTool ? "crosshair" : (isSel ? "move" : "pointer") }}
              data-testid={`text-${tx.id}`}
            >
              {isSel && <rect x={-4} y={-(tx.fontSize || 14) - 2} width={(tx.text?.length || 1) * (tx.fontSize || 14) * 0.55 + 8} height={(tx.fontSize || 14) + 6} fill="#FEF3C7" stroke="#D97706" strokeWidth="0.6" />}
              <text x="0" y="0" fontFamily="Outfit" fontSize={tx.fontSize || 14} fontWeight="600" fill={tx.color || "#0A0A0A"}>{tx.text}</text>
            </g>
          );
        })}

        {/* wall draft */}
        {(tool === "wall" || tool === "wall-cartongesso") && wallDraft && (
          <g pointerEvents="none">
            <line x1={wallDraft.x} y1={wallDraft.y} x2={cursor.x} y2={cursor.y} stroke="#16A34A" strokeWidth="12" strokeOpacity="0.55" />
            <circle cx={wallDraft.x} cy={wallDraft.y} r="6" fill="#16A34A" />
            <circle cx={cursor.x} cy={cursor.y} r="8" fill="white" stroke="#16A34A" strokeWidth="3" />
            <Measurement x1={wallDraft.x} y1={wallDraft.y} x2={cursor.x} y2={cursor.y} big />
          </g>
        )}

        {/* room draft */}
        {tool === "room" && roomDraft.length > 0 && (
          <g pointerEvents="none">
            <polyline points={[...roomDraft, cursor].map((p) => `${p.x},${p.y}`).join(" ")} fill="#2563EB" fillOpacity="0.08" stroke="#2563EB" strokeWidth="2" strokeDasharray="4 3" />
            {roomDraft.map((p, i) => {
              const next = i < roomDraft.length - 1 ? roomDraft[i + 1] : cursor;
              const segLen = Math.hypot(next.x - p.x, next.y - p.y);
              return (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r="6" fill="#2563EB" stroke="white" strokeWidth="2" />
                  {segLen > 30 && <Measurement x1={p.x} y1={p.y} x2={next.x} y2={next.y} color="#2563EB" />}
                </g>
              );
            })}
          </g>
        )}

        {/* demolizione pavimento area draft */}
        {tool === "demolish-floor-partial" && demoAreaDraft.length > 0 && (
          <g pointerEvents="none">
            <polyline points={[...demoAreaDraft, cursor].map((p) => `${p.x},${p.y}`).join(" ")} fill="#DC2626" fillOpacity="0.18" stroke="#DC2626" strokeWidth="2" strokeDasharray="5,4" />
            {demoAreaDraft.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="6" fill="#DC2626" stroke="white" strokeWidth="2" />
            ))}
          </g>
        )}

        {/* package area draft */}
        {tool === "package-area" && demoAreaDraft.length > 0 && (
          <g pointerEvents="none">
            <polyline points={[...demoAreaDraft, cursor].map((p) => `${p.x},${p.y}`).join(" ")} fill="#10B981" fillOpacity="0.10" stroke="#10B981" strokeWidth="2" strokeDasharray="5,4" />
            {demoAreaDraft.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="6" fill="#10B981" stroke="white" strokeWidth="2" />
            ))}
          </g>
        )}

        {/* controsoffitto area draft */}
        {tool === "controsoffitto-area" && demoAreaDraft.length > 0 && (
          <g pointerEvents="none">
            <polyline points={[...demoAreaDraft, cursor].map((p) => `${p.x},${p.y}`).join(" ")} fill="#0EA5E9" fillOpacity="0.18" stroke="#0EA5E9" strokeWidth="2" strokeDasharray="5,4" />
            {demoAreaDraft.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="6" fill="#0EA5E9" stroke="white" strokeWidth="2" />
            ))}
          </g>
        )}

        {/* controsoffitti AD AREA persistenti */}
        {(project.controsoffitti || []).map((c) => (
          <g key={`ctrsf-${c.id}`}
            onMouseDown={(ev) => { if (isPlacementTool) return; ev.stopPropagation(); handleElementClick("controsoffitti", c.id); }}
            style={{ cursor: isPlacementTool ? "crosshair" : "pointer" }}
            data-testid={`controsoffitto-area-${c.id}`}>
            <polygon points={(c.polygon || []).map((p) => `${p.x},${p.y}`).join(" ")} fill="url(#hatch-controsoff)" fillOpacity="0.55" stroke="#0EA5E9" strokeWidth="1.5" strokeDasharray="6,4" />
            <text x={c.x} y={c.y} textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono" fontWeight="700" fill="#0369A1">{`CONTROSOFF. ${fmtNum(c.areaM2 || 0, 2)}m²`}</text>
          </g>
        ))}

        {/* package area persistente */}
        {project.packageArea?.polygon && project.packageArea.polygon.length >= 3 && (
          <g pointerEvents="none">
            <polygon points={project.packageArea.polygon.map((p) => `${p.x},${p.y}`).join(" ")} fill="#10B981" fillOpacity="0.06" stroke="#10B981" strokeWidth="1.5" strokeDasharray="6,4" />
            {(() => {
              const a = polygonArea(project.packageArea.polygon) / 10000;
              const cx = project.packageArea.polygon.reduce((s, p) => s + p.x, 0) / project.packageArea.polygon.length;
              const cy = project.packageArea.polygon.reduce((s, p) => s + p.y, 0) / project.packageArea.polygon.length;
              return <text x={cx} y={cy} fontSize="11" fontFamily="JetBrains Mono" fontWeight="700" fill="#047857" textAnchor="middle">{`AREA PACCHETTO ${a.toFixed(2)} m²`}</text>;
            })()}
          </g>
        )}

        {/* crosshair */}
        {tool !== "select" && tool !== "delete" && (
          <g pointerEvents="none">
            <line x1={cursor.x} y1={viewBox.y} x2={cursor.x} y2={viewBox.y + viewBox.h} stroke="#2563EB" strokeWidth="0.3" strokeDasharray="2 3" opacity="0.4" />
            <line x1={viewBox.x} y1={cursor.y} x2={viewBox.x + viewBox.w} y2={cursor.y} stroke="#2563EB" strokeWidth="0.3" strokeDasharray="2 3" opacity="0.4" />
          </g>
        )}
      </svg>

      <div className="absolute bottom-3 left-3 bg-white border border-zinc-200 px-3 py-1.5 text-xs mono text-zinc-600 flex gap-4" data-testid="canvas-info">
        <span>x: {fmtNum(cursor.x / 100, 2)}m</span>
        <span>y: {fmtNum(cursor.y / 100, 2)}m</span>
        <span className="text-zinc-400">|</span>
        <span>{walls.length}m · {rooms.length}r · {electrical.length}el · {plumbing.length}id · {hvac.length}hv</span>
      </div>
      <div className="absolute bottom-3 right-3 bg-white border border-zinc-200 px-3 py-1.5 text-xs mono text-zinc-500">alt+trascina · rotella zoom</div>

      {tool === "wall" && <div className="absolute top-3 left-3 bg-zinc-900 text-white px-3 py-1.5 text-xs mono">muro mattone · click per punti · doppio click per terminare</div>}
      {tool === "wall-cartongesso" && <div className="absolute top-3 left-3 bg-zinc-700 text-white px-3 py-1.5 text-xs mono">muro cartongesso · click per punti · doppio click per terminare</div>}
      {tool === "room" && <div className="absolute top-3 left-3 bg-zinc-900 text-white px-3 py-1.5 text-xs mono">stanza · click vertici · doppio click per chiudere</div>}
      {tool === "door" && <div className="absolute top-3 left-3 bg-blue-600 text-white px-3 py-1.5 text-xs mono">porta · click su parete</div>}
      {tool === "window" && <div className="absolute top-3 left-3 bg-blue-600 text-white px-3 py-1.5 text-xs mono">finestra · click su parete</div>}
      {tool === "demolish-wall" && <div className="absolute top-3 left-3 bg-rose-600 text-white px-3 py-1.5 text-xs mono">demolisci muro · click per marcare</div>}
      {tool === "demolish-wall" && <div className="absolute top-3 left-3 bg-rose-600 text-white px-3 py-1.5 text-xs mono">demolisci muro · click muro (toggle TOTALE)</div>}
      {tool === "demolish-wall-partial" && <div className="absolute top-3 left-3 bg-rose-700 text-white px-3 py-1.5 text-xs mono">demoliz. muro parziale · click sul muro · poi modifica Da/A/Altezza nel pannello</div>}
      {tool === "demolish-floor" && <div className="absolute top-3 left-3 bg-rose-600 text-white px-3 py-1.5 text-xs mono">demolisci pavimento · click in stanza (totale)</div>}
      {tool === "demolish-floor-partial" && <div className="absolute top-3 left-3 bg-rose-700 text-white px-3 py-1.5 text-xs mono">demoliz. pavimento area · click vertici, doppio click chiude</div>}
      {tool === "demolish-rivestimento" && <div className="absolute top-3 left-3 bg-orange-500 text-white px-3 py-1.5 text-xs mono">demoliz. rivestimento · click sul muro · poi regola sx/dx/h-da-terra/altezza nel pannello</div>}
      {tool === "package-area" && <div className="absolute top-3 left-3 bg-emerald-700 text-white px-3 py-1.5 text-xs mono">area pacchetto · click vertici, doppio click chiude · ricalcola mq automatico</div>}
      {tool === "stairs" && <div className="absolute top-3 left-3 bg-amber-700 text-white px-3 py-1.5 text-xs mono">scala · {stairsKind || "muratura"} · click per posizionare</div>}
      {tool === "controsoffitto" && <div className="absolute top-3 left-3 bg-teal-700 text-white px-3 py-1.5 text-xs mono">controsoffitto · click su stanza per attivare/disattivare</div>}
      {tool === "controsoffitto-area" && <div className="absolute top-3 left-3 bg-sky-700 text-white px-3 py-1.5 text-xs mono">controsoffitto area · click vertici, doppio click chiude</div>}
      {tool === "electrical" && <div className="absolute top-3 left-3 bg-purple-700 text-white px-3 py-1.5 text-xs mono">elettrico · {electricalKind || "presa"}</div>}
      {tool === "plumbing" && <div className="absolute top-3 left-3 bg-cyan-700 text-white px-3 py-1.5 text-xs mono">idraulico · {plumbingKind || "acqua-fredda"}</div>}
      {tool === "gas" && <div className="absolute top-3 left-3 bg-yellow-600 text-white px-3 py-1.5 text-xs mono">gas · click per posizionare</div>}
      {tool === "hvac" && (() => {
        // Banner intelligente per multi-split
        const kind = hvacKind || "split";
        if (kind === "trial-split" || kind === "dual-split" || kind === "quadri-split") {
          const expected = kind === "quadri-split" ? 4 : (kind === "trial-split" ? 3 : 2);
          const labelPrefix = kind === "quadri-split" ? "Quadri" : (kind === "trial-split" ? "Trial" : "Dual");
          const all = (project.hvac || []).filter(h => h.group_kind === kind && h.phase === VM);
          const lastGid = all.length ? all[all.length - 1].group_id : null;
          const sameGroup = all.filter(h => h.group_id === lastGid);
          const has_ue = sameGroup.some(h => h.type === "esterna");
          const splitsCount = sameGroup.filter(h => h.type === "split").length;
          const completed = sameGroup.length >= expected + 1;
          const next = !has_ue ? "Posiziona Unità Esterna (UE)" : (completed ? `${labelPrefix} completato — click per nuovo gruppo` : `Posiziona Split ${splitsCount + 1}/${expected}`);
          return <div className="absolute top-3 left-3 bg-teal-700 text-white px-3 py-1.5 text-xs mono">condizionamento · {kind} · {next}</div>;
        }
        return <div className="absolute top-3 left-3 bg-teal-700 text-white px-3 py-1.5 text-xs mono">condizionamento · {kind}</div>;
      })()}
      {tool === "tiling" && <div className="absolute top-3 left-3 bg-stone-700 text-white px-3 py-1.5 text-xs mono">schema posa · click in stanza per partire</div>}
    </div>
  );
}

function projectPointOnSegment(p, a, b) {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const t = ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y || 1);
  return { t: Math.max(0, Math.min(1, t)) };
}

/**
 * applyWallAddWithSplit: aggiunge il muro al progetto e, se attraversa una stanza esistente
 * entrando ed uscendo dai bordi, divide la stanza in 2 nuove stanze (preservando le proprietà).
 */
function applyWallAddWithSplit(prj, newWall) {
  const rooms = prj.rooms || [];
  const W1 = { x: newWall.x1, y: newWall.y1 };
  const W2 = { x: newWall.x2, y: newWall.y2 };
  let splitRoomId = null;
  let split = null;
  for (const r of rooms) {
    const res = splitRoomByWall(r.points, W1, W2);
    if (res) { splitRoomId = r.id; split = res; break; }
  }
  if (!split) {
    return { ...prj, walls: [...(prj.walls || []), newWall] };
  }
  const original = rooms.find((r) => r.id === splitRoomId);
  const baseProps = { ...original };
  delete baseProps.id; delete baseProps.points; delete baseProps.name;
  const room1 = { ...baseProps, id: uid(), name: `${original.name} A`, points: split[0] };
  const room2 = { ...baseProps, id: uid(), name: `${original.name} B`, points: split[1] };
  const otherRooms = rooms.filter((r) => r.id !== splitRoomId);
  return { ...prj, rooms: [...otherRooms, room1, room2], walls: [...(prj.walls || []), newWall] };
}

function defaultItemSize(m) {
  switch (m.id) {
    case "furn-sofa": return { width: 220, depth: 90, height: 85 };
    case "furn-bed": return { width: 160, depth: 200, height: 55 };
    case "furn-table": return { width: 150, depth: 90, height: 75 };
    case "furn-chair": return { width: 45, depth: 45, height: 90 };
    case "furn-wardrobe": return { width: 200, depth: 60, height: 220 };
    case "furn-kitchen": return { width: 300, depth: 60, height: 90 };
    case "fix-toilet": return { width: 40, depth: 60, height: 40 };
    case "fix-sink": return { width: 60, depth: 45, height: 85 };
    case "fix-shower": return { width: 90, depth: 90, height: 200 };
    case "fix-bathtub": return { width: 170, depth: 70, height: 55 };
    case "app-fridge": return { width: 70, depth: 65, height: 185 };
    case "app-oven": return { width: 60, depth: 55, height: 60 };
    case "app-hob": return { width: 60, depth: 55, height: 5 };
    case "app-dishwasher": return { width: 60, depth: 55, height: 85 };
    case "light-ceiling":
    case "light-pendant":
    case "light-spot":
    case "light-wall": return { width: 30, depth: 30, height: 15 };
    default: return { width: 60, depth: 60, height: 60 };
  }
}
