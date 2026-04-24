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
- ✅ JWT httpOnly-cookie auth (register/login/logout/me/refresh) + brute-force guard + admin seed
- ✅ Projects CRUD (MongoDB, per-user scoped)
- ✅ Materials catalog: 31 default items, per-user editable, reset endpoint
- ✅ 2D SVG editor: walls, doors (with hinge arc), windows, room polygons with area labels, furniture boxes, snap-to-grid 10cm, pan/zoom, measurements, crosshair
- ✅ Real-time 3D viewer (Three.js imperative) with walls extruded with door/window holes, textured floors, light emissive materials, orbit camera
- ✅ Cost panel: live updates with per-room breakdown + items
- ✅ AI photorealistic render modal: captures 3D snapshot → Gemini Nano Banana (`gemini-3.1-flash-image-preview`)
- ✅ PDF export: header, floor plan image, rooms table, items table, totals
- ✅ Materials editor page with tabs per category and instant price editing
- ✅ Landing page (Swiss-style, Outfit/JetBrains Mono), Login, Register
- ✅ Swiss-style dashboard with project cards + empty state

## Next Action Items
- [ ] **P0**: Auto-orient 3D camera to framed initial view after first walls are drawn (currently requires user to orbit)
- [ ] **P1**: Drag-to-move items/walls in 2D (currently only place-then-edit via properties panel)
- [ ] **P1**: Thumbnail snapshot of 2D canvas on save → show on dashboard cards
- [ ] **P1**: Multi-undo / redo stack
- [ ] **P2**: Wall snap to existing wall endpoints (currently snaps to grid only)
- [ ] **P2**: Shareable read-only project link for clients
- [ ] **P2**: Labor-hours breakdown in preventivo, Iva 10/22%, discount support
- [ ] **P2**: Import DWG/DXF, export to IFC/DWG
- [ ] **P2**: Stripe monetization (free: 1 project; pro: unlimited + AI renders)

## Testing
- Backend: 15/15 pytest pass (auth, projects, materials, AI render error handling)
- Frontend: E2E verified — login → dashboard → editor → draw room → place furniture → cost updates → save → PDF export path present
- Admin: `admin@ristruttura.app` / `Admin12345!`
