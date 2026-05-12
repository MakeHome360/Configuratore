import React, { useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";

const CM = 1 / 100;

function buildScene(project, catalog) {
  const root = new THREE.Group();
  const byId = Object.fromEntries((catalog || []).map((m) => [m.id, m]));
  const viewMode = project.viewMode || "progetto";
  const phaseOK = (el) => {
    const ph = el?.phase || "fatto";
    if (viewMode === "fatto") return ph === "fatto";
    return true;
  };
  const tilingByRoom = {};
  (project.tiling || []).forEach((t) => {
    if (!t.roomId) return;
    const tPhase = t.phase || "fatto";
    // In viewMode 'fatto' mostra SOLO tile dello stato di fatto. In 'progetto' mostra tile progetto (con priorità) altrimenti fatto.
    if (viewMode === "fatto") {
      if (tPhase !== "fatto") return;
    }
    const existing = tilingByRoom[t.roomId];
    // priorità: in progetto mode, tile 'progetto' vince su 'fatto'
    if (existing && viewMode === "progetto" && existing.phase === "progetto" && tPhase === "fatto") return;
    tilingByRoom[t.roomId] = {
      color: t.color || t.tileColor || null,
      voceName: t.voceName || null,
      voceId: t.voceId || null,
      phase: tPhase,
    };
  });

  // Ground & grid: dimensioni adattate alla bbox del progetto (così non "soffoca" la casa)
  let gMinX = Infinity, gMinZ = Infinity, gMaxX = -Infinity, gMaxZ = -Infinity;
  (project.walls || []).forEach((w) => {
    gMinX = Math.min(gMinX, w.x1, w.x2); gMaxX = Math.max(gMaxX, w.x1, w.x2);
    gMinZ = Math.min(gMinZ, w.y1, w.y2); gMaxZ = Math.max(gMaxZ, w.y1, w.y2);
  });
  (project.rooms || []).forEach((r) => (r.points || []).forEach((p) => {
    if (typeof p.x !== "number") return;
    gMinX = Math.min(gMinX, p.x); gMaxX = Math.max(gMaxX, p.x);
    gMinZ = Math.min(gMinZ, p.y); gMaxZ = Math.max(gMaxZ, p.y);
  }));
  let groundSize = 20; // default 20m
  let groundCenterX = 0, groundCenterZ = 0;
  if (isFinite(gMinX)) {
    const sx = (gMaxX - gMinX) * CM;
    const sz = (gMaxZ - gMinZ) * CM;
    groundSize = Math.max(sx, sz, 6) + 8; // margine 4m per lato
    groundCenterX = ((gMinX + gMaxX) / 2) * CM;
    groundCenterZ = ((gMinZ + gMaxZ) / 2) * CM;
  }
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(groundSize, groundSize),
    new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.9 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(groundCenterX, -0.002, groundCenterZ);
  ground.receiveShadow = true;
  root.add(ground);

  const gridDivs = Math.max(10, Math.round(groundSize));
  const grid = new THREE.GridHelper(groundSize, gridDivs, 0xd4d4d8, 0xe4e4e7);
  grid.position.set(groundCenterX, 0, groundCenterZ);
  root.add(grid);

  // Room floors + ceilings
  (project.rooms || []).filter(phaseOK).forEach((r) => {
    if (!r.points || r.points.length < 3) return;
    const tilingHere = tilingByRoom[r.id];
    let baseFloorColor;
    if (tilingHere && tilingHere.color) {
      // Una tile è stata posata: usa il SUO colore in qualsiasi viewMode (fatto o progetto)
      baseFloorColor = tilingHere.color;
    } else if (viewMode === "progetto" && r.progetto?.floorMaterial) {
      const pmat = byId[r.progetto.floorMaterial];
      baseFloorColor = r.progetto.floorTileColor || pmat?.color || "#E4E4E7";
    } else {
      const mat = byId[r.floorMaterial];
      baseFloorColor = r.floorTileColor || mat?.color || "#E4E4E7";
    }
    const color = new THREE.Color(baseFloorColor);
    // FIX FLOOR: usa Shape in piano XZ-like (con Y invertita per matchare il rotation +PI/2)
    // Three.js ShapeGeometry crea triangoli in piano XY. Dopo rotation.x = +PI/2:
    //   (px, py, 0) → (px, 0, py). World z = py. Quindi mappa (x_cad, y_cad) → (x*CM, 0, y*CM) ✓
    const shape = new THREE.Shape();
    r.points.forEach((p, i) => {
      const x = p.x * CM;
      const z = p.y * CM;
      if (i === 0) shape.moveTo(x, z);
      else shape.lineTo(x, z);
    });
    shape.closePath();
    const geom = new THREE.ShapeGeometry(shape);
    const mesh = new THREE.Mesh(
      geom,
      new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide })
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = 0.001;
    mesh.receiveShadow = true;
    mesh.userData = { kind: "rooms", id: r.id };
    root.add(mesh);

    if (r.controsoffitto) {
      const ceilGeom = new THREE.ShapeGeometry(shape);
      const ceilColor = new THREE.Color(r.ceilingPaintColor || "#FAFAFA");
      const ceil = new THREE.Mesh(ceilGeom, new THREE.MeshStandardMaterial({ color: ceilColor, roughness: 0.95, side: THREE.DoubleSide }));
      ceil.rotation.x = Math.PI / 2;
      ceil.position.y = (project.roomHeight || 270) * CM - 30 * CM;
      root.add(ceil);
    } else if (r.ceilingPaintColor) {
      const ceilGeom = new THREE.ShapeGeometry(shape);
      const ceil = new THREE.Mesh(ceilGeom, new THREE.MeshStandardMaterial({ color: new THREE.Color(r.ceilingPaintColor), roughness: 0.9, side: THREE.DoubleSide }));
      ceil.rotation.x = Math.PI / 2;
      ceil.position.y = (project.roomHeight || 270) * CM - 0.5;
      root.add(ceil);
    }
  });

  (project.controsoffitti || []).forEach((c) => {
    if (!c.polygon || c.polygon.length < 3) return;
    const shape = new THREE.Shape();
    c.polygon.forEach((p, i) => {
      const x = p.x * CM;
      const z = p.y * CM;
      if (i === 0) shape.moveTo(x, z);
      else shape.lineTo(x, z);
    });
    shape.closePath();
    const ceilGeom = new THREE.ShapeGeometry(shape);
    const ceil = new THREE.Mesh(ceilGeom, new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.9, side: THREE.DoubleSide }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = (project.roomHeight || 270) * CM - 30 * CM;
    root.add(ceil);
  });

  const doors = (project.doors || []).filter(phaseOK);
  const windows = (project.windows || []).filter(phaseOK);
  const height = (project.roomHeight || 270) * CM;

  (project.walls || []).filter((w) => phaseOK(w) && !w.demolito).forEach((w) => {
    const dx = w.x2 - w.x1;
    const dy = w.y2 - w.y1;
    const length = Math.hypot(dx, dy) * CM;
    if (length < 0.001) return;
    const angle = Math.atan2(dy, dx);
    const mx = ((w.x1 + w.x2) / 2) * CM;
    const mz = ((w.y1 + w.y2) / 2) * CM;
    const th = (w.thickness || 10) * CM;

    const shape = new THREE.Shape();
    shape.moveTo(-length / 2, 0);
    shape.lineTo(length / 2, 0);
    shape.lineTo(length / 2, height);
    shape.lineTo(-length / 2, height);
    shape.lineTo(-length / 2, 0);

    doors
      .filter((d) => d.wallId === w.id)
      .forEach((d) => {
        const cx = (d.t - 0.5) * length;
        const hw = (d.width * CM) / 2;
        const hh = (d.height || 210) * CM;
        const hole = new THREE.Path();
        hole.moveTo(cx - hw, 0);
        hole.lineTo(cx + hw, 0);
        hole.lineTo(cx + hw, hh);
        hole.lineTo(cx - hw, hh);
        hole.lineTo(cx - hw, 0);
        shape.holes.push(hole);
      });

    windows
      .filter((wn) => wn.wallId === w.id)
      .forEach((wn) => {
        const cx = (wn.t - 0.5) * length;
        const hw = (wn.width * CM) / 2;
        const sill = (wn.sillHeight || 90) * CM;
        const top = sill + (wn.height || 140) * CM;
        const hole = new THREE.Path();
        hole.moveTo(cx - hw, sill);
        hole.lineTo(cx + hw, sill);
        hole.lineTo(cx + hw, top);
        hole.lineTo(cx - hw, top);
        hole.lineTo(cx - hw, sill);
        shape.holes.push(hole);
      });

    const effPaintColor = (viewMode === "progetto" && w.progetto?.paintColor) ? w.progetto.paintColor : w.paintColor;
    const wallColor = effPaintColor ? new THREE.Color(effPaintColor) : new THREE.Color(0xf4f4f5);
    const geom = new THREE.ExtrudeGeometry(shape, { depth: th, bevelEnabled: false });
    const mesh = new THREE.Mesh(
      geom,
      new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.85 })
    );
    mesh.position.set(mx, 0, mz);
    mesh.rotation.y = -angle;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { kind: "walls", id: w.id };
    root.add(mesh);

    // FIX PORTE 3D: gruppo con pivot al cardine, pannello offset, rotazione corretta
    doors
      .filter((d) => d.wallId === w.id)
      .forEach((d) => {
        const cxLocal = (d.t - 0.5) * length;
        const hw = (d.width * CM) / 2;
        const hh = (d.height || 210) * CM;
        const hingeSign = d.hinge === "right" ? +1 : -1; // -1 = sinistra
        const swingSign = d.swing === "outside" ? -1 : +1; // +1 = interno

        // Group con pivot al cardine, sul piano del muro
        const hingeGroup = new THREE.Group();
        // Posiziona il cardine nel sistema mondo: parto dal centro del muro, sposto lungo X locale (lunghezza muro) di cxLocal + hingeSign*hw
        const localHingeX = cxLocal + hingeSign * hw;
        // Coordinate mondo (allineate al muro)
        const hx = mx + Math.cos(angle) * localHingeX;
        const hz = mz + Math.sin(angle) * localHingeX;
        hingeGroup.position.set(hx, 0, hz);
        // Allinea l'orientamento al muro
        hingeGroup.rotation.y = -angle;
        // Aperto a 30° (swing)
        hingeGroup.rotation.y += swingSign * hingeSign * Math.PI / 6;

        // Pannello porta: offset positivo lungo X locale di +hw*(-hingeSign) per andare dal cardine verso l'esterno
        const doorGeom = new THREE.BoxGeometry(d.width * CM, hh, 4 * CM);
        const doorColMap = { bianco: 0xFAFAFA, noce: 0x6B4423, rovere: 0xA87653, wenge: 0x2C1810, grigio: 0x94A3B8, antracite: 0x374151, nero: 0x0F0F0F };
        const customColor = (d.doorColor === "ral" && d.doorColorRal) ? d.doorColorRal : null;
        const doorColor = customColor ? new THREE.Color(customColor) : (d.doorColor ? doorColMap[d.doorColor] : (d.color ? new THREE.Color(d.color) : 0xb08968));
        const doorMat = new THREE.MeshStandardMaterial({ color: doorColor, roughness: 0.7 });
        const doorMesh = new THREE.Mesh(doorGeom, doorMat);
        doorMesh.position.set(-hingeSign * hw, hh / 2, th / 2);
        doorMesh.castShadow = true;
        doorMesh.userData = { kind: "doors", id: d.id };
        hingeGroup.add(doorMesh);

        // Maniglia: usa handleFinish (cromato/satinato/nero/ottone/oro-rosa/bianco)
        const handleFinMap = { cromato: 0xC0C0C0, satinato: 0x9ca3af, nero: 0x1F1F1F, ottone: 0xC9A24A, "oro-rosa": 0xE0B0A0, bianco: 0xF8F8F8 };
        const handleCol = handleFinMap[d.handleFinish] ?? 0x9ca3af;
        // pomo (porta blindata) vs maniglia
        const isPomo = d.handleModel === "pomo";
        const handleGeom = isPomo
          ? new THREE.SphereGeometry(3 * CM, 16, 16)
          : new THREE.CylinderGeometry(2 * CM, 2 * CM, 10 * CM, 8);
        const handleMat = new THREE.MeshStandardMaterial({ color: handleCol, metalness: 0.7, roughness: 0.3 });
        const handle = new THREE.Mesh(handleGeom, handleMat);
        if (!isPomo) handle.rotation.z = Math.PI / 2;
        handle.position.set(-hingeSign * (d.width * CM - 8 * CM), 100 * CM, th / 2 + 3 * CM);
        hingeGroup.add(handle);

        hingeGroup.userData = { kind: "doors", id: d.id };
        root.add(hingeGroup);
      });

    windows
      .filter((wn) => wn.wallId === w.id)
      .forEach((wn) => {
        const cxLocal = (wn.t - 0.5) * length;
        const sill = (wn.sillHeight || 90) * CM;
        const winH = (wn.height || 140) * CM;
        const winW = wn.width * CM;
        const sin = Math.sin(angle), cos = Math.cos(angle);
        const wx = mx + cxLocal * cos;
        const wz = mz + cxLocal * sin;
        const fW = 6 * CM; // larghezza telaio
        const frameColMap = { bianco: 0xFAFAFA, antracite: 0x3F3F46, grigio: 0xA1A1AA, marrone: 0x78350F, noce: 0x5B3A1A, rovere: 0xA87C4F };
        const frameHex = frameColMap[wn.frameColor || wn.color] != null ? frameColMap[wn.frameColor || wn.color] : 0xFAFAFA;
        const frameMat = new THREE.MeshStandardMaterial({ color: frameHex, roughness: 0.5 });

        // Telaio CAVO: 4 box (top/bottom/left/right) anziché 1 box pieno (così il vetro è visibile)
        const frameGroup = new THREE.Group();
        frameGroup.position.set(wx, sill + winH / 2, wz);
        frameGroup.rotation.y = -angle;
        frameGroup.userData = { kind: "windows", id: wn.id };

        // Top
        const top = new THREE.Mesh(new THREE.BoxGeometry(winW, fW, th * 1.05), frameMat);
        top.position.set(0, winH / 2 - fW / 2, 0);
        frameGroup.add(top);
        // Bottom
        const bot = new THREE.Mesh(new THREE.BoxGeometry(winW, fW, th * 1.05), frameMat);
        bot.position.set(0, -winH / 2 + fW / 2, 0);
        frameGroup.add(bot);
        // Left
        const left = new THREE.Mesh(new THREE.BoxGeometry(fW, winH - 2 * fW, th * 1.05), frameMat);
        left.position.set(-winW / 2 + fW / 2, 0, 0);
        frameGroup.add(left);
        // Right
        const right = new THREE.Mesh(new THREE.BoxGeometry(fW, winH - 2 * fW, th * 1.05), frameMat);
        right.position.set(winW / 2 - fW / 2, 0, 0);
        frameGroup.add(right);

        // Vetro TRASPARENTE al centro (separato per ogni anta, con divider tra)
        const ante = Math.max(1, Math.min(4, Number(wn.ante) || 1));
        const innerW = winW - 2 * fW;
        const innerH = winH - 2 * fW;
        const dividerW = 5 * CM;
        const totalDividers = ante - 1;
        const glassW = (innerW - totalDividers * dividerW) / ante;
        const glassMat = new THREE.MeshPhysicalMaterial({
          color: 0xE0F2FE,
          roughness: 0.05,
          metalness: 0.0,
          transmission: 0.85, // trasparenza fisica
          transparent: true,
          opacity: 0.5,
          ior: 1.4,
        });
        for (let k = 0; k < ante; k++) {
          const glass = new THREE.Mesh(
            new THREE.BoxGeometry(glassW, innerH, 1 * CM),
            glassMat
          );
          const offsetX = -innerW / 2 + glassW / 2 + k * (glassW + dividerW);
          glass.position.set(offsetX, 0, 0);
          glass.userData = { kind: "windows", id: wn.id };
          frameGroup.add(glass);
          // Divider verticale (tranne dopo l'ultima anta)
          if (k < ante - 1) {
            const dv = new THREE.Mesh(
              new THREE.BoxGeometry(dividerW, innerH, th * 1.05),
              frameMat
            );
            dv.position.set(offsetX + glassW / 2 + dividerW / 2, 0, 0);
            frameGroup.add(dv);
          }
        }

        // Davanzale (solo finestra, non porta-finestra)
        if (sill > 0) {
          const sillMat = new THREE.MeshStandardMaterial({ color: 0x9CA3AF, roughness: 0.7 });
          const sillMesh = new THREE.Mesh(new THREE.BoxGeometry(winW + 6 * CM, 3 * CM, th * 1.3), sillMat);
          sillMesh.position.set(wx, sill - 1.5 * CM, wz);
          sillMesh.rotation.y = -angle;
          root.add(sillMesh);
        }

        // Cassonetto tapparella sopra
        if (wn.tapparella) {
          const tCol = { bianco: 0xFAFAFA, antracite: 0x3F3F46, marrone: 0x78350F }[wn.tapparella_colore] || 0x3F3F46;
          const cMat = new THREE.MeshStandardMaterial({ color: tCol, roughness: 0.6 });
          const cass = new THREE.Mesh(new THREE.BoxGeometry(winW + 8 * CM, 20 * CM, th * 1.05), cMat);
          cass.position.set(wx, sill + winH + 10 * CM, wz);
          cass.rotation.y = -angle;
          root.add(cass);
        }

        root.add(frameGroup);
      });
  });

  (project.items || []).filter(phaseOK).forEach((it) => {
    const mat = byId[it.materialId];
    const color = new THREE.Color(mat?.color || "#71717A");
    const w = (it.width || 60) * CM;
    const d = (it.depth || 60) * CM;
    const h = (it.height || 50) * CM;
    const isLight = mat?.category === "light";

    const group = new THREE.Group();
    group.position.set(it.x * CM, 0, it.y * CM);
    group.rotation.y = -(it.rotation || 0) * Math.PI / 180;

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({
        color,
        emissive: isLight ? color : 0x000000,
        emissiveIntensity: isLight ? 0.6 : 0,
        roughness: 0.5,
      })
    );
    mesh.position.y = h / 2;
    mesh.castShadow = true;
    mesh.userData = { kind: "items", id: it.id };
    group.add(mesh);
    group.userData = { kind: "items", id: it.id };

    if (isLight) {
      const pl = new THREE.PointLight(0xfef3c7, 0.5, 5);
      pl.position.y = h + 0.5;
      group.add(pl);
    }

    root.add(group);
  });

  // Pilastri / colonne: BoxGeometry verticale a tutta altezza con colore/texture per kind
  (project.columns || []).filter(phaseOK).forEach((c) => {
    const w = (c.width || 30) * CM;
    const d = (c.depth || 30) * CM;
    const h = (c.height || (project.roomHeight || 270)) * CM;
    const kind = c.kind || "cemento";
    const color = kind === "cemento" ? "#A8A29E" : kind === "mattone" ? "#B45309" : "#F4E4C1";
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.85 })
    );
    mesh.position.set(c.x * CM, h / 2, c.y * CM);
    mesh.rotation.y = -(c.rotation || 0) * Math.PI / 180;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { kind: "columns", id: c.id };
    root.add(mesh);
  });

  // ---------- MEP: electrical / plumbing / hvac ----------
  // Standard heights (cm) per kind
  const STD_H = {
    presa: 30, "presa-cucina": 110, "presa-tv": 30, "presa-rj45": 30,
    luce: 110, interruttore: 110, deviatore: 110, spia: 110,
    "punto-luce-led": 240, quadro: 160,
    acqua: 50, scarico: 30, fredda: 50, calda: 50, "punto-completo": 50,
    gas: 40, split: 230, "trial-split": 230, "quadri-split": 230,
    vmc: 200, caldaia: 150, fotovoltaico: 270,
  };
  const colorFor = (arr, kind) => {
    if (arr === "electrical") {
      if (kind === "luce" || kind === "punto-luce-led") return "#F59E0B";
      if (kind === "interruttore" || kind === "deviatore") return "#7C3AED";
      if (kind === "presa-tv") return "#06B6D4";
      if (kind === "presa-rj45") return "#0D9488";
      if (kind === "presa-cucina") return "#EA580C";
      if (kind === "quadro") return "#DC2626";
      return "#7C3AED";
    }
    if (arr === "plumbing") {
      if (kind === "scarico") return "#1F2937";
      if (kind === "calda") return "#DC2626";
      return "#0EA5E9";
    }
    if (arr === "hvac") return "#14B8A6";
    return "#71717A";
  };
  // helper: side offset (lato A=-1 esterno, B=+1 interno) — sposta il punto ~18cm verso il lato muro più vicino.
  // Considera SIA walls espliciti SIA segmenti perimetro stanza, orientando la normale verso il centro stanza (Lato B = interno).
  const sideOffset = (x, y, side) => {
    if (!side) return { x, y };
    const walls = project.walls || [];
    const rooms = project.rooms || [];
    let best = null; let bestD = Infinity;
    // Walls espliciti
    for (const w of walls) {
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - w.x1) * dx + (y - w.y1) * dy) / len2));
      const px = w.x1 + t * dx, py = w.y1 + t * dy;
      const d = Math.hypot(x - px, y - py);
      if (d < bestD) {
        bestD = d;
        const len = Math.sqrt(len2);
        best = { nx: -dy / len, ny: dx / len };
      }
    }
    // Segmenti perimetro stanze (importante per quick-room senza walls espliciti)
    for (const r of rooms) {
      const pts = r.points || [];
      if (pts.length < 2) continue;
      const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
      const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        const dx = b.x - a.x, dy = b.y - a.y;
        const len2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
        const px = a.x + t * dx, py = a.y + t * dy;
        const d = Math.hypot(x - px, y - py);
        if (d < bestD) {
          bestD = d;
          const len = Math.sqrt(len2);
          let nx = -dy / len, ny = dx / len;
          const midx = (a.x + b.x) / 2, midy = (a.y + b.y) / 2;
          if (nx * (cx - midx) + ny * (cy - midy) < 0) { nx = -nx; ny = -ny; }
          best = { nx, ny };
        }
      }
    }
    if (!best) return { x, y };
    const k = 18 * side;
    return { x: x + best.nx * k, y: y + best.ny * k };
  };

  const renderMep = (arr, items) => {
    (items || []).filter(phaseOK).forEach((e) => {
      const isFloor = !!e.floor;
      const baseH = e.height_cm != null ? e.height_cm : (STD_H[e.kind] ?? 110);
      const yPos = isFloor ? 2 * CM : baseH * CM; // se a pavimento → quasi a terra
      const pos = isFloor ? { x: e.x, y: e.y } : sideOffset(e.x, e.y, e.wall_side || 0);
      const color = new THREE.Color(colorFor(arr, e.kind));
      const group = new THREE.Group();
      group.position.set(pos.x * CM, yPos, pos.y * CM);
      group.rotation.y = -(e.rotation || 0) * Math.PI / 180;

      let geom;
      if (arr === "hvac" && (e.kind === "split" || e.kind === "trial-split" || e.kind === "quadri-split")) {
        // split a/c indoor unit: cuboide bianco lungo
        geom = new THREE.BoxGeometry(80 * CM, 25 * CM, 18 * CM);
      } else if (arr === "hvac" && e.kind === "caldaia") {
        geom = new THREE.BoxGeometry(45 * CM, 70 * CM, 35 * CM);
      } else if (arr === "hvac" && e.kind === "vmc") {
        geom = new THREE.BoxGeometry(60 * CM, 25 * CM, 25 * CM);
      } else if (arr === "electrical" && e.kind === "quadro") {
        geom = new THREE.BoxGeometry(35 * CM, 50 * CM, 12 * CM);
      } else if (arr === "electrical" && (e.kind === "luce" || e.kind === "punto-luce-led")) {
        geom = new THREE.SphereGeometry(8 * CM, 16, 12);
      } else if (arr === "plumbing") {
        // pipe stub
        geom = new THREE.CylinderGeometry(4 * CM, 4 * CM, 16 * CM, 16);
      } else {
        // standard outlet/switch
        geom = new THREE.BoxGeometry(10 * CM, 10 * CM, 4 * CM);
      }
      const isLight = arr === "electrical" && (e.kind === "luce" || e.kind === "punto-luce-led");
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: isLight ? color : 0x000000,
        emissiveIntensity: isLight ? 0.6 : 0,
        roughness: 0.5,
        metalness: arr === "plumbing" ? 0.7 : 0.1,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.castShadow = true;
      mesh.userData = { kind: arr, id: e.id };
      group.add(mesh);
      group.userData = { kind: arr, id: e.id };
      // Floor marker (ring at base)
      if (isFloor) {
        const ringGeom = new THREE.RingGeometry(12 * CM, 18 * CM, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xD97706, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = -yPos + 0.5 * CM;
        group.add(ring);
      }
      if (isLight) {
        const pl = new THREE.PointLight(0xfef3c7, 0.6, 5);
        pl.position.y = -0.1;
        group.add(pl);
      }
      root.add(group);
    });
  };
  renderMep("electrical", project.electrical);
  renderMep("plumbing", project.plumbing);
  renderMep("hvac", project.hvac);
  renderMep("gas", project.gas);

  return root;
}

function SceneRoot({ project, catalog }) {
  const { scene } = useThree();
  useEffect(() => {
    const group = buildScene(project, catalog);
    scene.add(group);
    return () => {
      scene.remove(group);
      group.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    };
  }, [project, catalog, scene]);
  return null;
}

/**
 * Picker3D — Drag & Drop completo:
 * - items: drag libero su X/Z
 * - rooms: drag traslazione del poligono (delta su tutti i punti)
 * - walls: drag traslazione di entrambi gli endpoint
 * - doors/windows: drag lungo il muro → aggiorna `t` (proiezione sul segmento)
 * Selezione click su tutto.
 */
function Picker3D({ onSelect, onDrag, onPlace, projectRef, placementRef, dragActiveRef }) {
  const { gl, camera, scene } = useThree();
  useEffect(() => {
    const ray = new THREE.Raycaster();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let downX = 0, downY = 0, moved = false;
    let dragTarget = null;
    let dragKind = null;
    let dragStart = new THREE.Vector3();
    let originalData = null; // snapshot dati al mousedown

    const screenToWorld = (ev) => {
      const rect = gl.domElement.getBoundingClientRect();
      const m = new THREE.Vector2(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1
      );
      ray.setFromCamera(m, camera);
    };

    const intersectGround = () => {
      const hit = new THREE.Vector3();
      ray.ray.intersectPlane(groundPlane, hit);
      return hit;
    };

    const onDown = (ev) => {
      downX = ev.clientX; downY = ev.clientY; moved = false;
      // Se siamo in modalità "placement" (inserimento nuovo punto MEP via 3D click) NON iniziare drag
      if (placementRef?.current?.tool) return;
      screenToWorld(ev);
      const hits = ray.intersectObjects(scene.children, true);
      for (const h of hits) {
        let o = h.object;
        while (o && !o.userData?.kind) o = o.parent;
        if (!o?.userData?.kind || !o.userData.id) continue;
        const kind = o.userData.kind;
        const id = o.userData.id;
        if (!onDrag) break;
        // Aggancia il drag per tutti i kind supportati
        if (["items", "rooms", "walls", "doors", "windows", "columns", "electrical", "plumbing", "hvac", "gas"].includes(kind)) {
          dragTarget = o;
          dragKind = kind;
          dragStart.copy(intersectGround());
          const proj = projectRef.current || {};
          if (kind === "items") {
            const item = (proj.items || []).find((x) => x.id === id);
            if (item) originalData = { x: item.x, y: item.y };
          } else if (kind === "columns") {
            const col = (proj.columns || []).find((x) => x.id === id);
            if (col) originalData = { x: col.x, y: col.y };
          } else if (kind === "rooms") {
            const room = (proj.rooms || []).find((x) => x.id === id);
            if (room) originalData = { points: room.points.map((p) => ({ x: p.x, y: p.y })) };
          } else if (kind === "walls") {
            const wall = (proj.walls || []).find((x) => x.id === id);
            if (wall) originalData = { x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 };
          } else if (kind === "doors") {
            const door = (proj.doors || []).find((x) => x.id === id);
            const wall = door ? (proj.walls || []).find((w) => w.id === door.wallId) : null;
            if (door && wall) originalData = { t: door.t, wall };
          } else if (kind === "windows") {
            const win = (proj.windows || []).find((x) => x.id === id);
            const wall = win ? (proj.walls || []).find((w) => w.id === win.wallId) : null;
            if (win && wall) originalData = { t: win.t, wall };
          } else if (kind === "electrical" || kind === "plumbing" || kind === "hvac" || kind === "gas") {
            const arr = proj[kind] || [];
            const el = arr.find((x) => x.id === id);
            if (el) originalData = { x: el.x, y: el.y, height_cm: el.height_cm };
          }
          gl.domElement.style.cursor = "grabbing";
          if (dragActiveRef) dragActiveRef.current = true;
          ev.stopPropagation();
          ev.preventDefault();
          break;
        }
      }
    };

    const onMove = (ev) => {
      if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > 4) moved = true;
      if (!dragTarget || !originalData) return;
      screenToWorld(ev);
      const cur = intersectGround();
      const deltaX = (cur.x - dragStart.x) * 100; // m → cm
      const deltaZ = (cur.z - dragStart.z) * 100;

      if (dragKind === "items") {
        dragTarget.position.x = (originalData.x + deltaX) * CM;
        dragTarget.position.z = (originalData.y + deltaZ) * CM;
      } else if (dragKind === "columns") {
        dragTarget.position.x = (originalData.x + deltaX) * CM;
        dragTarget.position.z = (originalData.y + deltaZ) * CM;
      } else if (dragKind === "rooms") {
        // sposta visualmente la mesh (rapido) — il commit aggiornerà i points
        dragTarget.position.x = deltaX * CM;
        dragTarget.position.z = deltaZ * CM;
      } else if (dragKind === "walls") {
        dragTarget.position.x = ((originalData.x1 + originalData.x2) / 2 + deltaX) * CM;
        dragTarget.position.z = ((originalData.y1 + originalData.y2) / 2 + deltaZ) * CM;
      } else if (dragKind === "doors" || dragKind === "windows") {
        // proiezione del punto cur sul segmento del muro per ottenere il nuovo t
        const w = originalData.wall;
        const wdx = w.x2 - w.x1, wdy = w.y2 - w.y1;
        const wlen2 = wdx * wdx + wdy * wdy || 1;
        const px = cur.x * 100, py = cur.z * 100;
        let t = ((px - w.x1) * wdx + (py - w.y1) * wdy) / wlen2;
        t = Math.max(0.02, Math.min(0.98, t));
        // riposiziona visivamente lungo il muro
        const len = Math.sqrt(wlen2);
        const angle = Math.atan2(wdy, wdx);
        const cxLocal = (t - 0.5) * len;
        const mx = ((w.x1 + w.x2) / 2);
        const mz = ((w.y1 + w.y2) / 2);
        dragTarget.position.x = (mx + Math.cos(angle) * cxLocal) * CM;
        dragTarget.position.z = (mz + Math.sin(angle) * cxLocal) * CM;
      } else if (["electrical", "plumbing", "hvac", "gas"].includes(dragKind)) {
        // Drag libero sul piano XZ; il commit ri-proietterà sul muro più vicino
        dragTarget.position.x = (originalData.x + deltaX) * CM;
        dragTarget.position.z = (originalData.y + deltaZ) * CM;
      }
      ev.stopPropagation();
    };

    const onUp = (ev) => {
      if (dragTarget && onDrag && moved && originalData) {
        screenToWorld(ev);
        const cur = intersectGround();
        const deltaX = (cur.x - dragStart.x) * 100;
        const deltaZ = (cur.z - dragStart.z) * 100;
        const payload = { kind: dragKind, id: dragTarget.userData.id };
        if (dragKind === "items") {
          payload.x = Math.round(originalData.x + deltaX);
          payload.y = Math.round(originalData.y + deltaZ);
        } else if (dragKind === "columns") {
          payload.x = Math.round(originalData.x + deltaX);
          payload.y = Math.round(originalData.y + deltaZ);
        } else if (dragKind === "rooms") {
          payload.points = originalData.points.map((p) => ({ x: Math.round(p.x + deltaX), y: Math.round(p.y + deltaZ) }));
        } else if (dragKind === "walls") {
          payload.x1 = Math.round(originalData.x1 + deltaX);
          payload.y1 = Math.round(originalData.y1 + deltaZ);
          payload.x2 = Math.round(originalData.x2 + deltaX);
          payload.y2 = Math.round(originalData.y2 + deltaZ);
        } else if (dragKind === "doors" || dragKind === "windows") {
          const w = originalData.wall;
          const wdx = w.x2 - w.x1, wdy = w.y2 - w.y1;
          const wlen2 = wdx * wdx + wdy * wdy || 1;
          const px = cur.x * 100, py = cur.z * 100;
          let t = ((px - w.x1) * wdx + (py - w.y1) * wdy) / wlen2;
          payload.t = Math.max(0.02, Math.min(0.98, t));
        } else if (["electrical", "plumbing", "hvac", "gas"].includes(dragKind)) {
          payload.x = Math.round(originalData.x + deltaX);
          payload.y = Math.round(originalData.y + deltaZ);
        }
        onDrag(payload);
        dragTarget = null;
        dragKind = null;
        originalData = null;
        if (dragActiveRef) dragActiveRef.current = false;
        gl.domElement.style.cursor = "default";
        return;
      }
      dragTarget = null;
      dragKind = null;
      originalData = null;
      if (dragActiveRef) dragActiveRef.current = false;
      gl.domElement.style.cursor = "default";
      if (moved || !onSelect) return;
      // PLACEMENT MODE: se l'utente ha selezionato un tool MEP, inserisce un nuovo punto sulla parete cliccata.
      const placement = placementRef?.current;
      if (placement?.tool && onPlace) {
        screenToWorld(ev);
        const hits = ray.intersectObjects(scene.children, true);
        for (const h of hits) {
          let o = h.object;
          while (o && !o.userData?.kind) o = o.parent;
          if (!o?.userData?.kind || !o.userData.id) continue;
          if (o.userData.kind !== "walls") continue;
          // Trova il muro nel project
          const proj = projectRef.current || {};
          const wall = (proj.walls || []).find((w) => w.id === o.userData.id);
          if (!wall) break;
          const hitPoint = h.point.clone(); // mondo (m)
          // Proiezione sul segmento del muro (cm)
          const px = hitPoint.x * 100, pz = hitPoint.z * 100;
          const wdx = wall.x2 - wall.x1, wdy = wall.y2 - wall.y1;
          const wlen2 = wdx * wdx + wdy * wdy || 1;
          const t = Math.max(0.02, Math.min(0.98, ((px - wall.x1) * wdx + (pz - wall.y1) * wdy) / wlen2));
          const onWallX = Math.round(wall.x1 + t * wdx);
          const onWallY = Math.round(wall.y1 + t * wdy);
          // Lato muro: usa la normale del muro vs la posizione del punto colpito (segno dot product)
          const wlen = Math.sqrt(wlen2);
          const nx = -wdy / wlen, ny = wdx / wlen;
          const dxToWall = px - (wall.x1 + t * wdx);
          const dyToWall = pz - (wall.y1 + t * wdy);
          const dot = dxToWall * nx + dyToWall * ny;
          const wall_side = dot > 0 ? 1 : -1;
          // Altezza dal pavimento (cm)
          const height_cm = Math.max(5, Math.min((proj.roomHeight || 270) - 5, Math.round(hitPoint.y * 100)));
          onPlace({ tool: placement.tool, kind: placement.kind, x: onWallX, y: onWallY, wall_side, height_cm });
          return;
        }
        return;
      }
      // Click-to-select standard
      screenToWorld(ev);
      const hits = ray.intersectObjects(scene.children, true);
      for (const h of hits) {
        let o = h.object;
        while (o && !o.userData?.kind) o = o.parent;
        if (o?.userData?.kind && o.userData.id) {
          onSelect({ kind: o.userData.kind, id: o.userData.id });
          return;
        }
      }
    };
    gl.domElement.addEventListener("pointerdown", onDown);
    gl.domElement.addEventListener("pointermove", onMove);
    gl.domElement.addEventListener("pointerup", onUp);
    return () => {
      gl.domElement.removeEventListener("pointerdown", onDown);
      gl.domElement.removeEventListener("pointermove", onMove);
      gl.domElement.removeEventListener("pointerup", onUp);
    };
  }, [gl, camera, scene, onSelect, onDrag, onPlace, projectRef, placementRef, dragActiveRef]);
  return null;
}

function Highlight3D({ selected }) {
  const { scene } = useThree();
  useEffect(() => {
    if (!selected?.id || !selected.kind) return;
    let target = null;
    scene.traverse((obj) => {
      if (obj.userData?.kind === selected.kind && obj.userData.id === selected.id) target = obj;
    });
    if (!target?.geometry) return;
    const edges = new THREE.EdgesGeometry(target.geometry, 30);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xF59E0B, linewidth: 3 }));
    target.add(line);
    return () => {
      target.remove(line);
      edges.dispose();
      line.material.dispose();
    };
  }, [selected, scene]);
  return null;
}

function Lights() {
  const { scene } = useThree();
  useEffect(() => {
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(10, 15, 10);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 1024;
    dir.shadow.mapSize.height = 1024;
    const amb = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(dir);
    scene.add(amb);
    return () => {
      scene.remove(dir);
      scene.remove(amb);
    };
  }, [scene]);
  return null;
}

function OrbitLite({ target = [0, 0, 0], dragActiveRef }) {
  const { camera, gl } = useThree();
  const isDown = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const phi = useRef(Math.PI / 4);
  const theta = useRef(Math.PI / 4);
  const radius = useRef(15);
  const t = useRef(new THREE.Vector3(...target));

  useEffect(() => {
    t.current.set(target[0], target[1], target[2]);
    const v = camera.position.clone().sub(t.current);
    radius.current = v.length();
    phi.current = Math.acos(Math.max(-1, Math.min(1, v.y / (radius.current || 1))));
    theta.current = Math.atan2(v.z, v.x);
    update();

    const dom = gl.domElement;
    const down = (e) => {
      // Se Picker3D sta gestendo un drag di un elemento, NON orbitare
      if (dragActiveRef && dragActiveRef.current) return;
      isDown.current = true;
      last.current = { x: e.clientX, y: e.clientY };
    };
    const up = () => {
      isDown.current = false;
    };
    const move = (e) => {
      if (!isDown.current) return;
      // Se il drag interno si è attivato durante il movimento, interrompi l'orbit
      if (dragActiveRef && dragActiveRef.current) { isDown.current = false; return; }
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      theta.current -= dx * 0.008;
      phi.current = Math.max(0.15, Math.min(Math.PI / 2 - 0.05, phi.current - dy * 0.006));
      update();
    };
    const wheel = (e) => {
      e.preventDefault();
      radius.current = Math.max(2, Math.min(60, radius.current * (e.deltaY > 0 ? 1.1 : 0.9)));
      update();
    };
    function update() {
      const r = radius.current;
      camera.position.x = t.current.x + r * Math.sin(phi.current) * Math.cos(theta.current);
      camera.position.y = t.current.y + r * Math.cos(phi.current);
      camera.position.z = t.current.z + r * Math.sin(phi.current) * Math.sin(theta.current);
      camera.lookAt(t.current);
    }

    dom.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    window.addEventListener("mousemove", move);
    dom.addEventListener("wheel", wheel, { passive: false });
    return () => {
      dom.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("mousemove", move);
      dom.removeEventListener("wheel", wheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl, target[0], target[1], target[2]]);
  return null;
}

const Viewer3D = forwardRef(function Viewer3D({ project, catalog, onSelect, onDrag, onPlace, placement, selected }, ref) {
  const glRef = useRef(null);
  const projectRef = useRef(project);
  const placementRef = useRef(placement);
  const dragActiveRef = useRef(false);
  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { placementRef.current = placement; }, [placement]);

  useImperativeHandle(ref, () => ({
    snapshot: () => {
      const entry = glRef.current;
      if (!entry) return null;
      entry.gl.render(entry.scene, entry.camera);
      return entry.gl.domElement.toDataURL("image/png");
    },
  }));

  const { center, initialCam } = useMemo(() => {
    const walls = project.walls || [];
    const rooms = project.rooms || [];
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    walls.forEach((w) => {
      minX = Math.min(minX, w.x1, w.x2);
      maxX = Math.max(maxX, w.x1, w.x2);
      minZ = Math.min(minZ, w.y1, w.y2);
      maxZ = Math.max(maxZ, w.y1, w.y2);
    });
    rooms.forEach((r) => {
      (r.points || []).forEach((p) => {
        if (typeof p.x !== "number" || typeof p.y !== "number") return;
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.y);
        maxZ = Math.max(maxZ, p.y);
      });
    });
    if (!isFinite(minX)) return { center: [0, 0, 0], initialCam: [8, 6, 10] };
    const cx = ((minX + maxX) / 2) * CM;
    const cz = ((minZ + maxZ) / 2) * CM;
    const sizeX = (maxX - minX) * CM;
    const sizeZ = (maxZ - minZ) * CM;
    const size = Math.max(sizeX, sizeZ, 4);
    const camDist = size * 1.3 + 4;
    return {
      center: [cx, 0, cz],
      initialCam: [cx + camDist * 0.6, camDist * 0.65, cz + camDist],
    };
  }, [project.walls, project.rooms]);

  return (
    <Canvas
      shadows
      camera={{ position: initialCam, fov: 45, near: 0.1, far: 500 }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      onCreated={({ gl, scene, camera }) => {
        glRef.current = { gl, scene, camera };
        gl.setClearColor("#FAFAFA");
      }}
      data-testid="canvas-3d"
    >
      <Lights />
      <OrbitLite target={center} dragActiveRef={dragActiveRef} />
      <SceneRoot project={project} catalog={catalog} />
      {(onSelect || onDrag || onPlace) && <Picker3D onSelect={onSelect} onDrag={onDrag} onPlace={onPlace} projectRef={projectRef} placementRef={placementRef} dragActiveRef={dragActiveRef} />}
      {selected && <Highlight3D selected={selected} />}
    </Canvas>
  );
});

export default Viewer3D;
