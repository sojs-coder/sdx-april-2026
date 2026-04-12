"use client";

import { useRef, useState, useEffect, useMemo, Suspense, useLayoutEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";

// ─── Stage metadata ───────────────────────────────────────────────
const STAGES = [
  { desc: "01 / spark"     },
  { desc: "02 / structure" },
  { desc: "03 / prototype" },
  { desc: "04 / system"    },
  { desc: "05 / forge"     },
] as const;

// Rotation speed (rad/s) per stage — fast for early chaos, slow for final complexity
const ROT_SPEEDS = [0.18, 0.55, 0.42, 0.38, 0.26];
const CYCLE_MS   = 4400;
const FADE_MS    = 750;

// ─── Stage 0: Spark ──────────────────────────────────────────────
// A raw, pulsing point of light. The idea before it has form.
function Spark() {
  const coreRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!coreRef.current) return;
    const mat = coreRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 2.8 + Math.sin(clock.elapsedTime * 3.4) * 1.8;
  });
  return (
    <group>
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={3} />
      </mesh>
      {/* Inner halo */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.62, 0.012, 8, 64]} />
        <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={1.8} transparent opacity={0.55} />
      </mesh>
      {/* Outer halo, tilted */}
      <mesh rotation={[Math.PI / 3, 0.4, 0]}>
        <torusGeometry args={[0.84, 0.008, 8, 64]} />
        <meshStandardMaterial color="#FBBF24" emissive="#FBBF24" emissiveIntensity={0.9} transparent opacity={0.28} />
      </mesh>
    </group>
  );
}

// ─── Stage 1: Structure ───────────────────────────────────────────
// First dimensionality — pure edge geometry, no faces yet.
function Structure() {
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.OctahedronGeometry(1.3, 0)), []);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#F59E0B" />
    </lineSegments>
  );
}

// ─── Stage 2: Prototype ───────────────────────────────────────────
// Many faces, semi-transparent fill — the crystal stage.
function Prototype() {
  const solidGeo = useMemo(() => new THREE.IcosahedronGeometry(1.1, 1), []);
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.1, 1)), []);
  useEffect(() => () => { solidGeo.dispose(); edgesGeo.dispose(); }, [solidGeo, edgesGeo]);
  return (
    <group>
      <mesh geometry={solidGeo}>
        <meshStandardMaterial
          color="#F59E0B"
          emissive="#F59E0B"
          emissiveIntensity={0.12}
          transparent
          opacity={0.14}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineSegments geometry={edgesGeo}>
        <lineBasicMaterial color="#FBBF24" />
      </lineSegments>
    </group>
  );
}

// ─── Stage 3: System ─────────────────────────────────────────────
// A torus — a loop, a cycle, a complete system with flow.
function System() {
  return (
    <mesh>
      <torusGeometry args={[0.9, 0.28, 10, 52]} />
      <meshStandardMaterial
        color="#F59E0B"
        emissive="#F59E0B"
        emissiveIntensity={0.42}
        metalness={0.55}
        roughness={0.32}
      />
    </mesh>
  );
}

// ─── Stage 4: Forge ───────────────────────────────────────────────
// Torus knot — intricate, interdependent, the finished creation.
function Forge() {
  return (
    <mesh>
      <torusKnotGeometry args={[0.7, 0.2, 120, 14, 2, 3]} />
      <meshStandardMaterial
        color="#F59E0B"
        emissive="#F59E0B"
        emissiveIntensity={0.5}
        metalness={0.42}
        roughness={0.28}
      />
    </mesh>
  );
}

// ─── Scene (inside Canvas) ───────────────────────────────────────
function Scene({
  intensity,
  stage,
  exitingRef,
}: {
  intensity: number;
  stage: number;
  exitingRef: React.RefObject<boolean>;
}) {
  const groupRef  = useRef<THREE.Group>(null);
  const scaleRef  = useRef(0);   // driven entirely by useFrame
  const timeRef   = useRef(0);

  // Reset scale to 0 each time a new stage mounts (before browser paints)
  useLayoutEffect(() => {
    scaleRef.current = 0;
  }, [stage]);

  useFrame((_, delta) => {
    timeRef.current += delta;

    const target = exitingRef.current ? 0 : 1;
    scaleRef.current += (target - scaleRef.current) * Math.min(1, delta * 7);

    const group = groupRef.current;
    if (!group) return;

    group.scale.setScalar(Math.max(0.001, scaleRef.current));
    group.rotation.y += delta * ROT_SPEEDS[stage];
    group.rotation.x = Math.sin(timeRef.current * 0.28) * 0.1;
  });

  return (
    <>
      <ambientLight intensity={0.12} />
      <pointLight color="#F59E0B" intensity={3 + intensity * 5} distance={9} decay={2} />
      <pointLight color="#FDE68A" intensity={0.6} position={[0, 3.5, 1]} distance={7} decay={2.5} />

      <group ref={groupRef}>
        {stage === 0 && <Spark />}
        {stage === 1 && <Structure />}
        {stage === 2 && <Prototype />}
        {stage === 3 && <System />}
        {stage === 4 && <Forge />}
      </group>

      <Sparkles
        count={35}
        size={0.42}
        speed={0.09}
        opacity={0.13}
        color="#F59E0B"
        scale={5.5}
        noise={0.3}
      />
    </>
  );
}

// ─── Export ──────────────────────────────────────────────────────
export function ForgeScene({ intensity = 0.5 }: { intensity?: number }) {
  const [stage, setStage]       = useState(0);
  const exitingRef              = useRef(false);

  // Cycle through stages; mutation of exitingRef is safe (read by useFrame, not React)
  useEffect(() => {
    const id = setInterval(() => {
      exitingRef.current = true;
      setTimeout(() => {
        setStage(s => (s + 1) % STAGES.length);
        exitingRef.current = false;
      }, FADE_MS);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: [0, 0.5, 4.6], fov: 44 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <Scene intensity={intensity} stage={stage} exitingRef={exitingRef} />
        </Suspense>
      </Canvas>

      {/* Stage label — HTML overlay, no drei Html needed */}
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
          }}
        >
          {STAGES[stage].desc}
        </span>
      </div>
    </div>
  );
}
