import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, RotateCw, Plus, Trash2 } from "lucide-react";
import { ProspettoWall, computeInterestingWalls } from "@/editor/Prospetti";
import { toast } from "sonner";

/**
 * WallProspettoEditor — apre il prospetto di UN SINGOLO muro selezionato
 * permettendo di:
 * - vedere il prospetto del lato A o del lato B (toggle 180°)
 * - aggiungere punti elettrici / idraulici / hvac direttamente cliccando sul prospetto
 * - eliminare punti
 * - vedere automaticamente DUE prospetti (uno per ogni lato) se il muro ha elementi su entrambi i lati
 *
 * props:
 *   project, wallId, editMode ('fatto'|'progetto'), onClose, onChange(newData)
 */
export default function WallProspettoEditor({ project, wallId, editMode, onClose, onChange }) {
  const data = project?.data || {};
  const wall = (data.walls || []).find((w) => w.id === wallId);
  const [flipped, setFlipped] = useState(false); // false = lato A (normale), true = lato B (ruotato 180°)
  const [tool, setTool] = useState(null); // null | 'electrical' | 'plumbing' | 'hvac'
  const [elecKind, setElecKind] = useState("presa");
  const [plumbKind, setPlumbKind] = useState("acqua");

  const wallsAll = data.walls || [];
  const entries = useMemo(() => {
    if (!wall) return [];
    return computeInterestingWalls({ ...data, walls: [wall] });
  }, [data, wall]);

  // Trova punti elettrici/idraulici/hvac di QUESTO muro
  const pointsForWall = useMemo(() => {
    const wDx = wall ? wall.x2 - wall.x1 : 0;
    const wDy = wall ? wall.y2 - wall.y1 : 0;
    const wLen2 = wDx * wDx + wDy * wDy || 1;
    const wLen = Math.sqrt(wLen2);
    const isOnThisWall = (px, py) => {
      if (!wall) return false;
      const t = ((px - wall.x1) * wDx + (py - wall.y1) * wDy) / wLen2;
      const projX = wall.x1 + Math.max(0, Math.min(1, t)) * wDx;
      const projY = wall.y1 + Math.max(0, Math.min(1, t)) * wDy;
      const d = Math.hypot(px - projX, py - projY);
      return d < 30 && t >= -0.02 && t <= 1.02; // 30cm di tolleranza
    };
    const all = [];
    (data.electrical || []).forEach((e) => { if (!e.floor && isOnThisWall(e.x, e.y)) all.push({ ...e, _arr: "electrical", _side: e.wall_side || 0, _t: Math.max(0, Math.min(1, ((e.x - wall.x1) * wDx + (e.y - wall.y1) * wDy) / wLen2)) }); });
    (data.plumbing || []).forEach((p) => { if (!p.floor && isOnThisWall(p.x, p.y)) all.push({ ...p, _arr: "plumbing", _side: p.wall_side || 0, _t: Math.max(0, Math.min(1, ((p.x - wall.x1) * wDx + (p.y - wall.y1) * wDy) / wLen2)) }); });
    (data.hvac || []).forEach((h) => { if (!h.floor && isOnThisWall(h.x, h.y)) all.push({ ...h, _arr: "hvac", _side: h.wall_side || 0, _t: Math.max(0, Math.min(1, ((h.x - wall.x1) * wDx + (h.y - wall.y1) * wDy) / wLen2)) }); });
    return { all, wLen };
  }, [data, wall]);

  const sideAPoints = pointsForWall.all.filter((p) => p._side <= 0);
  const sideBPoints = pointsForWall.all.filter((p) => p._side > 0);
  const hasBothSides = sideAPoints.length > 0 && sideBPoints.length > 0;
  const currentSide = flipped ? 1 : -1;
  const STD_HEIGHTS = { presa: 110, luce: 110, interruttore: 110, spia: 110, acqua: 100, scarico: 30, hvac: 220 };

  // Aggiungi un punto: prende la posizione t (0..1) lungo il muro e l'altezza h
  function addPoint(t, h) {
    if (!wall || !tool) return;
    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;
    const x = Math.round(wall.x1 + t * dx);
    const y = Math.round(wall.y1 + t * dy);
    const newPoint = { id: Math.random().toString(36).slice(2, 10), x, y, wall_side: currentSide, phase: editMode };
    let arr = tool;
    if (tool === "electrical") {
      Object.assign(newPoint, { kind: elecKind, rotation: 0, height_cm: h });
    } else if (tool === "plumbing") {
      Object.assign(newPoint, { kind: plumbKind, height_cm: h });
    } else if (tool === "hvac") {
      arr = "hvac";
      Object.assign(newPoint, { kind: "split", height_cm: h });
    }
    const newData = { ...data, [arr]: [...(data[arr] || []), newPoint] };
    onChange(newData);
    toast.success(`✓ ${tool} aggiunto a t=${(t * 100).toFixed(0)}% h=${h}cm su Lato ${currentSide > 0 ? "B" : "A"}`);
  }

  function removePoint(id, arr) {
    const newData = { ...data, [arr]: (data[arr] || []).filter((x) => x.id !== id) };
    onChange(newData);
    toast.success("Punto rimosso");
  }

  if (!wall || !entries[0]) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="bg-white p-6 rounded-lg" onClick={(e) => e.stopPropagation()}>
          Muro non valido <Button onClick={onClose} className="ml-3">Chiudi</Button>
        </div>
      </div>
    );
  }

  const entry = entries[0];
  // Se flipped, ribalta orizzontalmente l'entry per mostrare l'altro lato
  const displayEntry = flipped
    ? { ...entry, points: (entry.points || []).map((p) => ({ ...p, t: 1 - p.t })) }
    : entry;
  // Filtra i points che mostriamo nel prospetto in base al lato attivo
  const visiblePoints = (displayEntry.points || []).filter((p) => {
    const found = pointsForWall.all.find((x) => x.id === p.id);
    if (!found) return true; // door/window: mostra sempre
    return (found._side <= 0 && currentSide <= 0) || (found._side > 0 && currentSide > 0);
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose} data-testid="wall-prospetto-editor">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-bold text-lg">📐 Prospetto muro selezionato</h2>
            <div className="text-xs text-zinc-600 mono">L: {Math.round(pointsForWall.wLen)} cm · Lato attivo: <b className={currentSide > 0 ? "text-violet-700" : "text-amber-700"}>{currentSide > 0 ? "B (dietro)" : "A (fronte)"}</b></div>
          </div>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        {/* Toolbar */}
        <div className="px-5 py-3 border-b bg-zinc-50 flex flex-wrap items-center gap-2">
          <Button size="sm" variant={tool === "electrical" ? "default" : "outline"} onClick={() => setTool(tool === "electrical" ? null : "electrical")} data-testid="wpe-tool-electrical" className={tool === "electrical" ? "bg-violet-600 text-white" : ""}>⚡ Elettrico</Button>
          {tool === "electrical" && (
            <select className="border rounded h-9 px-2 text-sm font-mono" value={elecKind} onChange={(e) => setElecKind(e.target.value)}>
              <option value="presa">Presa</option><option value="luce">Punto luce</option><option value="interruttore">Interruttore</option><option value="spia">Spia</option>
            </select>
          )}
          <Button size="sm" variant={tool === "plumbing" ? "default" : "outline"} onClick={() => setTool(tool === "plumbing" ? null : "plumbing")} data-testid="wpe-tool-plumbing" className={tool === "plumbing" ? "bg-sky-600 text-white" : ""}>💧 Idraulico</Button>
          {tool === "plumbing" && (
            <select className="border rounded h-9 px-2 text-sm font-mono" value={plumbKind} onChange={(e) => setPlumbKind(e.target.value)}>
              <option value="acqua">Acqua</option><option value="scarico">Scarico</option>
            </select>
          )}
          <Button size="sm" variant={tool === "hvac" ? "default" : "outline"} onClick={() => setTool(tool === "hvac" ? null : "hvac")} data-testid="wpe-tool-hvac" className={tool === "hvac" ? "bg-teal-600 text-white" : ""}>❄ HVAC (split)</Button>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => setFlipped((v) => !v)} className="border-amber-400 text-amber-700 hover:bg-amber-50" data-testid="wpe-flip">
            <RotateCw className="h-4 w-4 mr-1.5" />Ruota 180° (mostra l'altro lato)
          </Button>
        </div>

        {tool && (
          <div className="px-5 py-2 bg-violet-50 text-violet-900 text-xs border-b border-violet-200">
            <b>👆 Clicca sul prospetto qui sotto</b> per piazzare il punto. La X = posizione sul muro (sx→dx), la Y = altezza dal pavimento. Premi <b>ESC</b> o ricliccha il bottone per uscire dalla modalità.
          </div>
        )}

        <div className="p-5 space-y-4">
          {/* Prospetto SVG cliccabile */}
          <ProspettoClickable
            entry={{ ...displayEntry, points: visiblePoints }}
            roomHeight={data.roomHeight || 270}
            onClick={(t, h) => tool && addPoint(t, h)}
            tool={tool}
            cursorStyle={tool ? "crosshair" : "default"}
          />

          {/* Lista punti del lato attivo con bottone elimina */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-amber-50 border border-amber-200 rounded p-3">
              <div className="font-bold text-sm text-amber-900 mb-2">Lato A (fronte) — {sideAPoints.length} punto/i</div>
              {sideAPoints.length === 0 && <div className="text-xs text-zinc-500 italic">Nessun punto</div>}
              {sideAPoints.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-amber-200 last:border-0">
                  <span className="mono">{p._arr} · {p.kind} · t={(p._t * 100).toFixed(0)}% · h={p.height_cm ?? STD_HEIGHTS[p.kind] ?? 110}cm</span>
                  <button onClick={() => removePoint(p.id, p._arr)} className="text-rose-600 hover:bg-rose-100 rounded p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
            <div className="bg-violet-50 border border-violet-200 rounded p-3">
              <div className="font-bold text-sm text-violet-900 mb-2">Lato B (dietro) — {sideBPoints.length} punto/i</div>
              {sideBPoints.length === 0 && <div className="text-xs text-zinc-500 italic">Nessun punto</div>}
              {sideBPoints.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-violet-200 last:border-0">
                  <span className="mono">{p._arr} · {p.kind} · t={(p._t * 100).toFixed(0)}% · h={p.height_cm ?? STD_HEIGHTS[p.kind] ?? 110}cm</span>
                  <button onClick={() => removePoint(p.id, p._arr)} className="text-rose-600 hover:bg-rose-100 rounded p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </div>

          {hasBothSides && (
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2">
              ✓ Questo muro ha impianti su <b>entrambi i lati</b> — la generazione tavole produrrà <b>2 prospetti separati</b>: uno per Lato A e uno per Lato B.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Wrapper attorno al ProspettoWall che aggiunge un layer di click per piazzare punti
function ProspettoClickable({ entry, roomHeight, onClick, tool, cursorStyle }) {
  const W = Math.max(400, Math.min(1200, entry.lengthCm));
  const H = roomHeight;
  const handleClick = (e) => {
    if (!tool) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xRel = (e.clientX - rect.left) / rect.width;
    const yRel = (e.clientY - rect.top) / rect.height;
    const t = Math.max(0, Math.min(1, xRel));
    // h: distanza dal PAVIMENTO (in basso). y=0 in alto (= soffitto) → h = roomHeight - y*roomHeight
    const h = Math.round(H - yRel * H);
    onClick(t, Math.max(5, Math.min(H - 5, h)));
  };
  return (
    <div className="border-2 border-zinc-300 rounded bg-white" style={{ cursor: cursorStyle }} onClick={handleClick} data-testid="wpe-prospetto-click">
      <ProspettoWall entry={entry} roomHeight={H} editable={false} />
    </div>
  );
}
