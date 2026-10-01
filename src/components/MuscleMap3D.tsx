import {
  memo,
  useState,
  useMemo,
  useEffect,
  useCallback,
  useSyncExternalStore,
  Component,
  type ReactNode,
} from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  MUSCLES,
  preloadModels,
  getModel,
  subscribeModels,
  modelSnapshot,
} from "../services/modelCache";
import { useLanguageStore } from "../store/useLanguageStore";
export interface MuscleMap3DProps {
  workedMuscles?: string[];
  onMuscleClick?: (muscle: string) => void;
}
const EMPTY: string[] = [];
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert">
        3D unavailable on this device / العرض ثلاثي الأبعاد غير متاح
      </p>
    ) : (
      this.props.children
    );
  }
}
const Model = memo(function Model({
  name,
  highlight,
  onClick,
}: {
  name: string;
  highlight: boolean;
  onClick: (name: string) => void;
}) {
  const scene = getModel(name)!.scene,
    invalidate = useThree((s) => s.invalidate);
  const { clone, materials } = useMemo(() => {
    const clone = scene.clone(true),
      materials: THREE.MeshStandardMaterial[] = [];
    clone.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        const create = (source: THREE.Material) => {
          const m = source.clone() as THREE.MeshStandardMaterial;
          m.color?.set("#cbd7de");
          m.roughness = 0.65;
          if (name !== "body") {
            m.polygonOffset = true;
            m.polygonOffsetFactor = -1;
            m.polygonOffsetUnits = -1;
          }
          materials.push(m);
          return m;
        };
        node.material = Array.isArray(node.material)
          ? node.material.map(create)
          : create(node.material);
      }
    });
    return { clone, materials };
  }, [scene, name]);
  useEffect(() => {
    materials.forEach((m) => m.color?.set(highlight ? "#edb582" : "#cbd7de"));
    invalidate();
  }, [materials, highlight, invalidate]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  const click = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (name !== "body") onClick(name);
    },
    [name, onClick],
  );
  return <primitive object={clone} dispose={null} onClick={click} />;
});
function Scene({
  loaded,
  selected,
  worked,
  onClick,
}: {
  loaded: string[];
  selected: string | null;
  worked: string[];
  onClick: (name: string) => void;
}) {
  const body = getModel("body");
  const transform = useMemo(() => {
    if (!body) return null;
    const box = new THREE.Box3().setFromObject(body.scene),
      size = box.getSize(new THREE.Vector3()),
      center = box.getCenter(new THREE.Vector3());
    return { scale: 2.6 / size.y, center };
  }, [body]);
  if (!transform) return null;
  return (
    <group scale={transform.scale}>
      <group
        position={[
          -transform.center.x,
          -transform.center.y,
          -transform.center.z,
        ]}
      >
        {loaded.map((name) => (
          <Model
            key={name}
            name={name}
            highlight={selected === name || worked.includes(name)}
            onClick={onClick}
          />
        ))}
      </group>
    </group>
  );
}
export function MuscleMap3D({
  workedMuscles = EMPTY,
  onMuscleClick,
}: MuscleMap3DProps) {
  const state = useSyncExternalStore(subscribeModels, modelSnapshot),
    [selected, setSelected] = useState<string | null>(null),
    ar = useLanguageStore((s) => s.lang) === "ar";
  useEffect(() => {
    void preloadModels().catch(() => undefined);
  }, []);
  const click = useCallback(
    (name: string) => {
      setSelected(name);
      onMuscleClick?.(name);
    },
    [onMuscleClick],
  );
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 320,
      }}
    >
      <SceneBoundary>
        <Canvas
          frameloop="demand"
          dpr={[1, 1.5]}
          gl={{ antialias: true, powerPreference: "low-power" }}
          camera={{ position: [0, 0, 3.2], fov: 50 }}
        >
          <ambientLight intensity={1.4} />
          <directionalLight position={[3, 4, 5]} intensity={2} />
          <directionalLight position={[-3, 2, -4]} intensity={1} />
          <Scene
            loaded={state.loaded}
            selected={selected}
            worked={workedMuscles}
            onClick={click}
          />
          <OrbitControls
            makeDefault
            enablePan={false}
            minDistance={1.8}
            maxDistance={5}
          />
        </Canvas>
      </SceneBoundary>
      {state.loaded.length < MUSCLES.length + 1 && (
        <div className="model-progress" role="status">
          <span>
            {ar ? "تحميل العضلات" : "Loading anatomy"} {state.loaded.length}/
            {MUSCLES.length + 1}
          </span>
          <progress max={MUSCLES.length + 1} value={state.loaded.length} />
          {state.error && (
            <button
              className="btn"
              onClick={() => void preloadModels().catch(() => undefined)}
            >
              {ar ? "إعادة المحاولة" : "Retry"}
            </button>
          )}
        </div>
      )}
      <div className="model-selector">
        <select
          aria-label={ar ? "اختر عضلة" : "Select muscle"}
          value={selected || ""}
          onChange={(e) => click(e.target.value)}
        >
          <option disabled value="">
            {ar ? "اختر عضلة أو اضغط عليها" : "Select or tap a muscle"}
          </option>
          {MUSCLES.map((name) => (
            <option value={name} key={name}>
              {name.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
export default MuscleMap3D;
