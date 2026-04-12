"use client";

import { useRef, useState, useEffect, useMemo, Suspense, useLayoutEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";

// ─── Stage metadata (the 5 Platonic solids in ascending complexity) ──
const STAGES = [
  { desc: "01 / tetrahedron"  },  //  4 faces
  { desc: "02 / hexahedron"   },  //  6 faces
  { desc: "03 / octahedron"   },  //  8 faces
  { desc: "04 / dodecahedron" },  // 12 faces
  { desc: "05 / icosahedron"  },  // 20 faces
] as const;

// Rotation slows as complexity increases — let the shape speak.
const ROT_SPEEDS = [0.46, 0.40, 0.38, 0.34, 0.28];
const CYCLE_MS   = 4400;
const FADE_MS    = 750;

// ─── Shared renderer: wireframe + translucent faces ───────────────
// faceOpacity and emissiveIntensity increase per stage so the solid
// progressively "materialises" from pure skeleton to glowing crystal.
function PlatonicModel({
  solidGeo,
  faceOpacity,
  emissiveIntensity,
}: {
  solidGeo: THREE.BufferGeometry;
  faceOpacity: number;
  emissiveIntensity: number;
}) {
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(solidGeo), [solidGeo]);
  useEffect(() => () => edgesGeo.dispose(), [edgesGeo]);

  return (
    <group>
      {faceOpacity > 0 && (
        <mesh geometry={solidGeo}>
          <meshStandardMaterial
            color="#F59E0B"
            emissive="#F59E0B"
            emissiveIntensity={emissiveIntensity}
            transparent
            opacity={faceOpacity}
          />
        </mesh>
      )}
      <lineSegments geometry={edgesGeo}>
        <lineBasicMaterial color="#FBBF24" />
      </lineSegments>
    </group>
  );
}

// ─── Stage 0: Tetrahedron — 4 faces, bare skeleton ───────────────
function Stage0() {
  const geo = useMemo(() => new THREE.TetrahedronGeometry(1.3, 0), []);
  useEffect(() => () => geo.dispose(), [geo]);
  return <PlatonicModel solidGeo={geo} faceOpacity={0} emissiveIntensity={0} />;
}

// ─── Stage 1: Hexahedron — 6 faces, hint of fill ─────────────────
function Stage1() {
  const geo = useMemo(() => new THREE.BoxGeometry(1.44, 1.44, 1.44), []);
  useEffect(() => () => geo.dispose(), [geo]);
  return <PlatonicModel solidGeo={geo} faceOpacity={0.07} emissiveIntensity={0.07} />;
}

// ─── Stage 2: Octahedron — 8 faces, clearly visible fill ─────────
function Stage2() {
  const geo = useMemo(() => new THREE.OctahedronGeometry(1.25, 0), []);
  useEffect(() => () => geo.dispose(), [geo]);
  return <PlatonicModel solidGeo={geo} faceOpacity={0.18} emissiveIntensity={0.16} />;
}

// ─── Stage 3: Dodecahedron — 12 pentagonal faces, solid-feeling ──
function Stage3() {
  const geo = useMemo(() => new THREE.DodecahedronGeometry(1.05, 0), []);
  useEffect(() => () => geo.dispose(), [geo]);
  return <PlatonicModel solidGeo={geo} faceOpacity={0.30} emissiveIntensity={0.26} />;
}

// ─── Stage 4: Icosahedron — 20 faces, glowing crystal ────────────
function Stage4() {
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1.12, 0), []);
  useEffect(() => () => geo.dispose(), [geo]);
  return <PlatonicModel solidGeo={geo} faceOpacity={0.48} emissiveIntensity={0.40} />;
}

// ─── Scene (lives inside Canvas) ─────────────────────────────────
function Scene({
  intensity,
  stage,
  exitingRef,
}: {
  intensity: number;
  stage: number;
  exitingRef: { current: boolean };
}) {
  const groupRef = useRef<THREE.Group>(null);
  const scaleRef = useRef(0);
  const timeRef  = useRef(0);

  // Each new stage starts at scale 0 so it grows in cleanly.
  useLayoutEffect(() => { scaleRef.current = 0; }, [stage]);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const target = exitingRef.current ? 0 : 1;
    scaleRef.current += (target - scaleRef.current) * Math.min(1, delta * 7);

    const group = groupRef.current;
    if (!group) return;
    group.scale.setScalar(Math.max(0.001, scaleRef.current));
    group.rotation.y += delta * ROT_SPEEDS[stage];
    group.rotation.x = Math.sin(timeRef.current * 0.28) * 0.08;
  });

  return (
    <>
      <ambientLight intensity={0.12} />
      <pointLight color="#F59E0B" intensity={3 + intensity * 5} distance={9} decay={2} />
      <pointLight color="#FDE68A" intensity={0.6} position={[0, 3.5, 1]} distance={7} decay={2.5} />

      <group ref={groupRef}>
        {stage === 0 && <Stage0 />}
        {stage === 1 && <Stage1 />}
        {stage === 2 && <Stage2 />}
        {stage === 3 && <Stage3 />}
        {stage === 4 && <Stage4 />}
      </group>

      <Sparkles count={35} size={0.42} speed={0.09} opacity={0.13} color="#F59E0B" scale={5.5} noise={0.3} />
    </>
  );
}

// ─── Export ───────────────────────────────────────────────────────
export function ForgeScene({ intensity = 0.5 }: { intensity?: number }) {
  const [stage, setStage]     = useState(0);
  const [exiting, setExiting] = useState(false);
  const exitingRef            = useRef(false);

  // Ref mirrors state so useFrame can read it without closure staleness.
  useEffect(() => { exitingRef.current = exiting; }, [exiting]);

  useEffect(() => {
    const id = setInterval(() => {
      setExiting(true);
      setTimeout(() => {
        setStage(s => (s + 1) % STAGES.length);
        setExiting(false);
      }, FADE_MS);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: [0, 0.6, 4.8], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <Scene intensity={intensity} stage={stage} exitingRef={exitingRef} />
        </Suspense>
      </Canvas>

      {/* Stage label — plain HTML overlay, no drei <Html> needed */}
      <div
        style={{
          position: "absolute",
          bottom: "1.25rem",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "10px",
            color: "rgba(245,158,11,0.38)",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            opacity: exiting ? 0 : 1,
            transition: "opacity 350ms ease",
          }}
        >
          {STAGES[stage].desc}
        </span>
      </div>
    </div>
  );
}
