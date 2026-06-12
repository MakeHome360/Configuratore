import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function AdminImpostazioni() {
  const [imp, setImp] = useState({});
  useEffect(() => { api.get("/impostazioni").then((r) => setImp(r.data || {})); }, []);
  const save = async () => { await api.put("/impostazioni", imp); toast.success("Salvato"); };

  const F = ({ label, k, unit = "" }) => (
    <div><Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input type="number" step="0.1" value={imp[k] || 0} onChange={(e) => setImp({ ...imp, [k]: Number(e.target.value) })} data-testid={`imp-${k}`} />
        {unit && <span className="text-sm text-zinc-500">{unit}</span>}
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Impostazioni" subtitle="Configura parametri di calcolo e ricarichi"
        actions={<Button onClick={save} data-testid="imp-save" style={{ background: "var(--brand)", color: "white" }}>Salva</Button>} />
      <Page>
        {/* R87: Diagnostico SMTP per debug email */}
        <SmtpDiagnostico />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-5xl">
          <DatiAzienda imp={imp} setImp={setImp} />
          <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4">
            <h3 className="font-semibold">Generale</h3>
            <F label="Margine minimo richiesto" k="margine_minimo" unit="%" />
            <F label="Costi fissi per commessa" k="costi_fissi_commessa" unit="€" />
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4">
            <h3 className="font-semibold">IVA</h3>
            <F label="IVA ristrutturazione" k="iva_ristrutturazione" unit="%" />
            <F label="IVA standard" k="iva_standard" unit="%" />
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4">
            <h3 className="font-semibold">Ricarichi</h3>
            <F label="Ricarico default voci" k="ricarico_default" unit="x" />
            <F label="Sicurezza cantiere" k="sicurezza_pct" unit="%" />
            <F label="Direzione lavori" k="direzione_lavori_pct" unit="%" />
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4 lg:col-span-2">
            <h3 className="font-semibold">Provvigioni Venditori</h3>
            <p className="text-xs text-zinc-500 -mt-2">% applicata sul totale commessa IVA inclusa. Usata sia per la dashboard del venditore sia per il calcolo dei compensi.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <F label="Venditore semplice" k="provvigione_semplice_pct" unit="% propria" />
              <F label="Responsabile P.V." k="provvigione_responsabile_pct" unit="% propria" />
              <F label="Area Manager" k="provvigione_area_manager_pct" unit="% propria" />
              <F label="Override Responsabile (su team)" k="provvigione_responsabile_override_pct" unit="%" />
              <F label="Override Area Manager (su area)" k="provvigione_area_manager_override_pct" unit="%" />
            </div>
          </div>

          {/* --- Round 76: Costi fissi globali per marginalità --- */}
          <CostiFissiGlobali imp={imp} setImp={setImp} />

          {/* --- Round 76: Documenti subappaltatore --- */}
          <DocSubappaltatore imp={imp} setImp={setImp} />

          {/* --- Round 76: Fasi cantiere + Checklist per tipo lavori --- */}
          <FasiETipoLavori imp={imp} setImp={setImp} />

          {/* --- Round 81: Preset modalità di pagamento --- */}
          <PresetPagamenti imp={imp} setImp={setImp} />

          {/* --- Round 85: Branding (logo, colore, anteprima) --- */}
          <Branding imp={imp} setImp={setImp} />

          {/* --- Round 85: Recap permessi & ruoli (read-only) --- */}
          <RuoliRecap />
        </div>
        <div className="mt-4 text-xs text-zinc-500 bg-amber-50 border border-amber-200 p-3 rounded max-w-5xl">
          <strong>Nota:</strong> Le modifiche avranno effetto solo sui nuovi preventivi. I preventivi esistenti non verranno modificati.
        </div>
      </Page>
    </div>
  );
}


// --------- Costi fissi globali ---------
function CostiFissiGlobali({ imp, setImp }) {
  const lista = imp.costi_fissi_globali || [];
  const set = (newList) => setImp({ ...imp, costi_fissi_globali: newList });
  const add = () => set([...lista, { id: `cf-${Date.now()}`, nome: "Nuovo costo", tipo: "fisso", valore: 0, attivo: true, descrizione: "" }]);
  const upd = (i, k, v) => set(lista.map((c, idx) => idx === i ? { ...c, [k]: v } : c));
  const del = (i) => set(lista.filter((_, idx) => idx !== i));
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-3 lg:col-span-2" data-testid="costi-fissi-section">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">💰 Costi fissi globali (marginalità)</h3>
          <p className="text-xs text-zinc-500">Costi che vengono SEMPRE scalati dal margine di ogni preventivo/commessa. Tipo "fisso" = € assoluto. Tipo "percentuale" = % sul valore commessa IVA escl.</p>
        </div>
        <button onClick={add} className="text-xs px-2 py-1 bg-zinc-900 text-white rounded" data-testid="cf-add">+ Aggiungi</button>
      </div>
      <div className="space-y-2">
        {lista.map((c, i) => (
          <div key={i} className={`grid grid-cols-12 gap-2 items-center p-2 rounded border ${c.attivo ? "border-zinc-200 bg-zinc-50" : "border-zinc-200 bg-zinc-50/50 opacity-60"}`} data-testid={`cf-row-${i}`}>
            <input type="checkbox" checked={c.attivo} onChange={(e) => upd(i, "attivo", e.target.checked)} className="col-span-1" title="Attivo" />
            <Input className="col-span-3 h-8 text-xs" value={c.nome} onChange={(e) => upd(i, "nome", e.target.value)} placeholder="Nome costo" />
            <select className="col-span-2 h-8 text-xs border border-zinc-300 rounded px-1" value={c.tipo} onChange={(e) => upd(i, "tipo", e.target.value)}>
              <option value="fisso">€ fisso</option>
              <option value="percentuale">% sul ricavo</option>
            </select>
            <Input type="number" step="0.01" className="col-span-2 h-8 text-xs text-right mono" value={c.valore} onChange={(e) => upd(i, "valore", Number(e.target.value))} />
            <Input className="col-span-3 h-8 text-xs" value={c.descrizione || ""} onChange={(e) => upd(i, "descrizione", e.target.value)} placeholder="Descrizione" />
            <button onClick={() => del(i)} className="col-span-1 text-rose-600 text-xs hover:bg-rose-50 rounded p-1" data-testid={`cf-del-${i}`}>✕</button>
          </div>
        ))}
        {!lista.length && <div className="text-xs text-zinc-400 italic text-center py-3">Nessun costo fisso. Click + Aggiungi</div>}
      </div>
    </div>
  );
}

// --------- Documenti subappaltatore configurabili ---------
function DocSubappaltatore({ imp, setImp }) {
  const lista = imp.documenti_subappaltatore || [];
  const set = (newList) => setImp({ ...imp, documenti_subappaltatore: newList });
  const add = () => set([...lista, { tipo: `doc${Date.now()}`, label: "Nuovo documento", obbligatorio: false, scadenza_alert_gg: 30, descrizione: "" }]);
  const upd = (i, k, v) => set(lista.map((d, idx) => idx === i ? { ...d, [k]: v } : d));
  const del = (i) => set(lista.filter((_, idx) => idx !== i));
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-3 lg:col-span-2" data-testid="docsub-section">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">📑 Documenti Subappaltatori</h3>
          <p className="text-xs text-zinc-500">Quali documenti vengono richiesti ai subappaltatori e quali sono <strong>obbligatori</strong> vs opzionali. Il flag "Alert giorni" è quanti gg prima della scadenza segnalare in rosso.</p>
        </div>
        <button onClick={add} className="text-xs px-2 py-1 bg-zinc-900 text-white rounded" data-testid="docsub-add">+ Aggiungi</button>
      </div>
      <div className="space-y-2">
        {lista.map((d, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center p-2 rounded border border-zinc-200 bg-zinc-50" data-testid={`docsub-row-${i}`}>
            <Input className="col-span-2 h-8 text-xs mono" value={d.tipo} onChange={(e) => upd(i, "tipo", e.target.value.replace(/\s/g, "_").toLowerCase())} placeholder="codice" />
            <Input className="col-span-3 h-8 text-xs" value={d.label} onChange={(e) => upd(i, "label", e.target.value)} placeholder="Label visibile" />
            <Input className="col-span-3 h-8 text-xs" value={d.descrizione || ""} onChange={(e) => upd(i, "descrizione", e.target.value)} placeholder="Descrizione" />
            <label className="col-span-2 flex items-center gap-1 text-xs cursor-pointer">
              <input type="checkbox" checked={!!d.obbligatorio} onChange={(e) => upd(i, "obbligatorio", e.target.checked)} data-testid={`docsub-obbl-${i}`} />
              <span>{d.obbligatorio ? "Obbligatorio" : "Opzionale"}</span>
            </label>
            <Input type="number" className="col-span-1 h-8 text-xs text-right mono" value={d.scadenza_alert_gg || 30} onChange={(e) => upd(i, "scadenza_alert_gg", Number(e.target.value))} title="Giorni prima scadenza per alert" />
            <button onClick={() => del(i)} className="col-span-1 text-rose-600 text-xs hover:bg-rose-50 rounded p-1" data-testid={`docsub-del-${i}`}>✕</button>
          </div>
        ))}
        {!lista.length && <div className="text-xs text-zinc-400 italic text-center py-3">Nessun documento configurato</div>}
      </div>
    </div>
  );
}

// --------- Fasi cantiere + Checklist per tipo lavori ---------
const TIPI_LAVORI_OPTS = [
  { k: "ristrutturazione_completa", label: "Ristrutturazione completa" },
  { k: "parziale", label: "Ristrutturazione parziale" },
  { k: "manutenzione", label: "Manutenzione" },
  { k: "infissi_only", label: "Solo infissi" },
];

function FasiETipoLavori({ imp, setImp }) {
  const [tipoLavoro, setTipoLavoro] = useState("ristrutturazione_completa");
  const fasi = (imp.fasi_per_tipo_lavori || {})[tipoLavoro] || [];
  const checks = (imp.checklist_per_tipo_lavori || {})[tipoLavoro] || [];
  const setFasi = (newFasi) => setImp({ ...imp, fasi_per_tipo_lavori: { ...(imp.fasi_per_tipo_lavori || {}), [tipoLavoro]: newFasi } });
  const setChecks = (newChecks) => setImp({ ...imp, checklist_per_tipo_lavori: { ...(imp.checklist_per_tipo_lavori || {}), [tipoLavoro]: newChecks } });
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4 lg:col-span-2" data-testid="fasi-section">
      <div>
        <h3 className="font-semibold">🏗 Fasi Cantiere & Checklist Venditore per tipo di lavori</h3>
        <p className="text-xs text-zinc-500">Per ogni tipo di intervento decidi quali fasi cantiere sono <strong>obbligatorie</strong> e quali opzionali. Idem per la checklist venditore.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {TIPI_LAVORI_OPTS.map(t => (
          <button key={t.k} onClick={() => setTipoLavoro(t.k)} className={`px-3 py-1.5 rounded text-xs font-semibold border ${tipoLavoro === t.k ? "bg-blue-600 text-white border-blue-600" : "bg-white text-blue-700 border-blue-300 hover:bg-blue-100"}`} data-testid={`fasi-tipo-${t.k}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ListaConfig titolo="🏗 Fasi cantiere" items={fasi} setItems={setFasi} testidPrefix="fasi" />
        <ListaConfig titolo="✅ Checklist venditore" items={checks} setItems={setChecks} testidPrefix="check" />
      </div>
    </div>
  );
}

function ListaConfig({ titolo, items, setItems, testidPrefix }) {
  const add = () => setItems([...items, { key: `${testidPrefix}_${Date.now()}`, label: "Nuova voce", obbligatoria: false }]);
  const upd = (i, k, v) => setItems(items.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const del = (i) => setItems(items.filter((_, idx) => idx !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };
  return (
    <div className="border border-zinc-200 rounded p-3 space-y-2 bg-zinc-50/40">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-sm">{titolo}</div>
        <button onClick={add} className="text-[10px] px-2 py-0.5 bg-zinc-900 text-white rounded" data-testid={`${testidPrefix}-add`}>+ Aggiungi</button>
      </div>
      <div className="text-[9px] text-zinc-500 italic">Usa ▲ ▼ per cambiare l'ordine.</div>
      <div className="space-y-1">
        {items.map((it, i) => (
          <div key={it.key || i} className="grid grid-cols-12 gap-1 items-center text-xs" data-testid={`${testidPrefix}-row-${i}`}>
            <div className="col-span-1 flex flex-col items-center text-zinc-500 leading-none">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed h-3" data-testid={`${testidPrefix}-up-${i}`} title="Sposta su">▲</button>
              <button onClick={() => move(i, +1)} disabled={i === items.length - 1} className="hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed h-3" data-testid={`${testidPrefix}-down-${i}`} title="Sposta giù">▼</button>
            </div>
            <span className="col-span-1 text-[10px] text-zinc-400 mono text-center">{i + 1}.</span>
            <Input className="col-span-5 h-7 text-xs" value={it.label} onChange={(e) => upd(i, "label", e.target.value)} />
            <label className="col-span-4 flex items-center gap-1 cursor-pointer text-[10px]">
              <input type="checkbox" checked={!!it.obbligatoria} onChange={(e) => upd(i, "obbligatoria", e.target.checked)} />
              <span>{it.obbligatoria ? "Obbligatoria" : "Opzionale"}</span>
            </label>
            <button onClick={() => del(i)} className="col-span-1 text-rose-600" data-testid={`${testidPrefix}-del-${i}`}>✕</button>
          </div>
        ))}
        {!items.length && <div className="text-[10px] text-zinc-400 italic text-center py-2">Nessuna voce</div>}
      </div>
    </div>
  );
}



// --------- Dati Azienda (Ragione sociale, P.IVA, Sedi) ---------
function DatiAzienda({ imp, setImp }) {
  const sedi = imp.sedi_operative || [];
  const setSedi = (next) => setImp({ ...imp, sedi_operative: next });
  const addSede = () => setSedi([...sedi, { id: `sede-${Date.now()}`, nome: "Nuova sede", indirizzo: "", citta: "", cap: "", provincia: "", telefono: "", email: "", referente: "" }]);
  const updSede = (i, k, v) => setSedi(sedi.map((s, idx) => idx === i ? { ...s, [k]: v } : s));
  const delSede = (i) => setSedi(sedi.filter((_, idx) => idx !== i));
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4 lg:col-span-2" data-testid="dati-azienda-section">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">🏢 Dati Azienda</h3>
        <span className="text-[10px] text-zinc-500 italic">Usati in PDF preventivi, contratti, fatture</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Ragione Sociale *</Label>
          <Input value={imp.ragione_sociale || ""} onChange={(e) => setImp({ ...imp, ragione_sociale: e.target.value })} placeholder="es. RELA SRLS" data-testid="imp-ragione-sociale" />
        </div>
        <div>
          <Label className="text-xs">Marchio commerciale</Label>
          <Input value={imp.marchio_commerciale || ""} onChange={(e) => setImp({ ...imp, marchio_commerciale: e.target.value })} placeholder="es. Sa di casa" data-testid="imp-marchio" />
        </div>
        <div>
          <Label className="text-xs">Partita IVA</Label>
          <Input value={imp.partita_iva || ""} onChange={(e) => setImp({ ...imp, partita_iva: e.target.value })} placeholder="01234567890" data-testid="imp-piva" />
        </div>
        <div>
          <Label className="text-xs">Codice Fiscale</Label>
          <Input value={imp.codice_fiscale || ""} onChange={(e) => setImp({ ...imp, codice_fiscale: e.target.value })} placeholder="RBNRSS80A01H501Z" data-testid="imp-cf" />
        </div>
        <div>
          <Label className="text-xs">REA / N° iscrizione CCIAA</Label>
          <Input value={imp.rea || ""} onChange={(e) => setImp({ ...imp, rea: e.target.value })} placeholder="MI-1234567" data-testid="imp-rea" />
        </div>
        <div>
          <Label className="text-xs">PEC</Label>
          <Input type="email" value={imp.pec || ""} onChange={(e) => setImp({ ...imp, pec: e.target.value })} placeholder="azienda@pec.it" data-testid="imp-pec" />
        </div>
      </div>
      {/* Sede legale */}
      <div className="border-t pt-3">
        <Label className="text-xs font-semibold">📍 Sede Legale</Label>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2">
          <Input placeholder="Indirizzo (via, civico)" value={imp.sede_legale_indirizzo || ""} onChange={(e) => setImp({ ...imp, sede_legale_indirizzo: e.target.value })} className="md:col-span-2" data-testid="imp-sl-indirizzo" />
          <Input placeholder="Città" value={imp.sede_legale_citta || ""} onChange={(e) => setImp({ ...imp, sede_legale_citta: e.target.value })} data-testid="imp-sl-citta" />
          <Input placeholder="CAP" value={imp.sede_legale_cap || ""} onChange={(e) => setImp({ ...imp, sede_legale_cap: e.target.value })} data-testid="imp-sl-cap" />
          <Input placeholder="Provincia (sigla)" value={imp.sede_legale_provincia || ""} onChange={(e) => setImp({ ...imp, sede_legale_provincia: e.target.value })} data-testid="imp-sl-prov" />
          <Input placeholder="Telefono" value={imp.telefono_principale || ""} onChange={(e) => setImp({ ...imp, telefono_principale: e.target.value })} data-testid="imp-sl-tel" />
          <Input placeholder="Email" value={imp.email_principale || ""} onChange={(e) => setImp({ ...imp, email_principale: e.target.value })} className="md:col-span-2" data-testid="imp-sl-email" />
        </div>
      </div>
      {/* Sedi operative multiple */}
      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-semibold">🏬 Sedi operative aggiuntive ({sedi.length})</Label>
          <button onClick={addSede} className="text-[10px] px-2 py-0.5 bg-zinc-900 text-white rounded" data-testid="imp-sede-add">+ Aggiungi sede</button>
        </div>
        {!sedi.length && <p className="text-[10px] text-zinc-400 italic">Nessuna sede aggiuntiva. Aggiungi se hai showroom, depositi o filiali.</p>}
        <div className="space-y-2">
          {sedi.map((s, i) => (
            <div key={s.id || i} className="bg-zinc-50 border border-zinc-200 rounded p-2 grid grid-cols-12 gap-1.5" data-testid={`imp-sede-row-${i}`}>
              <Input className="col-span-3 h-7 text-xs" placeholder="Nome sede (es. Showroom Milano)" value={s.nome} onChange={(e) => updSede(i, "nome", e.target.value)} />
              <Input className="col-span-3 h-7 text-xs" placeholder="Indirizzo" value={s.indirizzo} onChange={(e) => updSede(i, "indirizzo", e.target.value)} />
              <Input className="col-span-2 h-7 text-xs" placeholder="Città" value={s.citta} onChange={(e) => updSede(i, "citta", e.target.value)} />
              <Input className="col-span-1 h-7 text-xs" placeholder="CAP" value={s.cap} onChange={(e) => updSede(i, "cap", e.target.value)} />
              <Input className="col-span-1 h-7 text-xs" placeholder="PR" value={s.provincia} onChange={(e) => updSede(i, "provincia", e.target.value)} />
              <Input className="col-span-1 h-7 text-xs" placeholder="Tel" value={s.telefono} onChange={(e) => updSede(i, "telefono", e.target.value)} />
              <button className="col-span-1 text-rose-600 text-xs" onClick={() => delSede(i)} data-testid={`imp-sede-del-${i}`}>✕ Elimina</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// --------- Preset Modalità di Pagamento ---------
function PresetPagamenti({ imp, setImp }) {
  const presets = imp.preset_modalita_pagamento || [];
  const setPresets = (next) => setImp({ ...imp, preset_modalita_pagamento: next });
  const addPreset = () => setPresets([...presets, { id: `pmt-${Date.now()}`, nome: "Nuovo preset", descrizione: "", rate: [{ etichetta: "Acconto", pct: 30, scadenza_giorni: 0 }, { etichetta: "Saldo", pct: 70, scadenza_giorni: 30 }], default: false }]);
  const updPreset = (i, k, v) => setPresets(presets.map((p, idx) => idx === i ? { ...p, [k]: v } : p));
  const delPreset = (i) => setPresets(presets.filter((_, idx) => idx !== i));
  const addRata = (i) => updPreset(i, "rate", [...(presets[i].rate || []), { etichetta: `Rata ${(presets[i].rate || []).length + 1}`, pct: 0, scadenza_giorni: 0 }]);
  const updRata = (i, j, k, v) => updPreset(i, "rate", presets[i].rate.map((r, rIdx) => rIdx === j ? { ...r, [k]: v } : r));
  const delRata = (i, j) => updPreset(i, "rate", presets[i].rate.filter((_, rIdx) => rIdx !== j));

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4 lg:col-span-2" data-testid="preset-pagamenti-section">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">💳 Preset Modalità di Pagamento</h3>
        <button onClick={addPreset} className="text-[11px] px-2 py-1 bg-zinc-900 text-white rounded" data-testid="imp-preset-add">+ Nuovo preset</button>
      </div>
      <p className="text-xs text-zinc-500 -mt-2">Crea qui i preset (es. 30/40/30, 50/50, Bonus fiscali). Il venditore in fase di preventivo sceglie quello più indicato dalla tendina.</p>
      {!presets.length && <p className="text-xs text-zinc-400 italic text-center py-3">Nessun preset. Aggiungine almeno uno.</p>}
      <div className="space-y-3">
        {presets.map((p, i) => {
          const total = (p.rate || []).reduce((s, r) => s + (parseFloat(r.pct) || 0), 0);
          const valid = Math.abs(total - 100) < 0.01;
          return (
            <div key={p.id || i} className="border border-zinc-200 rounded p-3 bg-zinc-50/30 space-y-2" data-testid={`imp-preset-${i}`}>
              <div className="flex items-center gap-2">
                <Input className="flex-1 h-8 text-sm font-semibold" placeholder="Nome preset (es. 30/40/30)" value={p.nome} onChange={(e) => updPreset(i, "nome", e.target.value)} data-testid={`imp-preset-nome-${i}`} />
                <label className="flex items-center gap-1 text-[10px] text-zinc-600 cursor-pointer">
                  <input type="checkbox" checked={!!p.default} onChange={(e) => setPresets(presets.map((x, idx) => ({ ...x, default: idx === i ? e.target.checked : false })))} />
                  <span>Default</span>
                </label>
                <button onClick={() => delPreset(i)} className="text-rose-600 text-sm px-2" data-testid={`imp-preset-del-${i}`}>✕</button>
              </div>
              <Input className="h-7 text-[11px]" placeholder="Descrizione (visibile al venditore: quando usarlo)" value={p.descrizione || ""} onChange={(e) => updPreset(i, "descrizione", e.target.value)} />
              <div className="space-y-1">
                <div className="grid grid-cols-12 gap-1 text-[9px] uppercase tracking-widest text-zinc-500 px-1">
                  <span className="col-span-5">Etichetta rata</span>
                  <span className="col-span-2 text-right">%</span>
                  <span className="col-span-4 text-right">Scadenza (gg)</span>
                  <span className="col-span-1"></span>
                </div>
                {(p.rate || []).map((r, j) => (
                  <div key={j} className="grid grid-cols-12 gap-1 items-center">
                    <Input className="col-span-5 h-7 text-xs" placeholder="Es. Acconto" value={r.etichetta} onChange={(e) => updRata(i, j, "etichetta", e.target.value)} />
                    <Input className="col-span-2 h-7 text-xs text-right mono" type="number" step="0.5" value={r.pct} onChange={(e) => updRata(i, j, "pct", parseFloat(e.target.value) || 0)} />
                    <Input className="col-span-4 h-7 text-xs text-right mono" type="number" placeholder="0 = subito" value={r.scadenza_giorni} onChange={(e) => updRata(i, j, "scadenza_giorni", parseInt(e.target.value) || 0)} />
                    <button onClick={() => delRata(i, j)} className="col-span-1 text-rose-600 text-xs">✕</button>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <button onClick={() => addRata(i)} className="text-[10px] text-blue-700 underline">+ Aggiungi rata</button>
                  <span className={`text-[11px] mono font-semibold ${valid ? "text-emerald-700" : "text-rose-700"}`}>
                    Totale: {total.toFixed(1)}% {valid ? "✓" : "⚠ deve fare 100%"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --------- Branding (Logo + Colore + Anteprima header) ---------
const COLORS_BRAND = [
  { k: "teal", label: "Teal", color: "#0F766E" },
  { k: "blue", label: "Blu", color: "#1D4ED8" },
  { k: "indigo", label: "Indaco", color: "#4338CA" },
  { k: "violet", label: "Viola", color: "#6D28D9" },
  { k: "amber", label: "Ambra", color: "#B45309" },
  { k: "rose", label: "Rosa", color: "#BE123C" },
  { k: "emerald", label: "Smeraldo", color: "#047857" },
  { k: "zinc", label: "Antracite", color: "#27272A" },
];

function Branding({ imp, setImp }) {
  const selected = COLORS_BRAND.find(c => c.k === imp.colore_primario) || COLORS_BRAND[0];
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 800 * 1024) { alert("Logo troppo grande (max 800 KB)."); return; }
    const reader = new FileReader();
    reader.onload = () => setImp({ ...imp, logo: reader.result });
    reader.readAsDataURL(f);
  };
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4 lg:col-span-2" data-testid="branding-section">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">🎨 Branding</h3>
        <span className="text-[10px] text-zinc-500 italic">Logo + colore vetrina utilizzati nell'header, nei PDF e nel sito vetrina</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Logo (URL o carica file PNG/JPG)</Label>
          <Input value={imp.logo || ""} onChange={(e) => setImp({ ...imp, logo: e.target.value })} placeholder="https://… oppure carica file qui sotto" data-testid="imp-logo-url" />
          <input type="file" accept="image/*" onChange={onFile} className="text-xs mt-2 block" data-testid="imp-logo-file" />
          <div className="text-[10px] text-zinc-500 mt-1">Consigliato: PNG trasparente, 200×60px, max 800 KB.</div>
          {imp.logo && <img src={imp.logo} alt="Logo" className="mt-3 h-14 border border-zinc-200 rounded p-1 bg-white" />}
        </div>
        <div>
          <Label className="text-xs">Colore primario</Label>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {COLORS_BRAND.map(c => (
              <button key={c.k} type="button" onClick={() => setImp({ ...imp, colore_primario: c.k })}
                className={`p-2 rounded border-2 flex items-center gap-1.5 text-left ${imp.colore_primario === c.k ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-400"}`}
                data-testid={`imp-color-${c.k}`}>
                <div className="h-4 w-4 rounded shrink-0" style={{ background: c.color }} />
                <span className="text-[10px]">{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t pt-3">
        <Label className="text-xs">Anteprima header</Label>
        <div className="rounded p-3 mt-2 flex items-center gap-3" style={{ background: selected.color, color: "white" }}>
          {imp.logo ? <img src={imp.logo} className="h-8 bg-white/10 rounded p-1" alt="" /> : <div className="h-8 w-8 rounded bg-white/20 flex items-center justify-center font-bold">{((imp.marchio_commerciale || imp.ragione_sociale || "C")[0] || "C").toUpperCase()}</div>}
          <span className="font-semibold text-lg">{imp.marchio_commerciale || imp.ragione_sociale || "Il tuo marchio"}</span>
          {imp.ragione_sociale && imp.marchio_commerciale && imp.marchio_commerciale !== imp.ragione_sociale && (
            <span className="text-[11px] opacity-80">— {imp.ragione_sociale}</span>
          )}
        </div>
      </div>
    </div>
  );
}


// --------- Recap Permessi & Ruoli (read-only) ---------
const RUOLI = [
  { k: "admin", nome: "Admin", color: "rose", desc: "Accesso totale. Gestisce utenti, listini, pacchetti, impostazioni, vede tutti i preventivi/commesse/marginalità." },
  { k: "responsabile", nome: "Responsabile Vendite", color: "amber", desc: "Come admin sui dati commerciali. Vede marginalità, approva sconti, gestisce venditori e commesse." },
  { k: "gestore", nome: "Gestore Cantieri", color: "blue", desc: "Project Manager: valida SAL, gestisce fasi cantiere, foto cantiere, documenti subappaltatori." },
  { k: "venditore", nome: "Venditore", color: "emerald", desc: "Crea preventivi (Pacchetto/Composite), gestisce i propri lead CRM, vede le proprie commesse e provvigioni. Non vede marginalità." },
  { k: "user", nome: "Operatore", color: "zinc", desc: "Come venditore ma senza target/provvigioni. Tipicamente uffici tecnici interni." },
  { k: "subappaltatore", nome: "Subappaltatore", color: "violet", desc: "Vede solo le proprie commesse: i propri compensi, le checklist, i documenti richiesti, può caricare foto." },
  { k: "cliente", nome: "Cliente", color: "teal", desc: "Portale Cliente: vede i propri preventivi, documenti, firme OTP, foto cantiere, pagamenti." },
];
const PERMESSI = [
  { area: "Dashboard", admin: "✅", responsabile: "✅", gestore: "✅", venditore: "✅", user: "✅", subappaltatore: "—", cliente: "—" },
  { area: "Sito vetrina / Pacchetti pubblici", admin: "Gestione", responsabile: "Lettura", gestore: "—", venditore: "Lettura", user: "Lettura", subappaltatore: "—", cliente: "—" },
  { area: "Nuovo preventivo (Pacchetto/Composite)", admin: "✅", responsabile: "✅", gestore: "—", venditore: "✅", user: "✅", subappaltatore: "—", cliente: "—" },
  { area: "Preventivi (vedere e modificare)", admin: "Tutti", responsabile: "Tutti", gestore: "—", venditore: "Solo propri", user: "Solo propri", subappaltatore: "—", cliente: "Solo propri (read)" },
  { area: "CRM Lead", admin: "✅", responsabile: "✅", gestore: "—", venditore: "Solo propri", user: "—", subappaltatore: "—", cliente: "—" },
  { area: "Progetti CAD", admin: "✅", responsabile: "✅", gestore: "Lettura", venditore: "✅", user: "✅", subappaltatore: "—", cliente: "—" },
  { area: "Gestione Cantieri (commesse)", admin: "✅", responsabile: "✅", gestore: "✅", venditore: "Lettura", user: "Lettura", subappaltatore: "Solo proprie", cliente: "—" },
  { area: "Pacchetti & Voci / Optional / Listini", admin: "✅", responsabile: "Lettura", gestore: "—", venditore: "—", user: "—", subappaltatore: "—", cliente: "—" },
  { area: "Voci Backoffice / Materiali / Template", admin: "✅", responsabile: "Lettura", gestore: "—", venditore: "—", user: "—", subappaltatore: "—", cliente: "—" },
  { area: "Marginalità & Costi diretti", admin: "✅", responsabile: "✅", gestore: "Solo SAL", venditore: "—", user: "—", subappaltatore: "—", cliente: "—" },
  { area: "Approvazione Sconti", admin: "✅", responsabile: "✅", gestore: "—", venditore: "Richiesta", user: "Richiesta", subappaltatore: "—", cliente: "—" },
  { area: "Provvigioni", admin: "Tutte", responsabile: "Tutte", gestore: "—", venditore: "Proprie", user: "—", subappaltatore: "—", cliente: "—" },
  { area: "Documenti firma OTP", admin: "✅", responsabile: "✅", gestore: "✅", venditore: "Crea", user: "—", subappaltatore: "Firma propri", cliente: "Firma propri" },
  { area: "Audit Trail", admin: "✅", responsabile: "✅", gestore: "✅", venditore: "—", user: "—", subappaltatore: "—", cliente: "—" },
  { area: "Impostazioni Azienda", admin: "✅", responsabile: "—", gestore: "—", venditore: "—", user: "—", subappaltatore: "—", cliente: "—" },
  { area: "Gestione Utenti (invita/elimina)", admin: "✅", responsabile: "—", gestore: "—", venditore: "—", user: "—", subappaltatore: "—", cliente: "—" },
];
const COLOR_BG = { rose: "bg-rose-100 text-rose-800 border-rose-200", amber: "bg-amber-100 text-amber-800 border-amber-200", blue: "bg-blue-100 text-blue-800 border-blue-200", emerald: "bg-emerald-100 text-emerald-800 border-emerald-200", zinc: "bg-zinc-100 text-zinc-700 border-zinc-200", violet: "bg-violet-100 text-violet-800 border-violet-200", teal: "bg-teal-100 text-teal-800 border-teal-200" };

function RuoliRecap() {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4 lg:col-span-2" data-testid="ruoli-section">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">👥 Ruoli &amp; Permessi</h3>
        <span className="text-[10px] text-zinc-500 italic">Recap di chi può accedere e cosa può fare. La gestione utenti è in "Venditori" / "Subappaltatori" / "Clienti".</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {RUOLI.map(r => (
          <div key={r.k} className={`border rounded p-2.5 ${COLOR_BG[r.color]}`} data-testid={`ruolo-${r.k}`}>
            <div className="font-bold text-xs uppercase tracking-wider mb-1">{r.nome}</div>
            <div className="text-[11px] leading-snug">{r.desc}</div>
          </div>
        ))}
      </div>
      <div className="border-t pt-3 overflow-x-auto">
        <Label className="text-xs">Matrice permessi</Label>
        <table className="w-full text-[11px] mt-2 border border-zinc-200">
          <thead className="bg-zinc-50">
            <tr>
              <th className="text-left px-2 py-1.5 font-semibold border-r border-zinc-200">Area / Funzione</th>
              {RUOLI.map(r => <th key={r.k} className="px-1.5 py-1.5 text-center font-semibold border-r border-zinc-200 last:border-r-0">{r.nome}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERMESSI.map((row, i) => (
              <tr key={i} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="px-2 py-1.5 font-medium border-r border-zinc-200">{row.area}</td>
                {RUOLI.map(r => {
                  const v = row[r.k] || "—";
                  return <td key={r.k} className={`px-1.5 py-1.5 text-center border-r border-zinc-200 last:border-r-0 ${v === "✅" ? "text-emerald-700 font-bold" : v === "—" ? "text-zinc-300" : "text-zinc-700"}`}>{v}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}




function SmtpDiagnostico() {
  const [to, setTo] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const run = async () => {
    if (!to.trim()) { toast.error("Inserisci email destinatario"); return; }
    setRunning(true); setResult(null);
    try {
      const { data } = await api.post("/email/diagnose", { to: to.trim() });
      setResult(data);
      if (data.ok) toast.success(`✅ Aruba ha accettato la mail in ${data.elapsed_sec}s. Controlla la casella destinatario (anche SPAM).`);
      else toast.error(`❌ ${data.error_message || data.error}`);
    } catch (e) {
      toast.error("Errore: " + (e?.response?.data?.detail || e.message));
    }
    setRunning(false);
  };
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5 mb-5 max-w-5xl">
      <h3 className="font-semibold mb-2">🔧 Test diagnostico invio email</h3>
      <p className="text-xs text-zinc-500 mb-3 leading-snug">
        Verifica se l&apos;invio email funziona. Risponde in ~2 secondi indicandoti se Aruba ha accettato la mail.
        Se &quot;OK&quot; ma il destinatario non riceve, è bloccata da filtri spam DOPO Aruba (suggerisci di controllare SPAM).
      </p>
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Label htmlFor="smtp-test-to" className="text-xs uppercase tracking-widest">Email destinatario test</Label>
          <Input id="smtp-test-to" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="tuoindirizzo@example.com" className="rounded-sm h-9 mt-1" data-testid="smtp-test-to" />
        </div>
        <Button onClick={run} disabled={running} className="bg-zinc-900 hover:bg-zinc-800 text-white h-9" data-testid="smtp-test-run">
          {running ? "Test in corso..." : "Invia mail di test"}
        </Button>
      </div>
      {result && (
        <div className={`mt-3 p-3 rounded text-xs leading-snug border ${result.ok ? "bg-emerald-50 border-emerald-300" : "bg-rose-50 border-rose-300"}`} data-testid="smtp-test-result">
          <div className="font-bold mb-1">{result.ok ? "✅ ACCETTATA da Aruba" : "❌ RIFIUTATA"}</div>
          <div>Tempo: {result.elapsed_sec}s · Host: {result.smtp_host}:{result.smtp_port} · SSL: {String(result.smtp_use_ssl)}</div>
          {result.message && <div className="mt-2 text-zinc-700">{result.message}</div>}
          {result.error_message && <div className="mt-2 text-rose-700 mono text-[10px]">{result.error_message}</div>}
          {result.diagnosis && <div className="mt-2 p-2 bg-white rounded text-zinc-800">{result.diagnosis}</div>}
        </div>
      )}
    </div>
  );
}
