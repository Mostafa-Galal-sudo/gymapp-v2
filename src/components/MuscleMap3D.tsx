import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls, useGLTF, Html, Environment, Center } from '@react-three/drei';

const MUSCLES = [
  'abs', 'adductors', 'biceps', 'brachialis', 'calves', 'chest_lower',
  'chest_mid', 'chest_upper', 'forearms', 'glutes', 'hamstrings', 'lats',
  'lowerback', 'midback', 'obliques', 'quads', 'shoulders_front',
  'shoulders_rear', 'shoulders_side', 'traps', 'triceps', 'upperback'
];

export interface MuscleMap3DProps {
  workedMuscles?: string[];
  onMuscleClick?: (muscle: string) => void;
}

const BASE = window.location.origin;

function BodyModel() {
  const { scene } = useGLTF(`${BASE}/muscles/body.glb`);
  const clone = useMemo(() => {
    const c = scene.clone();
    c.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        if (!mesh.material) {
          mesh.material = new THREE.MeshStandardMaterial();
        } else {
          mesh.material = (mesh.material as THREE.Material).clone();
        }
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color.set('#d1d5db');
        mat.roughness = 0.6;
      }
    });
    return c;
  }, [scene]);

  return <primitive object={clone} />;
}

interface MuscleMeshProps {
  name: string;
  isWorked: boolean;
  isSelected: boolean;
  isHovered: boolean;
  onHover: (name: string | null) => void;
  onClick: (name: string) => void;
}

function MuscleMesh({ name, isWorked, isSelected, isHovered, onHover, onClick }: MuscleMeshProps) {
  const { scene } = useGLTF(`${BASE}/muscles/${name}.glb`);
  const clone = useMemo(() => {
    const c = scene.clone();
    c.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        if (!mesh.material) {
          mesh.material = new THREE.MeshStandardMaterial();
        } else {
          mesh.material = (mesh.material as THREE.Material).clone();
        }
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.polygonOffset = true;
        mat.polygonOffsetFactor = -1;
        mat.polygonOffsetUnits = -1;
        mat.roughness = 0.4;
      }
    });
    return c;
  }, [scene]);

  useEffect(() => {
    clone.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mat = (node as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (isSelected || isWorked) {
          mat.color.set('#ef4444');
          mat.transparent = false;
          mat.opacity = 1;
          mat.depthWrite = true;
        } else if (isHovered) {
          mat.color.set('#f97316');
          mat.transparent = false;
          mat.opacity = 1;
          mat.depthWrite = true;
        } else {
          mat.color.set('#d1d5db');
          mat.transparent = false;
          mat.opacity = 1;
          mat.depthWrite = true;
        }
        mat.needsUpdate = true;
      }
    });
  }, [clone, isWorked, isSelected, isHovered]);

  return (
    <primitive
      object={clone}
      onPointerOver={(e: any) => {
        e.stopPropagation();
        onHover(name);
      }}
      onPointerOut={(e: any) => {
        e.stopPropagation();
        onHover(null);
      }}
      onClick={(e: any) => {
        e.stopPropagation();
        onClick(name);
      }}
    />
  );
}

export function MuscleMap3D({ workedMuscles = [], onMuscleClick }: MuscleMap3DProps) {
  const [hoveredMuscle, setHoveredMuscle] = useState<string | null>(null);
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleClick = (name: string) => {
    setSelectedMuscle(name);
    if (onMuscleClick) {
      onMuscleClick(name);
    }
  };

  const formatMuscleName = (name: string) => {
    return name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%', cursor: hoveredMuscle ? 'pointer' : 'default' }}
      onPointerMove={handlePointerMove}
    >
      <Canvas
        style={{ width: '100%', height: '100%' }}
        camera={{ position: [0, 0, 1.5], fov: 75 }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 10, 5]} intensity={1.5} />
        <directionalLight position={[-5, 5, -5]} intensity={0.8} />
        <Environment preset="city" />

        <Suspense fallback={<Html center><div style={{ color: '#00F0FF', fontWeight: 600 }}>Loading...</div></Html>}>
          <Center>
            <group scale={10}>
              <BodyModel />
              {MUSCLES.map((muscle) => (
                <MuscleMesh
                  key={muscle}
                  name={muscle}
                  isWorked={workedMuscles.includes(muscle)}
                  isSelected={selectedMuscle === muscle}
                  isHovered={hoveredMuscle === muscle}
                  onHover={setHoveredMuscle}
                  onClick={handleClick}
                />
              ))}
            </group>
          </Center>
        </Suspense>

        <OrbitControls
          makeDefault
          target={[0, 0, 0]}
          enablePan={false}
          minDistance={0.5}
          maxDistance={8}
          enableZoom={true}
        />
      </Canvas>

      {hoveredMuscle && (
        <div
          className="fixed pointer-events-none z-50 bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-lg transform -translate-x-1/2 -translate-y-full transition-opacity duration-150"
          style={{
            left: mousePos.x,
            top: mousePos.y - 20
          }}
        >
          {formatMuscleName(hoveredMuscle)}
        </div>
      )}
    </div>
  );
}

export default MuscleMap3D;