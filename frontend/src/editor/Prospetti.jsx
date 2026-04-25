import React, { useMemo, useState } from "react";
import { fmtNum } from "./utils";

// Standard heights (cm) for installation elements on a wall (height from floor)
const STD_HEIGHTS = {
  // electrical
  "presa": 30,
  "presa-cucina": 110,
  "interruttore": 110,
  "luce": 220,
  "scatola": 110,
  "quadro": 160,
  // plumbing
  "acqua-fredda": 35,
  "acqua-calda": 35,
  "scarico": 30,
  // gas
  "gas": 40,
  // hvac
  "split": 220,
  "esterna": 250,
  "predisposizione": 220,
};

// Project a plan-view point onto a wall segment, returning {t, dist}
function projectOnWall(p, w) {
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
  const lenSq = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - w.x1) * dx + (p.y - w.y1) * dy) / lenSq));
  const cx = w.x1 + t * dx, cy = w.y1 + t * dy;
  return { t, dist: Math.hypot(cx - p.x, cy - p.y) };
}

// Find walls that are "interesting" for prospetto: in plumbing room OR have any electrical/plumbing/hvac point within 80 cm
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
      if (pr.dist < 80) {
        onThisWall.push({ ...p, t: pr.t });
      }
    });
    // Also include doors/windows on this wall
    const doorsOnWall = (project?.doors || []).filter((d) => d.wallId === w.id);
    const windowsOnWall = (project?.windows || []).filter((d) => d.wallId === w.id);
    if (onThisWall.length > 0 || doorsOnWall.length > 0 || windowsOnWall.length > 0) {
      result.push({ wall: w, length: len, points: onThisWall, doors: doorsOnWall, windows: windowsOnWall });
    }
  });
  return result;
}

const COLORS = {
  electrical: "#7C3AED", plumbing: "#0EA5E9", gas: "#EAB308", hvac: "#0F766E",
};

/**
 * ProspettoWall: side-view (elevation) of one wall.
 * Renders length × height (cm). Doors anchored to floor, windows at sillHeight.
 * Electrical/plumbing/gas/hvac points placed at standard heights (or override via heightOverrides[id]).
 * Editable: drag points vertically to change height.
 */
export function ProspettoWall({ entry, roomHeight, editable, heightOverrides, onChangeHeight }) {
  const { wall, length, points, doors, windows } = entry;
  const W = length, H = roomHeight || 270;
  const [dragging, setDragging] = useState(null);
  const svgRef = React.useRef(null);
  const pad = 60;

  const pxScaleX = 1, pxScaleY = 1; // 1cm = 1 unit in viewBox
  const onPointerMove = (e) => {
    if (!dragging || !svgRef.current) return;
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return;
    const local = pt.matrixTransform(ctm.inverse());
    // y in viewBox; floor is at H, ceiling at 0. height = H - local.y
    const newH = Math.max(5, Math.min(H - 5, H - local.y));
    onChangeHeight && onChangeHeight(dragging, Math.round(newH / 5) * 5);
  };
  const stopDrag = () => setDragging(null);

  return (
    <svg
      ref={svgRef}
      viewBox={`-${pad} -${pad} ${W + pad * 2} ${H + pad * 2}`}
      width="100%"
      style={{ display: "block", background: "#FFF" }}
      data-testid={`prospetto-svg-${wall.id}`}
      onPointerMove={onPointerMove}
      onPointerUp={stopDrag}
      onPointerLeave={stopDrag}
    >
      {/* floor and ceiling lines */}
      <rect x={0} y={0} width={W} height={H} fill="#FAFAFA" stroke="#0A0A0A" strokeWidth="2" />
      <line x1={0} y1={H} x2={W} y2={H} stroke="#0A0A0A" strokeWidth="3" />
      {/* hatched floor */}
      <line x1={-30} y1={H + 8} x2={W + 30} y2={H + 8} stroke="#0A0A0A" strokeWidth="1" />
      {Array.from({ length: Math.floor((W + 60) / 20) }).map((_, i) => (
        <line key={i} x1={-30 + i * 20} y1={H + 8} x2={-40 + i * 20} y2={H + 18} stroke="#71717A" strokeWidth="0.6" />
      ))}
      {/* total dimensions */}
      <DimLine x1={0} y1={-30} x2={W} y2={-30} label={`${fmtNum(W / 100, 2)} m`} color="#16A34A" />
      <DimLineV x1={W + 30} y1={0} x2={W + 30} y2={H} label={`${fmtNum(H / 100, 2)} m`} color="#16A34A" />

      {/* doors on this wall (always anchored to floor) */}
      {doors.map((d) => {
        const x = d.t * W - d.width / 2;
        const isBlind = d.type === "blindata";
        return (
          <g key={d.id}>
            <rect x={x} y={H - d.height} width={d.width} height={d.height} fill="#FAFAFA" stroke={isBlind ? "#7C2D12" : "#0A0A0A"} strokeWidth={isBlind ? 3 : 1.5} />
            <text x={x + d.width / 2} y={H + 32} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="14" fontWeight="700" fill="#0A0A0A">{d.width}×{d.height}</text>
            <text x={x + d.width / 2} y={H - d.height - 6} textAnchor="middle" fontFamily="Outfit" fontSize="13" fill="#0A0A0A">{isBlind ? "Blindata" : (d.type === "scorrevole" ? "Scorr." : "Porta")}</text>
          </g>
        );
      })}

      {/* windows on this wall */}
      {windows.map((wn) => {
        const x = wn.t * W - wn.width / 2;
        const sill = wn.sillHeight || 90;
        const yTop = H - sill - wn.height;
        return (
          <g key={wn.id}>
            <rect x={x} y={yTop} width={wn.width} height={wn.height} fill="#DBEAFE" fillOpacity="0.5" stroke="#0A0A0A" strokeWidth="1.5" />
            <line x1={x} y1={yTop + wn.height / 2} x2={x + wn.width} y2={yTop + wn.height / 2} stroke="#0A0A0A" strokeWidth="0.6" />
            <line x1={x + wn.width / 2} y1={yTop} x2={x + wn.width / 2} y2={yTop + wn.height} stroke="#0A0A0A" strokeWidth="0.6" />
            <text x={x + wn.width / 2} y={H + 32} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="14" fontWeight="700" fill="#0A0A0A">{wn.width}×{wn.height}</text>
            <text x={x + wn.width / 2} y={yTop - 6} textAnchor="middle" fontFamily="Outfit" fontSize="13" fill="#0A0A0A">{wn.type === "porta-finestra" ? "Porta-finestra" : "Finestra"} (h={sill})</text>
          </g>
        );
      })}

      {/* points (electrical/plumbing/gas/hvac) */}
      {points.map((p) => {
        const x = p.t * W;
        const stdKey = p.type || p.kind;
        const stdH = STD_HEIGHTS[stdKey] ?? 110;
        const h = heightOverrides?.[p.id] ?? stdH;
        const y = H - h;
        const color = COLORS[p.kind] || "#525252";
        return (
          <g key={p.id} style={{ cursor: editable ? "ns-resize" : "default" }}
             onPointerDown={editable ? (e) => { e.preventDefault(); setDragging(p.id); } : undefined}
             data-testid={`prospetto-point-${p.id}`}
          >
            <line x1={x} y1={H} x2={x} y2={y} stroke={color} strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
            <circle cx={x} cy={y} r="14" fill="white" stroke={color} strokeWidth="2.5" />
            <text x={x} y={y + 5} textAnchor="middle" fontSize="13" fontWeight="800" fontFamily="JetBrains Mono" fill={color}>{symbolFor(p)}</text>
            <text x={x + 18} y={y + 5} fontFamily="JetBrains Mono" fontSize="11" fontWeight="700" fill={color}>h={h}</text>
          </g>
        );
      })}

      {/* legend at bottom */}
      <text x={0} y={H + 60} fontFamily="Outfit" fontSize="13" fontWeight="700" fill="#0A0A0A">Parete · L={fmtNum(W / 100, 2)}m · H={fmtNum(H / 100, 2)}m</text>
      {editable && <text x={W} y={H + 60} textAnchor="end" fontFamily="JetBrains Mono" fontSize="10" fill="#16A34A">trascina i punti per regolare l'altezza</text>}
    </svg>
  );
}

function symbolFor(p) {
  const t = p.type || p.kind;
  if (t === "presa" || t === "presa-cucina") return "P";
  if (t === "interruttore") return "I";
  if (t === "luce") return "L";
  if (t === "scatola") return "■";
  if (t === "quadro") return "Q";
  if (t === "acqua-calda") return "C";
  if (t === "acqua-fredda") return "F";
  if (t === "scarico") return "S";
  if (t === "gas" || p.kind === "gas") return "G";
  if (t === "split") return "❄";
  if (t === "esterna") return "U";
  if (t === "predisposizione") return "P";
  return "•";
}

function DimLine({ x1, y1, x2, y2, label, color = "#16A34A" }) {
  return (
    <g pointerEvents="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1" />
      <line x1={x1} y1={y1 - 6} x2={x1} y2={y1 + 6} stroke={color} strokeWidth="1" />
      <line x1={x2} y1={y2 - 6} x2={x2} y2={y2 + 6} stroke={color} strokeWidth="1" />
      <rect x={(x1 + x2) / 2 - 50} y={y1 - 14} width={100} height={20} fill="white" stroke={color} strokeWidth="1.5" />
      <text x={(x1 + x2) / 2} y={y1 + 1} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="13" fontWeight="800" fill={color}>{label}</text>
    </g>
  );
}
function DimLineV({ x1, y1, x2, y2, label, color = "#16A34A" }) {
  return (
    <g pointerEvents="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1" />
      <line x1={x1 - 6} y1={y1} x2={x1 + 6} y2={y1} stroke={color} strokeWidth="1" />
      <line x1={x2 - 6} y1={y2} x2={x2 + 6} y2={y2} stroke={color} strokeWidth="1" />
      <rect x={x1 - 50} y={(y1 + y2) / 2 - 10} width={100} height={20} fill="white" stroke={color} strokeWidth="1.5" />
      <text x={x1} y={(y1 + y2) / 2 + 5} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="13" fontWeight="800" fill={color}>{label}</text>
    </g>
  );
}
