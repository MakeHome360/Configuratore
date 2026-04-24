import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "../components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Plus, FolderOpen, Trash2, MoreVertical, Calendar, Ruler } from "lucide-react";
import { emptyProjectData } from "../editor/utils";

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const nav = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/projects");
      setProjects(data);
    } catch { toast.error("Errore caricamento progetti"); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!newName.trim()) return;
    try {
      const { data } = await api.post("/projects", { name: newName, data: emptyProjectData() });
      setOpen(false); setNewName("");
      nav(`/editor/${data.id}`);
    } catch { toast.error("Errore creazione"); }
  };

  const del = async (id) => {
    if (!window.confirm("Eliminare questo progetto?")) return;
    try { await api.delete(`/projects/${id}`); load(); toast.success("Eliminato"); } catch { toast.error("Errore"); }
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-10" data-testid="dashboard-page">
        <div className="flex items-end justify-between mb-10 border-b border-zinc-200 pb-6">
          <div>
            <div className="label-kicker mb-2">Workspace</div>
            <h1 className="text-4xl font-semibold tracking-tight" style={{ fontFamily: "Outfit" }}>I tuoi progetti</h1>
            <p className="text-sm text-zinc-500 mt-2 mono">{projects.length} progett{projects.length === 1 ? "o" : "i"} salvat{projects.length === 1 ? "o" : "i"}</p>
          </div>
          <Button onClick={() => setOpen(true)} className="rounded-sm bg-zinc-900 hover:bg-zinc-800 h-11" data-testid="new-project-button">
            <Plus size={16} className="mr-2" /> Nuovo progetto
          </Button>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3].map(i => <div key={i} className="h-52 border border-zinc-200 bg-zinc-50 animate-pulse" />)}
          </div>
        ) : projects.length === 0 ? (
          <div className="border border-dashed border-zinc-300 p-16 text-center" data-testid="empty-state">
            <Ruler size={32} className="mx-auto text-zinc-400 mb-4" strokeWidth={1.5} />
            <div className="text-lg font-medium mb-1" style={{ fontFamily: "Outfit" }}>Nessun progetto ancora</div>
            <div className="text-sm text-zinc-500 mb-6 mono">Crea la tua prima planimetria in 30 secondi</div>
            <Button onClick={() => setOpen(true)} className="rounded-sm bg-zinc-900 hover:bg-zinc-800">
              <Plus size={16} className="mr-2" /> Crea progetto
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="projects-grid">
            {projects.map((p) => (
              <div
                key={p.id}
                className="group border border-zinc-200 bg-white hover:-translate-y-0.5 transition-transform cursor-pointer"
                onClick={() => nav(`/editor/${p.id}`)}
                data-testid={`project-card-${p.id}`}
              >
                <div className="aspect-video bg-zinc-50 border-b border-zinc-200 relative overflow-hidden">
                  {p.thumbnail ? (
                    <img src={p.thumbnail} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full cad-grid flex items-center justify-center">
                      <FolderOpen size={32} className="text-zinc-400" strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-8 h-8 bg-white border border-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" data-testid={`project-menu-${p.id}`}>
                          <MoreVertical size={14} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-sm">
                        <DropdownMenuItem onClick={() => del(p.id)} className="text-red-600" data-testid={`delete-project-${p.id}`}>
                          <Trash2 size={14} className="mr-2" /> Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="p-4">
                  <div className="font-medium text-zinc-900 truncate" style={{ fontFamily: "Outfit" }}>{p.name}</div>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-2 mono">
                    <Calendar size={12} />
                    {new Date(p.updated_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="rounded-sm max-w-md">
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "Outfit" }}>Nuovo progetto</DialogTitle>
              <DialogDescription className="text-zinc-500">Dai un nome alla tua planimetria. Potrai modificarlo in seguito.</DialogDescription>
            </DialogHeader>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Es. Appartamento Via Dante 12"
              className="rounded-sm h-11"
              onKeyDown={(e) => e.key === "Enter" && create()}
              data-testid="new-project-name-input"
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" className="rounded-sm" onClick={() => setOpen(false)}>Annulla</Button>
              <Button className="rounded-sm bg-zinc-900 hover:bg-zinc-800" onClick={create} data-testid="new-project-confirm">Crea</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
