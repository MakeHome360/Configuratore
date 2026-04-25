import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  ChevronRight, ChevronLeft, Hammer, Layers, Zap, Droplet, Flame, Wind, Grid3x3,
  Package, Upload, FileImage, FileText, Type,
} from "lucide-react";
import { estimateProject, estimateProjectV2, fmtEuro, fmtEuro2, fmtNum, emptyProjectData, uid, polygonArea, polygonPerimeter } from "../editor/utils";
import { ProspettoWall, ProspettoInputs, computeInterestingWalls } from "../editor/Prospetti";
import jsPDF from "jspdf";

const TOOL_GROUPS = [
  { id: "base", label: "Base", tools: [
    { id: "select", icon: MousePointer2, label: "Seleziona" },
    { id: "wall", icon: Minus, label: "Muro mattone" },
    { id: "wall-cartongesso", icon: Minus, label: "Muro cartongesso" },
    { id: "room", icon: Square, label: "Stanza" },
    { id: "door", icon: DoorClosed, label: "Porta" },
    { id: "window", icon: RectangleHorizontal, label: "Finestra" },
    { id: "item", icon: Sofa, label: "Arredo" },
    { id: "text", icon: Type, label: "Testo" },
    { id: "delete", icon: Trash2, label: "Elimina" },
  ]},
  { id: "demo", label: "Demolizioni / Costruzioni", tools: [
    { id: "demolish-wall", icon: Hammer, label: "Demolisci muro" },
    { id: "demolish-floor", icon: Hammer, label: "Demolisci pavimento (totale)" },
    { id: "demolish-floor-partial", icon: Hammer, label: "Demolisci pavimento %" },
    { id: "demolish-rivestimento", icon: Hammer, label: "Demolisci rivestim." },
    { id: "controsoffitto", icon: Layers, label: "Controsoffitto" },
  ]},
  { id: "impianti", label: "Impianti", tools: [
    { id: "electrical", icon: Zap, label: "Elettrico" },
    { id: "plumbing", icon: Droplet, label: "Idraulico" },
    { id: "gas", icon: Flame, label: "Gas" },
    { id: "hvac", icon: Wind, label: "Condizionamento" },
  ]},
  { id: "finiture", label: "Finiture", tools: [
    { id: "tiling", icon: Grid3x3, label: "Schema posa piastrelle" },
  ]},
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
  { id: "appliance", label: "Elettrod." },
  { id: "light", label: "Luci" },
];

const TILE_SIZES = ["30x60", "60x60", "60x120", "80x80", "22.5x90", "25x150"];

export default function Editor() {
  const { id } = useParams();
  const nav = useNavigate();
  const [project, setProject] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [voci, setVoci] = useState([]);
  const [packages, setPackages] = useState([]);
  const [tool, setTool] = useState("select");
  const [selected, setSelected] = useState(null);
  const [selectedMaterial, setSelectedMaterial] = useState("furn-sofa");
  const [show3D, setShow3D] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("Pavimento in rovere, pareti bianche opache, luce naturale calda dalle finestre, mobili moderni.");
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [floorplanOpen, setFloorplanOpen] = useState(false);
  const [floorplanFile, setFloorplanFile] = useState(null);
  const [floorplanLoading, setFloorplanLoading] = useState(false);
  const [tavoleOpen, setTavoleOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [doorParams, setDoorParams] = useState({ width: 80, height: 210, type: "interna" });
  const [windowParams, setWindowParams] = useState({ width: 120, height: 140, sillHeight: 90, type: "finestra", material: "pvc" });
  const [electricalKind, setElectricalKind] = useState("presa");
  const [plumbingKind, setPlumbingKind] = useState("acqua-fredda");
  const [hvacKind, setHvacKind] = useState("split");
  const [tilingParams, setTilingParams] = useState({ size: "60x60", angle: 0 });
  const [activeGroup, setActiveGroup] = useState("base");
  const [editMode, setEditMode] = useState("fatto"); // "fatto" | "progetto"
  const viewer3DRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [pr, cat, vc, pk] = await Promise.all([
          api.get(`/projects/${id}`),
          api.get("/materials"),
          api.get("/voci-backoffice").catch(() => ({ data: [] })),
          api.get("/packages").catch(() => ({ data: [] })),
        ]);
        const data = pr.data.data && Object.keys(pr.data.data).length > 0 ? { ...emptyProjectData(), ...pr.data.data } : emptyProjectData();
        setProject({ ...pr.data, data });
        setCatalog(cat.data);
        setVoci(vc.data || []);
        setPackages(pk.data || []);
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
      await api.put(`/projects/${project.id}`, { name: project.name, data: project.data, thumbnail: project.thumbnail });
      if (showToast) toast.success("Progetto salvato");
    } catch { toast.error("Errore salvataggio"); }
    setSaving(false);
  };

  const setProjectData = (fnOrVal) => {
    setProject((prj) => {
      const newData = typeof fnOrVal === "function" ? fnOrVal(prj.data) : fnOrVal;
      return { ...prj, data: newData };
    });
  };

  const addQuickRoom = (q) => {
    const existing = project?.data?.rooms || [];
    let startX = 200, startY = 200;
    if (existing.length > 0) {
      let maxX = 0;
      existing.forEach((r) => r.points.forEach((p) => { if (p.x > maxX) maxX = p.x; }));
      startX = maxX + 30;
    }
    const w = q.w, h = q.h;
    const wallIds = [uid(), uid(), uid(), uid()];
    const corners = [
      { x: startX, y: startY }, { x: startX + w, y: startY },
      { x: startX + w, y: startY + h }, { x: startX, y: startY + h },
    ];
    const walls = [
      { id: wallIds[0], x1: corners[0].x, y1: corners[0].y, x2: corners[1].x, y2: corners[1].y, thickness: 10, kind: "mattone" },
      { id: wallIds[1], x1: corners[1].x, y1: corners[1].y, x2: corners[2].x, y2: corners[2].y, thickness: 10, kind: "mattone" },
      { id: wallIds[2], x1: corners[2].x, y1: corners[2].y, x2: corners[3].x, y2: corners[3].y, thickness: 10, kind: "mattone" },
      { id: wallIds[3], x1: corners[3].x, y1: corners[3].y, x2: corners[0].x, y2: corners[0].y, thickness: 10, kind: "mattone" },
    ];
    const room = {
      id: uid(),
      name: q.name + (existing.filter((r) => r.name.startsWith(q.name)).length ? ` ${existing.filter((r) => r.name.startsWith(q.name)).length + 1}` : ""),
      points: corners,
      floorMaterial: q.floorMaterial || "floor-ceramic",
      wallMaterial: q.wallMaterial || "wall-paint",
      ceilingMaterial: "ceil-paint",
      electrical: true,
      plumbing: !!q.plumbing,
    };
    setProjectData((p) => ({ ...p, walls: [...(p.walls || []), ...walls], rooms: [...(p.rooms || []), room] }));
    toast.success(`${q.label} aggiunta`);
  };

  const estimate = useMemo(() => (project ? estimateProject(project.data, catalog) : null), [project, catalog]);
  const estimateV2 = useMemo(() => (project ? estimateProjectV2(project.data, voci, project.data?.packageRef) : null), [project, voci]);

  const generateAIRender = async () => {
    if (!viewer3DRef.current) return;
    const snap = viewer3DRef.current.snapshot();
    if (!snap) { toast.error("Attiva la vista 3D prima"); return; }
    setAiLoading(true);
    setAiResult(null);
    try {
      const { data } = await api.post("/ai-render", { image_base64: snap, prompt: aiPrompt, style: "photorealistic interior architectural photography" });
      setAiResult(data.data_url);
      toast.success("Rendering generato");
    } catch (e) { toast.error(e.response?.data?.detail || "Errore rendering AI"); }
    setAiLoading(false);
  };

  const importFloorplan = async () => {
    if (!floorplanFile) { toast.error("Seleziona un'immagine"); return; }
    setFloorplanLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const b64 = reader.result.split(",")[1];
          const { data } = await api.post("/ai/floorplan-import", { image_base64: b64 });
          if (data.project_data) {
            setProjectData(() => ({ ...emptyProjectData(), ...data.project_data }));
            toast.success("Planimetria importata");
            setFloorplanOpen(false);
          } else {
            toast.error("Impossibile elaborare l'immagine");
          }
        } catch (e) { toast.error(e.response?.data?.detail || "Errore import AI"); }
        setFloorplanLoading(false);
      };
      reader.readAsDataURL(floorplanFile);
    } catch (e) {
      toast.error("Errore lettura file");
      setFloorplanLoading(false);
    }
  };

  const exportPDF = async () => {
    if (!project) return;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;
    doc.setFont("helvetica", "bold"); doc.setFontSize(22);
    doc.text("Preventivo Ristrutturazione", 20, y); y += 8;
    doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(100);
    doc.text(project.name, 20, y); y += 6;
    doc.text(`Data: ${new Date().toLocaleDateString("it-IT")}`, 20, y);
    if (project.data?.packageRef) { y += 6; doc.text(`Pacchetto: ${project.data.packageRef.name}`, 20, y); }
    doc.setTextColor(0); y += 10;
    doc.setDrawColor(220); doc.line(20, y, pageW - 20, y); y += 8;

    if (estimateV2 && estimateV2.items.length > 0) {
      doc.setFontSize(14); doc.setFont("helvetica", "bold");
      doc.text("Computo metrico", 20, y); y += 7;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.setFillColor(244, 244, 245); doc.rect(20, y - 4, pageW - 40, 6, "F");
      doc.text("Voce", 22, y);
      doc.text("Q.tà", 100, y);
      doc.text("Inclusa", 115, y);
      doc.text("Extra", 135, y);
      doc.text("€/u", 150, y);
      doc.text("Totale", pageW - 25, y, { align: "right" });
      y += 6;
      estimateV2.items.forEach((it) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(it.name.slice(0, 38), 22, y);
        doc.text(`${fmtNum(it.qty, 2)} ${it.unit}`, 100, y);
        doc.text(`${fmtNum(it.qty_inclusa, 2)}`, 115, y);
        doc.text(`${fmtNum(it.qty_extra, 2)}`, 135, y);
        doc.text(fmtEuro2(it.unit_price), 150, y);
        doc.text(fmtEuro2(it.total), pageW - 25, y, { align: "right" });
        y += 5;
      });
      y += 6;
      doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(20, y, pageW - 20, y); y += 7;
      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.text("Incluso nel pacchetto", 22, y); doc.text(fmtEuro(estimateV2.included_total), pageW - 22, y, { align: "right" }); y += 6;
      doc.text("Extra (a parte)", 22, y); doc.text(fmtEuro(estimateV2.extra_total), pageW - 22, y, { align: "right" }); y += 7;
      doc.setFontSize(14);
      doc.text("TOTALE", 22, y); doc.text(fmtEuro(estimateV2.total), pageW - 22, y, { align: "right" });
    }
    doc.save(`${project.name.replace(/[^a-z0-9]+/gi, "-")}-preventivo.pdf`);
    toast.success("Preventivo esportato");
  };

  const exportTavole = async (selectedTavole, prospettiInteresting, heightOverrides) => {
    if (!project) return;
    const doc = new jsPDF({ unit: "mm", format: "a3", orientation: "landscape" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const captureSvg = async (svgEl, w = 2200, h = 1400) => {
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml" });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d"); ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      return canvas.toDataURL("image/png");
    };

    const renderTavola = (title, png) => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(20);
      doc.text(title, 15, 15);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text(`Progetto: ${project.name}  ·  Data: ${new Date().toLocaleDateString("it-IT")}  ·  Misure in metri`, 15, 22);
      doc.addImage(png, "PNG", 15, 30, pageW - 30, pageH - 50);
      doc.setFontSize(8); doc.setTextColor(100);
      doc.text(`Tavola generata da CAD · ${title}`, 15, pageH - 8);
      doc.setTextColor(0);
    };

    let isFirst = true;
    // First: piante
    for (const tav of selectedTavole) {
      if (!isFirst) doc.addPage("a3", "landscape");
      isFirst = false;
      const wrapper = document.querySelector(`[data-testid="tavola-preview-${tav.id}"]`);
      const svgEl = wrapper ? wrapper.querySelector('svg[data-testid="canvas-2d"]') : null;
      if (svgEl) {
        const png = await captureSvg(svgEl);
        renderTavola(tav.title, png);
      } else {
        doc.text(`Tavola "${tav.title}" non disponibile`, 20, 30);
      }
    }
    // Then: prospetti pareti
    for (const ent of (prospettiInteresting || [])) {
      const svgEl = document.querySelector(`[data-testid="prospetto-svg-${ent.wall.id}"]`);
      if (svgEl) {
        if (!isFirst) doc.addPage("a3", "landscape");
        isFirst = false;
        const png = await captureSvg(svgEl, 2400, 1100);
        renderTavola(`Prospetto Parete · ${fmtNum(ent.length / 100, 2)}m`, png);
      }
    }
    doc.save(`${project.name.replace(/[^a-z0-9]+/gi, "-")}-tavole.pdf`);
    toast.success("Tavole esportate");
  };

  const confirmaTavoleInCommessa = async (selectedTavole, prospettiInteresting, commessaId) => {
    try {
      const tav_codes = selectedTavole.map((t) => t.id);
      // Save flag on project
      await api.put(`/projects/${project.id}`, {
        name: project.name,
        data: { ...project.data, tavole_confermate: tav_codes, tavole_confermate_at: new Date().toISOString(), commessa_id: commessaId || project.data?.commessa_id },
      });
      setProjectData((p) => ({ ...p, tavole_confermate: tav_codes, tavole_confermate_at: new Date().toISOString(), commessa_id: commessaId || p.commessa_id }));

      // Push entries to commessa.documenti
      if (commessaId) {
        const { data: c } = await api.get(`/commesse/${commessaId}`);
        const newDocs = [
          ...(c.documenti || []),
          ...selectedTavole.map((t) => ({ nome: `Tavola di Progetto: ${t.title}`, url: `/editor/${project.id}`, tipo: "tavola_progetto", flag: true, data: new Date().toISOString() })),
          ...(prospettiInteresting || []).map((ent) => ({ nome: `Prospetto Parete (${fmtNum(ent.length / 100, 2)}m)`, url: `/editor/${project.id}`, tipo: "tavola_progetto", flag: true, data: new Date().toISOString() })),
        ];
        await api.put(`/commesse/${commessaId}`, { documenti: newDocs });
        toast.success(`Tavole confermate e aggiunte ai documenti commessa (${selectedTavole.length + (prospettiInteresting || []).length})`);
      } else {
        toast.success("Tavole confermate sul progetto. Collega una commessa per aggiungerle ai documenti.");
      }
    } catch (e) { toast.error(e.response?.data?.detail || "Errore conferma tavole"); }
  };

  if (!project) return <div className="h-screen flex items-center justify-center mono text-zinc-500">caricamento editor…</div>;

  return (
    <div className="editor-root flex flex-col h-screen bg-white" data-testid="editor-page">
      <div className="h-12 border-b border-zinc-200 px-4 flex items-center gap-3 bg-white">
        <Input value={project.name} onChange={(e) => setProject((p) => ({ ...p, name: e.target.value }))} className="rounded-sm h-8 border-transparent hover:border-zinc-200 focus:border-zinc-300 max-w-xs" data-testid="project-name-input" />
        <div className="mono text-xs text-zinc-400">#{project.id.slice(0, 8)}</div>
        <div className="flex border border-zinc-300 ml-3" data-testid="edit-mode-toggle">
          <button onClick={() => setEditMode("fatto")} className={`px-3 py-1 text-xs uppercase tracking-widest ${editMode === "fatto" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"}`} data-testid="mode-fatto" title="Disegna lo stato esistente del cliente">Stato di Fatto</button>
          <button onClick={() => setEditMode("progetto")} className={`px-3 py-1 text-xs uppercase tracking-widest border-l border-zinc-300 ${editMode === "progetto" ? "bg-amber-500 text-white" : "text-zinc-700 hover:bg-zinc-50"}`} data-testid="mode-progetto" title="Lavora sul progetto: il preventivo si aggiorna live">Progetto</button>
        </div>
        <PackagePicker project={project} setProjectData={setProjectData} packages={packages} voci={voci} />
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="rounded-sm h-8" onClick={() => setFloorplanOpen(true)} data-testid="open-floorplan-import"><Upload size={14} className="mr-1.5" /> Importa Pianta</Button>
          <Button size="sm" variant="outline" className="rounded-sm h-8" onClick={() => setShow3D(v => !v)} data-testid="toggle-3d">{show3D ? <EyeOff size={14} className="mr-1.5" /> : <Eye size={14} className="mr-1.5" />}{show3D ? "Nascondi 3D" : "Mostra 3D"}</Button>
          <Button size="sm" variant="outline" className="rounded-sm h-8" onClick={() => setAiOpen(true)} data-testid="open-ai-render"><Sparkles size={14} className="mr-1.5" /> Render AI</Button>
          <Button size="sm" variant="outline" className="rounded-sm h-8" onClick={() => setTavoleOpen(true)} data-testid="open-tavole"><FileImage size={14} className="mr-1.5" /> Tavole</Button>
          <Button size="sm" variant="outline" className="rounded-sm h-8" onClick={exportPDF} data-testid="export-pdf-button"><Download size={14} className="mr-1.5" /> PDF</Button>
          <Button size="sm" className="rounded-sm h-8 bg-zinc-900 hover:bg-zinc-800" disabled={saving} onClick={() => save(true)} data-testid="save-project-button"><Save size={14} className="mr-1.5" /> {saving ? "…" : "Salva"}</Button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left tools */}
        <aside className="w-52 border-r border-zinc-200 flex flex-col bg-white overflow-y-auto">
          <div className="grid grid-cols-2 border-b border-zinc-200 sticky top-0 bg-white z-10">
            {TOOL_GROUPS.map((g) => (
              <button key={g.id} onClick={() => setActiveGroup(g.id)} className={`text-[10px] uppercase tracking-wider py-2 ${activeGroup === g.id ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50 border-b border-transparent"}`} data-testid={`tool-group-${g.id}`}>
                {g.id === "base" ? "Base" : g.id === "demo" ? "Demoliz." : g.id === "impianti" ? "Impianti" : "Finiture"}
              </button>
            ))}
          </div>
          <div className="py-2">
            {(TOOL_GROUPS.find((g) => g.id === activeGroup)?.tools || []).map((t) => (
              <button key={t.id} onClick={() => { setTool(t.id); setSelected(null); }} className={`w-full px-4 py-2 flex items-center gap-3 text-sm border-l-2 ${tool === t.id ? "bg-zinc-900 text-white border-amber-400" : "border-transparent text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300"}`} data-testid={`tool-${t.id}`}>
                <t.icon size={16} strokeWidth={tool === t.id ? 2.5 : 1.8} />
                <span className="font-medium text-xs">{t.label}</span>
              </button>
            ))}
          </div>

          {activeGroup === "impianti" && tool === "electrical" && (
            <SubKindPicker label="Tipo elemento" value={electricalKind} onChange={setElectricalKind} options={[
              { v: "quadro", l: "Quadro elettrico" }, { v: "scatola", l: "Scatola derivazione" }, { v: "presa", l: "Presa" }, { v: "interruttore", l: "Interruttore" }, { v: "luce", l: "Punto luce" }
            ]} testid="electrical-kind" />
          )}
          {activeGroup === "impianti" && tool === "plumbing" && (
            <SubKindPicker label="Tipo punto" value={plumbingKind} onChange={setPlumbingKind} options={[
              { v: "acqua-fredda", l: "Acqua fredda" }, { v: "acqua-calda", l: "Acqua calda" }, { v: "scarico", l: "Scarico" }
            ]} testid="plumbing-kind" />
          )}
          {activeGroup === "impianti" && tool === "hvac" && (
            <SubKindPicker label="Elemento" value={hvacKind} onChange={setHvacKind} options={[
              { v: "split", l: "Split a parete" },
              { v: "esterna", l: "Unità esterna" },
              { v: "predisposizione", l: "Predisposizione" },
              { v: "caldaia", l: "Caldaia condensazione" },
              { v: "caldaia-ibrida", l: "Caldaia ibrida (pompa di calore)" },
              { v: "canalizzato-ui", l: "Canalizzato · Unità interna" },
              { v: "canalizzato-canale", l: "Canalizzato · Canale aria (auto plenum)" },
              { v: "vmc", l: "VMC (ventil. meccanica)" },
            ]} testid="hvac-kind" />
          )}
          {tool === "tiling" && (
            <div className="mx-2 mt-2 space-y-2 px-2">
              <Label className="text-[10px] uppercase tracking-widest text-zinc-500">Formato</Label>
              <Select value={tilingParams.size} onValueChange={(v) => setTilingParams((p) => ({ ...p, size: v }))}>
                <SelectTrigger className="rounded-sm h-8" data-testid="tile-size"><SelectValue /></SelectTrigger>
                <SelectContent>{TILE_SIZES.map((s) => <SelectItem key={s} value={s}>{s} cm</SelectItem>)}</SelectContent>
              </Select>
              <Label className="text-[10px] uppercase tracking-widest text-zinc-500">Angolo (°)</Label>
              <Input type="number" value={tilingParams.angle} onChange={(e) => setTilingParams((p) => ({ ...p, angle: parseInt(e.target.value) || 0 }))} className="rounded-sm h-8 mono" data-testid="tile-angle" />
              <div className="text-[10px] text-zinc-500 mono leading-tight">click in stanza per posare<br/>angolo per ruotare</div>
            </div>
          )}

          <div className="label-kicker px-4 pt-5 pb-2">Stanze rapide</div>
          {QUICK_ROOMS.map((q) => (
            <button key={q.id} onClick={() => addQuickRoom(q)} className="mx-2 px-3 py-2 flex items-center gap-3 text-sm text-zinc-700 hover:bg-zinc-50" data-testid={`quick-room-${q.id}`}>
              <q.icon size={16} /><span className="text-xs">{q.label}</span>
              <span className="ml-auto mono text-[10px] text-zinc-400">{q.w / 100}×{q.h / 100}m</span>
            </button>
          ))}
        </aside>

        {/* Center */}
        <main className="flex-1 flex min-w-0">
          <div className={show3D ? "flex-1 min-w-0 border-r border-zinc-200" : "flex-1 min-w-0"}>
            <div className="h-8 border-b border-zinc-200 flex items-center px-3 bg-zinc-50">
              <Ruler size={12} className="mr-1.5 text-zinc-500" />
              <span className="label-kicker text-[10px]">Planimetria 2D</span>
              <span className="ml-auto mono text-xs text-zinc-500">{tool}</span>
            </div>
            <div className="relative" style={{ height: "calc(100% - 2rem)" }}>
              {(tool === "door" || tool === "window") && (
                <ToolParamsPanel tool={tool} doorParams={doorParams} setDoorParams={setDoorParams} windowParams={windowParams} setWindowParams={setWindowParams} />
              )}
              <Canvas2D
                project={project.data} setProject={setProjectData}
                tool={tool} setTool={setTool}
                selected={selected} setSelected={setSelected}
                selectedMaterial={selectedMaterial} catalog={catalog}
                doorParams={doorParams} windowParams={windowParams}
                electricalKind={electricalKind} plumbingKind={plumbingKind} hvacKind={hvacKind} tilingParams={tilingParams}
                viewMode={editMode}
              />
            </div>
          </div>
          {show3D && (
            <div className="flex-1 min-w-0">
              <div className="h-8 border-b border-zinc-200 flex items-center px-3 bg-zinc-50">
                <Box size={12} className="mr-1.5 text-zinc-500" /><span className="label-kicker text-[10px]">Vista 3D</span>
                <span className="ml-auto mono text-xs text-zinc-500">trascina · zoom</span>
              </div>
              <div className="relative" style={{ height: "calc(100% - 2rem)" }}>
                <Viewer3D ref={viewer3DRef} project={project.data} catalog={catalog} />
              </div>
            </div>
          )}
        </main>

        {/* Right sidebar collapsible */}
        {sidebarOpen ? (
          <aside className="w-96 border-l border-zinc-200 bg-white flex flex-col min-h-0 relative" data-testid="right-sidebar">
            <button onClick={() => setSidebarOpen(false)} className="absolute -left-3 top-3 z-10 w-6 h-6 bg-white border border-zinc-300 flex items-center justify-center hover:bg-zinc-50 shadow-sm" title="Riduci pannello" data-testid="sidebar-collapse-btn"><ChevronRight size={14} /></button>
            <Tabs defaultValue="cost" className="flex-1 flex flex-col">
              <TabsList className="rounded-none h-10 border-b border-zinc-200 bg-white justify-start px-2">
                <TabsTrigger value="properties" className="rounded-none text-xs uppercase tracking-widest" data-testid="tab-properties">Proprietà</TabsTrigger>
                <TabsTrigger value="catalog" className="rounded-none text-xs uppercase tracking-widest" data-testid="tab-catalog">Catalogo</TabsTrigger>
                <TabsTrigger value="cost" className="rounded-none text-xs uppercase tracking-widest" data-testid="tab-cost">Preventivo Live</TabsTrigger>
              </TabsList>
              <TabsContent value="properties" className="p-4 overflow-auto flex-1 mt-0">
                <PropertiesPanel project={project.data} setProject={setProjectData} selected={selected} catalog={catalog} />
              </TabsContent>
              <TabsContent value="catalog" className="p-0 overflow-auto flex-1 mt-0">
                <CatalogPanel catalog={catalog} selectedMaterial={selectedMaterial} setSelectedMaterial={(id) => { setSelectedMaterial(id); setTool("item"); }} />
              </TabsContent>
              <TabsContent value="cost" className="p-0 overflow-auto flex-1 mt-0">
                <CostPanelV2 estimate={estimateV2} packageRef={project.data?.packageRef} legacy={estimate} />
              </TabsContent>
            </Tabs>
          </aside>
        ) : (
          <aside className="w-8 border-l border-zinc-200 bg-white flex flex-col items-center pt-3" data-testid="right-sidebar-collapsed">
            <button onClick={() => setSidebarOpen(true)} className="w-6 h-6 bg-white border border-zinc-300 flex items-center justify-center hover:bg-zinc-50 shadow-sm mb-3" data-testid="sidebar-expand-btn"><ChevronLeft size={14} /></button>
            <div className="text-[10px] mono text-zinc-500 [writing-mode:vertical-rl] mt-2">PANNELLO</div>
          </aside>
        )}
      </div>

      {aiOpen && (
        <AIRenderModal aiOpen={aiOpen} setAiOpen={setAiOpen} aiPrompt={aiPrompt} setAiPrompt={setAiPrompt} aiLoading={aiLoading} aiResult={aiResult} generateAIRender={generateAIRender} />
      )}
      {floorplanOpen && (
        <FloorplanImportModal open={floorplanOpen} setOpen={setFloorplanOpen} file={floorplanFile} setFile={setFloorplanFile} loading={floorplanLoading} onImport={importFloorplan} />
      )}
      {tavoleOpen && (
        <TavoleModal open={tavoleOpen} setOpen={setTavoleOpen} project={project} catalog={catalog} estimateV2={estimateV2} onExport={exportTavole} onConferma={confirmaTavoleInCommessa} />
      )}
    </div>
  );
}

// ---------- Sub-components ----------
function SubKindPicker({ label, value, onChange, options, testid }) {
  return (
    <div className="mx-2 mt-2 space-y-2 px-2">
      <Label className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="rounded-sm h-8" data-testid={testid}><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function PackagePicker({ project, setProjectData, packages, voci }) {
  const ref = project.data?.packageRef;
  const handleSelect = (pkgId) => {
    if (pkgId === "_none") {
      setProjectData((p) => ({ ...p, packageRef: null }));
      return;
    }
    const pkg = packages.find((p) => p.id === pkgId);
    if (!pkg) return;
    // Estimate quantità incluse based on pkg.mq_inclusi (default 80) and standard ratios
    const mq = pkg.mq_inclusi || 80;
    const voci_incluse = [
      { key: "pavimento_piastrelle", qty_inclusa: mq * 0.6 },
      { key: "pavimento_parquet", qty_inclusa: mq * 0.4 },
      { key: "pittura_pareti", qty_inclusa: mq * 2.5 },
      { key: "battiscopa", qty_inclusa: mq * 0.6 },
      { key: "impianto_elettrico_mq", qty_inclusa: mq },
      { key: "impianto_idraulico_mq", qty_inclusa: 8 },
      { key: "porta_interna", qty_inclusa: 4 },
      { key: "finestre_pvc", qty_inclusa: 3 },
      { key: "demolizione_muro", qty_inclusa: 10 },
      { key: "rivestimento_piastrelle", qty_inclusa: 18 },
    ];
    setProjectData((p) => ({ ...p, packageRef: { package_id: pkg.id, name: pkg.name, mq_inclusi: mq, voci_incluse } }));
  };
  return (
    <Select value={ref?.package_id || "_none"} onValueChange={handleSelect}>
      <SelectTrigger className="rounded-sm h-8 w-44" data-testid="package-picker"><SelectValue placeholder="Pacchetto…" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="_none">Senza pacchetto</SelectItem>
        {packages.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{p.mq_inclusi ? ` · ${p.mq_inclusi}mq` : ""}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function ToolParamsPanel({ tool, doorParams, setDoorParams, windowParams, setWindowParams }) {
  return (
    <div className="absolute top-3 right-3 z-10 bg-white border border-zinc-300 shadow-md p-3 w-64" data-testid={`${tool}-params-panel`}>
      <div className="label-kicker mb-2">{tool === "door" ? "Porta" : "Finestra"} — Parametri</div>
      {tool === "door" ? (
        <div className="space-y-2">
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-zinc-500">Tipo</Label>
            <Select value={doorParams.type} onValueChange={(v) => {
              const presets = { interna: { width: 80, height: 210 }, "blindata-cl3": { width: 90, height: 215 }, "blindata-cl4": { width: 90, height: 215 }, scorrevole: { width: 90, height: 210 } };
              setDoorParams((p) => ({ ...p, type: v, ...(presets[v] || {}) }));
            }}>
              <SelectTrigger className="rounded-sm h-8 mt-1" data-testid="door-type-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="interna">Porta interna</SelectItem>
                <SelectItem value="blindata-cl3">Porta blindata Classe 3</SelectItem>
                <SelectItem value="blindata-cl4">Porta blindata Classe 4</SelectItem>
                <SelectItem value="scorrevole">Porta scorrevole</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {doorParams.type !== "scorrevole" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-zinc-500">Cardine</Label>
                <Select value={doorParams.hinge || "left"} onValueChange={(v) => setDoorParams((p) => ({ ...p, hinge: v }))}>
                  <SelectTrigger className="rounded-sm h-8 mt-1" data-testid="door-default-hinge"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="left">Sinistra</SelectItem><SelectItem value="right">Destra</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-zinc-500">Apertura</Label>
                <Select value={doorParams.swing || "in"} onValueChange={(v) => setDoorParams((p) => ({ ...p, swing: v }))}>
                  <SelectTrigger className="rounded-sm h-8 mt-1" data-testid="door-default-swing"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="in">Verso interno</SelectItem><SelectItem value="out">Verso esterno</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-[10px] uppercase tracking-widest text-zinc-500">L (cm)</Label><Input type="number" value={doorParams.width} onChange={(e) => setDoorParams((p) => ({ ...p, width: parseInt(e.target.value) || 80 }))} className="rounded-sm h-8 mt-1 mono" data-testid="door-width-input" /></div>
            <div><Label className="text-[10px] uppercase tracking-widest text-zinc-500">H (cm)</Label><Input type="number" value={doorParams.height} onChange={(e) => setDoorParams((p) => ({ ...p, height: parseInt(e.target.value) || 210 }))} className="rounded-sm h-8 mt-1 mono" data-testid="door-height-input" /></div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-zinc-500">Tipo</Label>
            <Select value={windowParams.type} onValueChange={(v) => {
              const presets = { finestra: { width: 120, height: 140, sillHeight: 90 }, "porta-finestra": { width: 120, height: 230, sillHeight: 0 }, scorrevole: { width: 180, height: 230, sillHeight: 0 }, vasistas: { width: 60, height: 60, sillHeight: 160 } };
              setWindowParams((p) => ({ ...p, type: v, ...(presets[v] || {}) }));
            }}>
              <SelectTrigger className="rounded-sm h-8 mt-1" data-testid="window-type-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="finestra">Finestra</SelectItem>
                <SelectItem value="porta-finestra">Porta finestra</SelectItem>
                <SelectItem value="scorrevole">Scorrevole</SelectItem>
                <SelectItem value="vasistas">Vasistas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-zinc-500">Materiale</Label>
            <Select value={windowParams.material} onValueChange={(v) => setWindowParams((p) => ({ ...p, material: v }))}>
              <SelectTrigger className="rounded-sm h-8 mt-1" data-testid="window-material-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pvc">PVC</SelectItem>
                <SelectItem value="alluminio">Alluminio T.T.</SelectItem>
                <SelectItem value="legno">Legno/Alluminio</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-[10px] uppercase tracking-widest text-zinc-500">L</Label><Input type="number" value={windowParams.width} onChange={(e) => setWindowParams((p) => ({ ...p, width: parseInt(e.target.value) || 120 }))} className="rounded-sm h-8 mt-1 mono" data-testid="window-width-input" /></div>
            <div><Label className="text-[10px] uppercase tracking-widest text-zinc-500">H</Label><Input type="number" value={windowParams.height} onChange={(e) => setWindowParams((p) => ({ ...p, height: parseInt(e.target.value) || 140 }))} className="rounded-sm h-8 mt-1 mono" data-testid="window-height-input" /></div>
            <div><Label className="text-[10px] uppercase tracking-widest text-zinc-500">Par.</Label><Input type="number" value={windowParams.sillHeight} onChange={(e) => setWindowParams((p) => ({ ...p, sillHeight: parseInt(e.target.value) || 0 }))} className="rounded-sm h-8 mt-1 mono" data-testid="window-sill-input" /></div>
          </div>
        </div>
      )}
    </div>
  );
}

function PropertiesPanel({ project, setProject, selected, catalog }) {
  if (!selected) {
    return (
      <div>
        <div className="label-kicker mb-3">Progetto</div>
        <div className="space-y-3">
          <div>
            <Label className="text-xs uppercase tracking-widest text-zinc-500">Altezza soffitto (cm)</Label>
            <Input type="number" value={project.roomHeight || 270} onChange={(e) => setProject((p) => ({ ...p, roomHeight: parseInt(e.target.value) || 270 }))} className="rounded-sm h-9 mt-1.5 mono" data-testid="room-height-input" />
          </div>
        </div>
        <Separator className="my-6" />
        <div className="text-xs text-zinc-500 mono leading-relaxed">Seleziona un elemento sulla planimetria per modificarne le proprietà.</div>
      </div>
    );
  }
  const kind = selected.kind;
  const obj = (project[kind] || []).find((x) => x.id === selected.id);
  if (!obj) return <div className="text-sm text-zinc-500">Elemento non trovato</div>;
  const updateObj = (patch) => setProject((p) => ({ ...p, [kind]: (p[kind] || []).map((x) => x.id === selected.id ? { ...x, ...patch } : x) }));

  if (kind === "rooms") {
    return (
      <div className="space-y-4">
        <div className="label-kicker">Stanza</div>
        <div><Label className="text-xs uppercase tracking-widest text-zinc-500">Nome</Label><Input value={obj.name} onChange={(e) => updateObj({ name: e.target.value })} className="rounded-sm h-9 mt-1.5" data-testid="room-name-input" /></div>
        <MaterialSelect label="Pavimento" category="floor" catalog={catalog} value={obj.floorMaterial} onChange={(v) => updateObj({ floorMaterial: v })} testid="room-floor-select" />
        <MaterialSelect label="Pareti" category="wall" catalog={catalog} value={obj.wallMaterial} onChange={(v) => updateObj({ wallMaterial: v })} testid="room-wall-select" />
        <MaterialSelect label="Soffitto" category="ceiling" catalog={catalog} value={obj.ceilingMaterial} onChange={(v) => updateObj({ ceilingMaterial: v })} testid="room-ceiling-select" />
        <div className="flex items-center justify-between"><Label className="text-xs uppercase tracking-widest text-zinc-500">Imp. elettrico</Label><Switch checked={!!obj.electrical} onCheckedChange={(v) => updateObj({ electrical: v })} data-testid="room-electrical-switch" /></div>
        <div className="flex items-center justify-between"><Label className="text-xs uppercase tracking-widest text-zinc-500">Imp. idraulico</Label><Switch checked={!!obj.plumbing} onCheckedChange={(v) => updateObj({ plumbing: v })} data-testid="room-plumbing-switch" /></div>
        <div className="flex items-center justify-between"><Label className="text-xs uppercase tracking-widest text-zinc-500">Controsoffitto</Label><Switch checked={!!obj.controsoffitto} onCheckedChange={(v) => updateObj({ controsoffitto: v })} data-testid="room-controsoff-switch" /></div>
      </div>
    );
  }
  if (kind === "walls") {
    return (
      <div className="space-y-4">
        <div className="label-kicker">Parete</div>
        <div className="mono text-xs text-zinc-500">Lunghezza: {fmtNum(Math.hypot(obj.x2 - obj.x1, obj.y2 - obj.y1) / 100, 2)} m</div>
        <div><Label className="text-xs uppercase tracking-widest text-zinc-500">Tipo</Label>
          <Select value={obj.kind || "mattone"} onValueChange={(v) => updateObj({ kind: v })}>
            <SelectTrigger className="rounded-sm h-9 mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="esistente">Esistente (mattone)</SelectItem><SelectItem value="nuovo">Nuovo (mattone)</SelectItem><SelectItem value="cartongesso">Cartongesso</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs uppercase tracking-widest text-zinc-500">Spessore (cm)</Label><Input type="number" value={obj.thickness || 10} onChange={(e) => updateObj({ thickness: parseInt(e.target.value) || 10 })} className="rounded-sm h-9 mt-1.5 mono" /></div>
        <Separator />
        <div className="flex items-center justify-between"><Label className="text-xs uppercase tracking-widest text-zinc-500">Demolisci tutto</Label><Switch checked={!!obj.demolito} onCheckedChange={(v) => updateObj({ demolito: v, demolito_partial: v ? null : obj.demolito_partial })} data-testid="wall-demolito-switch" /></div>
        {!obj.demolito && (
          <div className="bg-rose-50 border border-rose-200 p-2 space-y-2">
            <Label className="text-xs uppercase tracking-widest text-rose-700">Demolizione parziale</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-zinc-500">Da (% lunghezza)</Label>
                <Input type="number" min="0" max="100" step="5" value={Math.round(((obj.demolito_partial?.from) || 0) * 100)} onChange={(e) => updateObj({ demolito_partial: { ...(obj.demolito_partial || { to: 1, height: 270 }), from: Math.max(0, Math.min(1, (parseInt(e.target.value) || 0) / 100)) } })} className="rounded-sm h-9 mt-1 mono" data-testid="wall-partial-from" />
              </div>
              <div>
                <Label className="text-[10px] text-zinc-500">A (% lunghezza)</Label>
                <Input type="number" min="0" max="100" step="5" value={Math.round(((obj.demolito_partial?.to) || 0) * 100)} onChange={(e) => updateObj({ demolito_partial: { ...(obj.demolito_partial || { from: 0, height: 270 }), to: Math.max(0, Math.min(1, (parseInt(e.target.value) || 0) / 100)) } })} className="rounded-sm h-9 mt-1 mono" data-testid="wall-partial-to" />
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-zinc-500">Altezza demolita (cm) — vuoto = tutta altezza</Label>
              <Input type="number" min="0" max="400" step="10" value={obj.demolito_partial?.height || 270} onChange={(e) => updateObj({ demolito_partial: { ...(obj.demolito_partial || { from: 0, to: 0.5 }), height: parseInt(e.target.value) || 270 } })} className="rounded-sm h-9 mt-1 mono" data-testid="wall-partial-height" />
            </div>
            {obj.demolito_partial && obj.demolito_partial.to > obj.demolito_partial.from && (
              <button onClick={() => updateObj({ demolito_partial: null })} className="text-xs text-rose-700 underline">Rimuovi demolizione parziale</button>
            )}
          </div>
        )}
      </div>
    );
  }
  if (kind === "doors" || kind === "windows") {
    const isDoor = kind === "doors";
    return (
      <div className="space-y-4">
        <div className="label-kicker">{isDoor ? "Porta" : "Finestra"}</div>
        <div><Label className="text-xs uppercase tracking-widest text-zinc-500">Tipo</Label>
          <Select value={obj.type || (isDoor ? "interna" : "finestra")} onValueChange={(v) => updateObj({ type: v })}>
            <SelectTrigger className="rounded-sm h-9 mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              {isDoor ? (<><SelectItem value="interna">Porta interna</SelectItem><SelectItem value="blindata-cl3">Porta blindata Classe 3</SelectItem><SelectItem value="blindata-cl4">Porta blindata Classe 4</SelectItem><SelectItem value="scorrevole">Porta scorrevole</SelectItem></>) :
                (<><SelectItem value="finestra">Finestra</SelectItem><SelectItem value="porta-finestra">Porta finestra</SelectItem><SelectItem value="scorrevole">Scorrevole</SelectItem><SelectItem value="vasistas">Vasistas</SelectItem></>)}
            </SelectContent>
          </Select>
        </div>
        {!isDoor && (<div><Label className="text-xs uppercase tracking-widest text-zinc-500">Materiale</Label>
          <Select value={obj.material || "pvc"} onValueChange={(v) => updateObj({ material: v })}>
            <SelectTrigger className="rounded-sm h-9 mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="pvc">PVC</SelectItem><SelectItem value="alluminio">Alluminio T.T.</SelectItem><SelectItem value="legno">Legno/Alluminio</SelectItem></SelectContent>
          </Select>
        </div>)}
        {/* Cardine + apertura: ora ANCHE per porte interne, blindate, finestre (esclusi scorrevoli) */}
        {obj.type !== "scorrevole" && obj.type !== "vasistas" && (
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs uppercase tracking-widest text-zinc-500">Cardine</Label>
              <Select value={obj.hinge || "left"} onValueChange={(v) => updateObj({ hinge: v })}>
                <SelectTrigger className="rounded-sm h-9 mt-1.5" data-testid={isDoor ? "door-hinge-select" : "win-hinge-select"}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Sinistra</SelectItem>
                  <SelectItem value="right">Destra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs uppercase tracking-widest text-zinc-500">Apertura</Label>
              <Select value={obj.swing || "in"} onValueChange={(v) => updateObj({ swing: v })}>
                <SelectTrigger className="rounded-sm h-9 mt-1.5" data-testid={isDoor ? "door-swing-select" : "win-swing-select"}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">{isDoor ? "Verso interno" : "Verso interno"}</SelectItem>
                  <SelectItem value="out">{isDoor ? "Verso esterno" : "Verso esterno"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <div><Label className="text-xs uppercase tracking-widest text-zinc-500">Larghezza (cm)</Label><Input type="number" value={obj.width} onChange={(e) => updateObj({ width: parseInt(e.target.value) || 80 })} className="rounded-sm h-9 mt-1.5 mono" /></div>
        <div><Label className="text-xs uppercase tracking-widest text-zinc-500">Altezza (cm)</Label><Input type="number" value={obj.height} onChange={(e) => updateObj({ height: parseInt(e.target.value) || 210 })} className="rounded-sm h-9 mt-1.5 mono" /></div>
        {!isDoor && (<div><Label className="text-xs uppercase tracking-widest text-zinc-500">Parapetto (cm)</Label><Input type="number" value={obj.sillHeight || 90} onChange={(e) => updateObj({ sillHeight: parseInt(e.target.value) || 90 })} className="rounded-sm h-9 mt-1.5 mono" /></div>)}
      </div>
    );
  }
  if (kind === "items") {
    const mat = (catalog || []).find((m) => m.id === obj.materialId);
    return (
      <div className="space-y-4">
        <div className="label-kicker">{mat?.name || "Oggetto"}</div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label className="text-[10px] uppercase tracking-widest text-zinc-500">L.</Label><Input type="number" value={obj.width} onChange={(e) => updateObj({ width: parseInt(e.target.value) || 60 })} className="rounded-sm h-9 mt-1 mono" /></div>
          <div><Label className="text-[10px] uppercase tracking-widest text-zinc-500">P.</Label><Input type="number" value={obj.depth} onChange={(e) => updateObj({ depth: parseInt(e.target.value) || 60 })} className="rounded-sm h-9 mt-1 mono" /></div>
          <div><Label className="text-[10px] uppercase tracking-widest text-zinc-500">H.</Label><Input type="number" value={obj.height} onChange={(e) => updateObj({ height: parseInt(e.target.value) || 60 })} className="rounded-sm h-9 mt-1 mono" /></div>
        </div>
        <div><Label className="text-xs uppercase tracking-widest text-zinc-500">Rotazione (°)</Label><Input type="number" value={obj.rotation || 0} onChange={(e) => updateObj({ rotation: parseInt(e.target.value) || 0 })} className="rounded-sm h-9 mt-1.5 mono" /></div>
        <div><Label className="text-xs uppercase tracking-widest text-zinc-500">Quantità</Label><Input type="number" min={1} value={obj.qty || 1} onChange={(e) => updateObj({ qty: parseInt(e.target.value) || 1 })} className="rounded-sm h-9 mt-1.5 mono" /></div>
      </div>
    );
  }
  // Generic for impianti
  if (["electrical", "plumbing", "gas", "hvac"].includes(kind)) {
    return (
      <div className="space-y-3">
        <div className="label-kicker">Elemento impianto</div>
        <div className="mono text-xs text-zinc-500">Tipo: {obj.type || kind}</div>
        <div className="mono text-xs text-zinc-500">Posizione: {fmtNum(obj.x / 100, 2)}m, {fmtNum(obj.y / 100, 2)}m</div>
        {(kind === "electrical" || kind === "hvac") && (
          <div>
            <Label className="text-xs uppercase tracking-widest text-zinc-500">Rotazione (°)</Label>
            <Input type="number" step="15" value={obj.rotation || 0} onChange={(e) => updateObj({ rotation: parseInt(e.target.value) || 0 })} className="rounded-sm h-9 mt-1.5 mono" data-testid={`${kind}-rotation-input`} />
            <div className="flex gap-1 mt-1.5">
              {[0, 90, 180, 270].map((a) => <button key={a} onClick={() => updateObj({ rotation: a })} className="flex-1 text-[10px] mono py-1 border border-zinc-300 hover:bg-zinc-50">{a}°</button>)}
            </div>
          </div>
        )}
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
        <SelectTrigger className="rounded-sm h-9 mt-1.5" data-testid={testid}><SelectValue placeholder="Seleziona…" /></SelectTrigger>
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

function CatalogPanel({ catalog, selectedMaterial, setSelectedMaterial }) {
  const [cat, setCat] = useState("furniture");
  const items = (catalog || []).filter((m) => m.category === cat);
  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-zinc-200">
        {ITEM_CATEGORIES.map((c) => <button key={c.id} onClick={() => setCat(c.id)} className={`flex-1 text-[10px] uppercase tracking-widest py-2 ${cat === c.id ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50"}`} data-testid={`catalog-tab-${c.id}`}>{c.label}</button>)}
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-1">
        <div className="text-xs text-zinc-500 mono mb-2 px-1">clicca per selezionare → poi clicca sulla planimetria</div>
        {items.map((m) => (
          <button key={m.id} onClick={() => setSelectedMaterial(m.id)} className={`w-full flex items-center gap-3 p-2 border text-left ${selectedMaterial === m.id ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300"}`} data-testid={`catalog-item-${m.id}`}>
            <div className="w-10 h-10 border border-zinc-200" style={{ background: m.color }} />
            <div className="flex-1 min-w-0"><div className="text-sm truncate">{m.name}</div><div className="text-xs text-zinc-500 mono">{fmtEuro(m.price)} / {m.unit}</div></div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CostPanelV2({ estimate, packageRef, legacy }) {
  if (!estimate) return null;
  return (
    <div className="p-4 flex flex-col gap-5" data-testid="cost-panel">
      {packageRef && (
        <div className="border border-emerald-300 bg-emerald-50 p-3">
          <div className="label-kicker text-emerald-700 mb-1">Pacchetto attivo</div>
          <div className="font-medium" data-testid="active-package">{packageRef.name} · {packageRef.mq_inclusi} mq inclusi</div>
        </div>
      )}
      <div>
        <div className="label-kicker mb-2">Totale preventivo (live)</div>
        <div className="text-3xl font-semibold tracking-tight mono text-zinc-900" data-testid="total-cost-v2">{fmtEuro(estimate.total)}</div>
        {packageRef && (
          <div className="mono text-xs text-zinc-500 mt-2 space-y-0.5">
            <div className="flex justify-between"><span>Incluso pacchetto</span><span data-testid="included-total">{fmtEuro(estimate.included_total)}</span></div>
            <div className="flex justify-between text-rose-700"><span>Extra</span><span data-testid="extra-total">{fmtEuro(estimate.extra_total)}</span></div>
          </div>
        )}
      </div>
      <Separator />
      <div className="overflow-auto">
        <div className="label-kicker mb-2">Computo metrico</div>
        {estimate.items.length === 0 ? (
          <div className="text-xs text-zinc-500 mono">Disegna muri, stanze, impianti per popolare il computo.</div>
        ) : (
          <table className="w-full text-xs" data-testid="computo-table">
            <thead className="border-b border-zinc-200">
              <tr className="text-left text-zinc-500 uppercase tracking-widest text-[9px]">
                <th className="py-1.5">Voce</th><th>Q.tà</th><th>Extra</th><th className="text-right">€</th>
              </tr>
            </thead>
            <tbody>
              {estimate.items.map((it) => (
                <tr key={it.key} className="border-b border-zinc-100" data-testid={`computo-row-${it.key}`}>
                  <td className="py-1.5"><div>{it.name}</div><div className="text-[10px] text-zinc-400 mono">{it.category}</div></td>
                  <td className="mono">{fmtNum(it.qty, 2)} {it.unit}</td>
                  <td className="mono text-rose-700">{fmtNum(it.qty_extra, 2)}</td>
                  <td className="mono text-right">{fmtEuro(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Separator />
      <div>
        <div className="label-kicker mb-2 text-zinc-400">Stima legacy (catalog)</div>
        <div className="mono text-xs text-zinc-500">{legacy ? fmtEuro(legacy.total) : "-"}</div>
      </div>
    </div>
  );
}

function AIRenderModal({ aiOpen, setAiOpen, aiPrompt, setAiPrompt, aiLoading, aiResult, generateAIRender }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAiOpen(false)} data-testid="ai-render-modal">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] flex flex-col border border-zinc-300" onClick={(e) => e.stopPropagation()}>
        <div className="h-12 px-4 flex items-center border-b border-zinc-200">
          <Sparkles size={16} className="mr-2 text-blue-600" /><span className="font-medium" style={{ fontFamily: "Outfit" }}>Rendering AI fotorealistico</span>
          <button className="ml-auto" onClick={() => setAiOpen(false)} data-testid="close-ai-render"><X size={18} /></button>
        </div>
        <div className="grid lg:grid-cols-2 flex-1 min-h-0">
          <div className="p-5 space-y-4 border-r border-zinc-200 overflow-auto">
            <div><Label className="text-xs uppercase tracking-widest text-zinc-500">Descrizione stile</Label><Textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} rows={5} className="rounded-sm mt-2" data-testid="ai-prompt-input" /></div>
            <Button onClick={generateAIRender} disabled={aiLoading} className="rounded-sm w-full h-11 bg-zinc-900 hover:bg-zinc-800" data-testid="ai-generate-button">{aiLoading ? "Generazione…" : <><Sparkles size={14} className="mr-2" /> Genera rendering</>}</Button>
          </div>
          <div className="p-5 overflow-auto">
            <Label className="text-xs uppercase tracking-widest text-zinc-500">Risultato</Label>
            <div className="mt-2 border border-zinc-200 bg-zinc-50 aspect-video flex items-center justify-center overflow-hidden">
              {aiLoading ? <div className="text-zinc-500 mono text-sm animate-pulse">rendering…</div> : aiResult ? <img src={aiResult} alt="AI render" className="w-full h-full object-cover" data-testid="ai-render-result" /> : <div className="text-zinc-400 mono text-xs">nessun render</div>}
            </div>
            {aiResult && <a href={aiResult} download="render.png" className="block mt-3"><Button variant="outline" className="rounded-sm w-full"><Download size={14} className="mr-2" /> Scarica PNG</Button></a>}
          </div>
        </div>
      </div>
    </div>
  );
}

function FloorplanImportModal({ open, setOpen, file, setFile, loading, onImport }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)} data-testid="floorplan-modal">
      <div className="bg-white w-full max-w-xl flex flex-col border border-zinc-300" onClick={(e) => e.stopPropagation()}>
        <div className="h-12 px-4 flex items-center border-b border-zinc-200">
          <Upload size={16} className="mr-2 text-blue-600" /><span className="font-medium">Importa Planimetria 2D (AI)</span>
          <button className="ml-auto" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-sm text-zinc-600">Carica una planimetria del cliente (jpg/png). L'AI Gemini analizzerà l'immagine ed estrarrà i muri principali per generare un progetto base 2D/3D modificabile.</div>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-sm" data-testid="floorplan-file-input" />
          {file && <div className="text-xs mono text-zinc-500">File: {file.name} ({Math.round(file.size / 1024)} KB)</div>}
          <Button onClick={onImport} disabled={!file || loading} className="rounded-sm w-full h-10 bg-zinc-900 hover:bg-zinc-800" data-testid="floorplan-import-btn">{loading ? "Elaborazione AI in corso…" : "Importa con AI"}</Button>
          <div className="text-xs text-zinc-400">⚠️ Il progetto attuale verrà sostituito dai dati estratti dall'immagine. Salva prima se serve.</div>
        </div>
      </div>
    </div>
  );
}

const TAVOLE = [
  { id: "stato-fatto", title: "Stato di Fatto", viewMode: "fatto", layers: { walls: true, doors: true, windows: true, rooms: true, items: false, electrical: false, plumbing: false, gas: false, hvac: false, demolitions: false, tiling: false, dimensions: true, floors: true } },
  { id: "stato-progetto", title: "Stato di Progetto", viewMode: "progetto", layers: { walls: true, doors: true, windows: true, rooms: true, items: true, electrical: false, plumbing: false, gas: false, hvac: false, demolitions: false, tiling: false, dimensions: true, floors: true } },
  { id: "demolizioni", title: "Demolizioni", viewMode: "demolizioni", layers: { walls: true, doors: false, windows: false, rooms: true, items: false, electrical: false, plumbing: false, gas: false, hvac: false, demolitions: true, tiling: false, dimensions: true, floors: true } },
  { id: "costruzioni", title: "Costruzioni", viewMode: "costruzioni", layers: { walls: true, doors: false, windows: false, rooms: true, items: false, electrical: false, plumbing: false, gas: false, hvac: false, demolitions: false, tiling: false, dimensions: true, floors: false } },
  { id: "elettrico", title: "Impianto Elettrico", viewMode: "progetto", layers: { walls: true, doors: true, windows: true, rooms: true, items: false, electrical: true, plumbing: false, gas: false, hvac: false, demolitions: false, tiling: false, dimensions: false, floors: false } },
  { id: "idraulico", title: "Impianto Idraulico", viewMode: "progetto", layers: { walls: true, doors: true, windows: true, rooms: true, items: false, electrical: false, plumbing: true, gas: false, hvac: false, demolitions: false, tiling: false, dimensions: false, floors: false } },
  { id: "gas", title: "Impianto Gas", viewMode: "progetto", layers: { walls: true, doors: true, windows: true, rooms: true, items: false, electrical: false, plumbing: false, gas: true, hvac: false, demolitions: false, tiling: false, dimensions: false, floors: false } },
  { id: "condizionamento", title: "Impianto Condizionamento", viewMode: "progetto", layers: { walls: true, doors: true, windows: true, rooms: true, items: false, electrical: false, plumbing: false, gas: false, hvac: true, demolitions: false, tiling: false, dimensions: false, floors: false } },
  { id: "schema-posa", title: "Schema Posa Piastrelle", viewMode: "progetto", layers: { walls: true, doors: true, windows: true, rooms: true, items: false, electrical: false, plumbing: false, gas: false, hvac: false, demolitions: false, tiling: true, dimensions: true, floors: false } },
];

function TavoleModal({ open, setOpen, project, catalog, estimateV2, onExport, onConferma }) {
  const [selected, setSelected] = useState(TAVOLE.map((t) => t.id));
  const [showProspetti, setShowProspetti] = useState(true);
  const [editProspetti, setEditProspetti] = useState(false);
  const [heightOverrides, setHeightOverrides] = useState(project.data?.prospetti_heights || {});
  const [positionOverrides, setPositionOverrides] = useState(project.data?.prospetti_positions || {});
  const [commessaList, setCommessaList] = useState([]);
  const [selectedCommessa, setSelectedCommessa] = useState(project.data?.commessa_id || "");
  const [tab, setTab] = useState("piante");

  React.useEffect(() => {
    api.get("/commesse").then((r) => setCommessaList(r.data || [])).catch(() => {});
  }, []);

  const interestingWalls = useMemo(() => computeInterestingWalls(project.data), [project.data]);
  const toggle = (id) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const sel = TAVOLE.filter((t) => selected.includes(t.id));
  const updateHeight = (id, h) => setHeightOverrides((o) => ({ ...o, [id]: h }));
  const updatePosition = (id, t) => setPositionOverrides((o) => ({ ...o, [id]: t }));
  const saveHeights = async () => {
    try {
      await api.put(`/projects/${project.id}`, { name: project.name, data: { ...project.data, prospetti_heights: heightOverrides, prospetti_positions: positionOverrides } });
      toast.success("Modifiche prospetti salvate");
    } catch { toast.error("Errore salvataggio"); }
  };

  // Apply position overrides to entries (so the prospetto draws at custom t positions)
  const entriesWithPositions = useMemo(() => {
    return interestingWalls.map((ent) => ({
      ...ent,
      points: ent.points.map((p) => positionOverrides[p.id] != null ? { ...p, t: positionOverrides[p.id] } : p),
    }));
  }, [interestingWalls, positionOverrides]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="tavole-modal">
      <div className="bg-white w-full max-w-7xl max-h-[95vh] flex flex-col border border-zinc-300">
        <div className="h-12 px-4 flex items-center border-b border-zinc-200">
          <FileImage size={16} className="mr-2 text-blue-600" />
          <span className="font-medium" style={{ fontFamily: "Outfit" }}>Tavole di Progetto</span>
          <button className="ml-auto" onClick={() => setOpen(false)} data-testid="close-tavole"><X size={18} /></button>
        </div>
        <div className="flex-1 flex min-h-0">
          <div className="w-72 border-r border-zinc-200 p-4 overflow-auto">
            <div className="label-kicker mb-3">Tavole · piante</div>
            {TAVOLE.map((t) => (
              <label key={t.id} className="flex items-center gap-2 py-1.5 cursor-pointer text-sm" data-testid={`tavola-toggle-${t.id}`}>
                <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} />
                <span>{t.title}</span>
              </label>
            ))}
            <Separator className="my-3" />
            <div className="label-kicker mb-2">Prospetti pareti</div>
            <label className="flex items-center gap-2 py-1.5 text-sm">
              <input type="checkbox" checked={showProspetti} onChange={(e) => setShowProspetti(e.target.checked)} data-testid="show-prospetti-toggle" />
              <span>Includi {interestingWalls.length} prospetti</span>
            </label>
            <label className="flex items-center gap-2 py-1.5 text-sm">
              <input type="checkbox" checked={editProspetti} onChange={(e) => setEditProspetti(e.target.checked)} data-testid="edit-prospetti-toggle" />
              <span>Modifica posizioni e altezze</span>
            </label>
            {editProspetti && <Button size="sm" variant="outline" className="rounded-sm w-full h-8 mt-2" onClick={saveHeights} data-testid="save-heights-btn">Salva modifiche</Button>}
            <Separator className="my-4" />
            <div className="label-kicker mb-2">Conferma in</div>
            <Select value={selectedCommessa || "_none"} onValueChange={(v) => setSelectedCommessa(v === "_none" ? "" : v)}>
              <SelectTrigger className="rounded-sm h-9" data-testid="commessa-picker"><SelectValue placeholder="Commessa…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Nessuna (solo progetto)</SelectItem>
                {commessaList.map((c) => <SelectItem key={c.id} value={c.id}>{c.numero || c.id.slice(0, 6)} · {c.cliente?.nome || "—"}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" className="rounded-sm w-full h-9 bg-zinc-900 hover:bg-zinc-800 mt-3" onClick={() => onExport(sel, showProspetti ? interestingWalls : [], heightOverrides)} data-testid="export-tavole-btn"><Download size={14} className="mr-2" /> Esporta PDF</Button>
            <Button size="sm" variant="outline" className="rounded-sm w-full h-9 mt-2" onClick={() => onConferma(sel, showProspetti ? interestingWalls : [], selectedCommessa)} data-testid="conferma-tavole-btn"><FileText size={14} className="mr-2" /> Conferma in Commessa</Button>
          </div>
          <div className="flex-1 overflow-auto p-4 bg-zinc-50">
            <div className="flex gap-2 mb-3">
              <button onClick={() => setTab("piante")} className={`px-3 py-1.5 text-xs uppercase tracking-widest ${tab === "piante" ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200"}`} data-testid="tab-piante">Piante ({sel.length})</button>
              <button onClick={() => setTab("prospetti")} className={`px-3 py-1.5 text-xs uppercase tracking-widest ${tab === "prospetti" ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200"}`} data-testid="tab-prospetti">Prospetti ({interestingWalls.length})</button>
            </div>
            {tab === "piante" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {sel.map((t) => <TavolaPreview key={t.id} tavola={t} project={project} catalog={catalog} />)}
              </div>
            )}
            {tab === "prospetti" && (
              <div className="space-y-4">
                {interestingWalls.length === 0 && (
                  <div className="text-sm text-zinc-500 p-6 bg-white border border-zinc-200 italic">Nessuna parete con elementi rilevanti (prese/scarichi/split) entro 80cm. Aggiungi impianti al progetto per generare i prospetti.</div>
                )}
                {entriesWithPositions.map((ent) => (
                  <div key={ent.wall.id} className="bg-white border border-zinc-300 p-3" data-testid={`prospetto-card-${ent.wall.id}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-sm" style={{ fontFamily: "Outfit" }}>Prospetto Parete · L={fmtNum(ent.length / 100, 2)}m</div>
                      <div className="text-[10px] mono text-zinc-400">{ent.points.length} elementi · {ent.doors.length} porte · {ent.windows.length} finestre</div>
                    </div>
                    <ProspettoWall entry={ent} roomHeight={project.data?.roomHeight || 270} editable={editProspetti} heightOverrides={heightOverrides} onChangeHeight={updateHeight} onChangePosition={updatePosition} />
                    {editProspetti && <ProspettoInputs entry={ent} heightOverrides={heightOverrides} onChangeHeight={updateHeight} onChangePosition={updatePosition} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TavolaPreview({ tavola, project, catalog }) {
  return (
    <div className="bg-white border border-zinc-300 p-3" data-testid={`tavola-preview-${tavola.id}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-sm" style={{ fontFamily: "Outfit" }}>{tavola.title}</div>
        <div className="text-[10px] mono text-zinc-400">{project.name}</div>
      </div>
      <div className="aspect-video bg-zinc-50 border border-zinc-200 relative">
        <Canvas2D
          project={project.data} setProject={() => {}} tool="select"
          selected={null} setSelected={() => {}} selectedMaterial="" catalog={catalog}
          doorParams={{}} windowParams={{}}
          electricalKind="presa" plumbingKind="acqua-fredda" hvacKind="split" tilingParams={{ size: "60x60", angle: 0 }}
          layers={tavola.layers} viewMode={tavola.viewMode}
        />
        <Legenda tavolaId={tavola.id} />
      </div>
    </div>
  );
}

const LEGENDE = {
  "stato-fatto": [
    { color: "#0A0A0A", label: "Muratura esistente" },
    { color: "#F5E9D8", label: "Pavimento esistente", swatch: true },
  ],
  "stato-progetto": [
    { color: "#0A0A0A", label: "Muratura esistente" },
    { color: "#EAB308", label: "Nuova muratura" },
    { color: "#F5E9D8", label: "Pavimento", swatch: true },
  ],
  demolizioni: [
    { color: "#DC2626", label: "Muratura da demolire", dashed: true },
    { color: "#DC2626", label: "Pavimento da demolire", hatch: "demo" },
  ],
  costruzioni: [
    { color: "#EAB308", label: "Nuova muratura (mattone)", hatch: "new" },
    { color: "#525252", label: "Nuova muratura (cartongesso)", dashed: true },
  ],
  elettrico: [
    { color: "#7C3AED", label: "Q · Quadro elettrico" },
    { color: "#7C3AED", label: "Scatola derivazione" },
    { color: "#7C3AED", label: "Presa / Interruttore / Luce" },
  ],
  idraulico: [
    { color: "#0EA5E9", label: "F · Acqua fredda" },
    { color: "#DC2626", label: "C · Acqua calda" },
    { color: "#0891B2", label: "S · Scarico" },
  ],
  gas: [{ color: "#EAB308", label: "G · Punto gas" }],
  condizionamento: [
    { color: "#0F766E", label: "Split / Unità interna" },
    { color: "#0F766E", label: "UE · Unità esterna" },
  ],
  "schema-posa": [
    { color: "#16A34A", label: "Punto di partenza piastrelle" },
    { color: "#71717A", label: "Trama piastrelle" },
  ],
};

function Legenda({ tavolaId }) {
  const items = LEGENDE[tavolaId];
  if (!items) return null;
  return (
    <div className="absolute bottom-1 right-1 bg-white/95 border border-zinc-300 px-2 py-1.5 text-[9px] mono space-y-0.5 max-w-[55%]" data-testid={`legenda-${tavolaId}`}>
      <div className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Legenda</div>
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {it.hatch === "demo" ? (
            <div className="w-3 h-3" style={{ backgroundImage: `repeating-linear-gradient(45deg, ${it.color}, ${it.color} 1.5px, transparent 1.5px, transparent 4px)` }} />
          ) : it.hatch === "new" ? (
            <div className="w-3 h-3" style={{ backgroundImage: `repeating-linear-gradient(-45deg, ${it.color}, ${it.color} 1px, transparent 1px, transparent 3px)` }} />
          ) : it.swatch ? (
            <div className="w-3 h-3 border border-zinc-400" style={{ background: it.color }} />
          ) : it.dashed ? (
            <div className="w-3 h-0.5" style={{ background: `repeating-linear-gradient(to right, ${it.color}, ${it.color} 2px, transparent 2px, transparent 4px)` }} />
          ) : (
            <div className="w-3 h-0.5" style={{ background: it.color }} />
          )}
          <span className="text-zinc-700">{it.label}</span>
        </div>
      ))}
    </div>
  );
}
