import React, { useMemo, useRef, useState, useCallback } from "react";
import { PX_PER_CM, snap, uid, polygonArea, polygonPerimeter, fmtNum } from "./utils";

/**
 * 2D floor plan editor.
 * Tools:
 *  - select  : click to select walls / rooms / items
 *  - wall    : click-click to draw walls (double click to stop)
 *  - room    : polygon click to close
 *  - door    : click on a wall
 *  - window  : click on a wall
 *  - item    : places last selected catalog item on canvas
 *  - delete  : click to delete
 *
 * Canvas coords = cm. SVG uses world coords directly.
 */
const WORLD_W = 1600; // cm
const WORLD_H = 1200;
const GRID = 10;      // 10cm grid

function Measurement({ x1, y1, x2, y2 }) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  return (
    <g transform={`translate(${mx},${my}) rotate(${angle})`} pointerEvents="none">
      <text y={-8} textAnchor="middle" fontSize="12" fontFamily="JetBrains Mono" fill="#2563EB">
        {fmtNum(len / 100, 2)} m
      </text>
    </g>
  );
}

export default function Canvas2D({ project, setProject, tool, setTool, selected, setSelected, selectedMaterial, catalog }) {
  const svgRef = useRef(null);
  const [wallDraft, setWallDraft] = useState(null); // {x1,y1}
  const [roomDraft, setRoomDraft] = useState([]);   // [{x,y}]
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: WORLD_W, h: WORLD_H });
  const [pan, setPan] = useState(null);

  const catalogById = useMemo(() => Object.fromEntries((catalog || []).map((m) => [m.id, m])), [catalog]);

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
  };

  const onMouseDown = (e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setPan({ sx: e.clientX, sy: e.clientY, vb: { ...viewBox } });
      return;
    }
    const p = snapPt(toWorld(e));

    if (tool === "wall") {
      if (!wallDraft) { setWallDraft(p); return; }
      // add wall
      const newWall = { id: uid(), x1: wallDraft.x, y1: wallDraft.y, x2: p.x, y2: p.y, thickness: 10 };
      setProject((prj) => ({ ...prj, walls: [...(prj.walls || []), newWall] }));
      setWallDraft(p); // chain
      return;
    }
    if (tool === "room") {
      setRoomDraft((arr) => [...arr, p]);
      return;
    }
    if (tool === "door" || tool === "window") {
      // find closest wall
      const walls = project.walls || [];
      let best = null; let bestD = 1e9;
      walls.forEach((w) => {
        const t = projectPointOnSegment(p, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
        const cx = w.x1 + t.t * (w.x2 - w.x1);
        const cy = w.y1 + t.t * (w.y2 - w.y1);
        const d = Math.hypot(cx - p.x, cy - p.y);
        if (d < bestD) { bestD = d; best = { w, t: t.t }; }
      });
      if (best && bestD < 30) {
        const op = tool === "door"
          ? { id: uid(), wallId: best.w.id, t: best.t, width: 80, height: 210 }
          : { id: uid(), wallId: best.w.id, t: best.t, width: 120, height: 140, sillHeight: 90 };
        setProject((prj) => ({
          ...prj,
          [tool === "door" ? "doors" : "windows"]: [...(prj[tool === "door" ? "doors" : "windows"] || []), op],
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
        items: [...(prj.items || []), {
          id: uid(), type: t, materialId: m.id, x: p.x, y: p.y, rotation: 0, qty: 1, ...defaults,
        }],
      }));
      return;
    }
    if (tool === "select") {
      setSelected(null);
    }
    if (tool === "delete") {
      // handled per-element in their handlers
    }
  };

  const onDblClick = () => {
    if (tool === "wall") { setWallDraft(null); }
    if (tool === "room" && roomDraft.length >= 3) {
      const newRoom = {
        id: uid(),
        name: `Stanza ${(project.rooms || []).length + 1}`,
        points: roomDraft,
        floorMaterial: "floor-ceramic",
        wallMaterial: "wall-paint",
        ceilingMaterial: "ceil-paint",
        electrical: true,
        plumbing: false,
      };
      setProject((prj) => ({ ...prj, rooms: [...(prj.rooms || []), newRoom] }));
      setRoomDraft([]);
    }
  };

  const onWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    const p = toWorld(e);
    const nw = viewBox.w * factor;
    const nh = viewBox.h * factor;
    const nx = p.x - (p.x - viewBox.x) * factor;
    const ny = p.y - (p.y - viewBox.y) * factor;
    setViewBox({ x: nx, y: ny, w: nw, h: nh });
  };

  const handleElementClick = (kind, id) => {
    if (tool === "delete") {
      setProject((prj) => ({ ...prj, [kind]: (prj[kind] || []).filter((x) => x.id !== id) }));
      return;
    }
    setSelected({ kind, id });
  };

  const walls = project.walls || [];
  const doors = project.doors || [];
  const windows = project.windows || [];
  const rooms = project.rooms || [];
  const items = project.items || [];

  return (
    <div className="relative w-full h-full bg-[#FAFAFA]">
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className="w-full h-full select-none"
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={() => setPan(null)}
        onMouseLeave={() => setPan(null)}
        onDoubleClick={onDblClick}
        onWheel={onWheel}
        data-testid="canvas-2d"
      >
        {/* grid */}
        <defs>
          <pattern id="grid-small" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#E4E4E7" strokeWidth="0.3" />
          </pattern>
          <pattern id="grid-big" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#grid-small)" />
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#D4D4D8" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="url(#grid-big)" />

        {/* rooms (fills) */}
        {rooms.map((r) => {
          const mat = catalogById[r.floorMaterial];
          const pts = r.points.map((p) => `${p.x},${p.y}`).join(" ");
          const isSel = selected?.kind === "rooms" && selected.id === r.id;
          const cx = r.points.reduce((s, p) => s + p.x, 0) / r.points.length;
          const cy = r.points.reduce((s, p) => s + p.y, 0) / r.points.length;
          const areaM2 = polygonArea(r.points) / 10000;
          return (
            <g key={r.id}
              onMouseDown={(e) => { e.stopPropagation(); handleElementClick("rooms", r.id); }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                const newName = window.prompt("Nome stanza:", r.name || "");
                if (newName !== null) {
                  setProject((prj) => ({ ...prj, rooms: (prj.rooms || []).map((x) => x.id === r.id ? { ...x, name: newName } : x) }));
                }
              }}
              style={{ cursor: "pointer" }}
              data-testid={`room-${r.id}`}
            >
              <polygon
                points={pts}
                fill={mat?.color || "#F4F4F5"}
                fillOpacity={isSel ? 0.6 : 0.35}
                stroke={isSel ? "#2563EB" : "#A1A1AA"}
                strokeWidth={isSel ? 2 : 0.6}
                strokeDasharray="4 3"
              />
              <text x={cx} y={cy - 6} fontSize="14" textAnchor="middle" fontFamily="Outfit" fill="#0A0A0A" fontWeight="600">
                {r.name}
              </text>
              <text x={cx} y={cy + 12} fontSize="11" textAnchor="middle" fontFamily="JetBrains Mono" fill="#71717A">
                {fmtNum(areaM2, 2)} m²
              </text>
            </g>
          );
        })}

        {/* walls */}
        {walls.map((w) => {
          const isSel = selected?.kind === "walls" && selected.id === w.id;
          const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
          return (
            <g key={w.id} onMouseDown={(e) => { e.stopPropagation(); handleElementClick("walls", w.id); }} style={{ cursor: "pointer" }}>
              <line
                x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}
                stroke={isSel ? "#2563EB" : "#0A0A0A"}
                strokeWidth={w.thickness || 10}
                strokeLinecap="butt"
              />
              {/* hit area for easier selection */}
              <line
                x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}
                stroke="transparent" strokeWidth="20"
              />
              {/* always show measurement */}
              {len > 30 && <Measurement x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} />}
            </g>
          );
        })}

        {/* doors */}
        {doors.map((d) => {
          const w = walls.find((ww) => ww.id === d.wallId); if (!w) return null;
          const cx = w.x1 + d.t * (w.x2 - w.x1);
          const cy = w.y1 + d.t * (w.y2 - w.y1);
          const angle = Math.atan2(w.y2 - w.y1, w.x2 - w.x1) * 180 / Math.PI;
          const isSel = selected?.kind === "doors" && selected.id === d.id;
          return (
            <g key={d.id} transform={`translate(${cx},${cy}) rotate(${angle})`} onMouseDown={(e) => { e.stopPropagation(); handleElementClick("doors", d.id); }} style={{ cursor: "pointer" }}>
              <rect x={-d.width / 2} y={-6} width={d.width} height={12} fill="#FAFAFA" stroke="none" />
              <path d={`M ${-d.width / 2} 0 A ${d.width} ${d.width} 0 0 1 ${d.width / 2} 0`} fill="none" stroke={isSel ? "#2563EB" : "#2563EB"} strokeWidth="1" strokeDasharray="3,3" opacity="0.7" />
              <line x1={-d.width / 2} y1={0} x2={d.width / 2} y2={0} stroke={isSel ? "#2563EB" : "#71717A"} strokeWidth="1.5" />
            </g>
          );
        })}

        {/* windows */}
        {windows.map((wn) => {
          const w = walls.find((ww) => ww.id === wn.wallId); if (!w) return null;
          const cx = w.x1 + wn.t * (w.x2 - w.x1);
          const cy = w.y1 + wn.t * (w.y2 - w.y1);
          const angle = Math.atan2(w.y2 - w.y1, w.x2 - w.x1) * 180 / Math.PI;
          const isSel = selected?.kind === "windows" && selected.id === wn.id;
          return (
            <g key={wn.id} transform={`translate(${cx},${cy}) rotate(${angle})`} onMouseDown={(e) => { e.stopPropagation(); handleElementClick("windows", wn.id); }} style={{ cursor: "pointer" }}>
              <rect x={-wn.width / 2} y={-6} width={wn.width} height={12} fill="#FAFAFA" />
              <rect x={-wn.width / 2} y={-3} width={wn.width} height={6} fill="none" stroke={isSel ? "#2563EB" : "#0A0A0A"} strokeWidth="1" />
              <line x1={-wn.width / 2} y1={0} x2={wn.width / 2} y2={0} stroke={isSel ? "#2563EB" : "#0A0A0A"} strokeWidth="1" />
            </g>
          );
        })}

        {/* items */}
        {items.map((it) => {
          const m = catalogById[it.materialId];
          const color = m?.color || "#71717A";
          const isSel = selected?.kind === "items" && selected.id === it.id;
          const w = it.width || 60, d = it.depth || 60;
          return (
            <g key={it.id} transform={`translate(${it.x},${it.y}) rotate(${it.rotation || 0})`} onMouseDown={(e) => { e.stopPropagation(); handleElementClick("items", it.id); }} style={{ cursor: "pointer" }}>
              <rect x={-w / 2} y={-d / 2} width={w} height={d} fill={color} fillOpacity="0.85" stroke={isSel ? "#2563EB" : "#3F3F46"} strokeWidth={isSel ? 1.5 : 0.6} />
              <text x={0} y={4} fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono" fill="#0A0A0A">
                {(m?.name || "item").slice(0, 12)}
              </text>
            </g>
          );
        })}

        {/* wall draft preview */}
        {tool === "wall" && wallDraft && (
          <g pointerEvents="none">
            <line x1={wallDraft.x} y1={wallDraft.y} x2={cursor.x} y2={cursor.y} stroke="#2563EB" strokeWidth="10" strokeOpacity="0.35" />
            <Measurement x1={wallDraft.x} y1={wallDraft.y} x2={cursor.x} y2={cursor.y} />
          </g>
        )}

        {/* room draft preview */}
        {tool === "room" && roomDraft.length > 0 && (
          <g pointerEvents="none">
            <polyline
              points={[...roomDraft, cursor].map((p) => `${p.x},${p.y}`).join(" ")}
              fill="#2563EB" fillOpacity="0.08" stroke="#2563EB" strokeWidth="1" strokeDasharray="4 3"
            />
            {roomDraft.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill="#2563EB" />)}
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

      {/* Info overlay */}
      <div className="absolute bottom-3 left-3 bg-white border border-zinc-200 px-3 py-1.5 text-xs mono text-zinc-600 flex gap-4" data-testid="canvas-info">
        <span>x: {fmtNum(cursor.x / 100, 2)}m</span>
        <span>y: {fmtNum(cursor.y / 100, 2)}m</span>
        <span className="text-zinc-400">|</span>
        <span>{walls.length}m · {rooms.length}r · {items.length}i</span>
      </div>
      <div className="absolute bottom-3 right-3 bg-white border border-zinc-200 px-3 py-1.5 text-xs mono text-zinc-500">
        alt+trascina per panorare · rotella per zoom
      </div>

      {tool === "wall" && (
        <div className="absolute top-3 left-3 bg-zinc-900 text-white px-3 py-1.5 text-xs mono">
          click per punti · doppio click per terminare
        </div>
      )}
      {tool === "room" && (
        <div className="absolute top-3 left-3 bg-zinc-900 text-white px-3 py-1.5 text-xs mono">
          click per vertici · doppio click per chiudere poligono
        </div>
      )}
    </div>
  );
}

function projectPointOnSegment(p, a, b) {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const t = ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y || 1);
  return { t: Math.max(0, Math.min(1, t)) };
}

function defaultItemSize(m) {
  // cm
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
