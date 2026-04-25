import React, { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { PX_PER_CM, snap, uid, polygonArea, polygonPerimeter, fmtNum } from "./utils";

/**
 * 2D floor plan editor.
 * Tools:
 *  - select  : click to select walls / rooms / items
 *  - wall    : click-click to draw walls (double click to stop)
 *  - room    : polygon click to close (delayed to avoid double-click stray point)
 *  - door    : click on a wall (snaps to nearest wall)
 *  - window  : click on a wall
 *  - item    : places last selected catalog item on canvas
 *  - delete  : click to delete
 *
 * Canvas coords = cm. SVG uses world coords directly.
 */
const WORLD_W = 1600; // cm
const WORLD_H = 1200;
const GRID = 10;      // 10cm grid
const INITIAL_VIEW = { x: -300, y: -200, w: WORLD_W + 600, h: WORLD_H + 400 };

function Measurement({ x1, y1, x2, y2, big = false, color = "#16A34A" }) {
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

export default function Canvas2D({
  project, setProject, tool, setTool, selected, setSelected,
  selectedMaterial, catalog,
  doorParams, windowParams,
}) {
  const svgRef = useRef(null);
  const [wallDraft, setWallDraft] = useState(null);
  const [roomDraft, setRoomDraft] = useState([]);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [viewBox, setViewBox] = useState(INITIAL_VIEW);
  const [pan, setPan] = useState(null);
  const pendingRoomClickRef = useRef(null);
  const pendingWallClickRef = useRef(null);

  const catalogById = useMemo(() => Object.fromEntries((catalog || []).map((m) => [m.id, m])), [catalog]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (pendingRoomClickRef.current) clearTimeout(pendingRoomClickRef.current);
    if (pendingWallClickRef.current) clearTimeout(pendingWallClickRef.current);
  }, []);

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
        const op = { id: uid(), wallId: best.w.id, t: best.t, width: dp.width || 80, height: dp.height || 210, type: dp.type || "interna" };
        setProject((prj) => ({ ...prj, doors: [...(prj.doors || []), op] }));
      } else {
        const wp = windowParams || { width: 120, height: 140, sillHeight: 90, type: "finestra" };
        const op = { id: uid(), wallId: best.w.id, t: best.t, width: wp.width || 120, height: wp.height || 140, sillHeight: wp.sillHeight || 90, type: wp.type || "finestra" };
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
        const newWall = { id: uid(), x1: wallDraft.x, y1: wallDraft.y, x2: p.x, y2: p.y, thickness: 10 };
        setProject((prj) => ({ ...prj, walls: [...(prj.walls || []), newWall] }));
        setWallDraft(p);
      }, 230);
      return;
    }
    if (tool === "room") {
      if (e.detail >= 2) return;
      // Use timeout so that a double-click cancels the pending point add
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
  };

  const onDblClick = () => {
    if (tool === "wall") {
      if (pendingWallClickRef.current) { clearTimeout(pendingWallClickRef.current); pendingWallClickRef.current = null; }
      setWallDraft(null);
    }
    if (tool === "room") {
      if (pendingRoomClickRef.current) { clearTimeout(pendingRoomClickRef.current); pendingRoomClickRef.current = null; }
      if (roomDraft.length >= 3) {
        const newWalls = roomDraft.map((pt, i) => {
          const next = roomDraft[(i + 1) % roomDraft.length];
          return { id: uid(), x1: pt.x, y1: pt.y, x2: next.x, y2: next.y, thickness: 10 };
        });
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

  // Tools that should be able to "click through" walls/rooms (so the canvas handler runs)
  const isPlacementTool = tool === "door" || tool === "window" || tool === "wall" || tool === "room" || tool === "item";

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
        <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="url(#grid-big)" pointerEvents="none" />

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
              onMouseDown={(e) => {
                if (isPlacementTool) return; // let canvas place
                e.stopPropagation();
                handleElementClick("rooms", r.id);
              }}
              onDoubleClick={(e) => {
                if (isPlacementTool) return;
                e.stopPropagation();
                const newName = window.prompt("Nome stanza:", r.name || "");
                if (newName !== null) {
                  setProject((prj) => ({ ...prj, rooms: (prj.rooms || []).map((x) => x.id === r.id ? { ...x, name: newName } : x) }));
                }
              }}
              style={{ cursor: isPlacementTool ? "crosshair" : "pointer" }}
              data-testid={`room-${r.id}`}
            >
              <polygon
                points={pts}
                fill={mat?.color || "#F4F4F5"}
                fillOpacity={isSel ? 0.5 : 0.25}
                stroke={isSel ? "#2563EB" : "transparent"}
                strokeWidth={isSel ? 2 : 0}
              />
              <text x={cx} y={cy - 6} fontSize="14" textAnchor="middle" fontFamily="Outfit" fill="#0A0A0A" fontWeight="600" pointerEvents="none">
                {r.name}
              </text>
              <text x={cx} y={cy + 12} fontSize="11" textAnchor="middle" fontFamily="JetBrains Mono" fill="#71717A" pointerEvents="none">
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
            <g key={w.id}
              onMouseDown={(e) => {
                if (isPlacementTool) return; // let canvas handle (door/window/etc)
                e.stopPropagation();
                handleElementClick("walls", w.id);
              }}
              style={{ cursor: isPlacementTool ? "crosshair" : "pointer" }}
              data-testid={`wall-${w.id}`}
            >
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
              {len > 30 && <Measurement x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} big />}
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
          const isBlindata = d.type === "blindata";
          const isScorrevole = d.type === "scorrevole";
          const stroke = isSel ? "#2563EB" : (isBlindata ? "#7C2D12" : "#2563EB");
          return (
            <g key={d.id} transform={`translate(${cx},${cy}) rotate(${angle})`}
              onMouseDown={(e) => {
                if (isPlacementTool) return;
                e.stopPropagation();
                handleElementClick("doors", d.id);
              }}
              style={{ cursor: isPlacementTool ? "crosshair" : "pointer" }}
              data-testid={`door-${d.id}`}
            >
              <rect x={-d.width / 2} y={-7} width={d.width} height={14} fill="#FAFAFA" stroke="none" />
              {!isScorrevole && (
                <>
                  <path d={`M ${-d.width / 2} 0 A ${d.width} ${d.width} 0 0 1 ${d.width / 2} 0`} fill="none" stroke={stroke} strokeWidth="1.2" strokeDasharray="3,3" opacity="0.7" />
                  <line x1={-d.width / 2} y1={0} x2={d.width / 2} y2={0} stroke={stroke} strokeWidth={isBlindata ? 3 : 1.8} />
                </>
              )}
              {isScorrevole && (
                <>
                  <line x1={-d.width / 2} y1={-3} x2={d.width / 2} y2={-3} stroke={stroke} strokeWidth="1.5" />
                  <line x1={-d.width / 2} y1={3} x2={d.width / 2} y2={3} stroke={stroke} strokeWidth="1.5" />
                </>
              )}
              <text x={0} y={-12} fontSize="12" textAnchor="middle" fontFamily="JetBrains Mono" fontWeight="700" fill={stroke} pointerEvents="none">
                {d.width}
              </text>
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
          const stroke = isSel ? "#2563EB" : "#0A0A0A";
          return (
            <g key={wn.id} transform={`translate(${cx},${cy}) rotate(${angle})`}
              onMouseDown={(e) => {
                if (isPlacementTool) return;
                e.stopPropagation();
                handleElementClick("windows", wn.id);
              }}
              style={{ cursor: isPlacementTool ? "crosshair" : "pointer" }}
              data-testid={`window-${wn.id}`}
            >
              <rect x={-wn.width / 2} y={-7} width={wn.width} height={14} fill="#FAFAFA" />
              <rect x={-wn.width / 2} y={-3} width={wn.width} height={6} fill="none" stroke={stroke} strokeWidth="1" />
              <line x1={-wn.width / 2} y1={0} x2={wn.width / 2} y2={0} stroke={stroke} strokeWidth="1" />
              <text x={0} y={-12} fontSize="12" textAnchor="middle" fontFamily="JetBrains Mono" fontWeight="700" fill={stroke} pointerEvents="none">
                {wn.width}
              </text>
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
            <g key={it.id} transform={`translate(${it.x},${it.y}) rotate(${it.rotation || 0})`}
              onMouseDown={(e) => {
                if (isPlacementTool) return;
                e.stopPropagation();
                handleElementClick("items", it.id);
              }}
              style={{ cursor: isPlacementTool ? "crosshair" : "pointer" }}
              data-testid={`item-${it.id}`}
            >
              <rect x={-w / 2} y={-d / 2} width={w} height={d} fill={color} fillOpacity="0.85" stroke={isSel ? "#2563EB" : "#3F3F46"} strokeWidth={isSel ? 1.5 : 0.6} />
              <text x={0} y={4} fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono" fill="#0A0A0A" pointerEvents="none">
                {(m?.name || "item").slice(0, 12)}
              </text>
            </g>
          );
        })}

        {/* wall draft preview */}
        {tool === "wall" && wallDraft && (
          <g pointerEvents="none">
            <line x1={wallDraft.x} y1={wallDraft.y} x2={cursor.x} y2={cursor.y} stroke="#16A34A" strokeWidth="12" strokeOpacity="0.55" />
            <circle cx={wallDraft.x} cy={wallDraft.y} r="6" fill="#16A34A" />
            <circle cx={cursor.x} cy={cursor.y} r="8" fill="white" stroke="#16A34A" strokeWidth="3" />
            <Measurement x1={wallDraft.x} y1={wallDraft.y} x2={cursor.x} y2={cursor.y} big />
          </g>
        )}

        {/* room draft preview with measurements */}
        {tool === "room" && roomDraft.length > 0 && (
          <g pointerEvents="none">
            <polyline
              points={[...roomDraft, cursor].map((p) => `${p.x},${p.y}`).join(" ")}
              fill="#2563EB" fillOpacity="0.08" stroke="#2563EB" strokeWidth="2" strokeDasharray="4 3"
            />
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
        <div className="absolute top-3 left-3 bg-zinc-900 text-white px-3 py-1.5 text-xs mono" data-testid="hint-wall">
          click per punti · doppio click per terminare
        </div>
      )}
      {tool === "room" && (
        <div className="absolute top-3 left-3 bg-zinc-900 text-white px-3 py-1.5 text-xs mono" data-testid="hint-room">
          click per vertici · doppio click per chiudere poligono
        </div>
      )}
      {tool === "door" && (
        <div className="absolute top-3 left-3 bg-blue-600 text-white px-3 py-1.5 text-xs mono" data-testid="hint-door">
          click su una parete per inserire la porta
        </div>
      )}
      {tool === "window" && (
        <div className="absolute top-3 left-3 bg-blue-600 text-white px-3 py-1.5 text-xs mono" data-testid="hint-window">
          click su una parete per inserire la finestra
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
