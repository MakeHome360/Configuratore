# Ristruttura.CAD — Product Requirements Document

## Original Problem Statement
> "puoi costruire un programma di progettezione tipo cad che faccia anche rendering del risultato per preventivare e progettare ristrutturazioni?"
> — User (Italian) asked for a CAD-like design program that also renders the result for quoting and designing renovations.

## User Choices (from first ask_human)
- **Design**: Entrambi — 2D floor plan editor + 3D preview
- **Preventivo**: Automatic €/m² calculation + editable material catalog + PDF export
- **Rendering**: Both — real-time Three.js 3D + AI photorealistic (Gemini Nano Banana)
- **Accesso**: Multi-utente con login
- **Elementi**: Completo — pareti, porte, finestre, mobili, sanitari, elettrodomestici, luci

## Architecture
- **Backend**: FastAPI + MongoDB + bcrypt/JWT (httpOnly cookies) + emergentintegrations (Gemini Nano Banana)
- **Frontend**: React 19 + Shadcn/UI + React Three Fiber (imperative Three.js scene) + jsPDF
- **Auth**: Cookie-based JWT (access 60m, refresh 7d), brute-force protection
- **Routes**: `/`, `/login`, `/register`, `/dashboard`, `/editor/:id`, `/materials`
- **API base**: `/api/*` (proxied by ingress)

## Core Data Model
- **users**: `{id, email, name, role, password_hash, created_at}`
- **projects**: `{id, user_id, name, data, thumbnail, created_at, updated_at}`
  - `data`: `{walls[], doors[], windows[], rooms[], items[], roomHeight, currency}`
- **materials** (per user): `{id, user_id, category, name, unit, price, color}` (9 categories, 31 default items)

## Cost Engine
- Per room: `floorArea × floor.€/m² + wallArea × wall.€/m² + ceilingArea × ceiling.€/m² + (elec+plumb)`
- Per item: `qty × unitPrice`

## Implemented (Feb 2026)
- ✅ JWT httpOnly-cookie auth + **Bearer token fallback in localStorage** (iframe/Safari compatible)
- ✅ Projects CRUD (MongoDB, per-user scoped)
- ✅ Materials catalog: 31 default items, per-user editable
- ✅ **CAD Editor v2 (improved)**:
  - Labeled toolbar with descriptions + keyboard hints
  - **Stanze rapide** (Cucina/Bagno/Camera/Soggiorno) — one-click room templates with walls
  - Always-visible wall measurements
  - Double-click room to rename
  - Real-time 3D viewer (imperative Three.js)
- ✅ AI photorealistic render via Gemini Nano Banana
- ✅ Cost panel live + PDF export
- ✅ **PREVENTIVATORE PACCHETTI** (based on user's .numbers files):
  - 4 pacchetti: SOFT €380, EASY €490, PLUS €790, TOP €1180 per m²
  - 30+ lavorazioni across MURATURA/IMPIANTI/ACCESSORI/BUROCRAZIA
  - Quantità incluse auto-calcolate sui m²; extras addebitati
  - 13 optional con sconto pacchetto
  - 3 tier bagno (Silver/Gold/Platinum)
  - Wizard a 7 step: pacchetto → mq → lavorazioni → optional → bagno → cliente → riepilogo
  - Auto-numerazione PRV-YYYY-NNNN, stati (bozza/inviato/accettato/rifiutato)
  - Sconto %, IVA 10/22%, PDF professionale
- ✅ Multi-user dashboard, Swiss-style UI

## Next Action Items (backlog)
**P0 — CRM & Vendita**
- CRM Leads (stato trattativa, venditore assegnato)
- AdminVenditori + assegnazione preventivi

**P1 — Gestione Commesse** (dal preventivo accettato)
- Commesse con fasi, DettaglioCommessa
- AdminFasiCommessa (Workflow kanban)
- Subappaltatori + DashboardSubappaltatore
- CentroCosto + ComputoMetrico

**P1 — Backoffice admin**
- AdminDatiAzienda, AdminImpostazioni, AdminNegozi
- AdminPacchetti (editor per pacchetti custom), AdminOptional
- AdminVociBackoffice (prezzario parametrico)

**P2 — Preventivi specializzati**
- PreventivoBagno, PreventivoInfissi (wizard isolati)
- ConfiguratoreEsigenze (lead magnet per cliente finale)

**P2 — Report & Email**
- AdminReportBudget (P&L per commessa)
- AdminTemplateEmail + invio preventivi
- DashboardCliente (cliente finale vede i propri preventivi)

**Ulteriori miglioramenti CAD**
- Drag-to-move per spostare elementi
- Snap a endpoint pareti (oltre griglia)
- Tools aggiuntivi: scale, termosifoni, doors variants (scorrevole, doppia anta)
- Undo/redo stack

## Testing
- Backend: 15/15 pytest pass (auth, projects, materials, AI render error handling)
- Frontend: E2E verified — login → dashboard → editor → draw room → place furniture → cost updates → save → PDF export path present
- Admin: `admin@ristruttura.app` / `Admin12345!`
