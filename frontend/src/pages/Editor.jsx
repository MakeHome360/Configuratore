import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Canvas2D from "../editor/Canvas2D";
import Viewer3D from "../editor/Viewer3D";
import AbacoInfisso from "../components/AbacoInfisso";
import AiCadEditPanel from "../components/AiCadEditPanel";
import WallProspettoEditor from "../components/WallProspettoEditor";
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
  MousePointer2, Minus, Square, DoorClosed, RectangleHorizontal, Sofa, Trash2, Plus,
  Save, Download, Sparkles, Eye, EyeOff, Box, Ruler, X, Home, Bath, ChefHat, Bed,
  ChevronRight, ChevronLeft, Hammer, Layers, Zap, Droplet, Flame, Wind, Grid3x3,
  Package, Upload, FileImage, FileText, Type, RotateCcw, RotateCw, Receipt,
} from "lucide-react";
import { estimateProject, estimateProjectV2, fmtEuro, fmtEuro2, fmtNum, emptyProjectData, uid, polygonArea, polygonPerimeter, splitRoomByWall, buildPackageRef } from "../editor/utils";
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
    { id: "stairs", icon: Layers, label: "Scala" },
    { id: "column", icon: Square, label: "Pilastro" },
    { id: "item", icon: Sofa, label: "Arredo" },
    { id: "text", icon: Type, label: "Testo" },
    { id: "delete", icon: Trash2, label: "Elimina" },
  ]},
  { id: "demolizioni", label: "Demolizioni", tools: [
    { id: "demolish-wall", icon: Hammer, label: "Muro · click" },
    { id: "demolish-wall-partial", icon: Hammer, label: "Muro parziale · drag" },
    { id: "demolish-floor", icon: Hammer, label: "Pavimento · totale" },
    { id: "demolish-floor-partial", icon: Hammer, label: "Pavimento · area" },
    { id: "demolish-rivestimento", icon: Hammer, label: "Rivestim. · parziale" },
  ]},
  { id: "pacchetto", label: "Pacchetto", tools: [
    { id: "package-area", icon: Square, label: "Area pacchetto" },
  ]},
  { id: "costruzioni", label: "Costruzioni", tools: [
    { id: "controsoffitto", icon: Layers, label: "Controsoffitto stanza" },
    { id: "controsoffitto-area", icon: Layers, label: "Controsoffitto area" },
    { id: "tiling", icon: Grid3x3, label: "Schema piastrelle" },
  ]},
  { id: "elettrico", label: "Imp. elettrico", tools: [
    { id: "electrical", icon: Zap, label: "Elettrico" },
  ]},
  { id: "termo", label: "Imp. termo-idraulico", tools: [
    { id: "plumbing", icon: Droplet, label: "Idraulico (acqua/scarico)" },
    { id: "gas", icon: Flame, label: "Gas" },
    { id: "hvac", icon: Wind, label: "Climatizz./Riscald." },
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
  const [viewLayout, setViewLayout] = useState("both"); // "2d" | "3d" | "both"
  const show2D = viewLayout === "2d" || viewLayout === "both";
  const show3D = viewLayout === "3d" || viewLayout === "both";
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStyle, setAiStyle] = useState("isometric_dollhouse");
  const svgWrapperRef = useRef(null);
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
  const [stairsKind, setStairsKind] = useState("muratura");
  const [columnKind, setColumnKind] = useState("cemento");
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [wallProspettoId, setWallProspettoId] = useState(null);
  const [tilingParams, setTilingParams] = useState({ size: "60x60", angle: 0, color: "#D4A574" });
  const [activeGroup, setActiveGroup] = useState("base");
  const [editMode, setEditMode] = useState("fatto"); // "fatto" | "progetto"
  const viewer3DRef = useRef(null);

  // Undo / Redo history stacks (snapshots di project)
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const lastSnapshotJsonRef = useRef(null);
  const skipNextSnapshotRef = useRef(false);

  // Snapshot automatico ogni volta che project cambia (eccetto durante undo/redo stesso)
  useEffect(() => {
    if (!project) return;
    if (skipNextSnapshotRef.current) { skipNextSnapshotRef.current = false; return; }
    const json = JSON.stringify(project);
    if (lastSnapshotJsonRef.current === null) {
      lastSnapshotJsonRef.current = json;
      return;
    }
    if (json === lastSnapshotJsonRef.current) return;
    undoStackRef.current.push(lastSnapshotJsonRef.current);
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
    redoStackRef.current = []; // qualsiasi nuova azione invalida il redo
    lastSnapshotJsonRef.current = json;
  }, [project]);

  // Espone helpers per test E2E e debug (preview/dev mode)
  useEffect(() => {
    if (!project) return;
    window.__editorTest = {
      getProject: () => project,
      setProjectData: (data) => setProject((p) => ({ ...p, data: typeof data === "function" ? data(p.data) : data })),
      setSelected: (sel) => setSelected(sel),
      getSelected: () => selected,
      addWallProgetto: (x1, y1, x2, y2) => {
        const id = Math.random().toString(36).slice(2, 10);
        setProject((p) => {
          const newWall = { id, x1, y1, x2, y2, thickness: 10, kind: "nuovo", phase: "progetto" };
          const rooms = p.data?.rooms || [];
          for (const r of rooms) {
            const split = splitRoomByWall(r.points, { x: x1, y: y1 }, { x: x2, y: y2 });
            if (split) {
              const baseProps = { ...r };
              delete baseProps.id; delete baseProps.points; delete baseProps.name;
              const r1 = { ...baseProps, id: id + "_a", name: `${r.name} A`, points: split[0] };
              const r2 = { ...baseProps, id: id + "_b", name: `${r.name} B`, points: split[1] };
              const otherRooms = rooms.filter((x) => x.id !== r.id);
              return { ...p, data: { ...p.data, rooms: [...otherRooms, r1, r2], walls: [...(p.data.walls || []), newWall] } };
            }
          }
          return { ...p, data: { ...p.data, walls: [...(p.data.walls || []), newWall] } };
        });
      },
    };
    return () => { delete window.__editorTest; };
  }, [project]);

  const undo = () => {
    if (undoStackRef.current.length === 0) { toast.info("Niente da annullare"); return; }
    const prevJson = undoStackRef.current.pop();
    redoStackRef.current.push(JSON.stringify(project));
    skipNextSnapshotRef.current = true;
    lastSnapshotJsonRef.current = prevJson;
    setProject(JSON.parse(prevJson));
    toast.success("Annullato");
  };
  const redo = () => {
    if (redoStackRef.current.length === 0) { toast.info("Niente da ripristinare"); return; }
    const nextJson = redoStackRef.current.pop();
    undoStackRef.current.push(JSON.stringify(project));
    skipNextSnapshotRef.current = true;
    lastSnapshotJsonRef.current = nextJson;
    setProject(JSON.parse(nextJson));
    toast.success("Ripristinato");
  };

  // Keyboard shortcuts: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      // Skip se sta scrivendo in un input/textarea
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

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
        // Migrazione phase: assegna "fatto" agli elementi senza phase (progetti legacy)
        const ensurePhase = (arr) => (arr || []).map((el) => el.phase ? el : { ...el, phase: "fatto" });
        data.walls = ensurePhase(data.walls);
        data.rooms = ensurePhase(data.rooms);
        data.doors = ensurePhase(data.doors);
        data.windows = ensurePhase(data.windows);
        data.electrical = ensurePhase(data.electrical);
        data.plumbing = ensurePhase(data.plumbing);
        data.gas = ensurePhase(data.gas);
        data.hvac = ensurePhase(data.hvac);
        data.stairs = ensurePhase(data.stairs);
        data.items = ensurePhase(data.items);
        setProject({ ...pr.data, data });
        setCatalog(cat.data);
        setVoci(vc.data || []);
        const pkgs = (pk.data || []).slice().sort((a, b) => (a.price_per_m2 || 0) - (b.price_per_m2 || 0));
        setPackages(pkgs);
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
    const phase = editMode === "fatto" ? "fatto" : "progetto";
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
    // Le quick-room rappresentano stanze ESISTENTI della casa (schema base): muri "esistenti".
    // Solo il tool wall esplicito disegna muri "nuovi" (di costruzione).
    const wallKind = "esistente";
    const walls = [
      { id: wallIds[0], x1: corners[0].x, y1: corners[0].y, x2: corners[1].x, y2: corners[1].y, thickness: 10, kind: wallKind, phase },
      { id: wallIds[1], x1: corners[1].x, y1: corners[1].y, x2: corners[2].x, y2: corners[2].y, thickness: 10, kind: wallKind, phase },
      { id: wallIds[2], x1: corners[2].x, y1: corners[2].y, x2: corners[3].x, y2: corners[3].y, thickness: 10, kind: wallKind, phase },
      { id: wallIds[3], x1: corners[3].x, y1: corners[3].y, x2: corners[0].x, y2: corners[0].y, thickness: 10, kind: wallKind, phase },
    ];
    const room = {
      id: uid(),
      name: q.name + (existing.filter((r) => r.name.startsWith(q.name)).length ? ` ${existing.filter((r) => r.name.startsWith(q.name)).length + 1}` : ""),
      points: corners,
      floorMaterial: q.floorMaterial || "floor-ceramic",
      wallMaterial: q.wallMaterial || "wall-paint",
      ceilingMaterial: "ceil-paint",
      electrical: false,
      plumbing: !!q.plumbing,
      phase,
    };
    setProjectData((p) => ({ ...p, walls: [...(p.walls || []), ...walls], rooms: [...(p.rooms || []), room] }));
    toast.success(`${q.label} aggiunta · ${phase === "fatto" ? "Stato di Fatto" : "Progetto"}`);
  };

  const estimate = useMemo(() => (project ? estimateProject(project.data, catalog) : null), [project, catalog]);
  const estimateV2 = useMemo(() => (project ? estimateProjectV2(project.data, voci, project.data?.packageRef) : null), [project, voci]);

  // Auto-ricalcola packageRef quando cambiano stanze, packageArea o pacchetto: mq_inclusi e voci_incluse devono restare sincronizzate
  useEffect(() => {
    if (!project?.data?.packageRef) return;
    const pkg = packages.find((p) => p.id === project.data.packageRef.package_id);
    if (!pkg) return;
    const fresh = buildPackageRef(pkg, project.data);
    if (!fresh) return;
    const cur = project.data.packageRef;
    if (Math.abs((cur.mq_inclusi || 0) - fresh.mq_inclusi) > 0.01 || Math.abs((cur.package_base_total || 0) - fresh.package_base_total) > 0.01) {
      setProjectData((p) => ({ ...p, packageRef: fresh }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.data?.rooms, project?.data?.packageArea, project?.data?.packageRef?.package_id, packages]);

  // Carica preventivo collegato (se esiste) per mostrare il confronto budget
  const [linkedPreventivo, setLinkedPreventivo] = useState(null);
  useEffect(() => {
    if (!project?.preventivo_id) { setLinkedPreventivo(null); return; }
    api.get(`/preventivi/${project.preventivo_id}`).then((r) => setLinkedPreventivo(r.data)).catch(() => setLinkedPreventivo(null));
  }, [project?.preventivo_id]);

  // Salva il computo metrico CAD live come Preventivo nel DB
  const saveAsPreventivo = async () => {
    if (!estimateV2) { toast.error("Nessun computo da salvare"); return; }
    const items = estimateV2.items.map((it) => ({
      voce_id: it.voce_id, name: it.name, unit: it.unit, qty: it.qty,
      qty_inclusa: it.qty_inclusa, qty_extra: it.qty_extra,
      unit_price: it.unit_price, total: it.total, category: it.category,
    }));
    // Se il progetto è già collegato a un preventivo CAD, aggiorna; altrimenti crea
    const totale = estimateV2.total;
    const iva = totale * 0.10;
    const cliente_default = project?.cliente || { nome: project?.name || "Cliente CAD" };
    const pkgRef = project.data?.packageRef;
    const body = {
      tipo: "cad",
      cliente: cliente_default,
      package_id: pkgRef?.package_id || null,
      mq: pkgRef?.mq_inclusi || estimateV2.mq_progetto || 0,
      items, optional: [],
      note: `Preventivo generato dal CAD · Progetto: ${project.name}`,
      sconto_pct: 0, sconto_eur: 0, iva_pct: 10,
      totale_iva_escl: Math.round(totale * 100) / 100,
      totale_iva_incl: Math.round((totale + iva) * 100) / 100,
      project_id: project.id,
      package_base_total: pkgRef?.package_base_total || 0,
      package_price_per_m2: pkgRef?.price_per_m2 || 0,
      package_name: pkgRef?.name || null,
      extra_total: estimateV2.extra_total,
      included_total: estimateV2.included_total,
    };
    try {
      let saved;
      if (project.preventivo_id) {
        saved = await api.put(`/preventivi/${project.preventivo_id}`, body);
        toast.success(`Preventivo aggiornato (${saved.data.numero || project.preventivo_id})`);
      } else {
        saved = await api.post("/preventivi", body);
        // collega il progetto al nuovo preventivo
        const newPid = saved.data.id;
        await api.put(`/projects/${project.id}`, { ...project, preventivo_id: newPid });
        setProject((p) => ({ ...p, preventivo_id: newPid }));
        toast.success(`Preventivo creato (${saved.data.numero})`);
      }
      setLinkedPreventivo(saved.data);
    } catch (e) {
      toast.error("Errore salvataggio preventivo");
    }
  };

  // Cattura il PNG della pianta 2D dal SVG (per modalità dollhouse).
  const capture2DPng = async () => {
    const wrap = svgWrapperRef.current;
    if (!wrap) return null;
    const svgEl = wrap.querySelector("svg");
    if (!svgEl) return null;
    const clone = svgEl.cloneNode(true);
    // Rimuovi cursori e draft elements
    const w = svgEl.clientWidth || 1200;
    const h = svgEl.clientHeight || 800;
    clone.setAttribute("width", w);
    clone.setAttribute("height", h);
    const xml = new XMLSerializer().serializeToString(clone);
    const dataUri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = w * 2; canvas.height = h * 2;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const png = canvas.toDataURL("image/png").split(",")[1];
        resolve(png);
      };
      img.onerror = () => resolve(null);
      img.src = dataUri;
    });
  };

  const generateAIRender = async () => {
    setAiLoading(true);
    setAiResult(null);
    try {
      let snap = null;
      if (aiStyle === "isometric_dollhouse") {
        // Per il dollhouse usiamo la pianta 2D come reference (più chiara per l'AI).
        snap = await capture2DPng();
        if (!snap || snap.length < 1000) {
          toast.error("Disegna prima la pianta 2D (almeno una stanza).");
          setAiLoading(false);
          return;
        }
      } else {
        // Per interior_room/exterior usiamo lo snapshot 3D
        if (!show3D) { setViewLayout("both"); await new Promise((res) => setTimeout(res, 900)); }
        if (!viewer3DRef.current) { toast.error("Vista 3D non disponibile."); setAiLoading(false); return; }
        await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
        snap = viewer3DRef.current.snapshot();
        if (snap && snap.startsWith("data:")) snap = snap.split(",")[1];
        if (!snap || snap.length < 2000) { toast.error("Snapshot 3D vuoto. Disegna almeno una stanza."); setAiLoading(false); return; }
      }
      const body = { image_base64: snap, style: aiStyle, project_id: project?.id };
      if (aiPrompt && aiPrompt.trim()) body.prompt = aiPrompt.trim();
      const { data } = await api.post("/render/3d", body);
      const dataUrl = `data:${data.mime_type || "image/png"};base64,${data.image_base64}`;
      setAiResult(dataUrl);
      toast.success("Rendering generato ✓");
    } catch (e) {
      console.error("[AI render]", e);
      toast.error(e.response?.data?.detail || "Errore rendering AI");
    }
    setAiLoading(false);
  };

  const importFloorplan = async () => {
    if (!floorplanFile) { toast.error("Seleziona un'immagine"); return; }
    setFloorplanLoading(true);
    try {
      // Resize via canvas: max 1600px lato lungo, JPEG q=0.85 → riduce drasticamente tempo AI
      const blobToBase64 = (blob) => new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(blob);
      });
      const optimizeImage = (file) => new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 1600;
          let { width: w, height: h } = img;
          if (w > MAX || h > MAX) {
            const scale = Math.min(MAX / w, MAX / h);
            w = Math.round(w * scale); h = Math.round(h * scale);
          }
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob((blob) => blob ? res(blob) : rej(new Error("Conversione fallita")), "image/jpeg", 0.85);
        };
        img.onerror = () => rej(new Error("File immagine non valido"));
        img.src = URL.createObjectURL(file);
      });

      let blob;
      try {
        blob = await optimizeImage(floorplanFile);
      } catch {
        // Fallback se browser non supporta conversione
        blob = floorplanFile;
      }
      const b64 = await blobToBase64(blob);
      const sizeKb = Math.round(b64.length * 0.75 / 1024);
      console.log(`[floorplan] sending ${sizeKb}KB to AI...`);

      try {
        const { data } = await api.post("/ai/floorplan-import", { image_base64: b64 }, { timeout: 120000 });
        if (data.project_data && (data.rooms_count || 0) > 0) {
          setProjectData(() => ({ ...emptyProjectData(), ...data.project_data }));
          toast.success(`Planimetria importata · ${data.rooms_count} stanze`);
          setFloorplanOpen(false);
          setTimeout(() => window.dispatchEvent(new CustomEvent("cad:fit-all")), 200);
        } else if (data.project_data && !data.rooms_count) {
          toast.error("L'AI non è riuscita a riconoscere stanze. Prova con un'immagine più chiara o ad alto contrasto.");
        } else {
          toast.error("Risposta AI inattesa. Riprova.");
        }
      } catch (e) {
        const detail = e.response?.data?.detail || e.message || "Errore sconosciuto";
        if (detail.includes("EMERGENT_LLM_KEY")) {
          toast.error("Servizio AI non configurato. Contatta l'amministratore.");
        } else if (e.code === "ECONNABORTED") {
          toast.error("L'AI ci sta mettendo troppo. Riprova con un'immagine più piccola.");
        } else {
          toast.error(`Errore import: ${detail.substring(0, 120)}`);
        }
      }
      setFloorplanLoading(false);
    } catch (e) {
      console.error("Floorplan import error:", e);
      toast.error("Errore durante la lettura del file");
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
    // SCALA 1:100 REALE — per ogni tavola calcoliamo le dimensioni di carta basate sul viewBox in cm
    // 1:100 → 1 cm reale (1 unità viewBox) = 0,1 mm carta (10mm reali = 1mm carta → sbagliato)
    // Convenzione architettonica: 1cm realtà = 0,01 m carta = 1mm carta su scala 1:10 (no)
    // Correzione: 1:100 significa 1 unità disegno = 100 unità realtà. Se viewBox è in cm (1 unità = 1cm realtà)
    // allora 1 cm realtà → 0,01 disegno carta → 0,1 mm carta. quindi paper_mm = viewBox_cm * 0.1 = viewBox_cm / 10
    // In pratica: paperMm = viewBox_units / 10
    const SCALE_DIVISOR = 10; // 1:100
    const MARGIN_MM = 30; // margine laterale per intestazione/legenda
    const TITLE_H_MM = 25;
    const FOOT_H_MM = 20;
    let doc = null;
    const captureSvg = async (svgEl, w, h) => {
      try {
        const cloned = svgEl.cloneNode(true);
        cloned.setAttribute("width", w);
        cloned.setAttribute("height", h);
        if (!cloned.getAttribute("xmlns")) cloned.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        const svgData = new XMLSerializer().serializeToString(cloned);
        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = () => rej(new Error("SVG load failed"));
          img.src = url;
          setTimeout(() => rej(new Error("SVG load timeout")), 8000);
        });
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d"); ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        return canvas.toDataURL("image/png");
      } catch (err) {
        console.warn("[exportTavole] captureSvg failed:", err);
        return null;
      }
    };

    // Per ogni tavola: ricava viewBox (in cm reali), calcola dimensioni carta a scala 1:100
    const buildPageForSvg = (svgEl) => {
      const vbAttr = svgEl.getAttribute("viewBox") || "0 0 2200 1400";
      const parts = vbAttr.split(/\s+/).map(Number);
      const vbW = parts[2] || 2200;
      const vbH = parts[3] || 1400;
      // dimensioni disegno su carta in mm (scala 1:100)
      const drawW = Math.max(60, vbW / SCALE_DIVISOR);
      const drawH = Math.max(40, vbH / SCALE_DIVISOR);
      // pagina = disegno + margini + intestazione + footer
      const pageW = drawW + MARGIN_MM * 2;
      const pageH = drawH + TITLE_H_MM + FOOT_H_MM;
      return { vbW, vbH, drawW, drawH, pageW, pageH };
    };

    const drawFrame = (d, pageW, pageH, title, scaleNote = "SCALA 1:100") => {
      // Cartiglio / frame
      d.setLineWidth(0.3);
      d.rect(MARGIN_MM - 5, TITLE_H_MM - 5, pageW - 2 * (MARGIN_MM - 5), pageH - TITLE_H_MM - FOOT_H_MM + 10);
      d.setFont("helvetica", "bold"); d.setFontSize(14);
      d.text(title, MARGIN_MM, 12);
      d.setFont("helvetica", "normal"); d.setFontSize(8);
      d.text(`Progetto: ${project.name}  ·  Data: ${new Date().toLocaleDateString("it-IT")}`, MARGIN_MM, 18);
      // Scala — in basso a destra con barra graduata
      const sbX = pageW - MARGIN_MM - 50, sbY = pageH - 10;
      d.setFont("helvetica", "bold"); d.setFontSize(9);
      d.text(scaleNote, sbX, sbY - 6);
      // Barra scala: ogni segmento = 10 mm carta = 1 m reale
      d.setLineWidth(0.3);
      for (let i = 0; i < 3; i++) {
        if (i % 2 === 0) d.setFillColor(0, 0, 0); else d.setFillColor(255, 255, 255);
        d.rect(sbX + i * 10, sbY - 3, 10, 3, "FD");
      }
      d.setFontSize(7);
      d.text("0", sbX - 1, sbY + 5);
      d.text("1", sbX + 9, sbY + 5);
      d.text("2", sbX + 19, sbY + 5);
      d.text("3 m", sbX + 29, sbY + 5);
      d.setFontSize(7);
      d.text("Misure sulle quote: cm", MARGIN_MM, pageH - 5);
    };

    let exported = 0;
    // Piante
    for (const tav of selectedTavole) {
      const wrapper = document.querySelector(`[data-testid="tavola-preview-${tav.id}"]`);
      const svgEl = wrapper ? wrapper.querySelector('svg[data-testid="canvas-2d"]') : null;
      if (!svgEl) continue;
      const { vbW, vbH, drawW, drawH, pageW, pageH } = buildPageForSvg(svgEl);
      // PNG ad alta risoluzione (4x vbW/vbH) per stampa nitida
      const png = await captureSvg(svgEl, Math.round(vbW * 2), Math.round(vbH * 2));
      if (!png) continue;
      if (!doc) doc = new jsPDF({ unit: "mm", format: [pageW, pageH], orientation: pageW > pageH ? "landscape" : "portrait" });
      else doc.addPage([pageW, pageH], pageW > pageH ? "landscape" : "portrait");
      drawFrame(doc, pageW, pageH, tav.title);
      doc.addImage(png, "PNG", MARGIN_MM, TITLE_H_MM, drawW, drawH);
      exported++;
    }
    // Prospetti
    for (const ent of (prospettiInteresting || [])) {
      const svgEl = document.querySelector(`[data-testid="prospetto-svg-${ent.wall.id}"]`);
      if (!svgEl) continue;
      const { vbW, vbH, drawW, drawH, pageW, pageH } = buildPageForSvg(svgEl);
      const png = await captureSvg(svgEl, Math.round(vbW * 2), Math.round(vbH * 2));
      if (!png) continue;
      if (!doc) doc = new jsPDF({ unit: "mm", format: [pageW, pageH], orientation: pageW > pageH ? "landscape" : "portrait" });
      else doc.addPage([pageW, pageH], pageW > pageH ? "landscape" : "portrait");
      drawFrame(doc, pageW, pageH, `Prospetto Parete · L=${fmtNum(ent.length / 100, 2)}m`);
      doc.addImage(png, "PNG", MARGIN_MM, TITLE_H_MM, drawW, drawH);
      exported++;
    }
    if (!doc || exported === 0) {
      toast.error("Nessuna tavola esportabile. Assicurati di aver aperto il preview almeno una volta.");
      return;
    }
    doc.save(`${project.name.replace(/[^a-z0-9]+/gi, "-")}-tavole-scala-1-100.pdf`);
    toast.success(`Tavole esportate (${exported}) in scala 1:100`);
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
      <div className="h-12 border-b border-zinc-200 px-4 flex items-center gap-2 bg-white overflow-x-auto whitespace-nowrap">
        <Input value={project.name} onChange={(e) => setProject((p) => ({ ...p, name: e.target.value }))} className="rounded-sm h-8 border-transparent hover:border-zinc-200 focus:border-zinc-300 max-w-[160px] shrink-0" data-testid="project-name-input" />
        <div className="mono text-[10px] text-zinc-400 shrink-0">#{project.id.slice(0, 6)}</div>
        <div className="flex border border-zinc-300 shrink-0" data-testid="edit-mode-toggle">
          <button onClick={() => setEditMode("fatto")} className={`px-2 py-1 text-[10px] uppercase tracking-widest ${editMode === "fatto" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"}`} data-testid="mode-fatto" title="Disegna lo stato esistente del cliente">Stato di Fatto</button>
          <button onClick={() => setEditMode("progetto")} className={`px-2 py-1 text-[10px] uppercase tracking-widest border-l border-zinc-300 ${editMode === "progetto" ? "bg-amber-500 text-white" : "text-zinc-700 hover:bg-zinc-50"}`} data-testid="mode-progetto" title="Lavora sul progetto: il preventivo si aggiorna live">Progetto</button>
        </div>
        <PackagePicker project={project} setProjectData={setProjectData} packages={packages} voci={voci} />
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <Button size="sm" variant="ghost" className="rounded-sm h-8 px-2" onClick={undo} title="Annulla (Ctrl+Z)" data-testid="undo-btn"><RotateCcw size={14} /></Button>
          <Button size="sm" variant="ghost" className="rounded-sm h-8 px-2" onClick={redo} title="Ripristina (Ctrl+Shift+Z)" data-testid="redo-btn"><RotateCw size={14} /></Button>
          <div className="w-px h-5 bg-zinc-200 mx-1"></div>
          <Button size="sm" variant="outline" className="rounded-sm h-8 px-2" onClick={() => setFloorplanOpen(true)} title="Importa Pianta da immagine (AI)" data-testid="open-floorplan-import"><Upload size={14} /></Button>
          <div className="flex border border-zinc-300 rounded-sm overflow-hidden h-8" data-testid="view-layout-toggle">
            <button onClick={() => setViewLayout("2d")} className={`px-2 text-[10px] uppercase tracking-widest ${viewLayout === "2d" ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"}`} title="Solo planimetria 2D" data-testid="view-2d-only">2D</button>
            <button onClick={() => setViewLayout("both")} className={`px-2 text-[10px] uppercase tracking-widest border-l border-r border-zinc-300 ${viewLayout === "both" ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"}`} title="Affiancato" data-testid="view-both">2D+3D</button>
            <button onClick={() => setViewLayout("3d")} className={`px-2 text-[10px] uppercase tracking-widest ${viewLayout === "3d" ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"}`} title="Solo vista 3D" data-testid="view-3d-only">3D</button>
          </div>
          <Button size="sm" variant="outline" className="rounded-sm h-8 px-2" onClick={() => setAiOpen(true)} title="Render AI fotorealistico" data-testid="open-ai-render"><Sparkles size={14} /></Button>
          <Button size="sm" variant="outline" className="rounded-sm h-8 px-2 border-violet-400 text-violet-700 hover:bg-violet-50" onClick={() => setAiPanelOpen((v) => !v)} title="AI assistente: modifica spazi del 2D via comando" data-testid="open-ai-2d"><Sparkles size={14} className="mr-1" /><span className="text-xs font-bold">AI 2D</span></Button>
          <Button size="sm" variant="outline" className="rounded-sm h-8 px-2" onClick={() => setTavoleOpen(true)} title="Tavole di Progetto" data-testid="open-tavole"><FileImage size={14} /></Button>
          <Button size="sm" variant="outline" className="rounded-sm h-8 px-2" onClick={exportPDF} title="Esporta preventivo PDF" data-testid="export-pdf-button"><Download size={14} /></Button>
          <Button size="sm" className="rounded-sm h-8 px-3 bg-zinc-900 hover:bg-zinc-800 sticky right-0 shrink-0" disabled={saving} onClick={() => save(true)} data-testid="save-project-button"><Save size={14} className="mr-1.5" /> {saving ? "…" : "Salva"}</Button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left tools */}
        <aside className="w-52 border-r border-zinc-200 flex flex-col bg-white overflow-y-auto">
          <div className="grid grid-cols-2 border-b border-zinc-200 sticky top-0 bg-white z-10">
            {TOOL_GROUPS.map((g) => (
              <button key={g.id} onClick={() => setActiveGroup(g.id)} className={`text-[10px] uppercase tracking-wider py-2 ${activeGroup === g.id ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50 border-b border-transparent"}`} data-testid={`tool-group-${g.id}`}>
                {g.label}
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

          {(activeGroup === "termo" || activeGroup === "impianti") && tool === "hvac" && (() => {
            const cadKindToHvacType = {
              "termo.mono_split": "split", "termo.dual_split": "dual-split", "termo.trial_split": "trial-split",
              "termo.quadri_split": "quadri-split",
              "termo.unita_esterna": "esterna", "termo.canalizzato": "canalizzato", "termo.vmc": "vmc",
              "termo.predisposizione": "predisposizione", "termo.caldaia": "caldaia", "termo.caldaia_ibrida": "caldaia-ibrida",
              "termo.pompa_calore": "pompa-calore", "termo.scaldabagno": "scaldabagno", "termo.termoarredo": "termoarredo",
              "termo.termosifone": "termosifone", "termo.fotovoltaico": "fotovoltaico",
              "termo.pavimento_radiante": "pavimento-radiante", "termo.soffitto_radiante": "soffitto-radiante",
            };
            const dynamicOpts = (voci || [])
              .filter(v => v.cad_category === "TERMO_IDRAULICO" && (v.active !== false))
              .filter(v => cadKindToHvacType[v.cad_kind])
              .map(v => ({ v: cadKindToHvacType[v.cad_kind], l: v.name }));
            // Aggiungi sempre mono/dual/trial/quadri come fallback
            const fallback = [
              { v: "split", l: "Mono split" },
              { v: "dual-split", l: "Dual split (2 split + UE)" },
              { v: "trial-split", l: "Trial split (3 split + UE)" },
              { v: "quadri-split", l: "Quadri split (4 split + UE)" },
            ];
            // Dedup by value preserving fallback order
            const seen = new Set();
            const merged = [...fallback, ...dynamicOpts].filter(o => { if (seen.has(o.v)) return false; seen.add(o.v); return true; });
            const opts = merged;
            return opts.length > 0 ? (
              <SubKindPicker label="Elemento (da Backoffice)" value={hvacKind} onChange={setHvacKind} options={opts} testid="hvac-kind" />
            ) : (
              <div className="text-xs text-zinc-500 mono">Nessuna voce TERMO_IDRAULICO. Aggiungi voci nel <a href="/voci-backoffice" className="text-blue-600 underline">Backoffice</a>.</div>
            );
          })()}
          {(activeGroup === "elettrico" || activeGroup === "impianti") && tool === "electrical" && (
            <SubKindPicker label="Elemento" value={electricalKind} onChange={setElectricalKind} options={[
              { v: "presa", l: "Presa" }, { v: "presa-tv", l: "Presa TV" }, { v: "presa-rj45", l: "Presa RJ45/dati" },
              { v: "interruttore", l: "Interruttore" }, { v: "deviatore", l: "Deviatore" },
              { v: "punto-luce", l: "Punto luce" }, { v: "punto-luce-led", l: "Punto luce LED" },
              { v: "quadro-elettrico", l: "Quadro elettrico" },
            ]} testid="electrical-kind" />
          )}
          {(activeGroup === "termo" || activeGroup === "impianti") && tool === "plumbing" && (
            <SubKindPicker label="Elemento" value={plumbingKind} onChange={setPlumbingKind} options={[
              { v: "punto-completo", l: "Punto acqua COMPLETO (F+C+S)" },
              { v: "acqua-fredda", l: "Solo acqua fredda" },
              { v: "acqua-calda", l: "Solo acqua calda" },
              { v: "scarico", l: "Solo scarico" },
              { v: "lavatrice", l: "Attacco lavatrice" },
              { v: "lavastoviglie", l: "Attacco lavastoviglie" },
            ]} testid="plumb-kind" />
          )}
          {tool === "stairs" && (
            <SubKindPicker label="Tipo scala" value={stairsKind} onChange={setStairsKind} options={[
              { v: "chiocciola", l: "A chiocciola" },
              { v: "muratura", l: "In muratura (rampa)" },
              { v: "legno", l: "In legno (rampa)" },
            ]} testid="stairs-kind" />
          )}
          {tool === "column" && (
            <SubKindPicker label="Tipo pilastro" value={columnKind} onChange={setColumnKind} options={[
              { v: "cemento", l: "Cemento armato" },
              { v: "mattone", l: "Muratura mattone" },
              { v: "cartongesso", l: "Cartongesso (rivest.)" },
            ]} testid="column-kind" />
          )}
          {tool === "tiling" && (
            <div className="mx-2 mt-2 space-y-2 px-2">
              <Label className="text-[10px] uppercase tracking-widest text-zinc-500">Tipo piastrella (catalogo)</Label>
              <Select value={tilingParams.voceId || ""} onValueChange={(v) => {
                const voce = (voci || []).find((x) => x.id === v);
                setTilingParams((p) => ({ ...p, voceId: v, vocePrice: voce?.prezzo_rivendita || voce?.unit_price || 0, voceName: voce?.name || "" }));
              }}>
                <SelectTrigger className="rounded-sm h-8" data-testid="tile-voce-select"><SelectValue placeholder="Scegli tipo…" /></SelectTrigger>
                <SelectContent>
                  {(voci || []).filter((v) => /piastrell|gres|ceramic|marmo|parquet|laminato|pvc|battiscop/i.test(v.name || "")).map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name} · {fmtEuro(v.prezzo_rivendita || v.unit_price || 0)}/{v.unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tilingParams.voceName && (
                <div className="text-[10px] text-emerald-700 mono">✓ {tilingParams.voceName} · {fmtEuro(tilingParams.vocePrice)}/m²</div>
              )}
              <Label className="text-[10px] uppercase tracking-widest text-zinc-500">Formato</Label>
              <Select value={tilingParams.size} onValueChange={(v) => setTilingParams((p) => ({ ...p, size: v }))}>
                <SelectTrigger className="rounded-sm h-8" data-testid="tile-size"><SelectValue /></SelectTrigger>
                <SelectContent>{TILE_SIZES.map((s) => <SelectItem key={s} value={s}>{s} cm</SelectItem>)}</SelectContent>
              </Select>
              <Label className="text-[10px] uppercase tracking-widest text-zinc-500">Angolo (°)</Label>
              <Input type="number" value={tilingParams.angle} onChange={(e) => setTilingParams((p) => ({ ...p, angle: parseInt(e.target.value) || 0 }))} className="rounded-sm h-8 mono" data-testid="tile-angle" />
              <Label className="text-[10px] uppercase tracking-widest text-zinc-500">Colore piastrella (per 2D/3D)</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={tilingParams.color || "#D4A574"} onChange={(e) => setTilingParams((p) => ({ ...p, color: e.target.value }))} className="h-8 w-12 border border-zinc-300 rounded-sm cursor-pointer" data-testid="tile-color" />
                <div className="grid grid-cols-6 gap-1 flex-1">
                  {["#D4A574","#A87C4F","#FAFAFA","#3F3F46","#A1A1AA","#78350F","#0F766E","#1E3A8A","#92400E","#475569","#FBBF24","#DC2626"].map((c) => (
                    <button key={c} onClick={() => setTilingParams((p) => ({ ...p, color: c }))} className={`h-6 border ${tilingParams.color === c ? "border-zinc-900 ring-2 ring-zinc-900" : "border-zinc-300"}`} style={{ background: c }} title={c} />
                  ))}
                </div>
              </div>
              <button
                type="button"
                disabled={!tilingParams.voceId || !(project?.data?.rooms || []).length}
                onClick={() => {
                  const voce = (voci || []).find((x) => x.id === tilingParams.voceId);
                  if (!voce) { toast.error("Scegli prima un tipo di piastrella"); return; }
                  const rooms = project?.data?.rooms || [];
                  setProjectData((d) => {
                    const existing = d.tiling || [];
                    const others = existing.filter((t) => !rooms.some((r) => r.id === t.roomId));
                    const newTilings = rooms.map((r) => ({
                      id: uid(), roomId: r.id, size: tilingParams.size, angle: tilingParams.angle,
                      startPoint: { x: r.points[0].x, y: r.points[0].y },
                      voceId: tilingParams.voceId, vocePrice: tilingParams.vocePrice, voceName: tilingParams.voceName,
                      color: tilingParams.color || "#D4A574",
                    }));
                    return { ...d, tiling: [...others, ...newTilings] };
                  });
                  toast.success(`✓ ${voce.name} applicato a tutte le ${rooms.length} stanze (m² calcolati a partire dai muri)`);
                }}
                className="w-full rounded-sm h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold disabled:bg-zinc-300 disabled:cursor-not-allowed"
                data-testid="tile-apply-all-rooms"
              >
                ↗ Applica a TUTTA la casa
              </button>
              <button
                type="button"
                disabled={!(project?.data?.tiling || []).length}
                onClick={() => {
                  if (!confirm("Rimuovere la posa piastrelle da tutte le stanze?")) return;
                  setProjectData((d) => ({ ...d, tiling: [] }));
                  toast.success("Posa piastrelle rimossa da tutta la casa");
                }}
                className="w-full rounded-sm h-7 border border-rose-300 text-rose-700 hover:bg-rose-50 text-[10px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="tile-clear-all"
              >
                ✕ Rimuovi posa da tutte le stanze
              </button>
              <div className="bg-blue-50 border border-blue-200 p-1.5 text-[10px] text-blue-900 leading-tight">
                <b>Come funziona:</b><br/>
                • <b>Click su una stanza</b> → applica solo lì<br/>
                • <b>"Applica a TUTTA la casa"</b> → tutte le stanze in un colpo<br/>
                • <b>m² adattati ai muri</b> automaticamente
              </div>
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
          {show2D && (
          <div className={show3D ? "flex-1 min-w-0 border-r border-zinc-200" : "flex-1 min-w-0"}>
            <div className="h-8 border-b border-zinc-200 flex items-center px-3 bg-zinc-50">
              <Ruler size={12} className="mr-1.5 text-zinc-500" />
              <span className="label-kicker text-[10px]">Planimetria 2D</span>
              <span className="ml-auto mono text-xs text-zinc-500">{tool}</span>
            </div>
            {/* Banner hint contestuale per i tool di demolizione */}
            {(() => {
              const HINTS = {
                "demolish-wall": { color: "bg-rose-50 text-rose-900 border-rose-300", text: "🔨 DEMOLIZIONE MURO · Click su un muro intero per marcarlo come demolito (linea rossa tratteggiata)." },
                "demolish-wall-partial": { color: "bg-rose-50 text-rose-900 border-rose-300", text: "🔨 DEMOLIZIONE MURO PARZIALE · Trascina sul muro per definire la porzione da demolire. Affina con maniglie/pannello." },
                "demolish-floor": { color: "bg-orange-50 text-orange-900 border-orange-300", text: "🔨 DEMOLIZIONE PAVIMENTO TOTALE · Click sulla stanza per demolire tutto il pavimento (toggle, ri-click rimuove)." },
                "demolish-floor-partial": { color: "bg-orange-50 text-orange-900 border-orange-300", text: "🔨 DEMOLIZIONE PAVIMENTO AD AREA · Click per i vertici del poligono, doppio click per chiudere l'area." },
                "demolish-rivestimento": { color: "bg-amber-50 text-amber-900 border-amber-300", text: "🔨 DEMOLIZIONE RIVESTIMENTO PARZIALE · Click sulla parete; poi nel pannello proprietà imposta posizione (sx/dx) e altezza dell'area." },
              };
              const hint = HINTS[tool];
              if (!hint) return null;
              return (
                <div className={`px-3 py-2 text-[11px] uppercase tracking-wider font-semibold border-b ${hint.color}`} data-testid={`tool-hint-${tool}`}>
                  {hint.text}
                </div>
              );
            })()}
            <div className="relative" style={{ height: "calc(100% - 2rem)" }}>
              {(tool === "door" || tool === "window") && (
                <ToolParamsPanel tool={tool} doorParams={doorParams} setDoorParams={setDoorParams} windowParams={windowParams} setWindowParams={setWindowParams} />
              )}
              <div ref={svgWrapperRef} className="absolute inset-0">
              <Canvas2D
                project={project.data} setProject={setProjectData}
                tool={tool} setTool={setTool}
                selected={selected} setSelected={setSelected}
                selectedMaterial={selectedMaterial} catalog={catalog}
                doorParams={doorParams} windowParams={windowParams}
                electricalKind={electricalKind} plumbingKind={plumbingKind} hvacKind={hvacKind} tilingParams={tilingParams} stairsKind={stairsKind} columnKind={columnKind}
                viewMode={editMode}
              />
              </div>
            </div>
          </div>
          )}
          {show3D && (
            <div className="flex-1 min-w-0">
              <div className="h-8 border-b border-zinc-200 flex items-center px-3 bg-zinc-50">
                <Box size={12} className="mr-1.5 text-zinc-500" /><span className="label-kicker text-[10px]">Vista 3D</span>
                <span className="ml-auto mono text-xs text-zinc-500">trascina · zoom</span>
              </div>
              <div className="relative" style={{ height: "calc(100% - 2rem)" }}>
                {["electrical","plumbing","gas","hvac"].includes(tool) && (
                  <div className="absolute top-2 left-2 z-10 bg-violet-600 text-white text-xs px-3 py-1.5 shadow-lg rounded-sm font-bold mono pointer-events-none" data-testid="3d-placement-hint">
                    🎯 Modalità inserimento {tool}: clicca su un muro nel 3D per piazzare il punto
                  </div>
                )}
                <Viewer3D ref={viewer3DRef} project={{ ...project.data, viewMode: editMode }} catalog={catalog} selected={selected} 
                  placement={(["electrical","plumbing","gas","hvac"].includes(tool)) ? { tool, kind: tool === "electrical" ? electricalKind : tool === "plumbing" ? plumbingKind : tool === "hvac" ? hvacKind : "gas" } : null}
                  onPlace={(payload) => {
                    const { tool: pt, kind, x, y, wall_side, height_cm } = payload;
                    const newPt = { id: uid(), x, y, wall_side, height_cm, phase: editMode };
                    if (pt === "electrical") {
                      newPt.type = kind || "presa";
                      setProjectData(d => ({ ...d, electrical: [...(d.electrical || []), newPt] }));
                      toast.success(`✓ Presa aggiunta in 3D · h=${height_cm}cm`);
                    } else if (pt === "plumbing") {
                      newPt.type = kind || "acqua-fredda";
                      if (kind === "punto-completo") Object.assign(newPt, { has_fredda: true, has_calda: true, has_scarico: true });
                      setProjectData(d => ({ ...d, plumbing: [...(d.plumbing || []), newPt] }));
                      toast.success(`✓ Punto idraulico aggiunto in 3D · h=${height_cm}cm`);
                    } else if (pt === "hvac") {
                      newPt.kind = kind || "split";
                      setProjectData(d => ({ ...d, hvac: [...(d.hvac || []), newPt] }));
                      toast.success(`✓ ${kind || "split"} aggiunto in 3D · h=${height_cm}cm`);
                    } else if (pt === "gas") {
                      setProjectData(d => ({ ...d, gas: [...(d.gas || []), newPt] }));
                      toast.success(`✓ Punto gas aggiunto in 3D · h=${height_cm}cm`);
                    }
                  }}
                  onSelect={(s) => { setSelected(s); setSidebarOpen(true); }} onDrag={(payload) => {
                  const { kind, id } = payload;
                  if (kind === "items") {
                    setProjectData(d => ({ ...d, items: (d.items || []).map(it => it.id === id ? { ...it, x: payload.x, y: payload.y } : it) }));
                  } else if (kind === "columns") {
                    setProjectData(d => ({ ...d, columns: (d.columns || []).map(c => c.id === id ? { ...c, x: payload.x, y: payload.y } : c) }));
                  } else if (kind === "rooms") {
                    setProjectData(d => ({ ...d, rooms: (d.rooms || []).map(r => r.id === id ? { ...r, points: payload.points } : r) }));
                  } else if (kind === "walls") {
                    setProjectData(d => ({ ...d, walls: (d.walls || []).map(w => w.id === id ? { ...w, x1: payload.x1, y1: payload.y1, x2: payload.x2, y2: payload.y2 } : w) }));
                  } else if (kind === "doors") {
                    setProjectData(d => ({ ...d, doors: (d.doors || []).map(dr => dr.id === id ? { ...dr, t: payload.t } : dr) }));
                  } else if (kind === "windows") {
                    setProjectData(d => ({ ...d, windows: (d.windows || []).map(wn => wn.id === id ? { ...wn, t: payload.t } : wn) }));
                  } else if (["electrical", "plumbing", "hvac", "gas"].includes(kind)) {
                    setProjectData(d => ({ ...d, [kind]: (d[kind] || []).map(el => el.id === id ? { ...el, x: payload.x, y: payload.y } : el) }));
                  }
                }} />
              </div>
            </div>
          )}
        </main>

        {/* Right sidebar collapsible */}
        {sidebarOpen ? (
          <aside className="w-96 border-l border-zinc-200 bg-white flex flex-col min-h-0 max-h-full relative overflow-hidden" data-testid="right-sidebar">
            <button onClick={() => setSidebarOpen(false)} className="absolute -left-3 top-3 z-10 w-6 h-6 bg-white border border-zinc-300 flex items-center justify-center hover:bg-zinc-50 shadow-sm" title="Riduci pannello" data-testid="sidebar-collapse-btn"><ChevronRight size={14} /></button>
            <Tabs defaultValue="properties" className="flex-1 flex flex-col min-h-0">
              <TabsList className="rounded-none h-10 border-b border-zinc-200 bg-white justify-start px-2 flex-shrink-0">
                <TabsTrigger value="properties" className="rounded-none text-xs uppercase tracking-widest" data-testid="tab-properties">Proprietà</TabsTrigger>
                <TabsTrigger value="catalog" className="rounded-none text-xs uppercase tracking-widest" data-testid="tab-catalog">Catalogo</TabsTrigger>
                <TabsTrigger value="cost" className="rounded-none text-xs uppercase tracking-widest" data-testid="tab-cost">Preventivo Live</TabsTrigger>
              </TabsList>
              <TabsContent value="properties" className="p-4 overflow-y-auto flex-1 mt-0 min-h-0">
                <PropertiesPanel project={project.data} setProject={setProjectData} selected={selected} catalog={catalog} editMode={editMode} voci={voci} openWallProspetto={(id) => setWallProspettoId(id)} />
              </TabsContent>
              <TabsContent value="catalog" className="p-0 overflow-y-auto flex-1 mt-0 min-h-0">
                <CatalogPanel catalog={catalog} selectedMaterial={selectedMaterial} setSelectedMaterial={(id) => { setSelectedMaterial(id); setTool("item"); }} project={project.data} setProject={setProjectData} voci={voci} selected={selected} />
              </TabsContent>
              <TabsContent value="cost" className="p-0 overflow-y-auto flex-1 mt-0 min-h-0">
                <CostPanelV2 estimate={estimateV2} packageRef={project.data?.packageRef} legacy={estimate} linkedPreventivo={linkedPreventivo} saveAsPreventivo={saveAsPreventivo} excludedKeys={project.data?.excluded_keys || []} setExcludedKeys={(keys) => setProjectData((d) => ({ ...d, excluded_keys: keys }))} removeElementsForKey={(key) => {
                  // Rimuove dal PROGETTO gli elementi associati alla voce
                  const map = {
                    "porta_interna": { arr: "doors", filter: (d) => d.phase === "progetto" && !(d.type || "").startsWith("blindata") },
                    "porta_blindata_cl3": { arr: "doors", filter: (d) => d.phase === "progetto" && (d.type === "blindata" || d.type === "blindata-cl3") },
                    "porta_blindata_cl4": { arr: "doors", filter: (d) => d.phase === "progetto" && d.type === "blindata-cl4" },
                    "finestre_pvc": { arr: "windows", filter: (w) => w.phase === "progetto" && (w.material || "pvc") === "pvc" },
                    "finestre_alluminio": { arr: "windows", filter: (w) => w.phase === "progetto" && w.material === "alluminio" },
                    "finestre_legno": { arr: "windows", filter: (w) => w.phase === "progetto" && w.material === "legno" },
                    "punto_presa": { arr: "electrical", filter: (e) => e.type === "presa" },
                    "punto_interruttore": { arr: "electrical", filter: (e) => e.type === "interruttore" },
                    "punto_luce": { arr: "electrical", filter: (e) => e.type === "luce" || e.type === "punto-luce" },
                    "quadro_elettrico": { arr: "electrical", filter: (e) => e.type === "quadro" || e.type === "quadro-elettrico" },
                    "punto_acqua": { arr: "plumbing", filter: (p) => p.type !== "scarico" },
                    "punto_scarico": { arr: "plumbing", filter: (p) => p.type === "scarico" },
                    "punto_gas": { arr: "gas", filter: () => true },
                    "costruzione_muro_cartongesso": { arr: "walls", filter: (w) => w.kind === "cartongesso" },
                    "costruzione_muro_mattone": { arr: "walls", filter: (w) => w.kind === "nuovo" },
                  };
                  const cfg = map[key];
                  if (!cfg) return false; // non supportato → solo exclude
                  const arr = (project.data || {})[cfg.arr] || [];
                  const toRemove = arr.filter(cfg.filter);
                  if (toRemove.length === 0) return false;
                  if (!window.confirm(`Rimuovere ${toRemove.length} ${cfg.arr} dal progetto?`)) return false;
                  setProjectData((d) => ({ ...d, [cfg.arr]: (d[cfg.arr] || []).filter((x) => !cfg.filter(x)) }));
                  return true;
                }} />
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
        <AIRenderModal aiOpen={aiOpen} setAiOpen={setAiOpen} aiPrompt={aiPrompt} setAiPrompt={setAiPrompt} aiLoading={aiLoading} aiResult={aiResult} generateAIRender={generateAIRender} aiStyle={aiStyle} setAiStyle={setAiStyle} />
      )}
      {aiPanelOpen && (
        <AiCadEditPanel
          project={project}
          editMode={editMode}
          onApply={(newData) => setProjectData(() => newData)}
          onClose={() => setAiPanelOpen(false)}
        />
      )}
      {wallProspettoId && (
        <WallProspettoEditor
          project={project}
          wallId={wallProspettoId}
          editMode={editMode}
          onClose={() => setWallProspettoId(null)}
          onChange={(newData) => setProjectData(() => newData)}
        />
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
    const newRef = buildPackageRef(pkg, project.data);
    if (!newRef || newRef.mq_inclusi <= 0) {
      toast.error("Disegna prima le stanze di progetto (o l'area pacchetto) per calcolare i mq");
      return;
    }
    setProjectData((p) => ({ ...p, packageRef: newRef }));
    toast.success(`${pkg.name}: ${newRef.mq_inclusi.toFixed(2)} mq × ${newRef.price_per_m2}€/mq = ${newRef.package_base_total.toFixed(2)}€`);
  };
  return (
    <Select value={ref?.package_id || "_none"} onValueChange={handleSelect}>
      <SelectTrigger className="rounded-sm h-8 w-44" data-testid="package-picker"><SelectValue placeholder="Pacchetto…" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="_none">Senza pacchetto</SelectItem>
        {packages.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {p.price_per_m2}€/mq</SelectItem>)}
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

function PropertiesPanel({ project, setProject, selected, catalog, editMode, voci, openWallProspetto }) {
  if (!selected) {
    const overrides = project.priceOverrides || {};
    const setOverride = (voce_id, price) => setProject((p) => ({
      ...p,
      priceOverrides: { ...(p.priceOverrides || {}), [voce_id]: price },
    }));
    const removeOverride = (voce_id) => setProject((p) => {
      const next = { ...(p.priceOverrides || {}) };
      delete next[voce_id];
      return { ...p, priceOverrides: next };
    });
    // Filtro fuori voci pavimentazione/piastrelle/parquet — vanno gestite SOLO dal tab CATALOGO (sinistra) per stanza
    // L'utente vuole che la scelta materiale pavimento sia confinata al catalogo, non duplicata qui.
    const FLOORING_CATS = new Set(["PAVIMENTAZIONE_GRES", "PAVIMENTAZIONE_PARQUET", "PAVIMENTAZIONE_LAMINATO", "PAVIMENTAZIONE_MARMO", "RIVESTIMENTO_PIASTRELLE"]);
    const editable = (voci || []).filter((v) => v.modificabile_dal_venditore && !FLOORING_CATS.has(v.category || ""));
    const pkgRef = project.packageRef;
    // Mappa voce_id → prezzo MAX coperto dal pacchetto (se voce è in pacchetto)
    const pkgPriceMap = {};
    if (pkgRef && Array.isArray(pkgRef.voci_incluse)) {
      pkgRef.voci_incluse.forEach((vi) => {
        if (vi.voce_id && vi.ref_unit_price > 0) pkgPriceMap[vi.voce_id] = vi.ref_unit_price;
      });
    }
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
        <details className="space-y-3 group" data-testid="listino-personalizzato-details">
          <summary className="cursor-pointer flex items-center gap-2 select-none">
            <div className="label-kicker flex items-center gap-2">🏷️ Prezzi NEGOZIATI con il tuo fornitore <span className="text-[10px] text-zinc-400 ml-1 group-open:hidden">(clicca per aprire)</span></div>
          </summary>
          <div className="text-[11px] text-zinc-700 bg-amber-50 border border-amber-200 p-2 rounded leading-relaxed mt-2">
            <b>Cosa è?</b> Qui modifichi il <b>COSTO al m²</b> dei materiali che hai negoziato col tuo fornitore (es. Gres marmo a 30€/m² invece di 38€/m²).<br/>
            <b>Non confondere con il catalogo:</b> il catalogo a sinistra serve per <b>SCEGLIERE il TIPO</b> di materiale (Gres / Parquet / Laminato). Qui invece cambi solo il <b>PREZZO</b> delle voci modificabili.<br/>
            <b>NB:</b> ha effetto solo sui materiali contrassegnati <code>modificabile_dal_venditore=true</code> nel backoffice.
          </div>
          <div className="text-[10px] text-zinc-500 mono leading-relaxed">
            {pkgRef ? <span className="text-amber-700">CON PACCHETTO ({pkgRef.name}): se il tuo prezzo supera il <b>prezzo MAX coperto dal pacchetto</b>, l'eccedenza × qty inclusa diventa extra.</span> : <span>SENZA PACCHETTO: il prezzo personalizzato vale per tutte le quantità (no extras).</span>}
          </div>
          {editable.length === 0 && <div className="text-xs text-zinc-400 mono">Nessuna voce modificabile configurata. Imposta `modificabile_dal_venditore=true` nelle voci dal Backoffice.</div>}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {editable.map((v) => {
              const cur = overrides[v.id];
              const standardPrice = v.prezzo_rivendita || v.unit_price || 0;
              const pkgMax = pkgPriceMap[v.id]; // null se voce NON nel pacchetto
              const ref = pkgRef && pkgMax ? pkgMax : standardPrice;
              const isInPkg = !!(pkgRef && pkgMax);
              return (
                <div key={v.id} className="bg-zinc-50 border border-zinc-200 p-2 rounded text-xs">
                  <div className="font-medium text-zinc-800">{v.name}</div>
                  <div className="text-[10px] text-zinc-500 mono">
                    {isInPkg ? <>Prezzo MAX pacchetto: <b className="text-amber-700">{fmtEuro(pkgMax)}</b> · standard: {fmtEuro(standardPrice)}</> : <>Riferimento: {fmtEuro(standardPrice)}</>} / {v.unit}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Input type="number" step="0.01" placeholder={String(ref)} value={cur != null ? cur : ""}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value);
                        if (isNaN(n) || n <= 0) removeOverride(v.id);
                        else setOverride(v.id, n);
                      }}
                      className="rounded-sm h-8 mono w-24"
                      data-testid={`price-override-${v.id}`} />
                    <span className="text-[10px] text-zinc-400 mono">€/{v.unit}</span>
                    {cur != null && isInPkg && cur > pkgMax && (
                      <span className="text-[10px] text-amber-600 mono">+{fmtEuro(cur - pkgMax)} eccedenza → extra</span>
                    )}
                    {cur != null && isInPkg && cur <= pkgMax && (
                      <span className="text-[10px] text-emerald-600 mono">✓ entro soglia</span>
                    )}
                    {cur != null && (
                      <button onClick={() => removeOverride(v.id)} className="text-[10px] text-rose-600 hover:underline ml-auto">reset</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
        <Separator className="my-6" />
        <div className="text-xs text-zinc-500 mono leading-relaxed">Seleziona un elemento sulla planimetria per modificarne le proprietà.</div>
      </div>
    );
  }
  const kind = selected.kind;
  const obj = (project[kind] || []).find((x) => x.id === selected.id);
  if (!obj) return <div className="text-sm text-zinc-500">Elemento non trovato</div>;
  const updateObj = (patch) => setProject((p) => ({ ...p, [kind]: (p[kind] || []).map((x) => x.id === selected.id ? { ...x, ...patch } : x) }));
  const isFattoElement = (obj.phase || "fatto") === "fatto";
  const isProgettoMode = editMode === "progetto";
  const lockedFatto = isFattoElement && isProgettoMode;

  if (kind === "rooms") {
    const prog = obj.progetto || {};
    const updateProgetto = (patch) => updateObj({ progetto: { ...prog, ...patch } });
    const applyMaterialAllRooms = (field, value) => {
      if (!value) { toast.error("Seleziona prima un materiale"); return; }
      const target = isProgettoMode ? "progetto" : "base";
      setProject((p) => ({
        ...p,
        rooms: (p.rooms || []).map((r) => {
          if (target === "progetto") return { ...r, progetto: { ...(r.progetto || {}), [field]: value } };
          return { ...r, [field]: value };
        }),
      }));
      toast.success(`"${field}" applicato a tutte le ${(project.rooms || []).length} stanze`);
    };
    return (
      <div className="space-y-4">
        <div className="label-kicker">Stanza{isFattoElement ? " (Stato di Fatto)" : " (Progetto)"}</div>
        {lockedFatto && (
          <div className="bg-amber-50 border border-amber-300 p-2 text-xs text-amber-900">
            🔒 Elemento dello Stato di Fatto. In modalità Progetto le proprietà sono read-only — usa le <b>Modifiche di progetto</b> qui sotto per definire le nuove finiture, oppure torna in modalità "Stato di Fatto" per modificarlo.
          </div>
        )}
        {/* INFO BOX: spiegazione UNIFICATA pavimento/preventivo */}
        {(() => {
          const tilingsForRoom = (project.tiling || []).filter((t) => t.roomId === obj.id);
          const tilingActive = (project.tiling || []).length > 0;
          return (
            <div className="bg-blue-50 border border-blue-300 p-2 text-[11px] text-blue-900 leading-tight" data-testid="room-tiling-banner">
              <b>📐 Pavimento → preventivo:</b><br/>
              {tilingActive ? (
                <>Stai usando il tool <b>"Schema piastrelle"</b> (è la fonte UFFICIALE per il pavimento). {tilingsForRoom.length ? <>In questa stanza è applicata: <b>{tilingsForRoom[0].voceName}</b>.</> : <>Questa stanza <b>NON</b> ha piastrelle: aggiungile dal tool 🟦 Schema piastrelle.</>}</>
              ) : (
                <>Le scelte qui sotto (pavimento esistente / nuovo) sono <b>solo visive</b>. Per far entrare il pavimento nel preventivo usa il tool <b>🟦 "Schema piastrelle"</b> dalla toolbar.</>
              )}
            </div>
          );
        })()}
        <div><Label className="text-xs uppercase tracking-widest text-zinc-500">Nome</Label><Input value={obj.name} onChange={(e) => updateObj({ name: e.target.value })} disabled={lockedFatto} className="rounded-sm h-9 mt-1.5" data-testid="room-name-input" /></div>
        <fieldset disabled={lockedFatto} className={lockedFatto ? "opacity-60 pointer-events-none" : ""}>
          <MaterialPickerWithApplyAll label="Pavimento (esistente)" category="floor" catalog={catalog} value={obj.floorMaterial} onChange={(v) => updateObj({ floorMaterial: v })} testid="room-floor-select" applyAll={() => applyMaterialAllRooms("floorMaterial", obj.floorMaterial)} />
          <ColorOverridePicker label="Colore piastrelle pavimento" value={obj.floorTileColor} onChange={(v) => updateObj({ floorTileColor: v })} testid="room-floor-color" />
          <div className="h-3"></div>
          <MaterialPickerWithApplyAll label="Pareti (esistente)" category="wall" catalog={catalog} value={obj.wallMaterial} onChange={(v) => updateObj({ wallMaterial: v })} testid="room-wall-select" applyAll={() => applyMaterialAllRooms("wallMaterial", obj.wallMaterial)} />
          <ColorOverridePicker label="Colore piastrelle/decorazione pareti" value={obj.wallTileColor} onChange={(v) => updateObj({ wallTileColor: v })} testid="room-wall-color" />
          <div className="h-3"></div>
          <MaterialPickerWithApplyAll label="Soffitto (esistente)" category="ceiling" catalog={catalog} value={obj.ceilingMaterial} onChange={(v) => updateObj({ ceilingMaterial: v })} testid="room-ceiling-select" applyAll={() => applyMaterialAllRooms("ceilingMaterial", obj.ceilingMaterial)} />
          <ColorOverridePicker label="Colore soffitto" value={obj.ceilingPaintColor} onChange={(v) => updateObj({ ceilingPaintColor: v })} testid="room-ceiling-color" />
          {/* SWITCH STANZA — con tooltip esplicativi */}
          <div className="mt-3 bg-zinc-50 border border-zinc-200 p-2 space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-zinc-700 font-bold">Lavorazioni della stanza (entrano nel preventivo)</div>
            <div className="flex items-start justify-between gap-2" title="Se ATTIVO: rifacimento completo dell'impianto elettrico al m² su tutta la stanza (cavi, scatole, certificazione). Aggiungi prese/interruttori/luci dal tool ⚡ ELETTRICO della toolbar per simboli specifici.">
              <div className="flex-1">
                <Label className="text-xs font-semibold text-zinc-800">⚡ Imp. elettrico</Label>
                <div className="text-[10px] text-zinc-500 leading-tight">Rifacimento completo cavi/scatole/certificazione al m².</div>
              </div>
              <Switch checked={!!obj.electrical} onCheckedChange={(v) => updateObj({ electrical: v })} data-testid="room-electrical-switch" />
            </div>
            <div className="flex items-start justify-between gap-2" title="Se ATTIVO: rifacimento dell'impianto idraulico al m² (tubi acqua/scarichi, collaudo) + rivestimento piastrelle pareti se non già scelto. Tipico per bagni/cucine.">
              <div className="flex-1">
                <Label className="text-xs font-semibold text-zinc-800">🚰 Imp. idraulico</Label>
                <div className="text-[10px] text-zinc-500 leading-tight">Rifacimento tubi acqua/scarichi al m². Tipico per bagni/cucine.</div>
              </div>
              <Switch checked={!!obj.plumbing} onCheckedChange={(v) => updateObj({ plumbing: v })} data-testid="room-plumbing-switch" />
            </div>
            <div className="flex items-start justify-between gap-2" title="Se ATTIVO: aggiunge controsoffitto totale in cartongesso (2 lastre + isolante) su TUTTA la superficie della stanza. Conta come m² nel preventivo. Riduce l'altezza utile di ~30cm.">
              <div className="flex-1">
                <Label className="text-xs font-semibold text-zinc-800">📐 Controsoffitto totale</Label>
                <div className="text-[10px] text-zinc-500 leading-tight">Cartongesso su tutta la stanza (uniforma altezze, nasconde impianti).</div>
              </div>
              <Switch checked={!!obj.controsoffitto} onCheckedChange={(v) => updateObj({ controsoffitto: v })} data-testid="room-controsoff-switch" />
            </div>
          </div>
        </fieldset>
        {/* MODIFICHE DI PROGETTO: visibili sempre per stanze fatto+progetto, modificabili in mode progetto */}
        {isProgettoMode && (
          <div className="bg-amber-50 border border-amber-300 p-3 space-y-3" data-testid="room-progetto-overrides">
            <div className="label-kicker text-amber-800">⚒ Modifiche di progetto</div>
            <MaterialPickerWithApplyAll label="Nuovo pavimento" category="floor" catalog={catalog} value={prog.floorMaterial || ""} onChange={(v) => updateProgetto({ floorMaterial: v })} testid="room-prog-floor" applyAll={() => applyMaterialAllRooms("floorMaterial", prog.floorMaterial)} />
            <MaterialPickerWithApplyAll label="Nuovo rivestimento pareti" category="wall" catalog={catalog} value={prog.wallMaterial || ""} onChange={(v) => updateProgetto({ wallMaterial: v })} testid="room-prog-wall" applyAll={() => applyMaterialAllRooms("wallMaterial", prog.wallMaterial)} />
            <MaterialPickerWithApplyAll label="Nuovo soffitto" category="ceiling" catalog={catalog} value={prog.ceilingMaterial || ""} onChange={(v) => updateProgetto({ ceilingMaterial: v })} testid="room-prog-ceiling" applyAll={() => applyMaterialAllRooms("ceilingMaterial", prog.ceilingMaterial)} />
            <div className="flex items-center justify-between"><Label className="text-xs uppercase tracking-widest text-amber-800">Aggiungi controsoffitto</Label><Switch checked={!!prog.controsoffitto} onCheckedChange={(v) => updateProgetto({ controsoffitto: v })} data-testid="room-prog-ctrsoff" /></div>
            <div className="flex items-center justify-between"><Label className="text-xs uppercase tracking-widest text-amber-800">Rifare imp. elettrico</Label><Switch checked={!!prog.electrical} onCheckedChange={(v) => updateProgetto({ electrical: v })} data-testid="room-prog-elec" /></div>
            <div className="flex items-center justify-between"><Label className="text-xs uppercase tracking-widest text-amber-800">Rifare imp. idraulico</Label><Switch checked={!!prog.plumbing} onCheckedChange={(v) => updateProgetto({ plumbing: v })} data-testid="room-prog-plumb" /></div>
            <div className="flex items-center justify-between"><Label className="text-xs uppercase tracking-widest text-amber-800">Pittura pareti</Label><Switch checked={prog.pittura !== false} onCheckedChange={(v) => updateProgetto({ pittura: v })} data-testid="room-prog-pittura" /></div>
            <button onClick={() => updateObj({ progetto: null })} className="text-xs text-amber-700 underline" data-testid="room-prog-clear">Rimuovi tutte le modifiche di progetto</button>
          </div>
        )}
      </div>
    );
  }
  if (kind === "walls") {
    // Override progetto: se sto in modalità Progetto e il muro è dello stato di fatto,
    // scrivo paintColor/decorazione in wall.progetto invece di mutare wall (stato di fatto).
    const useOverride = isProgettoMode && isFattoElement;
    const wallProg = obj.progetto || {};
    const effPaintColor = useOverride ? (wallProg.paintColor ?? obj.paintColor) : obj.paintColor;
    const effDecorVoceId = useOverride ? (wallProg.decorVoceId ?? obj.decorVoceId) : obj.decorVoceId;
    const effDecorVoceName = useOverride ? (wallProg.decorVoceName ?? obj.decorVoceName) : obj.decorVoceName;
    const effDecorVocePrice = useOverride ? (wallProg.decorVocePrice ?? obj.decorVocePrice) : obj.decorVocePrice;
    const setDecor = (patch) => {
      if (useOverride) updateObj({ progetto: { ...wallProg, ...patch } });
      else updateObj(patch);
    };
    return (
      <div className="space-y-4">
        <div className="label-kicker">Parete{isFattoElement ? " (Stato di Fatto)" : " (Progetto)"}</div>
        {/* BOTTONE PRINCIPALE: apri prospetto editabile di questo muro */}
        <button
          type="button"
          onClick={() => openWallProspetto && openWallProspetto(obj.id)}
          className="w-full rounded-sm py-3 px-3 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow"
          data-testid="open-wall-prospetto"
        >📐 Apri PROSPETTO di questo muro <span className="text-[10px] font-normal opacity-90">(aggiungi prese, luci, acqua…)</span></button>
        <div className="text-[10px] text-zinc-500 mono leading-tight bg-zinc-50 border border-zinc-200 p-1.5 rounded">
          Sul prospetto puoi: aggiungere punti elettrici/idraulici/HVAC cliccando dove vuoi sul muro, ruotare 180° per lavorare sull'altro lato, eliminare punti. Se ci sono impianti su entrambi i lati genererà 2 prospetti separati nelle Tavole.
        </div>
        {lockedFatto && (
          <div className="bg-amber-50 border border-amber-300 p-2 text-xs text-amber-900">
            🔒 Muro dello Stato di Fatto. In modalità Progetto puoi solo demolirlo (totale o parziale) ma non modificarne le proprietà fisiche.
          </div>
        )}
        <div className="bg-emerald-50 border border-emerald-200 p-2.5 space-y-2" data-testid="wall-length-edit">
          <Label className="text-xs uppercase tracking-widest text-emerald-800">Lunghezza muro</Label>
          {(() => {
            const lenCm = Math.hypot(obj.x2 - obj.x1, obj.y2 - obj.y1);
            const lenM = lenCm / 100;
            const orient = Math.abs(obj.x2 - obj.x1) > Math.abs(obj.y2 - obj.y1) ? "orizzontale" : "verticale";
            const setLength = (newM) => {
              const newCm = parseFloat(newM) * 100;
              if (!newCm || newCm < 10 || lenCm < 1) return;
              const ratio = newCm / lenCm;
              const newX2 = obj.x1 + (obj.x2 - obj.x1) * ratio;
              const newY2 = obj.y1 + (obj.y2 - obj.y1) * ratio;
              updateObj({ x2: newX2, y2: newY2 });
              // Trigger auto-fit del canvas dopo la modifica (dispatch event)
              setTimeout(() => window.dispatchEvent(new CustomEvent("cad:fit-all")), 80);
            };
            return (
              <>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.1"
                    defaultValue={lenM.toFixed(2)}
                    key={lenCm}
                    onBlur={(e) => setLength(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.target.blur(); } }}
                    disabled={lockedFatto}
                    className="rounded-sm h-9 mono flex-1"
                    data-testid="wall-length-input"
                  />
                  <span className="text-xs text-zinc-700 mono font-semibold">m</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 50].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setLength(v)}
                      disabled={lockedFatto}
                      className="text-[10px] px-2 py-0.5 bg-white border border-emerald-300 rounded hover:bg-emerald-100 mono"
                    >{v}m</button>
                  ))}
                </div>
                <div className="text-[10px] text-zinc-600 mono">
                  Orientamento: {orient} · Premi <kbd className="bg-white border border-zinc-300 px-1 rounded text-[9px]">Enter</kbd> per applicare
                </div>
              </>
            );
          })()}
        </div>
        <fieldset disabled={lockedFatto} className={lockedFatto ? "opacity-60 pointer-events-none" : ""}>
          <div><Label className="text-xs uppercase tracking-widest text-zinc-500">Tipo</Label>
            <Select value={obj.kind || "mattone"} onValueChange={(v) => updateObj({ kind: v })}>
              <SelectTrigger className="rounded-sm h-9 mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="esistente">Esistente (mattone)</SelectItem><SelectItem value="nuovo">Nuovo (mattone)</SelectItem><SelectItem value="cartongesso">Cartongesso</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="mt-3"><Label className="text-xs uppercase tracking-widest text-zinc-500">Spessore (cm)</Label><Input type="number" value={obj.thickness || 10} onChange={(e) => updateObj({ thickness: parseInt(e.target.value) || 10 })} className="rounded-sm h-9 mt-1.5 mono" /></div>
        </fieldset>
        <Separator />
        <div className="bg-purple-50 border border-purple-200 p-2 space-y-2" data-testid="wall-decoration-block">
          <Label className="text-xs uppercase tracking-widest text-purple-800">Decorazione · pittura/rivestimento parete</Label>
          {useOverride && (
            <div className="text-[10px] text-amber-800 bg-amber-50 border border-amber-300 p-1 rounded mono">
              ⚙️ Modalità Progetto: il colore/decorazione viene salvato SOLO come override progetto (lo Stato di Fatto resta intatto).
            </div>
          )}
          <div className="flex items-center gap-2">
            <input type="color" value={effPaintColor || "#FFFFFF"} onChange={(e) => setDecor({ paintColor: e.target.value })} className="w-10 h-9 rounded-sm border border-zinc-300 cursor-pointer" data-testid="wall-paint-color" />
            <Input value={effPaintColor || ""} placeholder="#FFFFFF" onChange={(e) => setDecor({ paintColor: e.target.value })} className="rounded-sm h-9 flex-1 mono text-xs" />
            {effPaintColor && <button onClick={() => setDecor({ paintColor: null })} className="text-[10px] text-rose-600 hover:underline">reset</button>}
          </div>
          <Label className="text-[10px] uppercase tracking-widest text-purple-800">Voce catalogo (decorazione/laminato/parquet a parete)</Label>
          <Select value={effDecorVoceId || "__none__"} onValueChange={(v) => {
            if (v === "__none__") { setDecor({ decorVoceId: null, decorVoceName: null, decorVocePrice: null }); return; }
            const voce = (voci || []).find((x) => x.id === v);
            if (!voce) return;
            setDecor({ decorVoceId: v, decorVoceName: voce.name, decorVocePrice: voce.prezzo_rivendita || voce.unit_price || 0 });
          }}>
            <SelectTrigger className="rounded-sm h-8" data-testid="wall-decor-voce-select"><SelectValue placeholder="Nessuna voce" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Nessuna voce —</SelectItem>
              {(voci || []).filter((v) => /decoraz|pittur|idropittur|laminat|parquet|rivestim|tappezz|carta da par|mosaic|gres parete|piastrell|legno parete/i.test(v.name || "")).map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.name} · {fmtEuro(v.prezzo_rivendita || v.unit_price || 0)}/{v.unit}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {effDecorVoceName && (
            <div className="text-[10px] text-emerald-700 mono">✓ {effDecorVoceName} · {fmtEuro(effDecorVocePrice || 0)}/{(voci || []).find((x) => x.id === effDecorVoceId)?.unit || "m²"}</div>
          )}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                if (!effPaintColor && !effDecorVoceId) { toast.error("Imposta prima un colore o una voce"); return; }
                setProject((p) => ({
                  ...p,
                  walls: (p.walls || []).map((w) => {
                    if (w.demolito) return w;
                    // In modalità Progetto applica override su wall.progetto, altrimenti su wall direttamente
                    if (useOverride) {
                      return { ...w, progetto: { ...(w.progetto || {}), paintColor: effPaintColor || w.progetto?.paintColor, decorVoceId: effDecorVoceId || w.progetto?.decorVoceId, decorVoceName: effDecorVoceName || w.progetto?.decorVoceName, decorVocePrice: effDecorVocePrice != null ? effDecorVocePrice : w.progetto?.decorVocePrice } };
                    }
                    return { ...w, paintColor: effPaintColor || w.paintColor, decorVoceId: effDecorVoceId || w.decorVoceId, decorVoceName: effDecorVoceName || w.decorVoceName, decorVocePrice: effDecorVocePrice != null ? effDecorVocePrice : w.decorVocePrice };
                  }),
                }));
                toast.success(`✓ Applicato a TUTTA LA CASA (${useOverride ? "override Progetto" : "Stato di Fatto"})`);
              }}
              className="rounded-sm h-8 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-semibold"
              data-testid="wall-apply-house"
            >↗ Applica a tutta la casa</button>
            <button
              type="button"
              onClick={() => setDecor({ decorVoceId: null, decorVoceName: null, decorVocePrice: null, paintColor: null })}
              className="rounded-sm h-8 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 text-[10px] font-medium"
              data-testid="wall-decor-clear"
            >Pulisci parete</button>
          </div>
          <div className="text-[10px] text-zinc-500 mono leading-tight">
            Usa "Applica a parete" cambiando solo il colore/voce qui sopra (la parete corrente è la selezionata).<br/>
            Usa "Applica a tutta la casa" per replicare colore + voce su <b>tutte le pareti</b> non demolite.
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between"><Label className="text-xs uppercase tracking-widest text-zinc-500">Demolisci tutto</Label><Switch checked={!!obj.demolito} onCheckedChange={(v) => updateObj({ demolito: v, demolito_partial: v ? null : obj.demolito_partial })} data-testid="wall-demolito-switch" /></div>
        {!obj.demolito && (
          <div className="bg-rose-50 border border-rose-200 p-2 space-y-2">
            <Label className="text-xs uppercase tracking-widest text-rose-700">Demolizione parziale</Label>
            <div className="text-[10px] text-rose-700 mono leading-relaxed bg-white border border-rose-200 p-1.5">
              ✋ Seleziona il muro e <b>trascina i pallini rossi</b> sul canvas per ridefinire visivamente la zona demolita. Oppure usa i numeri qui sotto per precisione.
            </div>
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
    // Anteprima AbacoInfisso (solo finestre): mostra la finestra come nei configuratori infissi.
    const winCategoria = obj.type === "porta-finestra" ? "portafinestra" : "finestra";
    const winApertura = obj.type === "scorrevole" ? "scorrevole" : "battente";
    const winHingeSide = obj.hinge === "right" ? "dx" : "sx";
    const winColore = obj.frameColor || "bianco";
    return (
      <div className="space-y-4">
        <div className="label-kicker">{isDoor ? "Porta" : "Finestra"}</div>
        {!isDoor && (
          <AbacoInfisso
            categoria={winCategoria}
            apertura={winApertura}
            hingeSide={winHingeSide}
            colore={winColore}
            larghezza={obj.width || 120}
            altezza={obj.height || 140}
            materiale={obj.material || "pvc"}
            vetro={obj.glass || "doppio"}
            ante={Number(obj.ante) || 1}
            tapparella={!!obj.tapparella}
            tapparella_colore={obj.tapparella_colore}
            zanzariera={!!obj.zanzariera}
            size="mini"
          />
        )}
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
        {/* Numero ante + colore telaio + accessori per finestre */}
        {!isDoor && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs uppercase tracking-widest text-zinc-500">Ante</Label>
                <Select value={String(obj.ante || 1)} onValueChange={(v) => updateObj({ ante: Number(v) })}>
                  <SelectTrigger className="rounded-sm h-9 mt-1.5" data-testid="win-ante-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 anta</SelectItem><SelectItem value="2">2 ante</SelectItem><SelectItem value="3">3 ante</SelectItem><SelectItem value="4">4 ante</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs uppercase tracking-widest text-zinc-500">Colore telaio</Label>
                <Select value={obj.frameColor || "bianco"} onValueChange={(v) => updateObj({ frameColor: v })}>
                  <SelectTrigger className="rounded-sm h-9 mt-1.5" data-testid="win-color-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bianco">Bianco</SelectItem><SelectItem value="antracite">Antracite</SelectItem><SelectItem value="grigio">Grigio</SelectItem><SelectItem value="marrone">Marrone</SelectItem><SelectItem value="noce">Noce</SelectItem><SelectItem value="rovere">Rovere</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs uppercase tracking-widest text-zinc-500">Vetro</Label>
                <Select value={obj.glass || "doppio"} onValueChange={(v) => updateObj({ glass: v })}>
                  <SelectTrigger className="rounded-sm h-9 mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="singolo">Singolo</SelectItem>
                    <SelectItem value="doppio">Doppio (4-16-4)</SelectItem>
                    <SelectItem value="triplo">Triplo</SelectItem>
                    <SelectItem value="basso-emissivo">Basso emissivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between"><Label className="text-xs">Tapparella</Label><Switch checked={!!obj.tapparella} onCheckedChange={(v) => updateObj({ tapparella: v })} data-testid="win-tapparella" /></div>
                <div className="flex items-center justify-between"><Label className="text-xs">Zanzariera</Label><Switch checked={!!obj.zanzariera} onCheckedChange={(v) => updateObj({ zanzariera: v })} data-testid="win-zanzariera" /></div>
              </div>
            </div>
          </>
        )}
        {/* PVC pellicolato: maggiorazione % per finestra */}
        {!isDoor && (obj.material || "pvc") === "pvc" && (
          <div className="bg-amber-50 border border-amber-300 p-2 space-y-1.5" data-testid="win-pellicolatura">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-widest text-amber-800">Pellicolatura PVC (+25%)</Label>
              <Switch checked={!!obj.pellicolato} onCheckedChange={(v) => updateObj({ pellicolato: v })} data-testid="win-pellicolato-switch" />
            </div>
            {obj.pellicolato && (
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-amber-800">Texture / finitura</Label>
                <Input value={obj.pellicolato_texture || ""} placeholder="Es. Quercia chiara, Antracite RAL7016" onChange={(e) => updateObj({ pellicolato_texture: e.target.value })} className="rounded-sm h-8 mt-1 text-xs" data-testid="win-pellicolato-texture" />
              </div>
            )}
            <div className="text-[10px] text-amber-700 mono">Il prezzo PVC bianco-massa viene maggiorato della % decisa dalle Voci Backoffice (default 25%).</div>
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
    const sideVal = obj.wall_side || 0;
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
        {/* Toggle "A pavimento" — utile per cucina ad isola, prese per terra in mezzo stanza */}
        <div className="bg-amber-50 border-2 border-amber-400 p-3 rounded">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-bold text-amber-900">📍 A pavimento (centro stanza)</Label>
            <Switch checked={!!obj.floor} onCheckedChange={(v) => updateObj({ floor: v })} data-testid="mep-floor-toggle" />
          </div>
          <div className="text-[11px] text-amber-800 mt-1.5 leading-tight">
            {obj.floor
              ? "✓ Punto a TERRA: non legato a un muro (es. cucina ad isola, presa centrale)"
              : "Disattivato: il punto è sulla parete. Attiva per posizionarlo in mezzo alla stanza."
            }
          </div>
        </div>
        {/* Lato muro: indica da quale lato del muro è installato l'elemento (visto da sopra) */}
        <div className="bg-violet-50 border-2 border-violet-400 p-3 space-y-2">
          <Label className="text-xs uppercase tracking-widest text-violet-900 font-bold">📍 Su quale lato del muro?</Label>
          <div className="text-[11px] text-violet-800 leading-tight">
            Se hai un muro che divide 2 stanze, scegli da quale stanza far entrare questo elemento.
            <br />L'elemento verrà spostato visivamente di ~18cm sul lato scelto.
          </div>
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => updateObj({ wall_side: -1 })}
              className={`text-[11px] mono py-2 border-2 font-semibold ${sideVal === -1 ? "bg-violet-700 text-white border-violet-700 ring-2 ring-violet-300" : "bg-white text-violet-900 border-violet-300 hover:bg-violet-100"}`}
              data-testid={`${kind}-wall-side-a`}
            >◀ Lato A</button>
            <button
              onClick={() => updateObj({ wall_side: 0 })}
              className={`text-[11px] mono py-2 border-2 font-semibold ${sideVal === 0 ? "bg-zinc-700 text-white border-zinc-700" : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100"}`}
              data-testid={`${kind}-wall-side-center`}
            >• Sul muro</button>
            <button
              onClick={() => updateObj({ wall_side: 1 })}
              className={`text-[11px] mono py-2 border-2 font-semibold ${sideVal === 1 ? "bg-violet-700 text-white border-violet-700 ring-2 ring-violet-300" : "bg-white text-violet-900 border-violet-300 hover:bg-violet-100"}`}
              data-testid={`${kind}-wall-side-b`}
            >Lato B ▶</button>
          </div>
          <div className="text-[10px] text-violet-700 mono pt-1">💡 Una freccia colorata sul canvas indica il lato. Se vedi A e ti serve B (o viceversa), basta cliccare l'altro bottone.</div>
        </div>
        {/* Punto acqua composito: scegli quali tubazioni includere (F+C+S, sotto-insiemi) */}
        {kind === "plumbing" && (obj.type === "punto-completo" || obj.type === "acqua-completo") && (
          <div className="bg-cyan-50 border border-cyan-300 p-2 space-y-1.5" data-testid="plumb-completo-flags">
            <Label className="text-xs uppercase tracking-widest text-cyan-800">Componenti del punto acqua</Label>
            <div className="flex items-center justify-between text-xs">
              <span><span className="inline-block w-3 h-3 rounded-full bg-sky-500 mr-1 align-middle"></span>F · acqua fredda</span>
              <Switch checked={obj.has_fredda !== false} onCheckedChange={(v) => updateObj({ has_fredda: v })} data-testid="plumb-flag-fredda" />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span><span className="inline-block w-3 h-3 rounded-full bg-rose-500 mr-1 align-middle"></span>C · acqua calda</span>
              <Switch checked={obj.has_calda !== false} onCheckedChange={(v) => updateObj({ has_calda: v })} data-testid="plumb-flag-calda" />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span><span className="inline-block w-3 h-3 rounded-full bg-cyan-700 mr-1 align-middle"></span>S · scarico</span>
              <Switch checked={obj.has_scarico !== false} onCheckedChange={(v) => updateObj({ has_scarico: v })} data-testid="plumb-flag-scarico" />
            </div>
            <div className="text-[10px] text-cyan-700 mono mt-1">Resta sempre 1 punto acqua (per l'incidenza € pacchetto), ma il CAD mostra solo le tubazioni effettivamente richieste.</div>
          </div>
        )}
        {/* Pellicolatura per finestre PVC: la mostra solo se kind=windows ma siamo in plumbing block, lasciato qui per compattezza... NO: rimosso */}
      </div>
    );
  }
  if (kind === "stairs") {
    return (
      <div className="space-y-3">
        <div className="label-kicker">Scala</div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-zinc-500">Tipo</Label>
          <Select value={obj.type || "muratura"} onValueChange={(v) => updateObj({ type: v })}>
            <SelectTrigger className="rounded-sm h-9 mt-1.5" data-testid="stairs-type-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="chiocciola">A chiocciola</SelectItem>
              <SelectItem value="muratura">In muratura (rampa)</SelectItem>
              <SelectItem value="legno">In legno (rampa)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-[10px] uppercase tracking-widest text-zinc-500">L (cm)</Label><Input type="number" value={obj.width || 100} onChange={(e) => updateObj({ width: parseInt(e.target.value) || 100 })} className="rounded-sm h-9 mt-1 mono" /></div>
          <div><Label className="text-[10px] uppercase tracking-widest text-zinc-500">{obj.type === "chiocciola" ? "Ø (cm)" : "P (cm)"}</Label><Input type="number" value={obj.depth || 200} onChange={(e) => updateObj({ depth: parseInt(e.target.value) || 200 })} className="rounded-sm h-9 mt-1 mono" /></div>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-zinc-500">Rotazione (°)</Label>
          <Input type="number" step="15" value={obj.rotation || 0} onChange={(e) => updateObj({ rotation: parseInt(e.target.value) || 0 })} className="rounded-sm h-9 mt-1.5 mono" />
          <div className="flex gap-1 mt-1.5">
            {[0, 90, 180, 270].map((a) => <button key={a} onClick={() => updateObj({ rotation: a })} className="flex-1 text-[10px] mono py-1 border border-zinc-300 hover:bg-zinc-50">{a}°</button>)}
          </div>
        </div>
        <Separator />
        <div className="bg-amber-50 border border-amber-200 p-2 space-y-1">
          <Label className="text-xs uppercase tracking-widest text-amber-800">Prezzo a corpo (€)</Label>
          <Input type="number" step="0.01" min="0" value={obj.priceLump || ""} onChange={(e) => { const n = parseFloat(e.target.value); updateObj({ priceLump: isNaN(n) || n <= 0 ? null : n }); }} placeholder="lascia vuoto per usare voce backoffice" className="rounded-sm h-9 mt-1 mono" data-testid="stairs-price-lump" />
          <div className="text-[10px] text-zinc-500 mono leading-relaxed">Quando impostato, sostituisce il prezzo standard ed è SEMPRE conteggiato come voce extra (anche senza pacchetto).</div>
        </div>
      </div>
    );
  }
  if (kind === "columns") {
    return (
      <div className="space-y-3">
        <div className="label-kicker">Pilastro / Colonna</div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-zinc-500">Materiale</Label>
          <Select value={obj.kind || "cemento"} onValueChange={(v) => updateObj({ kind: v })}>
            <SelectTrigger className="rounded-sm h-9 mt-1.5" data-testid="column-kind-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cemento">Cemento armato</SelectItem>
              <SelectItem value="mattone">Muratura mattone</SelectItem>
              <SelectItem value="cartongesso">Cartongesso (rivestimento)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label className="text-[10px] uppercase tracking-widest text-zinc-500">L (cm)</Label><Input type="number" min={10} value={obj.width || 30} onChange={(e) => updateObj({ width: Math.max(10, parseInt(e.target.value) || 30) })} className="rounded-sm h-9 mt-1 mono" data-testid="column-width" /></div>
          <div><Label className="text-[10px] uppercase tracking-widest text-zinc-500">P (cm)</Label><Input type="number" min={10} value={obj.depth || 30} onChange={(e) => updateObj({ depth: Math.max(10, parseInt(e.target.value) || 30) })} className="rounded-sm h-9 mt-1 mono" data-testid="column-depth" /></div>
          <div><Label className="text-[10px] uppercase tracking-widest text-zinc-500">H (cm)</Label><Input type="number" min={50} value={obj.height || 270} onChange={(e) => updateObj({ height: Math.max(50, parseInt(e.target.value) || 270) })} className="rounded-sm h-9 mt-1 mono" data-testid="column-height" /></div>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-zinc-500">Rotazione (°)</Label>
          <div className="flex gap-1 mt-1.5">
            {[0, 45, 90, 135].map((a) => <button key={a} onClick={() => updateObj({ rotation: a })} className={`flex-1 text-[10px] mono py-1 border ${(obj.rotation || 0) === a ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-300 hover:bg-zinc-50"}`}>{a}°</button>)}
          </div>
        </div>
        <div className="bg-stone-50 border border-stone-300 p-2 text-[11px] text-stone-700 leading-relaxed">
          📐 Il pilastro viene conteggiato come <strong>1 pz</strong> di "Pilastro {obj.kind || "cemento"}" nella voce backoffice (NON come muro).
        </div>
        <button onClick={() => setProject((p) => ({ ...p, columns: (p.columns || []).filter((x) => x.id !== selected.id) }))} className="text-xs text-rose-600 underline" data-testid="column-delete">Rimuovi pilastro</button>
      </div>
    );
  }
  if (kind === "demolitions") {
    if (obj.kind !== "rivestimento") {
      return (
        <div className="space-y-3">
          <div className="label-kicker">Demolizione · {obj.kind}</div>
          <div className="text-xs mono text-zinc-500">Area: {fmtNum(obj.areaM2 || 0, 2)} m²</div>
          {obj.kind === "pavimento" && (
            <div className="bg-orange-50 border border-orange-300 p-2 space-y-1.5" data-testid="demo-pavimento-massetto">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-widest text-orange-800">Includi rimozione massetto</Label>
                <Switch checked={!!obj.with_massetto} onCheckedChange={(v) => updateObj({ with_massetto: v })} data-testid="demo-with-massetto" />
              </div>
              <div className="text-[10px] text-orange-700 mono">Se attivo: il computo conta 2× area (pavimento + sottostante massetto da rimuovere).</div>
            </div>
          )}
          <button onClick={() => setProject((p) => ({ ...p, demolitions: (p.demolitions || []).filter((x) => x.id !== selected.id) }))} className="text-xs text-rose-600 underline" data-testid="demo-delete">Rimuovi demolizione</button>
        </div>
      );
    }
    const wall = (project.walls || []).find((w) => w.id === obj.wallId);
    const lenCm = wall ? Math.round(Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1)) : 0;
    const xFrom = obj.xFromCm != null ? obj.xFromCm : 0;
    const xTo = obj.xToCm != null ? obj.xToCm : lenCm;
    const hFrom = obj.hFromCm || 0;
    const hTo = obj.hToCm != null ? obj.hToCm : (obj.heightCm || 200);
    const recompute = (patch) => {
      const merged = { xFromCm: xFrom, xToCm: xTo, hFromCm: hFrom, hToCm: hTo, ...patch };
      const xfC = Math.max(0, Math.min(lenCm, merged.xFromCm));
      const xtC = Math.max(xfC, Math.min(lenCm, merged.xToCm));
      const hfC = Math.max(0, Math.min(400, merged.hFromCm));
      const htC = Math.max(hfC, Math.min(400, merged.hToCm));
      const area = ((xtC - xfC) / 100) * ((htC - hfC) / 100);
      updateObj({ xFromCm: xfC, xToCm: xtC, hFromCm: hfC, hToCm: htC, areaM2: area, heightCm: htC - hfC });
    };
    return (
      <div className="space-y-4">
        <div className="label-kicker text-orange-700">Demolizione rivestimento (zona)</div>
        <div className="bg-orange-50 border border-orange-200 p-2 text-xs text-orange-900">
          Definisci la zona di rivestimento da demolire sulla parete (es. cucina a 100cm da terra).
          Lunghezza parete: <b>{lenCm} cm</b>.
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-zinc-500">Da sx (cm)</Label>
            <Input type="number" min="0" max={lenCm} value={xFrom} onChange={(e) => recompute({ xFromCm: parseInt(e.target.value) || 0 })} className="rounded-sm h-9 mt-1 mono" data-testid="demo-riv-xfrom" />
          </div>
          <div>
            <Label className="text-[10px] text-zinc-500">A (cm da sx)</Label>
            <Input type="number" min="0" max={lenCm} value={xTo} onChange={(e) => recompute({ xToCm: parseInt(e.target.value) || 0 })} className="rounded-sm h-9 mt-1 mono" data-testid="demo-riv-xto" />
          </div>
        </div>
        <div className="text-[10px] mono text-zinc-500">Larghezza demolizione: <b>{Math.max(0, xTo - xFrom)} cm</b> · da dx: <b>{Math.max(0, lenCm - xTo)} cm</b></div>
        <Separator />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-zinc-500">H da terra (cm)</Label>
            <Input type="number" min="0" max="400" value={hFrom} onChange={(e) => recompute({ hFromCm: parseInt(e.target.value) || 0 })} className="rounded-sm h-9 mt-1 mono" data-testid="demo-riv-hfrom" />
          </div>
          <div>
            <Label className="text-[10px] text-zinc-500">Fino a (cm da terra)</Label>
            <Input type="number" min="0" max="400" value={hTo} onChange={(e) => recompute({ hToCm: parseInt(e.target.value) || 0 })} className="rounded-sm h-9 mt-1 mono" data-testid="demo-riv-hto" />
          </div>
        </div>
        <div className="text-[10px] mono text-zinc-500">Altezza demolizione: <b>{Math.max(0, hTo - hFrom)} cm</b></div>
        <Separator />
        <div className="bg-orange-100 border border-orange-300 p-2 text-xs">
          <span className="mono">Area demolita: <b>{fmtNum(((Math.max(0, xTo - xFrom)) * (Math.max(0, hTo - hFrom))) / 10000, 2)} m²</b></span>
        </div>
        <button onClick={() => setProject((p) => ({ ...p, demolitions: (p.demolitions || []).filter((x) => x.id !== selected.id) }))} className="text-xs text-rose-600 underline" data-testid="demo-riv-delete">Rimuovi demolizione</button>
      </div>
    );
  }
  return null;
}

function MaterialSelect({ label, category, catalog, value, onChange, testid }) {
  const options = (catalog || []).filter((m) => m.category === category);
  const showPrice = category !== "furniture";
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
                {o.name} {showPrice && <span className="text-zinc-400 mono text-xs">· {fmtEuro(o.price)}</span>}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MaterialPickerWithApplyAll({ label, category, catalog, value, onChange, testid, applyAll }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-xs uppercase tracking-widest text-zinc-500">{label}</Label>
        <button type="button" onClick={applyAll} disabled={!value} title="Applica questo materiale a tutte le stanze del progetto" className="text-[10px] text-emerald-700 hover:underline disabled:text-zinc-400 disabled:cursor-not-allowed mono" data-testid={`${testid}-apply-all`}>
          ↗ Tutta casa
        </button>
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="rounded-sm h-9" data-testid={testid}><SelectValue placeholder="Seleziona…" /></SelectTrigger>
        <SelectContent>
          {(catalog || []).filter((m) => m.category === category).map((o) => (
            <SelectItem key={o.id} value={o.id}>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border border-zinc-300" style={{ background: o.color }} />
                {o.name} {category !== "furniture" && <span className="text-zinc-400 mono text-xs">· {fmtEuro(o.price)}</span>}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ColorOverridePicker({ label, value, onChange, testid }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <input type="color" value={value || "#FFFFFF"} onChange={(e) => onChange(e.target.value)} className="w-9 h-8 rounded-sm border border-zinc-300 cursor-pointer flex-shrink-0" data-testid={testid} title={label} />
      <span className="text-[10px] mono text-zinc-500 flex-1 truncate">{label}: <b>{value || "default"}</b></span>
      {value && <button onClick={() => onChange(null)} className="text-[10px] text-rose-600 hover:underline">×</button>}
    </div>
  );
}

// Mappa categoria backoffice → macro-gruppo CAD (Muratura/Impianti/Serramenti/Finiture/Servizi)
const CAT_TO_GRUPPO = {
  muratura: "Muratura", demolizioni: "Muratura", scale: "Muratura", strutture: "Muratura",
  impianti: "Impianti", impianto: "Impianti", impianto_elettrico: "Impianti", elettrico: "Impianti", idraulico: "Impianti", impianto_idraulico: "Impianti", gas: "Impianti", impianto_gas: "Impianti", termo_idraulico: "Impianti", clima: "Impianti", termoidraulico: "Impianti", riscaldamento: "Impianti",
  serramenti: "Serramenti", infissi: "Serramenti", porte: "Serramenti",
  finiture: "Finiture", pavimenti: "Finiture", rivestimenti: "Finiture", decorazione: "Finiture", pittura: "Finiture", sanitari: "Finiture", controsoffitto: "Finiture",
  servizi: "Servizi", pratiche: "Servizi", oneri: "Servizi", professionali: "Servizi", direzione_lavori: "Servizi", sicurezza: "Servizi", documentazione: "Servizi",
};
function gruppoOf(voce) {
  const c = (voce.category || voce.categoria || "").toLowerCase().trim();
  if (CAT_TO_GRUPPO[c]) return CAT_TO_GRUPPO[c];
  // Match per parole chiave nel category
  if (/impiant|elettric|idraulic|gas|clima|termo|caldai|split|riscald|sanitar|cond|vmc|fotov/.test(c)) return "Impianti";
  if (/infiss|serrament|porte|finestr|tappar|zanzar/.test(c)) return "Serramenti";
  if (/pavim|rivest|piastr|parquet|decoraz|pittur|finitur|controsoff/.test(c)) return "Finiture";
  if (/serviz|pratich|oneri|sicurez|direz/.test(c)) return "Servizi";
  if (/muratur|demoliz|scale|costruz/.test(c)) return "Muratura";
  // Fallback per nome voce
  const n = (voce.name || "").toLowerCase();
  if (/cila|ape|direzione|sicurezza|pratica|oneri|notaio|capitolato|progetto/.test(n)) return "Servizi";
  if (/elettric|idraulic|caldai|split|clima|gas|riscald|punto luce|punto presa|punto acqua|punto scarico|sanitar|vmc/.test(n)) return "Impianti";
  if (/infiss|finestr|porta|tappar|zanzar|persian/.test(n)) return "Serramenti";
  return "Finiture";
}

function CatalogoVociPanel({ project, setProject, voci, selected, catalog }) {
  const [filter, setFilter] = useState("");
  const [openGruppo, setOpenGruppo] = useState("Muratura");
  const manualItems = project.manualItems || [];
  const setManualItems = (next) => setProject((p) => ({ ...p, manualItems: typeof next === "function" ? next(p.manualItems || []) : next }));

  // Determine selected target context
  const selWall = selected?.kind === "walls" ? (project.walls || []).find((x) => x.id === selected.id) : null;
  const selRoom = selected?.kind === "rooms" ? (project.rooms || []).find((x) => x.id === selected.id) : null;
  const roomHeight = project.roomHeight || 270;

  // Compute target-specific qty
  const qtyForTarget = (voce, target) => {
    const u = (voce.unit || "pz").toLowerCase();
    if (target === "wall" && selWall) {
      const len = Math.hypot(selWall.x2 - selWall.x1, selWall.y2 - selWall.y1) / 100; // m
      if (u === "ml" || u === "m") return parseFloat(len.toFixed(2));
      if (u === "m²" || u === "mq" || u === "m2") return parseFloat((len * (roomHeight / 100)).toFixed(2));
      return 1;
    }
    if (target === "room" && selRoom) {
      const areaM2 = polygonArea(selRoom.points) / 10000;
      const perimM = polygonPerimeter(selRoom.points) / 100;
      if (u === "m²" || u === "mq" || u === "m2") return parseFloat(areaM2.toFixed(2));
      if (u === "ml" || u === "m") return parseFloat(perimM.toFixed(2));
      return 1;
    }
    if (target === "all-house") {
      const totalArea = (project.rooms || []).reduce((s, r) => s + polygonArea(r.points) / 10000, 0);
      const totalPerim = (project.rooms || []).reduce((s, r) => s + polygonPerimeter(r.points) / 100, 0);
      if (u === "m²" || u === "mq" || u === "m2") return parseFloat(totalArea.toFixed(2));
      if (u === "ml" || u === "m") return parseFloat(totalPerim.toFixed(2));
      return 1;
    }
    return 1;
  };

  const addVoce = (voce, target = "free") => {
    const qty = qtyForTarget(voce, target);
    const targetLabel = target === "wall" ? `Parete (${selWall?.id?.slice(0, 4)})` :
                       target === "room" ? `Stanza ${selRoom?.name || ""}` :
                       target === "all-house" ? "Tutta casa" : "";
    const desc = targetLabel ? `Applicato a: ${targetLabel}` : "";
    const newItem = {
      id: uid(),
      voce_id: voce.id,
      name: voce.name,
      unit: voce.unit || "pz",
      qty,
      unit_price: voce.prezzo_rivendita || voce.unit_price || 0,
      category: voce.category || "",
      target_kind: target,
      target_id: target === "wall" ? selWall?.id : (target === "room" ? selRoom?.id : null),
      descrizione: desc,
    };
    setManualItems((arr) => [...arr, newItem]);
    toast.success(`+ ${voce.name}${targetLabel ? ` → ${targetLabel}` : ""} (${qty} ${voce.unit || "pz"})`);
  };
  const updateMI = (id, patch) => setManualItems((arr) => arr.map((x) => x.id === id ? { ...x, ...patch } : x));
  const removeMI = (id) => setManualItems((arr) => arr.filter((x) => x.id !== id));
  const grouped = (voci || []).reduce((acc, v) => {
    const g = gruppoOf(v);
    (acc[g] = acc[g] || []).push(v);
    return acc;
  }, {});
  const groups = ["Muratura", "Impianti", "Serramenti", "Finiture", "Servizi"];
  const filtFn = (v) => !filter || (v.name || "").toLowerCase().includes(filter.toLowerCase());

  // Wall/room helpers
  const wallLenM = selWall ? Math.hypot(selWall.x2 - selWall.x1, selWall.y2 - selWall.y1) / 100 : 0;
  const wallAreaM2 = wallLenM * (roomHeight / 100);
  const roomAreaM2 = selRoom ? polygonArea(selRoom.points) / 10000 : 0;

  return (
    <div className="space-y-3">
      <div className="label-kicker">Catalogo voci backoffice</div>

      {/* SELECTION CONTEXT BANNER */}
      {selWall && (
        <div className="bg-blue-50 border border-blue-300 p-2 rounded text-xs space-y-1" data-testid="catalog-selected-wall">
          <div className="font-semibold text-blue-900">📐 Parete selezionata</div>
          <div className="mono text-[11px] text-blue-800">
            L = <b>{fmtNum(wallLenM, 2)} m</b> · H = <b>{fmtNum(roomHeight / 100, 2)} m</b> · area = <b>{fmtNum(wallAreaM2, 2)} m²</b>
          </div>
          <div className="text-[10px] text-blue-700 leading-relaxed">Quando aggiungi una voce, scegli <b>"Applica a parete"</b>: la quantità verrà calcolata automaticamente in base a m²/ml della parete.</div>
        </div>
      )}
      {selRoom && (
        <div className="bg-emerald-50 border border-emerald-300 p-2 rounded text-xs space-y-1" data-testid="catalog-selected-room">
          <div className="font-semibold text-emerald-900">🏠 Stanza selezionata: {selRoom.name}</div>
          <div className="mono text-[11px] text-emerald-800">
            Area = <b>{fmtNum(roomAreaM2, 2)} m²</b> · perimetro = <b>{fmtNum(polygonPerimeter(selRoom.points) / 100, 2)} m</b>
          </div>
          <div className="text-[10px] text-emerald-700 leading-relaxed">Quando aggiungi una voce, scegli <b>"Applica a stanza"</b>: la quantità verrà calcolata in base all'area / perimetro.</div>
        </div>
      )}
      {!selWall && !selRoom && (
        <div className="bg-zinc-50 border border-zinc-200 p-2 rounded text-[11px] text-zinc-600 leading-relaxed">
          ℹ️ <b>Seleziona prima una parete o una stanza</b> sulla planimetria, poi aggiungi una voce dal catalogo per applicarla con la quantità giusta. Oppure clicca <b>+</b> per aggiungere come voce libera.
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 p-2 rounded text-[10px] mono text-blue-900 leading-relaxed">
        💡 <b>Tip:</b> Una volta finalizzata la progettazione, aggiungi i <b>SERVIZI</b> (pratiche edilizie, CILA, direzione lavori, sicurezza). Se hai un pacchetto, controlla se sono già inclusi nel forfait.
      </div>
      <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Cerca voce…" className="rounded-sm h-8 mono text-xs" data-testid="catalog-voci-search" />
      <div className="space-y-1">
        {groups.map((g) => {
          const list = (grouped[g] || []).filter(filtFn);
          if (list.length === 0) return null;
          const isOpen = openGruppo === g || filter.length > 0;
          return (
            <div key={g} className="border border-zinc-200 rounded-sm">
              <button onClick={() => setOpenGruppo(isOpen && openGruppo === g ? "" : g)} className="w-full px-2 py-1.5 flex items-center justify-between text-xs uppercase tracking-widest font-semibold bg-zinc-50 hover:bg-zinc-100" data-testid={`gruppo-${g}`}>
                <span>{g}</span><span className="mono text-zinc-500">{list.length}</span>
              </button>
              {isOpen && (
                <div className="max-h-72 overflow-y-auto divide-y divide-zinc-100">
                  {list.map((v) => (
                    <div key={v.id} className="px-2 py-1.5 hover:bg-zinc-50 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="flex-1 truncate font-medium">{v.name}</span>
                        <span className="text-zinc-400 mono text-[10px]">{fmtEuro(v.prezzo_rivendita || v.unit_price || 0)}/{v.unit}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <button onClick={() => addVoce(v, "free")} className="px-1.5 py-0.5 text-[10px] bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-sm" data-testid={`add-voce-${v.id}`}>+ libera</button>
                        {selWall && <button onClick={() => addVoce(v, "wall")} className="px-1.5 py-0.5 text-[10px] bg-blue-100 hover:bg-blue-200 border border-blue-400 text-blue-900 rounded-sm font-semibold" data-testid={`add-voce-wall-${v.id}`}>↗ parete ({fmtNum(qtyForTarget(v, "wall"), 2)} {v.unit})</button>}
                        {selRoom && <button onClick={() => addVoce(v, "room")} className="px-1.5 py-0.5 text-[10px] bg-emerald-100 hover:bg-emerald-200 border border-emerald-400 text-emerald-900 rounded-sm font-semibold" data-testid={`add-voce-room-${v.id}`}>↗ stanza ({fmtNum(qtyForTarget(v, "room"), 2)} {v.unit})</button>}
                        <button onClick={() => addVoce(v, "all-house")} className="px-1.5 py-0.5 text-[10px] bg-amber-100 hover:bg-amber-200 border border-amber-400 text-amber-900 rounded-sm" data-testid={`add-voce-all-${v.id}`}>↗ tutta casa</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {manualItems.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-sm space-y-2 mt-3">
          <div className="label-kicker text-emerald-800">Voci aggiunte ({manualItems.length})</div>
          {manualItems.map((mi) => (
            <div key={mi.id} className="bg-white border border-zinc-200 p-2 text-xs space-y-1">
              <div className="font-medium truncate flex items-center gap-1">
                <span className="flex-1 truncate">{mi.name}</span>
                {mi.target_kind === "wall" && <span className="px-1 bg-blue-100 text-blue-800 text-[9px] rounded-sm">parete</span>}
                {mi.target_kind === "room" && <span className="px-1 bg-emerald-100 text-emerald-800 text-[9px] rounded-sm">stanza</span>}
                {mi.target_kind === "all-house" && <span className="px-1 bg-amber-100 text-amber-800 text-[9px] rounded-sm">casa</span>}
              </div>
              <div className="flex items-center gap-1.5">
                <Input type="number" step="0.1" min="0" value={mi.qty} onChange={(e) => updateMI(mi.id, { qty: parseFloat(e.target.value) || 0 })} className="rounded-sm h-7 mono w-16" />
                <span className="text-[10px] text-zinc-500 mono">{mi.unit}</span>
                <span className="text-[10px] text-zinc-400">×</span>
                <Input type="number" step="0.01" min="0" value={mi.unit_price_override != null ? mi.unit_price_override : mi.unit_price} onChange={(e) => { const n = parseFloat(e.target.value); updateMI(mi.id, { unit_price_override: isNaN(n) ? null : n }); }} className="rounded-sm h-7 mono flex-1" />
                <span className="text-[10px] text-zinc-500 mono">€</span>
                <button onClick={() => removeMI(mi.id)} className="text-rose-600 hover:underline" data-testid={`del-mi-${mi.id}`}><Trash2 className="h-3 w-3" /></button>
              </div>
              <Input value={mi.descrizione || ""} onChange={(e) => updateMI(mi.id, { descrizione: e.target.value })} placeholder="descrizione opzionale" className="rounded-sm h-7 mono text-[10px]" />
              <div className="text-right text-[10px] mono text-zinc-700 font-semibold">{fmtEuro((mi.qty || 0) * (mi.unit_price_override != null ? mi.unit_price_override : mi.unit_price))}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CatalogPanel({ catalog, selectedMaterial, setSelectedMaterial, project, setProject, voci, selected }) {
  const [tab, setTab] = useState("voci");
  const [cat, setCat] = useState("furniture");
  const items = (catalog || []).filter((m) => m.category === cat);
  return (
    <div className="flex flex-col h-full">
      {/* Top sub-tabs: Voci backoffice / Arredi & materiali */}
      <div className="flex border-b border-zinc-200 bg-zinc-50">
        <button onClick={() => setTab("voci")} className={`flex-1 text-[11px] uppercase tracking-widest py-2 font-semibold ${tab === "voci" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`} data-testid="catalog-tab-voci">Voci Backoffice</button>
        <button onClick={() => setTab("materiali")} className={`flex-1 text-[11px] uppercase tracking-widest py-2 font-semibold ${tab === "materiali" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`} data-testid="catalog-tab-materiali">Arredi & Materiali</button>
      </div>
      {tab === "voci" && (
        <div className="p-3 overflow-auto flex-1">
          <CatalogoVociPanel project={project} setProject={setProject} voci={voci} selected={selected} catalog={catalog} />
        </div>
      )}
      {tab === "materiali" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex border-b border-zinc-200">
            {ITEM_CATEGORIES.map((c) => <button key={c.id} onClick={() => setCat(c.id)} className={`flex-1 text-[10px] uppercase tracking-widest py-2 ${cat === c.id ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50"}`} data-testid={`catalog-tab-${c.id}`}>{c.label}</button>)}
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-1">
            <div className="text-xs text-zinc-500 mono mb-2 px-1">clicca per selezionare → poi clicca sulla planimetria</div>
            {items.map((m) => (
              <button key={m.id} onClick={() => setSelectedMaterial(m.id)} className={`w-full flex items-center gap-3 p-2 border text-left ${selectedMaterial === m.id ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300"}`} data-testid={`catalog-item-${m.id}`}>
                <div className="w-10 h-10 border border-zinc-200" style={{ background: m.color }} />
                <div className="flex-1 min-w-0"><div className="text-sm truncate">{m.name}</div>{cat !== "furniture" && <div className="text-xs text-zinc-500 mono">{fmtEuro(m.price)} / {m.unit}</div>}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CostPanelV2({ estimate, packageRef, legacy, linkedPreventivo, saveAsPreventivo, excludedKeys = [], setExcludedKeys, removeElementsForKey }) {
  if (!estimate) return null;
  // Calcola scostamento vs budget preventivo approvato (se collegato)
  const budgetTotal = linkedPreventivo?.totale_iva_escl || linkedPreventivo?.total || 0;
  const overBudget = budgetTotal > 0 ? estimate.total - budgetTotal : 0;
  const overPct = budgetTotal > 0 ? (overBudget / budgetTotal) * 100 : 0;
  return (
    <div className="p-4 flex flex-col gap-5" data-testid="cost-panel">
      {linkedPreventivo && (
        <div className={`border p-3 ${overBudget > 0 ? "bg-rose-50 border-rose-300" : "bg-emerald-50 border-emerald-300"}`} data-testid="budget-status">
          <div className="label-kicker mb-1">Preventivo collegato · {linkedPreventivo.numero || linkedPreventivo.id?.slice(0, 8)}</div>
          <div className="mono text-xs flex items-center gap-2">
            <span className={linkedPreventivo.stato === "accettato" ? "px-1.5 py-0.5 bg-emerald-600 text-white" : "px-1.5 py-0.5 bg-zinc-300 text-zinc-700"}>{(linkedPreventivo.stato || "bozza").toUpperCase()}</span>
            <span>budget {fmtEuro(budgetTotal)}</span>
          </div>
          <div className="mono text-[10px] text-zinc-600 mt-1 italic">
            Il totale del preventivo <b>NON si aggiorna automaticamente</b>. Il "Preventivo live" qui sotto è solo una simulazione di cosa succederebbe se approvassi queste lavorazioni.
          </div>
          {overBudget !== 0 && (
            <div className={`mono text-xs mt-1.5 font-medium ${overBudget > 0 ? "text-rose-700" : "text-emerald-700"}`} data-testid="budget-delta">
              {overBudget > 0 ? "⚠ SFORI budget" : "✓ Sotto budget"}: {overBudget > 0 ? "+" : ""}{fmtEuro(overBudget)} ({overPct.toFixed(1)}%)
            </div>
          )}
          {overBudget > 0 && (
            <div className="mt-2 flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  if (!window.confirm(`Confermi di aggiornare il preventivo con ${fmtEuro(overBudget)} di lavorazioni EXTRA?`)) return;
                  saveAsPreventivo && saveAsPreventivo(true);
                }}
                className="rounded-sm px-2 py-1 bg-emerald-600 text-white text-[10px] font-semibold hover:bg-emerald-700"
                data-testid="confirm-extras-btn"
              >✓ Conferma extras e aggiorna preventivo</button>
              <button
                onClick={() => {
                  toast.info("Scorri il Preventivo Live qui sotto: per rimuovere le opere extra usa il cestino rosso 🗑 accanto alla voce");
                  // Scroll alla tabella
                  document.querySelector('[data-testid^="computo-row-"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="rounded-sm px-2 py-1 bg-zinc-200 text-zinc-800 text-[10px] font-medium hover:bg-zinc-300"
                data-testid="remove-extras-btn"
              >↓ Rimuovi opere che creano extras</button>
            </div>
          )}
          {linkedPreventivo.stato === "accettato" && overBudget > 0 && (
            <div className="text-[10px] text-rose-700 mt-1">⚠ Il preventivo è ACCETTATO. Sforare significa lavorazioni extra non pagate dal cliente: rinegozia o riduci.</div>
          )}
        </div>
      )}
      {packageRef && (
        <div className="border border-emerald-300 bg-emerald-50 p-3">
          <div className="label-kicker text-emerald-700 mb-1">Pacchetto attivo</div>
          <div className="font-medium" data-testid="active-package">{packageRef.name} · {packageRef.mq_inclusi} mq inclusi</div>
          {packageRef.package_base_total > 0 && (
            <div className="mono text-xs text-emerald-800 mt-1">Forfait base: {fmtEuro(packageRef.package_base_total)} ({fmtEuro(packageRef.price_per_m2 || 0)}/mq × {packageRef.mq_inclusi} mq)</div>
          )}
        </div>
      )}
      <div>
        <div className="label-kicker mb-2">Totale preventivo (live)</div>
        <div className="text-3xl font-semibold tracking-tight mono text-zinc-900" data-testid="total-cost-v2">{fmtEuro(estimate.total)}</div>
        {packageRef && (
          <div className="mono text-xs text-zinc-500 mt-2 space-y-0.5">
            <div className="flex justify-between text-emerald-700"><span>Forfait pacchetto</span><span data-testid="package-base">{fmtEuro(estimate.package_base || 0)}</span></div>
            <div className="flex justify-between"><span>Voci incluse (coperte dal forfait)</span><span data-testid="included-total" className="text-zinc-400">{fmtEuro(estimate.included_total)}</span></div>
            <div className="flex justify-between text-rose-700 font-medium"><span>Extra (non coperti)</span><span data-testid="extra-total">{fmtEuro(estimate.extra_total)}</span></div>
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
                <th className="py-1.5">Voce</th><th>Q.tà</th>{packageRef && <th>Extra</th>}<th className="text-right">€</th>
              </tr>
            </thead>
            <tbody>
              {estimate.items.map((it) => (
                <tr key={it.key} className="border-b border-zinc-100" data-testid={`computo-row-${it.key}`}>
                  <td className="py-1.5">
                    <div className="flex items-start gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (!setExcludedKeys) return;
                          setExcludedKeys([...(excludedKeys || []), it.key]);
                          toast.success(`Riga "${it.name}" nascosta dal preventivo`);
                        }}
                        className="mt-0.5 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded p-0.5"
                        title="Nascondi questa voce solo dal preventivo"
                        data-testid={`computo-delete-${it.key}`}
                      ><X size={12} /></button>
                      {removeElementsForKey && (
                        <button
                          type="button"
                          onClick={() => {
                            const ok = removeElementsForKey(it.key);
                            if (ok) {
                              toast.success(`Elementi "${it.name}" eliminati dal progetto`);
                            } else {
                              toast.error("Non rimovibile automaticamente — elimina dal canvas o escludi dal preventivo");
                            }
                          }}
                          className="mt-0.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded p-0.5"
                          title="Elimina anche gli elementi corrispondenti dal PROGETTO"
                          data-testid={`computo-remove-elements-${it.key}`}
                        ><Trash2 size={12} /></button>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="leading-tight">{it.name}</div>
                        <div className="text-[10px] text-zinc-400 mono">{it.category}</div>
                      </div>
                    </div>
                  </td>
                  <td className="mono">{fmtNum(it.qty, 2)} {it.unit}</td>
                  {packageRef && <td className="mono text-rose-700">{fmtNum(it.qty_extra, 2)}</td>}
                  <td className="mono text-right">{fmtEuro(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {(excludedKeys && excludedKeys.length > 0) && (
          <div className="mt-3 bg-amber-50 border border-amber-300 p-2 text-[11px]">
            <div className="flex items-center justify-between mb-1">
              <span className="mono uppercase tracking-widest text-amber-800 text-[9px]">{excludedKeys.length} voci rimosse</span>
              <button onClick={() => setExcludedKeys && setExcludedKeys([])} className="text-amber-800 underline text-[10px]" data-testid="restore-excluded-all">Ripristina tutte</button>
            </div>
            <ul className="space-y-0.5 max-h-24 overflow-auto">
              {excludedKeys.map((k) => (
                <li key={k} className="flex items-center justify-between gap-2">
                  <span className="mono text-amber-900 truncate">{k}</span>
                  <button onClick={() => setExcludedKeys && setExcludedKeys(excludedKeys.filter((x) => x !== k))} className="text-amber-700 hover:text-amber-900" data-testid={`restore-excluded-${k}`}><RotateCcw size={11} /></button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <Separator />
      <div className="flex gap-2">
        <Button onClick={saveAsPreventivo} className="rounded-sm w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="save-as-preventivo-button">
          <Receipt size={14} className="mr-2" /> {linkedPreventivo ? "Aggiorna Preventivo collegato" : "Salva come Preventivo"}
        </Button>
      </div>
      <Separator />
      <div>
        <div className="label-kicker mb-2 text-zinc-400">Stima legacy (catalog)</div>
        <div className="mono text-xs text-zinc-500">{legacy ? fmtEuro(legacy.total) : "-"}</div>
      </div>
    </div>
  );
}

function AIRenderModal({ aiOpen, setAiOpen, aiPrompt, setAiPrompt, aiLoading, aiResult, generateAIRender, aiStyle, setAiStyle }) {
  const STYLES = [
    { id: "isometric_dollhouse", label: "Dollhouse Isometrico", desc: "Vista 3D dall'alto stile Archsynth — fotorealistica con mobili, luci, materiali. Usa la pianta 2D come riferimento." },
    { id: "interior_room", label: "Stanza Interno", desc: "Render fotorealistico a livello occhi della stanza/ambiente. Usa la vista 3D come riferimento." },
    { id: "exterior", label: "Esterno Edificio", desc: "Render fotorealistico esterno della casa. Usa la pianta come riferimento." },
  ];
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAiOpen(false)} data-testid="ai-render-modal">
      <div className="bg-white w-full max-w-5xl max-h-[92vh] flex flex-col border border-zinc-300" onClick={(e) => e.stopPropagation()}>
        <div className="h-12 px-4 flex items-center border-b border-zinc-200">
          <Sparkles size={16} className="mr-2 text-blue-600" /><span className="font-medium" style={{ fontFamily: "Outfit" }}>Rendering AI fotorealistico</span>
          <span className="ml-3 text-[10px] mono text-zinc-400">powered by Gemini Nano Banana</span>
          <button className="ml-auto" onClick={() => setAiOpen(false)} data-testid="close-ai-render"><X size={18} /></button>
        </div>
        <div className="grid lg:grid-cols-2 flex-1 min-h-0">
          <div className="p-5 space-y-4 border-r border-zinc-200 overflow-auto">
            <div>
              <Label className="text-xs uppercase tracking-widest text-zinc-500 mb-2 block">Stile rendering</Label>
              <div className="space-y-2">
                {STYLES.map((s) => (
                  <button key={s.id} type="button" onClick={() => setAiStyle(s.id)} className={`w-full text-left p-3 border rounded-sm transition ${aiStyle === s.id ? "bg-blue-50 border-blue-500" : "bg-white border-zinc-200 hover:bg-zinc-50"}`} data-testid={`ai-style-${s.id}`}>
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5 leading-snug">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-zinc-500">Descrizione personalizzata (opzionale)</Label>
              <Textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} rows={4} className="rounded-sm mt-2" placeholder="Es: 'pavimento parquet rovere chiaro, divano grigio, cucina laccata bianca, luce calda'" data-testid="ai-prompt-input" />
              <div className="text-[10px] text-zinc-400 mono mt-1">Se vuoto, viene usato il prompt ottimale per lo stile selezionato.</div>
            </div>
            <Button onClick={generateAIRender} disabled={aiLoading} className="rounded-sm w-full h-11 bg-zinc-900 hover:bg-zinc-800" data-testid="ai-generate-button">{aiLoading ? "Generazione (30-60s)…" : <><Sparkles size={14} className="mr-2" /> Genera rendering</>}</Button>
            <div className="text-[10px] text-zinc-400 mono leading-relaxed">⏱ Tempo medio: 30-60 secondi.<br/>💡 Tip: prima della generazione ricontrolla che la pianta abbia stanze, muri e mobili.</div>
          </div>
          <div className="p-5 overflow-auto">
            <Label className="text-xs uppercase tracking-widest text-zinc-500">Risultato</Label>
            <div className="mt-2 border border-zinc-200 bg-zinc-50 aspect-video flex items-center justify-center overflow-hidden rounded-sm">
              {aiLoading ? <div className="text-zinc-500 mono text-sm animate-pulse">rendering in corso…</div> : aiResult ? <img src={aiResult} alt="AI render" className="w-full h-full object-contain bg-zinc-900" data-testid="ai-render-result" /> : <div className="text-zinc-400 mono text-xs">nessun render</div>}
            </div>
            {aiResult && <a href={aiResult} download={`render-${aiStyle}.png`} className="block mt-3"><Button variant="outline" className="rounded-sm w-full"><Download size={14} className="mr-2" /> Scarica PNG</Button></a>}
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
  { id: "elettrico", title: "Impianto Elettrico", viewMode: "progetto", layers: { walls: true, doors: true, windows: true, rooms: true, items: false, electrical: true, plumbing: false, gas: false, hvac: false, demolitions: false, tiling: false, dimensions: true, floors: false } },
  { id: "idraulico", title: "Impianto Idraulico", viewMode: "progetto", layers: { walls: true, doors: true, windows: true, rooms: true, items: false, electrical: false, plumbing: true, gas: false, hvac: false, demolitions: false, tiling: false, dimensions: true, floors: false } },
  { id: "gas", title: "Impianto Gas", viewMode: "progetto", layers: { walls: true, doors: true, windows: true, rooms: true, items: false, electrical: false, plumbing: false, gas: true, hvac: false, demolitions: false, tiling: false, dimensions: true, floors: false } },
  { id: "condizionamento", title: "Impianto Condizionamento", viewMode: "progetto", layers: { walls: true, doors: true, windows: true, rooms: true, items: false, electrical: false, plumbing: false, gas: false, hvac: true, demolitions: false, tiling: false, dimensions: true, floors: false } },
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
  // Calcola aspect ratio reale del progetto per evitare clip
  const aspectRatio = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    (project.data?.rooms || []).forEach((r) => (r.points || []).forEach((p) => {
      if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
    }));
    (project.data?.walls || []).forEach((w) => {
      [w.x1, w.x2].forEach((x) => { if (x < minX) minX = x; if (x > maxX) maxX = x; });
      [w.y1, w.y2].forEach((y) => { if (y < minY) minY = y; if (y > maxY) maxY = y; });
    });
    if (!isFinite(minX)) return "16/9";
    const w = (maxX - minX) * 1.36, h = (maxY - minY) * 1.36; // include padding del computedViewBox
    if (w < 1 || h < 1) return "16/9";
    const r = w / h;
    return Math.min(2.2, Math.max(0.7, r)); // tra 0.7 (verticale) e 2.2 (panoramico)
  }, [project.data]);

  return (
    <div className="bg-white border border-zinc-300 p-3" data-testid={`tavola-preview-${tavola.id}`}>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="font-semibold text-sm" style={{ fontFamily: "Outfit" }}>{tavola.title}</div>
        <div className="flex items-center gap-2">
          <div className="text-[10px] mono px-1.5 py-0.5 bg-zinc-900 text-white tracking-widest">SCALA 1:100</div>
          <div className="text-[10px] mono text-zinc-400">{project.name}</div>
        </div>
      </div>
      <div className="bg-zinc-50 border border-zinc-200 relative w-full" style={{ aspectRatio }}>
        <Canvas2D
          project={project.data} setProject={() => {}} tool="select"
          selected={null} setSelected={() => {}} selectedMaterial="" catalog={catalog}
          doorParams={{}} windowParams={{}}
          electricalKind="presa" plumbingKind="acqua-fredda" hvacKind="split" tilingParams={{ size: "60x60", angle: 0 }}
          layers={tavola.layers} viewMode={tavola.viewMode}
          autoFit={true}
        />
      </div>
      {/* Legenda + barra scala FUORI dal canvas per non coprire il disegno */}
      <div className="flex items-center justify-between mt-2 gap-3 flex-wrap">
        <Legenda tavolaId={tavola.id} inline />
        <div className="bg-white border border-zinc-900 px-2 py-1 flex items-center gap-1.5">
          <div className="flex h-3">
            <div className="w-6 bg-zinc-900" />
            <div className="w-6 bg-white border-y border-zinc-900" />
            <div className="w-6 bg-zinc-900" />
          </div>
          <span className="mono text-[10px] font-bold text-zinc-900">0—3 m · scala 1:100</span>
        </div>
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

function Legenda({ tavolaId, inline = false }) {
  const items = LEGENDE[tavolaId];
  if (!items) return null;
  if (inline) {
    return (
      <div className="bg-white border border-zinc-300 px-2 py-1 text-[10px] mono flex flex-wrap items-center gap-x-3 gap-y-1" data-testid={`legenda-${tavolaId}`}>
        <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">Legenda:</span>
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {it.hatch === "demo" ? (
              <div className="w-3 h-3" style={{ backgroundImage: `repeating-linear-gradient(45deg, ${it.color}, ${it.color} 1.5px, transparent 1.5px, transparent 4px)` }} />
            ) : it.hatch === "new" ? (
              <div className="w-3 h-3" style={{ backgroundImage: `repeating-linear-gradient(-45deg, ${it.color}, ${it.color} 1px, transparent 1px, transparent 3px)` }} />
            ) : it.swatch ? (
              <div className="w-3 h-3 border border-zinc-400" style={{ background: it.color }} />
            ) : it.dashed ? (
              <div className="w-4 h-0.5" style={{ background: `repeating-linear-gradient(to right, ${it.color}, ${it.color} 2px, transparent 2px, transparent 4px)` }} />
            ) : (
              <div className="w-4 h-0.5" style={{ background: it.color }} />
            )}
            <span className="text-zinc-700">{it.label}</span>
          </div>
        ))}
      </div>
    );
  }
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
