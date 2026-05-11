import React, { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, Send, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";

/**
 * AI 2D Edit Panel — l'utente descrive in linguaggio naturale modifiche al progetto
 * e il backend ritorna operazioni JSON che il frontend applica al project.data.
 *
 * props:
 *   project: { id, data, ... }
 *   editMode: 'fatto' | 'progetto'
 *   onApply: (newData) => void   // chiamato col nuovo project.data
 *   onClose: () => void
 */
export default function AiCadEditPanel({ project, editMode, onApply, onClose }) {
  const [history, setHistory] = useState([]); // {role, text, ops?}
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history, loading]);

  const uid = () => Math.random().toString(36).slice(2, 10);

  /** Applica le ops ricevute dal backend allo state del progetto. */
  function applyOps(ops, data) {
    let d = { ...data };
    const ensureArr = (k) => { if (!Array.isArray(d[k])) d[k] = []; };
    const findById = (arr, id) => (d[arr] || []).find((x) => x.id === id);
    const replaceById = (arr, id, patch) => { d[arr] = (d[arr] || []).map((x) => x.id === id ? { ...x, ...patch } : x); };
    const removeById = (arr, id) => { d[arr] = (d[arr] || []).filter((x) => x.id !== id); };
    const addTo = (arr, item) => { ensureArr(arr); d[arr] = [...d[arr], item]; };

    for (const op of ops || []) {
      try {
        const p = op.params || {};
        switch (op.op) {
          case "addWall":
            addTo("walls", { id: uid(), x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2, thickness: p.thickness || 10, phase: p.phase || editMode });
            break;
          case "removeWall":
            removeById("walls", p.id);
            break;
          case "moveWall":
            replaceById("walls", p.id, { x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2 });
            break;
          case "markWallDemolished":
            replaceById("walls", p.id, { demolito: true });
            break;
          case "addRoom":
            addTo("rooms", { id: uid(), name: p.name || "Stanza", points: p.points || [], phase: p.phase || editMode });
            break;
          case "removeRoom":
            removeById("rooms", p.id);
            break;
          case "renameRoom":
            replaceById("rooms", p.id, { name: p.name });
            break;
          case "addDoor":
            addTo("doors", { id: uid(), wallId: p.wallId, t: Math.max(0.05, Math.min(0.95, p.t ?? 0.5)), width: p.width || 80, height: p.height || 210, phase: editMode });
            break;
          case "addWindow":
            addTo("windows", { id: uid(), wallId: p.wallId, t: Math.max(0.05, Math.min(0.95, p.t ?? 0.5)), width: p.width || 120, height: p.height || 140, sillHeight: p.sillHeight || 90, ante: p.ante || 2, frameColor: "bianco", glass: "doppio", phase: editMode });
            break;
          case "moveDoor":
            replaceById("doors", p.id, { t: Math.max(0.05, Math.min(0.95, p.t)) });
            break;
          case "moveWindow":
            replaceById("windows", p.id, { t: Math.max(0.05, Math.min(0.95, p.t)) });
            break;
          case "removeDoor": removeById("doors", p.id); break;
          case "removeWindow": removeById("windows", p.id); break;
          case "addElectrical":
            addTo("electrical", { id: uid(), kind: p.kind || "presa", x: p.x, y: p.y, wall_side: p.wall_side ?? 0, height_cm: p.height_cm ?? 110, rotation: 0, phase: editMode });
            break;
          case "addPlumbing":
            addTo("plumbing", { id: uid(), kind: p.kind || "acqua", x: p.x, y: p.y, wall_side: p.wall_side ?? 0, phase: editMode });
            break;
          case "addColumn":
            addTo("columns", { id: uid(), kind: p.kind || "cemento", x: p.x, y: p.y, width: p.width || 30, depth: p.depth || 30, height: 270, rotation: 0, phase: editMode });
            break;
          case "paintWall": {
            const w = findById("walls", p.id);
            if (w) {
              if (editMode === "progetto" && (w.phase || "fatto") === "fatto") {
                replaceById("walls", p.id, { progetto: { ...(w.progetto || {}), paintColor: p.color } });
              } else {
                replaceById("walls", p.id, { paintColor: p.color });
              }
            }
            break;
          }
          case "paintAllWalls":
            d.walls = (d.walls || []).map((w) => {
              if (w.demolito) return w;
              if (editMode === "progetto" && (w.phase || "fatto") === "fatto") return { ...w, progetto: { ...(w.progetto || {}), paintColor: p.color } };
              return { ...w, paintColor: p.color };
            });
            break;
          case "splitRoomByLine": {
            // Approccio semplice: aggiungi un muro che divide e crea visivamente 2 ambienti.
            // Manteniamo la stanza originale + aggiungiamo il nuovo muro divisorio.
            addTo("walls", { id: uid(), x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2, thickness: p.thickness || 10, phase: editMode });
            break;
          }
          case "noop":
            break;
          default:
            // operazione non riconosciuta — ignora silenziosamente
            break;
        }
      } catch { /* skip op malformata */ }
    }
    return d;
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setHistory((h) => [...h, { role: "user", text }]);
    setLoading(true);
    try {
      const resp = await api.post("/ai/cad-edit", {
        message: text,
        project_data: project?.data || {},
        view_mode: editMode,
        history: history.slice(-8).map((m) => ({ role: m.role, text: m.text })),
      });
      const data = resp.data || {};
      const ops = Array.isArray(data.ops) ? data.ops : [];
      let opsApplied = 0;
      if (ops.length > 0) {
        const newData = applyOps(ops, project?.data || {});
        onApply(newData);
        opsApplied = ops.length;
      }
      setHistory((h) => [...h, {
        role: "assistant",
        text: data.message || (opsApplied > 0 ? `✓ Applicate ${opsApplied} operazioni` : "OK"),
        ops,
        suggestion: data.suggestion || "",
      }]);
      if (opsApplied > 0) toast.success(`AI: applicate ${opsApplied} operazioni`);
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Errore AI";
      setHistory((h) => [...h, { role: "assistant", text: `⚠ Errore: ${msg}` }]);
      toast.error("AI error: " + msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed right-4 bottom-4 w-[420px] max-w-[95vw] max-h-[80vh] bg-white border-2 border-violet-500 shadow-2xl rounded-lg flex flex-col z-40" data-testid="ai-2d-panel">
      <div className="px-4 py-3 bg-violet-600 text-white flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          <div>
            <div className="font-bold text-sm">AI assistente CAD 2D</div>
            <div className="text-[10px] text-violet-100">Modifica spazi · suggerimenti · planimetria</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setHistory([])} title="Pulisci chat" className="p-1.5 hover:bg-white/10 rounded"><RotateCcw className="h-4 w-4" /></button>
          <button onClick={onClose} title="Chiudi" className="p-1.5 hover:bg-white/10 rounded" data-testid="ai-2d-close"><X className="h-4 w-4" /></button>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
        {history.length === 0 && (
          <div className="text-xs text-zinc-600 space-y-2">
            <div className="font-bold text-zinc-800">Cosa posso fare:</div>
            <ul className="space-y-1 list-disc list-inside text-[12px]">
              <li>"Togli il muro tra cucina e soggiorno"</li>
              <li>"Aggiungi una porta al centro del muro est della cucina"</li>
              <li>"Dipingi tutte le pareti del soggiorno di azzurro chiaro"</li>
              <li>"Metti un punto luce a 1m da terra sulla parete nord"</li>
              <li>"Dividi il soggiorno in due stanze"</li>
              <li>"Aggiungi un pilastro in cemento qui in basso a sinistra"</li>
            </ul>
            <div className="text-[11px] italic text-violet-700 bg-violet-50 border border-violet-200 rounded p-1.5">Modalità attiva: <b>{editMode === "fatto" ? "Stato di Fatto" : "Progetto"}</b>. Le modifiche vengono applicate qui.</div>
          </div>
        )}
        {history.map((m, i) => (
          <div key={i} className={`max-w-[88%] ${m.role === "user" ? "ml-auto bg-violet-100 border border-violet-200" : "bg-zinc-50 border border-zinc-200"} rounded-lg px-3 py-2 text-[13px] leading-relaxed`}>
            <div className="font-semibold text-[10px] uppercase mb-0.5 opacity-70">{m.role === "user" ? "Tu" : "AI"}</div>
            <div className="whitespace-pre-wrap break-words">{m.text}</div>
            {m.ops && m.ops.length > 0 && (
              <details className="mt-1.5 text-[10px] text-zinc-600">
                <summary className="cursor-pointer hover:underline">{m.ops.length} operazione/i applicate</summary>
                <ul className="mt-1 ml-2 list-disc">
                  {m.ops.map((o, j) => <li key={j}><code className="text-violet-700">{o.op}</code> {JSON.stringify(o.params || {}).slice(0, 100)}</li>)}
                </ul>
              </details>
            )}
            {m.suggestion && (
              <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-1.5">💡 {m.suggestion}</div>
            )}
          </div>
        ))}
        {loading && (
          <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 inline-flex items-center gap-2 text-xs text-zinc-600">
            <Loader2 className="h-3 w-3 animate-spin" /> Sto pensando…
          </div>
        )}
      </div>
      <div className="border-t border-zinc-200 p-2 flex items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Es. togli il muro tra cucina e soggiorno…"
          disabled={loading}
          className="flex-1 text-sm"
          data-testid="ai-2d-input"
        />
        <Button onClick={send} disabled={loading || !input.trim()} size="sm" style={{ background: "#7C3AED", color: "white" }} data-testid="ai-2d-send">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
