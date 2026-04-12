"use client";

import { useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles } from "@react-three/drei";
import * as THREE from "three";

// ─── Orbital ────────────────────────────────────────────────────
// Tilted orbital plane: outer group sets the tilt angle,
// inner group rotates on Y to produce the orbit motion,
// position group offsets the artifact to orbital radius.
function Orbital({
  children,
  radius,
  speed,
  offset,
  tiltX = 0,
  tiltZ = 0,
}: {
  children: React.ReactNode;
  radius: number;
  speed: number;
  offset: number;
  tiltX?: number;
  tiltZ?: number;
}) {
  const rotRef = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    rotRef.current.rotation.y = clock.elapsedTime * speed + offset;
  });
  return (
    <group rotation={[tiltX, 0, tiltZ]}>
      <group ref={rotRef}>
        <group position={[radius, 0, 0]}>{children}</group>
      </group>
    </group>
  );
}

// ─── Orbit path ring (barely visible guide) ─────────────────────
function OrbitPath({ radius, tiltX = 0, tiltZ = 0 }: { radius: number; tiltX?: number; tiltZ?: number }) {
  return (
    <group rotation={[tiltX, 0, tiltZ]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.005, 6, 128]} />
        <meshBasicMaterial color="#F59E0B" transparent opacity={0.07} />
      </mesh>
    </group>
  );
}

// ─── Artifact 1: Signal Weave ────────────────────────────────────
// A torus knot — the complexity of the sentiment signal itself.
function SignalWeave({ glow }: { glow: number }) {
  const mesh = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    mesh.current.rotation.x = clock.elapsedTime * 0.38;
    mesh.current.rotation.z = clock.elapsedTime * 0.24;
  });
  return (
    <>
      <OrbitPath radius={1.9} tiltX={0.35} />
      <Orbital radius={1.9} speed={0.22} offset={0} tiltX={0.35}>
        <mesh ref={mesh}>
          <torusKnotGeometry args={[0.42, 0.13, 140, 16, 2, 3]} />
          <meshStandardMaterial
            color="#F59E0B"
            emissive="#F59E0B"
            emissiveIntensity={0.35 + glow * 0.65}
            metalness={0.92}
            roughness={0.08}
          />
        </mesh>
      </Orbital>
    </>
  );
}

// ─── Artifact 2: Market Board ────────────────────────────────────
// Seven amber bars rising from a base plate — a dashboard app at rest.
const BAR_DATA: [number, string][] = [
  [0.45, "#FBBF24"], [0.88, "#F59E0B"], [1.28, "#F59E0B"],
  [1.0, "#FBBF24"], [0.62, "#D97706"], [1.12, "#F59E0B"], [0.52, "#FBBF24"],
];

function MarketBoard({ glow }: { glow: number }) {
  const group = useRef<THREE.Group>(null!);
  useFrame(() => { group.current.rotation.y += 0.008; });
  return (
    <>
      <OrbitPath radius={1.72} tiltX={-0.5} tiltZ={0.2} />
      <Orbital radius={1.72} speed={-0.3} offset={Math.PI * 0.5} tiltX={-0.5} tiltZ={0.2}>
        <Float speed={1.8} floatIntensity={0.2} rotationIntensity={0}>
          <group ref={group}>
            {BAR_DATA.map(([h, color], i) => (
              <mesh key={i} position={[(i - 3) * 0.185, h / 2 - 0.56, 0]}>
                <boxGeometry args={[0.115, h, 0.115]} />
                <meshStandardMaterial
                  color={color}
                  emissive={color}
                  emissiveIntensity={0.2 + glow * 0.45}
                  metalness={0.75}
                  roughness={0.25}
                />
              </mesh>
            ))}
            {/* Base plate */}
            <mesh position={[0, -0.575, 0]}>
              <boxGeometry args={[1.45, 0.022, 0.28]} />
              <meshStandardMaterial color="#92400E" emissive="#92400E" emissiveIntensity={0.35} metalness={0.95} roughness={0.05} />
            </mesh>
          </group>
        </Float>
      </Orbital>
    </>
  );
}

// ─── Artifact 3: Data Crystal ────────────────────────────────────
// Solid semi-transparent icosahedron inside a bright wireframe cage.
function DataCrystal({ glow }: { glow: number }) {
  const solid = useRef<THREE.Mesh>(null!);
  const wire = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    solid.current.rotation.x = t * 0.56;
    solid.current.rotation.y = t * 0.39;
    solid.current.rotation.z = t * 0.21;
    wire.current.rotation.x = t * 0.56;
    wire.current.rotation.y = t * 0.39;
    wire.current.rotation.z = t * 0.21;
  });
  return (
    <>
      <OrbitPath radius={2.08} tiltX={0.62} tiltZ={-0.28} />
      <Orbital radius={2.08} speed={0.38} offset={Math.PI} tiltX={0.62} tiltZ={-0.28}>
        <Float speed={2.6} floatIntensity={0.3} rotationIntensity={0}>
          <group>
            <mesh ref={solid}>
              <icosahedronGeometry args={[0.5, 1]} />
              <meshStandardMaterial
                color="#D97706"
                emissive="#F59E0B"
                emissiveIntensity={0.18 + glow * 0.42}
                metalness={0.96}
                roughness={0.04}
                transparent
                opacity={0.6}
              />
            </mesh>
            <mesh ref={wire}>
              <icosahedronGeometry args={[0.54, 1]} />
              <meshBasicMaterial color="#FBBF24" wireframe transparent opacity={0.65} />
            </mesh>
          </group>
        </Float>
      </Orbital>
    </>
  );
}

// ─── Artifact 4: Gyroscope ───────────────────────────────────────
// Three concentric tori spinning on independent axes — a real-time
// monitoring loop. Each ring's axis is orthogonal to the others.
function Gyroscope({ glow }: { glow: number }) {
  const r1 = useRef<THREE.Mesh>(null!);
  const r2 = useRef<THREE.Mesh>(null!);
  const r3 = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    r1.current.rotation.x = t * 0.85;
    r2.current.rotation.y = t * 0.7;
    r2.current.rotation.z = t * 0.28;
    r3.current.rotation.x = -t * 1.1;
    r3.current.rotation.y = t * 0.46;
  });

  const shared = { metalness: 0.82, roughness: 0.14, transparent: true, opacity: 0.88 } as const;
  return (
    <>
      <OrbitPath radius={1.56} tiltX={-0.3} tiltZ={0.44} />
      <Orbital radius={1.56} speed={0.52} offset={Math.PI * 1.5} tiltX={-0.3} tiltZ={0.44}>
        <Float speed={3} floatIntensity={0.18} rotationIntensity={0}>
          <group>
            <mesh ref={r1}>
              <torusGeometry args={[0.53, 0.042, 14, 72]} />
              <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={0.5 + glow * 0.5} {...shared} />
            </mesh>
            <mesh ref={r2}>
              <torusGeometry args={[0.38, 0.032, 12, 56]} />
              <meshStandardMaterial color="#FBBF24" emissive="#FBBF24" emissiveIntensity={0.38 + glow * 0.42} {...shared} />
            </mesh>
            <mesh ref={r3}>
              <torusGeometry args={[0.23, 0.025, 10, 40]} />
              <meshStandardMaterial color="#D97706" emissive="#D97706" emissiveIntensity={0.28 + glow * 0.35} {...shared} />
            </mesh>
          </group>
        </Float>
      </Orbital>
    </>
  );
}

// ─── Forge Core ──────────────────────────────────────────────────
// The origin point that everything orbits. Pulses with sentiment.
function ForgeCore({ intensity }: { intensity: number }) {
  const mesh = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    const pulse = 1 + Math.sin(clock.elapsedTime * 2.6) * 0.14;
    mesh.current.scale.setScalar(pulse * (0.85 + intensity * 0.22));
  });
  return (
    <group>
      <mesh ref={mesh}>
        <sphereGeometry args={[0.1, 32, 32]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#F59E0B" emissiveIntensity={2.5 + intensity * 2.5} roughness={1} metalness={0} />
      </mesh>
      {/* Primary warm key light */}
      <pointLight color="#F59E0B" intensity={4 + intensity * 5} distance={8} decay={2} />
      {/* Cool fill from above */}
      <pointLight color="#FDE68A" intensity={0.8} distance={5} decay={2.5} position={[0, 2.5, 0.5]} />
    </group>
  );
}

// ─── Scene wrapper ───────────────────────────────────────────────
function Scene({ intensity }: { intensity: number }) {
  return (
    <>
      <ambientLight intensity={0.05} />
      <ForgeCore intensity={intensity} />
      <SignalWeave glow={intensity} />
      <MarketBoard glow={intensity} />
      <DataCrystal glow={intensity} />
      <Gyroscope glow={intensity} />
      <Sparkles
        count={90}
        size={0.55}
        speed={0.12}
        opacity={0.22}
        color="#F59E0B"
        scale={8}
        noise={0.4}
      />
    </>
  );
}

// ─── Export ──────────────────────────────────────────────────────
export function ForgeScene({ intensity = 0.5 }: { intensity?: number }) {
  return (
    <Canvas
      camera={{ position: [0, 1.6, 5.8], fov: 46 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
      dpr={[1, 2]}
    >
      <Suspense fallback={null}>
        <Scene intensity={intensity} />
      </Suspense>
    </Canvas>
  );
}
