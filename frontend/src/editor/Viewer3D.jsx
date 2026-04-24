import React, { useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";

const CM = 1 / 100;

function buildScene(project, catalog) {
  const root = new THREE.Group();
  const byId = Object.fromEntries((catalog || []).map((m) => [m.id, m]));

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

  // Room floors
  (project.rooms || []).forEach((r) => {
    if (!r.points || r.points.length < 3) return;
    const mat = byId[r.floorMaterial];
    const color = new THREE.Color(mat?.color || "#E4E4E7");
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
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.001;
    mesh.receiveShadow = true;
    root.add(mesh);
  });

  // Walls with door/window holes
  const doors = project.doors || [];
  const windows = project.windows || [];
  const height = (project.roomHeight || 270) * CM;

  (project.walls || []).forEach((w) => {
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

    const geom = new THREE.ExtrudeGeometry(shape, { depth: th, bevelEnabled: false });
    const mesh = new THREE.Mesh(
      geom,
      new THREE.MeshStandardMaterial({ color: 0xf4f4f5, roughness: 0.85 })
    );
    mesh.position.set(mx, 0, mz);
    mesh.rotation.y = -angle;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  });

  // Items
  (project.items || []).forEach((it) => {
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
    group.add(mesh);

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

const Viewer3D = forwardRef(function Viewer3D({ project, catalog }, ref) {
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
    </Canvas>
  );
});

export default Viewer3D;
