import React, { useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";

const CM = 1 / 100;

function buildScene(project, catalog) {
  const root = new THREE.Group();
  const byId = Object.fromEntries((catalog || []).map((m) => [m.id, m]));
  const viewMode = project.viewMode || "progetto"; // "fatto" | "progetto"
  // Filtro phase coerente col 2D: in "fatto" → solo elementi esistenti, in "progetto" → tutto tranne demoliti.
  const phaseOK = (el) => {
    const ph = el?.phase || "fatto";
    if (viewMode === "fatto") return ph === "fatto";
    return true;
  };
  // Tiling map: roomId → { color, voceName }
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

  // Room floors + ceilings (controsoffitto totale stanza) — filtrate per phase
  (project.rooms || []).filter(phaseOK).forEach((r) => {
    if (!r.points || r.points.length < 3) return;
    // PRIORITÀ COLORE PAVIMENTO:
    // 1. Se viewMode=progetto e c'è tiling specifico per la stanza → colore voce piastrella (catalog) o tiling.color
    // 2. Se viewMode=progetto e r.progetto.floorMaterial → mat.color
    // 3. Altrimenti r.floorTileColor → mat.color (stato fatto)
    const tilingHere = tilingByRoom[r.id];
    let baseFloorColor;
    if (viewMode === "progetto" && tilingHere) {
      baseFloorColor = tilingHere.color || "#D4A574"; // colore scelto dall'utente nel tool
    } else if (viewMode === "progetto" && r.progetto?.floorMaterial) {
      const pmat = byId[r.progetto.floorMaterial];
      baseFloorColor = r.progetto.floorTileColor || pmat?.color || "#E4E4E7";
    } else {
      const mat = byId[r.floorMaterial];
      baseFloorColor = r.floorTileColor || mat?.color || "#E4E4E7";
    }
    const color = new THREE.Color(baseFloorColor);
    const shape = new THREE.Shape();
    r.points.forEach((p, i) => {
      const x = p.x * CM;
      const z = p.y * CM;
      if (i === 0) shape.moveTo(x, z);
      else shape.lineTo(x, z);
    });
    const geom = new THREE.ShapeGeometry(shape);
    const mesh = new THREE.Mesh(
      geom,
      new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide })
    );
    // FIX: rotation +PI/2 (non -PI/2) per allineare il pavimento ai muri (mappa (x,y) 2D → (x,0,y) 3D)
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = 0.001;
    mesh.receiveShadow = true;
    mesh.userData = { kind: "rooms", id: r.id };
    root.add(mesh);

    // Controsoffitto totale (riduce altezza utile a -30cm)
    if (r.controsoffitto) {
      const ceilGeom = new THREE.ShapeGeometry(shape);
      const ceilColor = new THREE.Color(r.ceilingPaintColor || "#FAFAFA");
      const ceil = new THREE.Mesh(ceilGeom, new THREE.MeshStandardMaterial({ color: ceilColor, roughness: 0.95, side: THREE.DoubleSide }));
      ceil.rotation.x = Math.PI / 2;
      ceil.position.y = (project.roomHeight || 270) * CM - 30 * CM;
      root.add(ceil);
    } else if (r.ceilingPaintColor) {
      // colore soffitto anche senza controsoffitto
      const ceilGeom = new THREE.ShapeGeometry(shape);
      const ceil = new THREE.Mesh(ceilGeom, new THREE.MeshStandardMaterial({ color: new THREE.Color(r.ceilingPaintColor), roughness: 0.9, side: THREE.DoubleSide }));
      ceil.rotation.x = Math.PI / 2;
      ceil.position.y = (project.roomHeight || 270) * CM - 0.5;
      root.add(ceil);
    }
  });

  // Controsoffitti AD AREA (poligoni custom)
  (project.controsoffitti || []).forEach((c) => {
    if (!c.polygon || c.polygon.length < 3) return;
    const shape = new THREE.Shape();
    c.polygon.forEach((p, i) => {
      const x = p.x * CM;
      const z = p.y * CM;
      if (i === 0) shape.moveTo(x, z);
      else shape.lineTo(x, z);
    });
    const ceilGeom = new THREE.ShapeGeometry(shape);
    const ceil = new THREE.Mesh(ceilGeom, new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.9, side: THREE.DoubleSide }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = (project.roomHeight || 270) * CM - 30 * CM;
    root.add(ceil);
  });

  // Walls with door/window holes — filtrati per phase coerente col 2D
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

    // Render porte dentro il varco (pannello porta inclinato 30° per simulare apertura)
    doors
      .filter((d) => d.wallId === w.id)
      .forEach((d) => {
        const cxLocal = (d.t - 0.5) * length;
        const hw = (d.width * CM) / 2;
        const hh = (d.height || 210) * CM;
        const doorGeom = new THREE.BoxGeometry(d.width * CM, hh, 4 * CM);
        const doorMat = new THREE.MeshStandardMaterial({ color: d.color ? new THREE.Color(d.color) : 0xb08968, roughness: 0.7 });
        const doorMesh = new THREE.Mesh(doorGeom, doorMat);
        // Posiziona nel sistema locale del muro (x lungo il muro, z in profondità)
        const sin = Math.sin(angle), cos = Math.cos(angle);
        const wx = mx + cxLocal * cos;
        const wz = mz - cxLocal * sin;
        doorMesh.position.set(wx, hh / 2, wz);
        doorMesh.rotation.y = -angle + (d.swing === "left" ? Math.PI / 6 : -Math.PI / 6);
        // Sposta il pivot al cardine
        doorMesh.position.x += (d.hinge === "left" ? -hw : hw) * Math.cos(-angle);
        doorMesh.position.z -= (d.hinge === "left" ? -hw : hw) * Math.sin(-angle);
        doorMesh.castShadow = true;
        root.add(doorMesh);
        // Maniglia
        const handleGeom = new THREE.CylinderGeometry(2 * CM, 2 * CM, 8 * CM, 8);
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.7, roughness: 0.3 });
        const handle = new THREE.Mesh(handleGeom, handleMat);
        handle.rotation.z = Math.PI / 2;
        handle.position.copy(doorMesh.position);
        handle.position.y = 100 * CM;
        root.add(handle);
      });

    // Render finestre dentro il varco (vetro azzurrato + cornice)
    windows
      .filter((wn) => wn.wallId === w.id)
      .forEach((wn) => {
        const cxLocal = (wn.t - 0.5) * length;
        const sill = (wn.sillHeight || 90) * CM;
        const winH = (wn.height || 140) * CM;
        const sin = Math.sin(angle), cos = Math.cos(angle);
        const wx = mx + cxLocal * cos;
        const wz = mz - cxLocal * sin;
        // Telaio (cornice)
        const frameGeom = new THREE.BoxGeometry(wn.width * CM, winH, th * 1.05);
        const frameMat = new THREE.MeshStandardMaterial({ color: wn.color ? new THREE.Color(wn.color) : 0xffffff, roughness: 0.5 });
        const frame = new THREE.Mesh(frameGeom, frameMat);
        frame.position.set(wx, sill + winH / 2, wz);
        frame.rotation.y = -angle;
        root.add(frame);
        // Vetro (azzurrato semitrasparente)
        const glassGeom = new THREE.BoxGeometry((wn.width - 8) * CM, winH - 8 * CM, 1 * CM);
        const glassMat = new THREE.MeshStandardMaterial({ color: 0xa5d8e6, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.55 });
        const glass = new THREE.Mesh(glassGeom, glassMat);
        glass.position.copy(frame.position);
        glass.rotation.y = -angle;
        root.add(glass);
      });
  });

  // Items
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

function Picker3D({ onSelect, onDrag }) {
  const { gl, camera, scene } = useThree();
  useEffect(() => {
    const ray = new THREE.Raycaster();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let downX = 0, downY = 0, moved = false;
    let dragTarget = null;
    let dragOffset = new THREE.Vector3();

    const screenToWorld = (ev) => {
      const rect = gl.domElement.getBoundingClientRect();
      const m = new THREE.Vector2(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1
      );
      ray.setFromCamera(m, camera);
      return { rect, m };
    };

    const onDown = (ev) => {
      downX = ev.clientX; downY = ev.clientY; moved = false;
      screenToWorld(ev);
      // Cerca un item draggabile sotto il puntatore (solo "items": mobili)
      const hits = ray.intersectObjects(scene.children, true);
      for (const h of hits) {
        let o = h.object;
        while (o && !o.userData?.kind) o = o.parent;
        if (o?.userData?.kind === "items" && o.userData.id && onDrag) {
          dragTarget = o;
          // calcola offset tra centro oggetto e punto colpito sul piano y=0
          const groundHit = new THREE.Vector3();
          ray.ray.intersectPlane(groundPlane, groundHit);
          dragOffset.copy(groundHit).sub(o.position);
          // disabilita orbit controls
          gl.domElement.style.cursor = "grabbing";
          ev.stopPropagation();
          break;
        }
      }
    };

    const onMove = (ev) => {
      if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > 4) moved = true;
      if (dragTarget) {
        screenToWorld(ev);
        const groundHit = new THREE.Vector3();
        if (ray.ray.intersectPlane(groundPlane, groundHit)) {
          const newPos = groundHit.sub(dragOffset);
          dragTarget.position.x = newPos.x;
          dragTarget.position.z = newPos.z;
        }
        ev.stopPropagation();
      }
    };

    const onUp = (ev) => {
      if (dragTarget && onDrag && moved) {
        // commit posizione finale (in cm CAD: x/CM, z/CM)
        const px = dragTarget.position.x * 100; // 1m = 100cm; CM=1/100 quindi *100 inverte
        const pz = dragTarget.position.z * 100;
        onDrag({ kind: "items", id: dragTarget.userData.id, x: Math.round(px), y: Math.round(pz) });
        dragTarget = null;
        gl.domElement.style.cursor = "default";
        return;
      }
      dragTarget = null;
      gl.domElement.style.cursor = "default";
      if (moved || !onSelect) return; // era un drag della camera
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
  }, [gl, camera, scene, onSelect, onDrag]);
  return null;
}

// Highlight visivo dell'elemento selezionato nel 3D (outline arancione)
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

function OrbitLite({ target = [0, 0, 0] }) {
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
    let minX = Infinity,
      minZ = Infinity,
      maxX = -Infinity,
      maxZ = -Infinity;
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
      {(onSelect || onDrag) && <Picker3D onSelect={onSelect} onDrag={onDrag} />}
      {selected && <Highlight3D selected={selected} />}
    </Canvas>
  );
});

export default Viewer3D;
