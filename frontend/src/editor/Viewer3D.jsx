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
    tilingByRoom[t.roomId] = {
      color: t.color || t.tileColor || null,
      voceName: t.voceName || null,
      voceId: t.voceId || null,
    };
  });

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.9 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.002;
  ground.receiveShadow = true;
  root.add(ground);

  const grid = new THREE.GridHelper(60, 60, 0xd4d4d8, 0xe4e4e7);
  grid.position.y = 0;
  root.add(grid);

  // Room floors + ceilings
  (project.rooms || []).filter(phaseOK).forEach((r) => {
    if (!r.points || r.points.length < 3) return;
    const tilingHere = tilingByRoom[r.id];
    let baseFloorColor;
    if (viewMode === "progetto" && tilingHere) {
      baseFloorColor = tilingHere.color || "#D4A574";
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

    const wallColor = w.paintColor ? new THREE.Color(w.paintColor) : new THREE.Color(0xf4f4f5);
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
        const doorMat = new THREE.MeshStandardMaterial({ color: d.color ? new THREE.Color(d.color) : 0xb08968, roughness: 0.7 });
        const doorMesh = new THREE.Mesh(doorGeom, doorMat);
        doorMesh.position.set(-hingeSign * hw, hh / 2, th / 2);
        doorMesh.castShadow = true;
        doorMesh.userData = { kind: "doors", id: d.id };
        hingeGroup.add(doorMesh);

        const handleGeom = new THREE.CylinderGeometry(2 * CM, 2 * CM, 8 * CM, 8);
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.7, roughness: 0.3 });
        const handle = new THREE.Mesh(handleGeom, handleMat);
        handle.rotation.z = Math.PI / 2;
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
        const sin = Math.sin(angle), cos = Math.cos(angle);
        const wx = mx + cxLocal * cos;
        const wz = mz + cxLocal * sin;
        const frameGeom = new THREE.BoxGeometry(wn.width * CM, winH, th * 1.05);
        const frameMat = new THREE.MeshStandardMaterial({ color: wn.color ? new THREE.Color(wn.color) : 0xffffff, roughness: 0.5 });
        const frame = new THREE.Mesh(frameGeom, frameMat);
        frame.position.set(wx, sill + winH / 2, wz);
        frame.rotation.y = -angle;
        frame.userData = { kind: "windows", id: wn.id };
        root.add(frame);
        const glassGeom = new THREE.BoxGeometry((wn.width - 8) * CM, winH - 8 * CM, 1 * CM);
        const glassMat = new THREE.MeshStandardMaterial({ color: 0xa5d8e6, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.55 });
        const glass = new THREE.Mesh(glassGeom, glassMat);
        glass.position.copy(frame.position);
        glass.rotation.y = -angle;
        glass.userData = { kind: "windows", id: wn.id };
        root.add(glass);
        // Divider verticale interno per ante>1
        const ante = Math.max(1, Math.min(4, Number(wn.ante) || 1));
        if (ante > 1) {
          for (let k = 1; k < ante; k++) {
            const dvGeom = new THREE.BoxGeometry(4 * CM, winH - 8 * CM, th * 1.1);
            const dvMat = new THREE.MeshStandardMaterial({ color: wn.color ? new THREE.Color(wn.color) : 0xffffff, roughness: 0.5 });
            const dv = new THREE.Mesh(dvGeom, dvMat);
            // posizione lungo larghezza locale dell'infisso
            const offsetLocal = (-wn.width / 2 + (wn.width / ante) * k) * CM;
            const dx2 = offsetLocal * cos;
            const dz2 = offsetLocal * sin;
            dv.position.set(wx + dx2, sill + winH / 2, wz + dz2);
            dv.rotation.y = -angle;
            dv.userData = { kind: "windows", id: wn.id };
            root.add(dv);
          }
        }
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
function Picker3D({ onSelect, onDrag, projectRef }) {
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
        if (["items", "rooms", "walls", "doors", "windows"].includes(kind)) {
          dragTarget = o;
          dragKind = kind;
          dragStart.copy(intersectGround());
          const proj = projectRef.current || {};
          if (kind === "items") {
            const item = (proj.items || []).find((x) => x.id === id);
            if (item) originalData = { x: item.x, y: item.y };
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
          }
          gl.domElement.style.cursor = "grabbing";
          ev.stopPropagation();
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
        }
        onDrag(payload);
        dragTarget = null;
        dragKind = null;
        originalData = null;
        gl.domElement.style.cursor = "default";
        return;
      }
      dragTarget = null;
      dragKind = null;
      originalData = null;
      gl.domElement.style.cursor = "default";
      if (moved || !onSelect) return;
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
  }, [gl, camera, scene, onSelect, onDrag, projectRef]);
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

function OrbitLite({ target = [0, 0, 0], enabledRef }) {
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
      // Se il drag interno è attivo, non orbitare
      if (enabledRef && enabledRef.current === false) return;
      isDown.current = true;
      last.current = { x: e.clientX, y: e.clientY };
    };
    const up = () => {
      isDown.current = false;
    };
    const move = (e) => {
      if (!isDown.current) return;
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

const Viewer3D = forwardRef(function Viewer3D({ project, catalog, onSelect, onDrag, selected }, ref) {
  const glRef = useRef(null);
  const projectRef = useRef(project);
  useEffect(() => { projectRef.current = project; }, [project]);

  useImperativeHandle(ref, () => ({
    snapshot: () => {
      const entry = glRef.current;
      if (!entry) return null;
      entry.gl.render(entry.scene, entry.camera);
      return entry.gl.domElement.toDataURL("image/png");
    },
  }));

  const center = useMemo(() => {
    const walls = project.walls || [];
    if (!walls.length) return [0, 0, 0];
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    walls.forEach((w) => {
      minX = Math.min(minX, w.x1, w.x2);
      maxX = Math.max(maxX, w.x1, w.x2);
      minZ = Math.min(minZ, w.y1, w.y2);
      maxZ = Math.max(maxZ, w.y1, w.y2);
    });
    return [((minX + maxX) / 2) * CM, 0, ((minZ + maxZ) / 2) * CM];
  }, [project.walls]);

  return (
    <Canvas
      shadows
      camera={{ position: [8, 6, 10], fov: 45, near: 0.1, far: 500 }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      onCreated={({ gl, scene, camera }) => {
        glRef.current = { gl, scene, camera };
        gl.setClearColor("#FAFAFA");
      }}
      data-testid="canvas-3d"
    >
      <Lights />
      <OrbitLite target={center} />
      <SceneRoot project={project} catalog={catalog} />
      {(onSelect || onDrag) && <Picker3D onSelect={onSelect} onDrag={onDrag} projectRef={projectRef} />}
      {selected && <Highlight3D selected={selected} />}
    </Canvas>
  );
});

export default Viewer3D;
