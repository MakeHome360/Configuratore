import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
const _Navbar = Navbar; // compat
import Canvas2D from "../editor/Canvas2D";
import Viewer3D from "../editor/Viewer3D";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Separator } from "../components/ui/separator";
import { Textarea } from "../components/ui/textarea";
import {
  MousePointer2, Minus, Square, DoorClosed, RectangleHorizontal, Sofa, Trash2,
  Save, Download, Sparkles, Eye, EyeOff, Box, Ruler, X, Home, Bath, ChefHat, Bed,
  Plus,
} from "lucide-react";
import { estimateProject, fmtEuro, fmtNum, emptyProjectData, uid } from "../editor/utils";
import jsPDF from "jspdf";

const TOOLS = [
  { id: "select", icon: MousePointer2, label: "Seleziona", hint: "Clicca per selezionare elementi" },
  { id: "wall", icon: Minus, label: "Parete", hint: "Clicca due punti · doppio click per terminare" },
  { id: "room", icon: Square, label: "Stanza", hint: "Clicca i vertici · doppio click per chiudere" },
  { id: "door", icon: DoorClosed, label: "Porta", hint: "Clicca su una parete per inserire" },
  { id: "window", icon: RectangleHorizontal, label: "Finestra", hint: "Clicca su una parete per inserire" },
  { id: "item", icon: Sofa, label: "Arredo", hint: "Seleziona un arredo dal catalogo e piazzalo" },
  { id: "delete", icon: Trash2, label: "Elimina", hint: "Clicca un elemento per rimuoverlo" },
];

const QUICK_ROOMS = [
  { id: "kitchen", icon: ChefHat, label: "Cucina", w: 400, h: 350, name: "Cucina", floorMaterial: "floor-ceramic" },
  { id: "bathroom", icon: Bath, label: "Bagno", w: 250, h: 200, name: "Bagno", floorMaterial: "floor-ceramic", wallMaterial: "wall-tile", plumbing: true },
  { id: "bedroom", icon: Bed, label: "Camera", w: 400, h: 350, name: "Camera", floorMaterial: "floor-parquet" },
  { id: "living", icon: Home, label: "Soggiorno", w: 500, h: 400, name: "Soggiorno", floorMaterial: "floor-parquet" },
];

const ITEM_CATEGORIES = [
  { id: "furniture", label: "Arredi" },
  { id: "fixture", label: "Sanitari" },
  { id: "appliance", label: "Elettrodomestici" },
  { id: "light", label: "Luci" },
];

export default function Editor() {
  const { id } = useParams();
  const nav = useNavigate();
  const [project, setProject] = useState(null); // {id, name, data}
  const [catalog, setCatalog] = useState([]);
  const [tool, setTool] = useState("select");
  const [selected, setSelected] = useState(null);
  const [selectedMaterial, setSelectedMaterial] = useState("furn-sofa");
  const [show3D, setShow3D] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("Pavimento in rovere, pareti bianche opache, luce naturale calda dalle finestre, mobili moderni.");
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const viewer3DRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [pr, cat] = await Promise.all([
          api.get(`/projects/${id}`),
          api.get("/materials"),
        ]);
        const data = pr.data.data && Object.keys(pr.data.data).length > 0 ? pr.data.data : emptyProjectData();
        setProject({ ...pr.data, data });
        setCatalog(cat.data);
      } catch {
        toast.error("Progetto non trovato");
        nav("/dashboard");
      }
    })();
  }, [id, nav]);

  const save = async (showToast = true) => {
    if (!project) return;
    setSaving(true);
    try {
      await api.put(`/projects/${project.id}`, {
        name: project.name,
        data: project.data,
        thumbnail: project.thumbnail,
      });
      if (showToast) toast.success("Progetto salvato");
    } catch {
      toast.error("Errore salvataggio");
    }
    setSaving(false);
  };

  // Auto-save every 30s if dirty (simple: after any change, after 10s idle)
  // For MVP: manual save button

  const setProjectData = (fnOrVal) => {
    setProject((prj) => {
      const newData = typeof fnOrVal === "function" ? fnOrVal(prj.data) : fnOrVal;
      return { ...prj, data: newData };
    });
  };

  const addQuickRoom = (q) => {
    const existing = project?.data?.rooms || [];
    // Compute placement: place next to the rightmost room bbox, or start at 200,200
    let startX = 200, startY = 200;
    if (existing.length > 0) {
      let maxX = 0;
      existing.forEach((r) => {
        r.points.forEach((p) => { if (p.x > maxX) maxX = p.x; });
      });
      startX = maxX + 30;
    }
    const w = q.w, h = q.h;
    const roomId = uid();
    const wallIds = [uid(), uid(), uid(), uid()];
    const corners = [
      { x: startX, y: startY },
      { x: startX + w, y: startY },
      { x: startX + w, y: startY + h },
      { x: startX, y: startY + h },
    ];
    const walls = [
      { id: wallIds[0], x1: corners[0].x, y1: corners[0].y, x2: corners[1].x, y2: corners[1].y, thickness: 10 },
      { id: wallIds[1], x1: corners[1].x, y1: corners[1].y, x2: corners[2].x, y2: corners[2].y, thickness: 10 },
      { id: wallIds[2], x1: corners[2].x, y1: corners[2].y, x2: corners[3].x, y2: corners[3].y, thickness: 10 },
      { id: wallIds[3], x1: corners[3].x, y1: corners[3].y, x2: corners[0].x, y2: corners[0].y, thickness: 10 },
    ];
    const room = {
      id: roomId,
      name: q.name + (existing.filter((r) => r.name.startsWith(q.name)).length ? ` ${existing.filter((r) => r.name.startsWith(q.name)).length + 1}` : ""),
      points: corners,
      floorMaterial: q.floorMaterial || "floor-ceramic",
      wallMaterial: q.wallMaterial || "wall-paint",
      ceilingMaterial: "ceil-paint",
      electrical: true,
      plumbing: !!q.plumbing,
    };
    setProjectData((p) => ({
      ...p,
      walls: [...(p.walls || []), ...walls],
      rooms: [...(p.rooms || []), room],
    }));
    toast.success(`${q.label} aggiunta`);
  };

  const estimate = useMemo(() => (project ? estimateProject(project.data, catalog) : null), [project, catalog]);

  const generateAIRender = async () => {
    if (!viewer3DRef.current) return;
    const snap = viewer3DRef.current.snapshot();
    if (!snap) { toast.error("Attiva la vista 3D prima"); return; }
    setAiLoading(true);
    setAiResult(null);
    try {
      const { data } = await api.post("/ai-render", {
        image_base64: snap,
        prompt: aiPrompt,
        style: "photorealistic interior architectural photography",
      });
      setAiResult(data.data_url);
      toast.success("Rendering generato");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore rendering AI");
    }
    setAiLoading(false);
  };

  const exportPDF = async () => {
    if (!project || !estimate) return;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFont("helvetica", "bold"); doc.setFontSize(22);
    doc.text("Preventivo Ristrutturazione", 20, y);
    y += 8;
    doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(100);
    doc.text(project.name, 20, y); y += 6;
    doc.text(`Data: ${new Date().toLocaleDateString("it-IT")}`, 20, y);
    doc.setTextColor(0);
    y += 10;

    doc.setDrawColor(220); doc.line(20, y, pageW - 20, y); y += 8;

    // Try to capture 2D SVG thumbnail
    const svgEl = document.querySelector('[data-testid="canvas-2d"]');
    if (svgEl) {
      try {
        const svgData = new XMLSerializer().serializeToString(svgEl);
        const svgBlob = new Blob([svgData], { type: "image/svg+xml" });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
        const canvas = document.createElement("canvas");
        canvas.width = 800; canvas.height = 500;
        const ctx = canvas.getContext("2d"); ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, 800, 500);
        ctx.drawImage(img, 0, 0, 800, 500);
        const png = canvas.toDataURL("image/png");
        doc.addImage(png, "PNG", 20, y, pageW - 40, 100);
        URL.revokeObjectURL(url);
        y += 105;
      } catch {}
    }

    // Rooms table
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("Stanze e costi edili", 20, y); y += 7;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);

    doc.setFillColor(244, 244, 245); doc.rect(20, y - 4, pageW - 40, 6, "F");
    doc.text("Stanza", 22, y);
    doc.text("Area m²", 80, y);
    doc.text("Pavimento", 100, y);
    doc.text("Pareti", 135, y);
    doc.text("Totale", pageW - 25, y, { align: "right" });
    y += 6;
    estimate.rooms.forEach((r) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(r.name.slice(0, 26), 22, y);
      doc.text(fmtNum(r.areaM2, 2), 80, y);
      doc.text((r.floorName || "-").slice(0, 18), 100, y);
      doc.text((r.wallName || "-").slice(0, 18), 135, y);
      doc.text(fmtEuro(r.total), pageW - 25, y, { align: "right" });
      y += 6;
    });

    // Items
    if (estimate.items.length) {
      y += 4;
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(14); doc.setFont("helvetica", "bold");
      doc.text("Arredi, sanitari ed elettrodomestici", 20, y); y += 7;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      estimate.items.forEach((it) => {
        if (y > 275) { doc.addPage(); y = 20; }
        doc.text(it.name.slice(0, 35), 22, y);
        doc.text(`${it.qty} ${it.unit}`, 100, y);
        doc.text(fmtEuro(it.unitPrice), 130, y);
        doc.text(fmtEuro(it.total), pageW - 25, y, { align: "right" });
        y += 6;
      });
    }

    y += 10;
    doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(20, y, pageW - 20, y); y += 8;
    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text("TOTALE", 22, y);
    doc.text(fmtEuro(estimate.total), pageW - 22, y, { align: "right" });

    doc.save(`${project.name.replace(/[^a-z0-9]+/gi, "-")}-preventivo.pdf`);
    toast.success("Preventivo esportato");
  };

  if (!project) {
    return (
      <div className="h-screen flex items-center justify-center mono text-zinc-500">
        caricamento editor…
      </div>
    );
  }

  return (
    <div className="editor-root flex flex-col h-screen bg-white" data-testid="editor-page">
      {/* Top project toolbar */}
      <div className="h-12 border-b border-zinc-200 px-4 flex items-center gap-3 bg-white">
        <Input
          value={project.name}
          onChange={(e) => setProject((p) => ({ ...p, name: e.target.value }))}
          className="rounded-sm h-8 border-transparent hover:border-zinc-200 focus:border-zinc-300 max-w-xs"
          data-testid="project-name-input"
        />
        <div className="mono text-xs text-zinc-400">#{project.id.slice(0, 8)}</div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="rounded-sm h-8" onClick={() => setShow3D(v => !v)} data-testid="toggle-3d">
            {show3D ? <EyeOff size={14} className="mr-1.5" /> : <Eye size={14} className="mr-1.5" />}
            {show3D ? "Nascondi 3D" : "Mostra 3D"}
          </Button>
          <Button size="sm" variant="outline" className="rounded-sm h-8" onClick={() => setAiOpen(true)} data-testid="open-ai-render">
            <Sparkles size={14} className="mr-1.5" /> Render AI
          </Button>
          <Button size="sm" variant="outline" className="rounded-sm h-8" onClick={exportPDF} data-testid="export-pdf-button">
            <Download size={14} className="mr-1.5" /> PDF
          </Button>
          <Button size="sm" className="rounded-sm h-8 bg-zinc-900 hover:bg-zinc-800" disabled={saving} onClick={() => save(true)} data-testid="save-project-button">
            <Save size={14} className="mr-1.5" /> {saving ? "…" : "Salva"}
          </Button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left tools with labels */}
        <aside className="w-44 border-r border-zinc-200 flex flex-col py-3 gap-1 bg-white overflow-y-auto">
          <div className="label-kicker px-4 pb-2">Strumenti</div>
          {TOOLS.map((t) => (
            <button
              key={t.id}
              title={t.hint}
              onClick={() => { setTool(t.id); setSelected(null); }}
              className={`mx-2 px-3 py-2 flex items-center gap-3 text-sm transition-colors border-l-2 ${tool === t.id ? "bg-zinc-900 text-white border-zinc-900" : "border-transparent text-zinc-700 hover:bg-zinc-50"}`}
              data-testid={`tool-${t.id}`}
            >
              <t.icon size={16} strokeWidth={tool === t.id ? 2.4 : 2} />
              <span className="font-medium">{t.label}</span>
            </button>
          ))}

          <div className="label-kicker px-4 pt-5 pb-2">Stanze rapide</div>
          {QUICK_ROOMS.map((q) => (
            <button key={q.id}
              onClick={() => addQuickRoom(q)}
              className="mx-2 px-3 py-2 flex items-center gap-3 text-sm transition-colors text-zinc-700 hover:bg-zinc-50"
              title={`Aggiungi ${q.label} ${q.w / 100}×${q.h / 100}m`}
              data-testid={`quick-room-${q.id}`}
            >
              <q.icon size={16} />
              <span>{q.label}</span>
              <span className="ml-auto mono text-[10px] text-zinc-400">{q.w / 100}×{q.h / 100}m</span>
            </button>
          ))}

          <div className="mx-2 mt-5 px-3 py-2 text-[11px] leading-relaxed text-zinc-500">
            <div className="mono text-zinc-700 mb-1">Suggerimenti:</div>
            <div>• <b>snap</b> automatico a 10 cm</div>
            <div>• <b>alt+drag</b> per panorare</div>
            <div>• <b>doppio click</b> stanza per rinominare</div>
          </div>
        </aside>

        {/* Center canvases */}
        <main className="flex-1 flex min-w-0">
          <div className={show3D ? "flex-1 min-w-0 border-r border-zinc-200" : "flex-1 min-w-0"}>
            <div className="h-8 border-b border-zinc-200 flex items-center px-3 bg-zinc-50">
              <Ruler size={12} className="mr-1.5 text-zinc-500" />
              <span className="label-kicker text-[10px]">Planimetria 2D</span>
              <span className="ml-auto mono text-xs text-zinc-500">{TOOLS.find(t => t.id === tool)?.label}</span>
            </div>
            <div className="relative" style={{ height: "calc(100% - 2rem)" }}>
              <Canvas2D
                project={project.data}
                setProject={setProjectData}
                tool={tool}
                setTool={setTool}
                selected={selected}
                setSelected={setSelected}
                selectedMaterial={selectedMaterial}
                catalog={catalog}
              />
            </div>
          </div>
          {show3D && (
            <div className="flex-1 min-w-0">
              <div className="h-8 border-b border-zinc-200 flex items-center px-3 bg-zinc-50">
                <Box size={12} className="mr-1.5 text-zinc-500" />
                <span className="label-kicker text-[10px]">Vista 3D</span>
                <span className="ml-auto mono text-xs text-zinc-500">trascina · zoom</span>
              </div>
              <div className="relative" style={{ height: "calc(100% - 2rem)" }}>
                <Viewer3D ref={viewer3DRef} project={project.data} catalog={catalog} />
              </div>
            </div>
          )}
        </main>

        {/* Right panel */}
        <aside className="w-80 border-l border-zinc-200 bg-white flex flex-col min-h-0">
          <Tabs defaultValue="properties" className="flex-1 flex flex-col">
            <TabsList className="rounded-none h-10 border-b border-zinc-200 bg-white justify-start px-2">
              <TabsTrigger value="properties" className="rounded-none text-xs uppercase tracking-widest" data-testid="tab-properties">Proprietà</TabsTrigger>
              <TabsTrigger value="catalog" className="rounded-none text-xs uppercase tracking-widest" data-testid="tab-catalog">Catalogo</TabsTrigger>
              <TabsTrigger value="cost" className="rounded-none text-xs uppercase tracking-widest" data-testid="tab-cost">Costi</TabsTrigger>
            </TabsList>

            <TabsContent value="properties" className="p-4 overflow-auto flex-1 mt-0">
              <PropertiesPanel project={project.data} setProject={setProjectData} selected={selected} catalog={catalog} />
            </TabsContent>

            <TabsContent value="catalog" className="p-0 overflow-auto flex-1 mt-0">
              <CatalogPanel
                catalog={catalog}
                selectedMaterial={selectedMaterial}
                setSelectedMaterial={(id) => { setSelectedMaterial(id); setTool("item"); }}
              />
            </TabsContent>

            <TabsContent value="cost" className="p-0 overflow-auto flex-1 mt-0">
              <CostPanel estimate={estimate} />
            </TabsContent>
          </Tabs>
        </aside>
      </div>

      {/* AI Render modal */}
      {aiOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAiOpen(false)} data-testid="ai-render-modal">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] flex flex-col border border-zinc-300" onClick={(e) => e.stopPropagation()}>
            <div className="h-12 px-4 flex items-center border-b border-zinc-200">
              <Sparkles size={16} className="mr-2 text-blue-600" />
              <span className="font-medium" style={{ fontFamily: "Outfit" }}>Rendering AI fotorealistico</span>
              <button className="ml-auto" onClick={() => setAiOpen(false)} data-testid="close-ai-render"><X size={18} /></button>
            </div>
            <div className="grid lg:grid-cols-2 flex-1 min-h-0">
              <div className="p-5 space-y-4 border-r border-zinc-200 overflow-auto">
                <div>
                  <Label className="text-xs uppercase tracking-widest text-zinc-500">Descrizione stile</Label>
                  <Textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    rows={5}
                    className="rounded-sm mt-2"
                    data-testid="ai-prompt-input"
                  />
                </div>
                <div className="space-y-2 mono text-xs text-zinc-500">
                  <div>Suggerimenti:</div>
                  {["Stile scandinavo, legno chiaro, tessili naturali",
                    "Industriale loft, cemento, metallo nero, mattoni a vista",
                    "Minimal lusso, marmo, ottone, luci soffuse",
                    "Classico italiano, parquet, stucchi, boiserie"].map((s) => (
                    <button key={s} onClick={() => setAiPrompt(s)} className="block text-left hover:text-zinc-900 transition-colors" data-testid={`ai-preset-${s.slice(0,10)}`}>
                      → {s}
                    </button>
                  ))}
                </div>
                <Button onClick={generateAIRender} disabled={aiLoading} className="rounded-sm w-full h-11 bg-zinc-900 hover:bg-zinc-800" data-testid="ai-generate-button">
                  {aiLoading ? "Generazione in corso…" : <><Sparkles size={14} className="mr-2" /> Genera rendering</>}
                </Button>
                <div className="text-xs text-zinc-400">
                  Richiede una vista 3D visibile. Il rendering usa Gemini Nano Banana e richiede ~10-20 secondi.
                </div>
              </div>
              <div className="p-5 overflow-auto">
                <Label className="text-xs uppercase tracking-widest text-zinc-500">Risultato</Label>
                <div className="mt-2 border border-zinc-200 bg-zinc-50 aspect-video flex items-center justify-center overflow-hidden">
                  {aiLoading ? (
                    <div className="text-zinc-500 mono text-sm animate-pulse">rendering…</div>
                  ) : aiResult ? (
                    <img src={aiResult} alt="AI render" className="w-full h-full object-cover" data-testid="ai-render-result" />
                  ) : (
                    <div className="text-zinc-400 mono text-xs">nessun render ancora</div>
                  )}
                </div>
                {aiResult && (
                  <a href={aiResult} download="render.png" className="block mt-3" data-testid="ai-render-download">
                    <Button variant="outline" className="rounded-sm w-full"><Download size={14} className="mr-2" /> Scarica PNG</Button>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Properties Panel ----------
function PropertiesPanel({ project, setProject, selected, catalog }) {
  if (!selected) {
    return (
      <div>
        <div className="label-kicker mb-3">Progetto</div>
        <div className="space-y-3">
          <div>
            <Label className="text-xs uppercase tracking-widest text-zinc-500">Altezza soffitto (cm)</Label>
            <Input
              type="number"
              value={project.roomHeight || 270}
              onChange={(e) => setProject((p) => ({ ...p, roomHeight: parseInt(e.target.value) || 270 }))}
              className="rounded-sm h-9 mt-1.5 mono"
              data-testid="room-height-input"
            />
          </div>
        </div>
        <Separator className="my-6" />
        <div className="text-xs text-zinc-500 mono leading-relaxed">
          Seleziona un elemento sulla planimetria per modificarne le proprietà.
        </div>
      </div>
    );
  }

  const kind = selected.kind;
  const obj = (project[kind] || []).find((x) => x.id === selected.id);
  if (!obj) return <div className="text-sm text-zinc-500">Elemento non trovato</div>;

  const updateObj = (patch) => {
    setProject((p) => ({
      ...p,
      [kind]: (p[kind] || []).map((x) => (x.id === selected.id ? { ...x, ...patch } : x)),
    }));
  };

  if (kind === "rooms") {
    return (
      <div className="space-y-4">
        <div className="label-kicker">Stanza</div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-zinc-500">Nome</Label>
          <Input value={obj.name} onChange={(e) => updateObj({ name: e.target.value })} className="rounded-sm h-9 mt-1.5" data-testid="room-name-input" />
        </div>
        <MaterialSelect
          label="Pavimento" category="floor" catalog={catalog}
          value={obj.floorMaterial} onChange={(v) => updateObj({ floorMaterial: v })} testid="room-floor-select"
        />
        <MaterialSelect
          label="Pareti" category="wall" catalog={catalog}
          value={obj.wallMaterial} onChange={(v) => updateObj({ wallMaterial: v })} testid="room-wall-select"
        />
        <MaterialSelect
          label="Soffitto" category="ceiling" catalog={catalog}
          value={obj.ceilingMaterial} onChange={(v) => updateObj({ ceilingMaterial: v })} testid="room-ceiling-select"
        />
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-widest text-zinc-500">Impianto elettrico</Label>
          <Switch checked={!!obj.electrical} onCheckedChange={(v) => updateObj({ electrical: v })} data-testid="room-electrical-switch" />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-widest text-zinc-500">Impianto idraulico</Label>
          <Switch checked={!!obj.plumbing} onCheckedChange={(v) => updateObj({ plumbing: v })} data-testid="room-plumbing-switch" />
        </div>
      </div>
    );
  }

  if (kind === "walls") {
    return (
      <div className="space-y-4">
        <div className="label-kicker">Parete</div>
        <div className="mono text-xs text-zinc-500">
          Lunghezza: {fmtNum(Math.hypot(obj.x2 - obj.x1, obj.y2 - obj.y1) / 100, 2)} m
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-zinc-500">Spessore (cm)</Label>
          <Input type="number" value={obj.thickness || 10} onChange={(e) => updateObj({ thickness: parseInt(e.target.value) || 10 })} className="rounded-sm h-9 mt-1.5 mono" />
        </div>
      </div>
    );
  }

  if (kind === "doors" || kind === "windows") {
    return (
      <div className="space-y-4">
        <div className="label-kicker">{kind === "doors" ? "Porta" : "Finestra"}</div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-zinc-500">Larghezza (cm)</Label>
          <Input type="number" value={obj.width} onChange={(e) => updateObj({ width: parseInt(e.target.value) || 80 })} className="rounded-sm h-9 mt-1.5 mono" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-zinc-500">Altezza (cm)</Label>
          <Input type="number" value={obj.height} onChange={(e) => updateObj({ height: parseInt(e.target.value) || 210 })} className="rounded-sm h-9 mt-1.5 mono" />
        </div>
        {kind === "windows" && (
          <div>
            <Label className="text-xs uppercase tracking-widest text-zinc-500">Altezza parapetto (cm)</Label>
            <Input type="number" value={obj.sillHeight || 90} onChange={(e) => updateObj({ sillHeight: parseInt(e.target.value) || 90 })} className="rounded-sm h-9 mt-1.5 mono" />
          </div>
        )}
      </div>
    );
  }

  if (kind === "items") {
    const mat = (catalog || []).find((m) => m.id === obj.materialId);
    return (
      <div className="space-y-4">
        <div className="label-kicker">{mat?.name || "Oggetto"}</div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-zinc-500">Largh.</Label>
            <Input type="number" value={obj.width} onChange={(e) => updateObj({ width: parseInt(e.target.value) || 60 })} className="rounded-sm h-9 mt-1 mono" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-zinc-500">Prof.</Label>
            <Input type="number" value={obj.depth} onChange={(e) => updateObj({ depth: parseInt(e.target.value) || 60 })} className="rounded-sm h-9 mt-1 mono" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-zinc-500">Alt.</Label>
            <Input type="number" value={obj.height} onChange={(e) => updateObj({ height: parseInt(e.target.value) || 60 })} className="rounded-sm h-9 mt-1 mono" />
          </div>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-zinc-500">Rotazione (°)</Label>
          <Input type="number" value={obj.rotation || 0} onChange={(e) => updateObj({ rotation: parseInt(e.target.value) || 0 })} className="rounded-sm h-9 mt-1.5 mono" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-zinc-500">Quantità</Label>
          <Input type="number" min={1} value={obj.qty || 1} onChange={(e) => updateObj({ qty: parseInt(e.target.value) || 1 })} className="rounded-sm h-9 mt-1.5 mono" />
        </div>
        <div className="mono text-xs text-zinc-500">
          Prezzo: {fmtEuro(mat?.price || 0)} / {mat?.unit}
        </div>
      </div>
    );
  }

  return null;
}

function MaterialSelect({ label, category, catalog, value, onChange, testid }) {
  const options = (catalog || []).filter((m) => m.category === category);
  return (
    <div>
      <Label className="text-xs uppercase tracking-widest text-zinc-500">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="rounded-sm h-9 mt-1.5" data-testid={testid}>
          <SelectValue placeholder="Seleziona…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border border-zinc-300" style={{ background: o.color }} />
                {o.name} <span className="text-zinc-400 mono text-xs">· {fmtEuro(o.price)}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ---------- Catalog Panel ----------
function CatalogPanel({ catalog, selectedMaterial, setSelectedMaterial }) {
  const [cat, setCat] = useState("furniture");
  const items = (catalog || []).filter((m) => m.category === cat);
  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-zinc-200">
        {ITEM_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={`flex-1 text-[10px] uppercase tracking-widest py-2 transition-colors ${cat === c.id ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50"}`}
            data-testid={`catalog-tab-${c.id}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-1">
        <div className="text-xs text-zinc-500 mono mb-2 px-1">clicca per selezionare → poi clicca sulla planimetria</div>
        {items.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelectedMaterial(m.id)}
            className={`w-full flex items-center gap-3 p-2 border text-left transition-colors ${selectedMaterial === m.id ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300"}`}
            data-testid={`catalog-item-${m.id}`}
          >
            <div className="w-10 h-10 border border-zinc-200" style={{ background: m.color }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{m.name}</div>
              <div className="text-xs text-zinc-500 mono">{fmtEuro(m.price)} / {m.unit}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Cost Panel ----------
function CostPanel({ estimate }) {
  if (!estimate) return null;
  return (
    <div className="p-4 flex flex-col gap-6" data-testid="cost-panel">
      <div>
        <div className="label-kicker mb-2">Totale preventivo</div>
        <div className="text-4xl font-semibold tracking-tight mono text-zinc-900" data-testid="total-cost">{fmtEuro(estimate.total)}</div>
      </div>

      {estimate.rooms.length > 0 && (
        <div>
          <div className="label-kicker mb-3">Per stanza</div>
          <div className="space-y-3">
            {estimate.rooms.map((r) => (
              <div key={r.id} className="border border-zinc-200 p-3">
                <div className="flex items-baseline justify-between mb-2">
                  <div className="font-medium">{r.name}</div>
                  <div className="mono text-sm">{fmtEuro(r.total)}</div>
                </div>
                <div className="mono text-xs text-zinc-500 space-y-0.5">
                  <div className="flex justify-between"><span>Area</span><span>{fmtNum(r.areaM2, 2)} m²</span></div>
                  <div className="flex justify-between"><span>Pavimento</span><span>{fmtEuro(r.floorCost)}</span></div>
                  <div className="flex justify-between"><span>Pareti ({fmtNum(r.wallAreaM2, 1)} m²)</span><span>{fmtEuro(r.wallCost)}</span></div>
                  <div className="flex justify-between"><span>Soffitto</span><span>{fmtEuro(r.ceilCost)}</span></div>
                  {r.elec > 0 && <div className="flex justify-between"><span>Elettrico</span><span>{fmtEuro(r.elec)}</span></div>}
                  {r.plumb > 0 && <div className="flex justify-between"><span>Idraulico</span><span>{fmtEuro(r.plumb)}</span></div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {estimate.items.length > 0 && (
        <div>
          <div className="label-kicker mb-3">Arredi e dotazioni</div>
          <div className="space-y-1">
            {estimate.items.map((it) => (
              <div key={it.id} className="flex items-center justify-between text-sm py-1.5 border-b border-zinc-100">
                <span className="truncate mr-2">{it.name} <span className="text-zinc-400 mono text-xs">×{it.qty}</span></span>
                <span className="mono text-zinc-900">{fmtEuro(it.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
