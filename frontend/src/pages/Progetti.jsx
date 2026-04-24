import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Page, PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Plus, FolderOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Progetti() {
  const [rows, setRows] = useState([]);
  const nav = useNavigate();
  const load = () => api.get("/projects").then((r) => setRows(r.data || []));
  useEffect(() => { load(); }, []);

  const create = async () => {
    const name = window.prompt("Nome progetto?", "Nuovo progetto");
    if (!name) return;
    const { data } = await api.post("/projects", { name, data: { walls: [], rooms: [], doors: [], windows: [], items: [], roomHeight: 270 } });
    nav(`/editor/${data.id}`);
  };
  const del = async (id) => { if (!window.confirm("Eliminare progetto?")) return; await api.delete(`/projects/${id}`); toast.success("Eliminato"); load(); };

  return (
    <div>
      <PageHeader title="Progetti CAD" subtitle="Planimetrie 2D/3D con rendering AI" actions={<Button onClick={create} data-testid="new-project" style={{ background: "var(--brand)", color: "white" }}><Plus className="h-4 w-4 mr-2" />Nuovo Progetto</Button>} />
      <Page>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((p) => (
            <div key={p.id} className="bg-white border border-zinc-200 rounded-lg overflow-hidden hover:shadow-md transition-all">
              <button onClick={() => nav(`/editor/${p.id}`)} className="block w-full aspect-video bg-zinc-100">
                {p.thumbnail ? <img src={p.thumbnail} alt={p.name} className="w-full h-full object-cover" /> : <FolderOpen className="h-10 w-10 text-zinc-400 m-auto mt-10" />}
              </button>
              <div className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-zinc-500">{new Date(p.updated_at).toLocaleDateString("it-IT")}</div>
                </div>
                <button onClick={() => del(p.id)} className="p-1.5 rounded hover:bg-rose-50"><Trash2 className="h-4 w-4 text-rose-600" /></button>
              </div>
            </div>
          ))}
          {!rows.length && <div className="col-span-full text-center text-zinc-500 py-12">Nessun progetto. Clicca "Nuovo Progetto".</div>}
        </div>
      </Page>
    </div>
  );
}
