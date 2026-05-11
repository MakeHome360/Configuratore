import React, { useState } from "react";
import { fmtNum } from "./utils";

// Standard heights (cm) for installation elements on a wall (height from floor)
const STD_HEIGHTS = {
  // electrical
  "presa": 30, "presa-cucina": 110, "presa-tv": 30, "presa-rj45": 30,
  "interruttore": 110, "deviatore": 110, "luce": 220, "punto-luce": 220, "punto-luce-led": 220,
  "scatola": 110, "quadro": 160, "quadro-elettrico": 160,
  // plumbing
  "acqua-fredda": 35, "acqua-calda": 35, "scarico": 30,
  "lavatrice": 70, "lavastoviglie": 70,
  // gas
  "gas": 40,
  // hvac
  "split": 220, "esterna": 250, "predisposizione": 220,
};

// Project a plan-view point onto a wall segment, returning {t, dist}
function projectOnWall(p, w) {
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
  const lenSq = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - w.x1) * dx + (p.y - w.y1) * dy) / lenSq));
  const cx = w.x1 + t * dx, cy = w.y1 + t * dy;
  return { t, dist: Math.hypot(cx - p.x, cy - p.y) };
}

// Find walls that are "interesting" for prospetto: demolitions, openings, electrical/plumbing/hvac points within 80cm
export function computeInterestingWalls(project) {
  const walls = project?.walls || [];
  const result = [];
  const els = (project?.electrical || []).map((e) => ({ ...e, kind: "electrical" }));
  const pls = (project?.plumbing || []).map((p) => ({ ...p, kind: "plumbing" }));
  const gss = (project?.gas || []).map((g) => ({ ...g, kind: "gas", type: "gas" }));
  const hvs = (project?.hvac || []).map((h) => ({ ...h, kind: "hvac" }));
  const allPts = [...els, ...pls, ...gss, ...hvs];
  walls.forEach((w) => {
    if (w.demolito) return;
    const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
    if (len < 50) return;
    const onThisWall = [];
    allPts.forEach((p) => {
      const pr = projectOnWall(p, w);
      if (pr.dist < 80) onThisWall.push({ ...p, t: pr.t });
    });
    const doorsOnWall = (project?.doors || []).filter((d) => d.wallId === w.id);
    const windowsOnWall = (project?.windows || []).filter((d) => d.wallId === w.id);
    const wallDemos = (project?.demolitions || []).filter((d) => d.kind === "rivestimento" && d.wallId === w.id);
    const partial = w.demolito_partial && w.demolito_partial.to > w.demolito_partial.from ? w.demolito_partial : null;
    if (onThisWall.length > 0 || doorsOnWall.length > 0 || windowsOnWall.length > 0 || wallDemos.length > 0 || partial) {
      result.push({ wall: w, length: len, points: onThisWall, doors: doorsOnWall, windows: windowsOnWall, demolitions: wallDemos, partial });
    }
  });
  return result;
}

const COLORS = { electrical: "#7C3AED", plumbing: "#0EA5E9", gas: "#EAB308", hvac: "#0F766E" };

/**
 * ProspettoWall: side-view (elevation) of one wall.
 * Renders length × height (cm) WITH FULL DIMENSIONAL QUOTES:
 *   - Total length & height
 *   - For each door/window/demolition: width, distance from left, distance from right, height-from-floor (sill)
 *   - For each MEP point: h from floor + horizontal distance from left/right
 */
export function ProspettoWall({ entry, roomHeight, editable, heightOverrides, onChangeHeight, onChangePosition }) {
  const { wall, length, points, doors, windows, demolitions, partial } = entry;
  const W = length, H = roomHeight || 270;
  const [dragging, setDragging] = useState(null);
  const svgRef = React.useRef(null);
  // Bigger padding to host multiple dim chains; padBottom cresce con il numero di MEP points
  const padTop = 120;
  const padSide = 80;
  const padBottom = Math.max(180, 80 + (points?.length || 0) * 30 + 30);

  const onPointerMove = (e) => {
    if (!dragging || !svgRef.current) return;
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return;
    const local = pt.matrixTransform(ctm.inverse());
    const newH = Math.max(5, Math.min(H - 5, H - local.y));
    onChangeHeight && onChangeHeight(dragging, Math.round(newH / 5) * 5);
    const newT = Math.max(0, Math.min(1, local.x / W));
    onChangePosition && onChangePosition(dragging, parseFloat(newT.toFixed(3)));
  };
  const stopDrag = () => setDragging(null);

  // Pre-compute openings list with positions (cm)
  const openings = [
    ...doors.map((d) => ({ kind: "door", id: d.id, t: d.t, width: d.width, height: d.height, sill: 0, label: d.type === "blindata" ? "Blindata" : (d.type === "scorrevole" ? "Porta scorrevole" : "Porta"), color: d.type === "blindata" ? "#7C2D12" : "#0A0A0A", obj: d })),
    ...windows.map((wn) => ({ kind: "window", id: wn.id, t: wn.t, width: wn.width, height: wn.height, sill: wn.sillHeight || 90, label: wn.type === "porta-finestra" ? "Porta-finestra" : (wn.type === "scorrevole" ? "Finestra scorrevole" : (wn.type === "vasistas" ? "Vasistas" : "Finestra")), color: "#0A0A0A", obj: wn })),
  ].sort((a, b) => a.t - b.t);

  return (
    <svg
      ref={svgRef}
      viewBox={`-${padSide} -${padTop} ${W + padSide * 2} ${H + padTop + padBottom}`}
      width="100%"
      style={{ display: "block", background: "#FFF" }}
      data-testid={`prospetto-svg-${wall.id}`}
      onPointerMove={onPointerMove}
      onPointerUp={stopDrag}
      onPointerLeave={stopDrag}
    >
      {/* wall body */}
      <rect x={0} y={0} width={W} height={H} fill="#FAFAFA" stroke="#0A0A0A" strokeWidth="2" />
      {/* floor hatch */}
      <line x1={0} y1={H} x2={W} y2={H} stroke="#0A0A0A" strokeWidth="3" />
      <line x1={-30} y1={H + 8} x2={W + 30} y2={H + 8} stroke="#0A0A0A" strokeWidth="1" />
      {Array.from({ length: Math.floor((W + 60) / 18) }).map((_, i) => (
        <line key={i} x1={-30 + i * 18} y1={H + 8} x2={-40 + i * 18} y2={H + 18} stroke="#71717A" strokeWidth="0.6" />
      ))}

      {/* TOTAL DIMENSION CHAIN (top, far) + per-element dim chain (top, near) */}
      <DimLine x1={0} y1={-90} x2={W} y2={-90} label={`L tot ${fmtNum(W / 100, 2)} m`} color="#0A0A0A" big />
      <DimLineV x1={W + 50} y1={0} x2={W + 50} y2={H} label={`H ${fmtNum(H / 100, 2)} m`} color="#0A0A0A" big />
      {/* IMPIANTI PRESENTI: piccolo riepilogo in alto a dx */}
      {(() => {
        const kinds = {};
        (points || []).forEach((p) => { kinds[p.kind] = (kinds[p.kind] || 0) + 1; });
        const entries = Object.entries(kinds);
        if (entries.length === 0) return null;
        const labels = { electrical: "Elettrico", plumbing: "Idraulico", gas: "Gas", hvac: "Condiz." };
        return (
          <g pointerEvents="none">
            <rect x={W - 180} y={-padTop + 4} width={180} height={22 + entries.length * 14} rx={2} fill="white" stroke="#0A0A0A" strokeWidth="1" />
            <text x={W - 170} y={-padTop + 20} fontFamily="JetBrains Mono" fontSize="9" fontWeight="700" fill="#71717A" letterSpacing="1">IMPIANTI SU QUESTA PARETE</text>
            {entries.map(([k, n], i) => (
              <text key={k} x={W - 170} y={-padTop + 36 + i * 14} fontFamily="JetBrains Mono" fontSize="11" fontWeight="700" fill="#0A0A0A">{`• ${labels[k] || k}: ${n} punti`}</text>
            ))}
          </g>
        );
      })()}

      {/* PARTIAL WALL DEMOLITION (rendered inside wall) */}
      {partial && (() => {
        const xa = partial.from * W, xb = partial.to * W;
        const wDem = xb - xa;
        const hDem = partial.height || H;
        const yDem = H - hDem;
        return (
          <g key="partial-demo">
            <pattern id={`hatch-demo-${wall.id}`} patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="10" stroke="#DC2626" strokeWidth="2" />
            </pattern>
            <rect x={xa} y={yDem} width={wDem} height={hDem} fill={`url(#hatch-demo-${wall.id})`} stroke="#DC2626" strokeWidth="2" strokeDasharray="6,4" opacity="0.85" />
            <text x={xa + wDem / 2} y={yDem - 6} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="11" fontWeight="800" fill="#DC2626">{`DEMO MURO ${Math.round(wDem)}×${Math.round(hDem)} cm`}</text>
            {/* quote width sotto */}
            <DimLine x1={xa} y1={H + 50} x2={xb} y2={H + 50} label={`${Math.round(wDem)} cm`} color="#DC2626" />
          </g>
        );
      })()}

      {/* CLADDING DEMOLITION zones on this wall */}
      {(demolitions || []).map((d) => {
        const xFrom = (d.xFrom != null ? d.xFrom : 0);
        const xTo = (d.xTo != null ? d.xTo : Math.min(W, 100));
        const hFromFloor = d.hFromFloor != null ? d.hFromFloor : 0;
        const hDem = d.height != null ? d.height : H;
        const w0 = xTo - xFrom;
        const yDem = H - hFromFloor - hDem;
        return (
          <g key={d.id}>
            <pattern id={`hatch-rivest-${d.id}`} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="#F97316" strokeWidth="1.5" />
            </pattern>
            <rect x={xFrom} y={yDem} width={w0} height={hDem} fill={`url(#hatch-rivest-${d.id})`} stroke="#F97316" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.7" />
            <text x={xFrom + w0 / 2} y={yDem + hDem / 2} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" fontWeight="700" fill="#C2410C">DEMO RIV.<tspan x={xFrom + w0 / 2} dy="14">{Math.round(w0)}×{Math.round(hDem)}</tspan></text>
          </g>
        );
      })}

      {/* OPENINGS + per-element quotes */}
      {openings.map((o) => {
        const xCenter = o.t * W;
        const x = xCenter - o.width / 2;
        const xR = x + o.width;
        const yTop = o.kind === "window" ? H - o.sill - o.height : H - o.height;
        const distSx = Math.round(x);
        const distDx = Math.round(W - xR);
        return (
          <g key={`${o.kind}-${o.id}`}>
            {/* opening box */}
            {o.kind === "window" ? (
              <>
                <rect x={x} y={yTop} width={o.width} height={o.height} fill="#DBEAFE" fillOpacity="0.5" stroke={o.color} strokeWidth="1.5" />
                <line x1={x} y1={yTop + o.height / 2} x2={x + o.width} y2={yTop + o.height / 2} stroke={o.color} strokeWidth="0.6" />
                <line x1={x + o.width / 2} y1={yTop} x2={x + o.width / 2} y2={yTop + o.height} stroke={o.color} strokeWidth="0.6" />
              </>
            ) : (
              <>
                <rect x={x} y={yTop} width={o.width} height={o.height} fill="#FAFAFA" stroke={o.color} strokeWidth={o.label === "Blindata" ? 3 : 1.5} />
                {/* swing arc indication */}
                <line x1={x + o.width / 2} y1={yTop + 15} x2={x + o.width / 2 + 10} y2={yTop + 15} stroke={o.color} strokeWidth="1" />
              </>
            )}
            {/* element label sopra */}
            <text x={xCenter} y={yTop - 8} textAnchor="middle" fontFamily="Outfit" fontSize="13" fontWeight="600" fill="#0A0A0A">{o.label}</text>
            {/* width dim sotto al pavimento */}
            <DimLine x1={x} y1={H + 30} x2={xR} y2={H + 30} label={`${Math.round(o.width)}`} color="#0A0A0A" />
            {/* sx dim (distance from left) */}
            {distSx > 5 && <DimLine x1={0} y1={H + 60} x2={x} y2={H + 60} label={`sx ${distSx}`} color="#0A0A0A" small />}
            {/* dx dim (distance from right) */}
            {distDx > 5 && <DimLine x1={xR} y1={H + 60} x2={W} y2={H + 60} label={`dx ${distDx}`} color="#0A0A0A" small />}
            {/* opening height (vertical, RIGHT side) */}
            <DimLineV x1={x - 18} y1={yTop} x2={x - 18} y2={yTop + o.height} label={`H ${o.height}`} color="#0A0A0A" small />
            {/* sill height (vertical, from floor) */}
            {o.kind === "window" && o.sill > 0 && (
              <DimLineV x1={xR + 18} y1={yTop + o.height} x2={xR + 18} y2={H} label={`par. ${o.sill}`} color="#0A0A0A" small />
            )}
          </g>
        );
      })}

      {/* MEP points */}
      {/* TABELLA QUOTE ordinata sotto il prospetto: una riga per punto, niente sovrapposizioni */}
      {(() => {
        const sorted = points.slice().sort((a, b) => (a.t - b.t));
        const ROW_H = 24;
        const TABLE_TOP = H + 70;
        return (
          <g pointerEvents="none">
            {/* Header tabella */}
            <rect x={0} y={TABLE_TOP - 18} width={W} height={20} fill="#FAFAFA" stroke="#D4D4D8" strokeWidth="1" />
            <text x={6} y={TABLE_TOP - 4} fontFamily="JetBrains Mono" fontSize="10" fontWeight="900" fill="#3F3F46">N°</text>
            <text x={40} y={TABLE_TOP - 4} fontFamily="JetBrains Mono" fontSize="10" fontWeight="900" fill="#3F3F46">SIGLA</text>
            <text x={120} y={TABLE_TOP - 4} fontFamily="JetBrains Mono" fontSize="10" fontWeight="900" fill="#3F3F46">SX (cm)</text>
            <text x={230} y={TABLE_TOP - 4} fontFamily="JetBrains Mono" fontSize="10" fontWeight="900" fill="#3F3F46">DX (cm)</text>
            <text x={340} y={TABLE_TOP - 4} fontFamily="JetBrains Mono" fontSize="10" fontWeight="900" fill="#3F3F46">H (cm)</text>
            {sorted.map((p, n) => {
              const x = p.t * W;
              const stdKey = p.type || p.kind;
              const stdH = STD_HEIGHTS[stdKey] ?? 110;
              const ovr = heightOverrides?.[p.id];
              const h = (typeof ovr === "number" && !isNaN(ovr)) ? ovr : stdH;
              const sx = Math.round(p.t * W);
              const dx = Math.round((1 - p.t) * W);
              const yRow = TABLE_TOP + n * ROW_H;
              const color = colorFor(p);
              const sym = symbolFor(p);
              return (
                <g key={`row-${p.id}`}>
                  {/* zebra background */}
                  <rect x={0} y={yRow} width={W} height={ROW_H} fill={n % 2 === 0 ? "#FFFFFF" : "#FAFAFA"} stroke="#E4E4E7" strokeWidth="0.5" />
                  {/* leader line: dal punto sulla parete fino alla riga */}
                  <line x1={x} y1={H + 2} x2={x} y2={yRow + ROW_H / 2} stroke={color} strokeWidth="0.6" strokeDasharray="2,3" opacity="0.45" />
                  {/* Numero progressivo */}
                  <text x={6} y={yRow + 16} fontFamily="JetBrains Mono" fontSize="12" fontWeight="700" fill="#0A0A0A">{`${n + 1}.`}</text>
                  {/* Sigla con cerchietto colorato */}
                  <circle cx={50} cy={yRow + 12} r={9} fill="white" stroke={color} strokeWidth="2" />
                  <text x={50} y={yRow + 16} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="11" fontWeight="900" fill={color}>{sym}</text>
                  {/* Label tipo (es. presa, faretto, …) */}
                  <text x={66} y={yRow + 16} fontFamily="JetBrains Mono" fontSize="11" fontWeight="600" fill="#3F3F46">{(stdKey || "").slice(0, 8)}</text>
                  {/* SX */}
                  <text x={120} y={yRow + 16} fontFamily="JetBrains Mono" fontSize="13" fontWeight="800" fill="#0A0A0A">{sx}</text>
                  {/* DX */}
                  <text x={230} y={yRow + 16} fontFamily="JetBrains Mono" fontSize="13" fontWeight="800" fill="#0A0A0A">{dx}</text>
                  {/* H */}
                  <text x={340} y={yRow + 16} fontFamily="JetBrains Mono" fontSize="13" fontWeight="800" fill="#0A0A0A">{h}</text>
                </g>
              );
            })}
          </g>
        );
      })()}

      {points.map((p, idx) => {
        const x = p.t * W;
        const stdKey = p.type || p.kind;
        const stdH = STD_HEIGHTS[stdKey] ?? 110;
        const ovr = heightOverrides?.[p.id];
        const h = (typeof ovr === "number" && !isNaN(ovr)) ? ovr : stdH;
        const y = H - h;
        const color = colorFor(p);
        // Cerchio leggermente più grande quando la sigla è più di 1 carattere
        const sym = symbolFor(p);
        const r = sym.length >= 2 ? 16 : 14;
        return (
          <g key={p.id} style={{ cursor: editable ? "move" : "default" }}
             onPointerDown={editable ? (e) => { e.preventDefault(); e.stopPropagation(); setDragging(p.id); } : undefined}
             data-testid={`prospetto-point-${p.id}`}
          >
            <line x1={x} y1={H} x2={x} y2={y} stroke={color} strokeWidth="1.2" strokeDasharray="3,3" opacity="0.6" />
            <circle cx={x} cy={y} r={r} fill="white" stroke={color} strokeWidth="2.5" />
            <text x={x} y={y + 4} textAnchor="middle" fontSize={sym.length >= 3 ? "10" : "12"} fontWeight="900" fontFamily="JetBrains Mono" fill={color} pointerEvents="none">{sym}</text>
          </g>
        );
      })}

      {/* legend on top-left */}
      <text x={0} y={-padTop + 18} fontFamily="Outfit" fontSize="13" fontWeight="700" fill="#0A0A0A">{`Parete · L=${fmtNum(W / 100, 2)}m · H=${fmtNum(H / 100, 2)}m`}</text>
      <text x={0} y={-padTop + 36} fontFamily="JetBrains Mono" fontSize="9" fill="#525252">quote in cm · sx/dx = distanze dai bordi parete · h = altezza da pavimento</text>
      {editable && <text x={W} y={-padTop + 18} textAnchor="end" fontFamily="JetBrains Mono" fontSize="10" fill="#16A34A">trascina i punti per posizione e altezza</text>}
    </svg>
  );
}

// Inline numeric inputs for prospetto heights & positions (precise editing)
export function ProspettoInputs({ entry, heightOverrides, onChangeHeight, onChangePosition }) {
  if (!entry.points.length) return null;
  const W = entry.length;
  return (
    <div className="bg-zinc-50 border-t border-zinc-200 p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2" data-testid={`prospetto-inputs-${entry.wall.id}`}>
      {entry.points.map((p) => {
        const stdKey = p.type || p.kind;
        const stdH = STD_HEIGHTS[stdKey] ?? 110;
        const h = heightOverrides?.[p.id] ?? stdH;
        const color = colorFor(p);
        const posCm = Math.round((p.t || 0) * W);
        return (
          <div key={p.id} className="flex items-center gap-2 bg-white border border-zinc-200 px-2 py-1.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: "white", border: `2px solid ${color}`, color }}>{symbolFor(p)}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">{p.type || p.kind}</div>
              <div className="flex items-center gap-1">
                <input type="number" value={h} onChange={(e) => onChangeHeight(p.id, parseInt(e.target.value) || 0)} className="w-12 text-sm font-mono border-0 bg-transparent p-0 focus:outline-none" step={5} data-testid={`prospetto-input-${p.id}`} title="Altezza (cm)" />
                <span className="text-[9px] mono text-zinc-400">h</span>
                {onChangePosition && (
                  <>
                    <input type="number" value={posCm} onChange={(e) => onChangePosition(p.id, Math.max(0, Math.min(1, (parseInt(e.target.value) || 0) / W)))} className="w-14 text-sm font-mono border-0 bg-transparent p-0 focus:outline-none border-l border-zinc-200 pl-2" step={5} data-testid={`prospetto-pos-${p.id}`} title="Posizione orizzontale dal lato sinistro (cm)" />
                    <span className="text-[9px] mono text-zinc-400">x</span>
                  </>
                )}
              </div>
            </div>
            <span className="text-[10px] mono text-zinc-400">cm</span>
          </div>
        );
      })}
    </div>
  );
}

function symbolFor(p) {
  const t = p.type || p.kind;
  if (t === "presa") return "P";
  if (t === "presa-cucina") return "P+";
  if (t === "presa-tv") return "TV";
  if (t === "presa-rj45") return "RJ";
  if (t === "interruttore") return "I";
  if (t === "deviatore") return "DV";
  if (t === "punto-luce-led") return "LED";
  if (t === "luce" || t === "punto-luce") return "L";
  if (t === "scatola") return "■";
  if (t === "quadro" || t === "quadro-elettrico") return "Q";
  if (t === "acqua-calda") return "C";
  if (t === "acqua-fredda") return "F";
  if (t === "scarico") return "S";
  if (t === "lavatrice") return "LV";
  if (t === "lavastoviglie") return "LS";
  if (t === "gas" || p.kind === "gas") return "G";
  if (t === "split") return "❄";
  if (t === "esterna") return "U";
  if (t === "predisposizione") return "P";
  return "•";
}

// Colore dedicato per ogni tipo elettrico (oltre al colore-kind generico)
function colorFor(p) {
  const t = p.type || p.kind;
  if (t === "presa") return "#7C3AED";
  if (t === "presa-cucina") return "#EA580C";
  if (t === "presa-tv") return "#0E7490";
  if (t === "presa-rj45") return "#0F766E";
  if (t === "deviatore") return "#9333EA";
  if (t === "punto-luce-led") return "#F59E0B";
  if (t === "interruttore") return "#7C3AED";
  if (t === "luce" || t === "punto-luce") return "#7C3AED";
  if (t === "quadro" || t === "quadro-elettrico") return "#7C3AED";
  if (t === "acqua-calda") return "#DC2626";
  if (t === "acqua-fredda") return "#0EA5E9";
  if (t === "scarico") return "#0891B2";
  return COLORS[p.kind] || "#525252";
}

function DimLine({ x1, y1, x2, y2, label, color = "#16A34A", big = false, small = false }) {
  const tickH = small ? 4 : (big ? 7 : 6);
  const fontSize = small ? 10 : (big ? 13 : 11);
  const boxH = small ? 16 : (big ? 22 : 18);
  const boxW = Math.max(40, label.length * 7 + 14);
  if (Math.abs(x2 - x1) < 4) return null;
  return (
    <g pointerEvents="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="0.8" />
      <line x1={x1} y1={y1 - tickH} x2={x1} y2={y1 + tickH} stroke={color} strokeWidth="1" />
      <line x1={x2} y1={y2 - tickH} x2={x2} y2={y2 + tickH} stroke={color} strokeWidth="1" />
      <rect x={(x1 + x2) / 2 - boxW / 2} y={y1 - boxH / 2} width={boxW} height={boxH} fill="white" stroke={color} strokeWidth="1" />
      <text x={(x1 + x2) / 2} y={y1 + (small ? 3 : 4)} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={fontSize} fontWeight={big ? 800 : 700} fill={color}>{label}</text>
    </g>
  );
}
function DimLineV({ x1, y1, x2, y2, label, color = "#16A34A", big = false, small = false }) {
  const tickW = small ? 4 : (big ? 7 : 6);
  const fontSize = small ? 10 : (big ? 13 : 11);
  const boxH = small ? 16 : (big ? 22 : 18);
  const boxW = Math.max(50, label.length * 7 + 14);
  if (Math.abs(y2 - y1) < 4) return null;
  return (
    <g pointerEvents="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="0.8" />
      <line x1={x1 - tickW} y1={y1} x2={x1 + tickW} y2={y1} stroke={color} strokeWidth="1" />
      <line x1={x2 - tickW} y1={y2} x2={x2 + tickW} y2={y2} stroke={color} strokeWidth="1" />
      <rect x={x1 - boxW / 2} y={(y1 + y2) / 2 - boxH / 2} width={boxW} height={boxH} fill="white" stroke={color} strokeWidth="1" />
      <text x={x1} y={(y1 + y2) / 2 + (small ? 3 : 4)} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={fontSize} fontWeight={big ? 800 : 700} fill={color}>{label}</text>
    </g>
  );
}
