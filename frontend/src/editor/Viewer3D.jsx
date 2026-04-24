import React, { useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";

// Convert world (cm) to meters in Three.js (1 unit = 1m)
const CM = 1 / 100;

function Ground({ size = 40 }) {
  return (
    <>
      <gridHelper args={[size, size, "#D4D4D8", "#E4E4E7"]} position={[0, 0, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#FAFAFA" />
      </mesh>
    </>
  );
}

function Wall({ w, height, doors = [], windows = [] }) {
  // Build a rectangle centered on the wall segment, oriented along it
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
  const length = Math.hypot(dx, dy) * CM;
  const angle = Math.atan2(dy, dx);
  const mx = ((w.x1 + w.x2) / 2) * CM;
  const mz = ((w.y1 + w.y2) / 2) * CM;
  const th = (w.thickness || 10) * CM;
  const h = height * CM;

  // Use extrude geometry with holes for doors/windows for nicer result
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-length / 2, 0);
    s.lineTo(length / 2, 0);
    s.lineTo(length / 2, h);
    s.lineTo(-length / 2, h);
    s.lineTo(-length / 2, 0);
    const wallDoors = doors.filter((d) => d.wallId === w.id);
    const wallWins = windows.filter((wn) => wn.wallId === w.id);
    wallDoors.forEach((d) => {
      const cx = (d.t - 0.5) * length;
      const hw = (d.width * CM) / 2;
      const hh = (d.height || 210) * CM;
      const hole = new THREE.Path();
      hole.moveTo(cx - hw, 0);
      hole.lineTo(cx + hw, 0);
      hole.lineTo(cx + hw, hh);
      hole.lineTo(cx - hw, hh);
      hole.lineTo(cx - hw, 0);
      s.holes.push(hole);
    });
    wallWins.forEach((wn) => {
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
      s.holes.push(hole);
    });
    return s;
  }, [length, h, w.id, JSON.stringify(doors), JSON.stringify(windows)]);

  const geom = useMemo(() => new THREE.ExtrudeGeometry(shape, { depth: th, bevelEnabled: false }), [shape, th]);

  if (length < 0.001) return null;

  return (
    <mesh
      geometry={geom}
      position={[mx, 0, mz]}
      rotation={[0, -angle, 0]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color="#F4F4F5" roughness={0.85} />
    </mesh>
  );
}

function RoomFloor({ room, catalog }) {
  const mat = (catalog || []).find((m) => m.id === room.floorMaterial);
  const color = mat?.color || "#E4E4E7";
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    room.points.forEach((p, i) => {
      const x = p.x * CM;
      const z = p.y * CM;
      if (i === 0) s.moveTo(x, z); else s.lineTo(x, z);
    });
    return s;
  }, [JSON.stringify(room.points)]);
  const geom = useMemo(() => new THREE.ShapeGeometry(shape), [shape]);
  return (
    <mesh geometry={geom} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  );
}

function ItemBox({ it, catalog }) {
  const mat = (catalog || []).find((m) => m.id === it.materialId);
  const color = mat?.color || "#71717A";
  const w = (it.width || 60) * CM;
  const d = (it.depth || 60) * CM;
  const h = (it.height || 50) * CM;
  const isLight = mat?.category === "light";
  return (
    <group position={[it.x * CM, 0, it.y * CM]} rotation={[0, -(it.rotation || 0) * Math.PI / 180, 0]}>
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} emissive={isLight ? color : "#000000"} emissiveIntensity={isLight ? 0.6 : 0} roughness={0.5} />
      </mesh>
      {isLight && <pointLight position={[0, h + 0.5, 0]} intensity={0.5} distance={5} color="#FEF3C7" />}
    </group>
  );
}

function Camera({ refCam }) {
  const { camera } = useThree();
  useImperativeHandle(refCam, () => camera, [camera]);
  useEffect(() => {
    camera.position.set(8, 6, 10);
    camera.lookAt(0, 1, 0);
  }, [camera]);
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
    // initialize from current camera
    const v = camera.position.clone().sub(t.current);
    radius.current = v.length();
    phi.current = Math.acos(v.y / radius.current);
    theta.current = Math.atan2(v.z, v.x);
    update();

    const dom = gl.domElement;
    const down = (e) => { isDown.current = true; last.current = { x: e.clientX, y: e.clientY }; };
    const up = () => { isDown.current = false; };
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
  }, [camera, gl]);
  return null;
}

const Viewer3D = forwardRef(function Viewer3D({ project, catalog }, ref) {
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  const camRef = useRef(null);

  useImperativeHandle(ref, () => ({
    snapshot: () => {
      const gl = glRef.current; if (!gl) return null;
      // re-render then capture
      gl.render(gl.scene, gl.camera);
      return gl.domElement.toDataURL("image/png");
    },
  }));

  // compute world center for camera target
  const center = useMemo(() => {
    const walls = project.walls || [];
    if (!walls.length) return [0, 0, 0];
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    walls.forEach((w) => {
      minX = Math.min(minX, w.x1, w.x2); maxX = Math.max(maxX, w.x1, w.x2);
      minZ = Math.min(minZ, w.y1, w.y2); maxZ = Math.max(maxZ, w.y1, w.y2);
    });
    return [((minX + maxX) / 2) * CM, 0, ((minZ + maxZ) / 2) * CM];
  }, [JSON.stringify(project.walls)]);

  return (
    <Canvas
      ref={canvasRef}
      shadows
      camera={{ position: [8, 6, 10], fov: 45, near: 0.1, far: 500 }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      onCreated={({ gl, scene, camera }) => {
        glRef.current = { ...gl, scene, camera, render: (s, c) => gl.render(s, c), domElement: gl.domElement };
        gl.setClearColor("#FAFAFA");
      }}
      data-testid="canvas-3d"
    >
      <Camera refCam={camRef} />
      <OrbitLite target={center} />
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <Ground size={60} />

      {(project.rooms || []).map((r) => <RoomFloor key={r.id} room={r} catalog={catalog} />)}
      {(project.walls || []).map((w) => (
        <Wall key={w.id} w={w} height={project.roomHeight || 270} doors={project.doors || []} windows={project.windows || []} />
      ))}
      {(project.items || []).map((it) => <ItemBox key={it.id} it={it} catalog={catalog} />)}
    </Canvas>
  );
});

export default Viewer3D;
