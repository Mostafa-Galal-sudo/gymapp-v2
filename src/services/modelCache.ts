import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { Cache } from "three";
Cache.enabled = true;
export const MUSCLES = [
  "abs",
  "adductors",
  "biceps",
  "brachialis",
  "calves",
  "chest_lower",
  "chest_mid",
  "chest_upper",
  "forearms",
  "glutes",
  "hamstrings",
  "lats",
  "lowerback",
  "midback",
  "obliques",
  "quads",
  "shoulders_front",
  "shoulders_rear",
  "shoulders_side",
  "traps",
  "triceps",
  "upperback",
];
const common = ["chest_mid", "biceps", "quads", "lats"];
const cache = new Map<string, GLTF>(),
  pending = new Map<string, Promise<GLTF>>(),
  listeners = new Set<() => void>();
let snapshot = { loaded: [] as string[], loading: "", error: "" },
  running: Promise<void> | undefined;
const publish = (update: Partial<typeof snapshot>) => {
  snapshot = { ...snapshot, ...update };
  listeners.forEach((fn) => fn());
};
export const subscribeModels = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const modelSnapshot = () => snapshot;
export const getModel = (name: string) => cache.get(name);
export function loadModel(name: string): Promise<GLTF> {
  if (cache.has(name)) return Promise.resolve(cache.get(name)!);
  if (pending.has(name)) return pending.get(name)!;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  publish({ loading: name, error: "" });
  const request = loader
    .loadAsync(`${import.meta.env.BASE_URL}muscles/${name}.glb`)
    .then((model) => {
      cache.set(name, model);
      publish({ loaded: [...cache.keys()], loading: "" });
      return model;
    })
    .catch((error) => {
      publish({ error: String(error), loading: "" });
      throw error;
    })
    .finally(() => pending.delete(name));
  pending.set(name, request);
  return request;
}
const idle = () =>
  new Promise<void>((resolve) => {
    if ("requestIdleCallback" in window)
      window.requestIdleCallback(() => resolve(), { timeout: 1500 });
    else setTimeout(resolve, 100);
  });
/** Single queue, one model at a time: body → common → remaining, yielding between parses.
 * Cache owns shared geometry/textures for this app session; clones dispose only their materials. */
export function preloadModels(includeRemaining = true): Promise<void> {
  if (running) return running;
  running = (async () => {
    await loadModel("body");
    for (const name of common) {
      await idle();
      await loadModel(name);
    }
    if (includeRemaining)
      for (const name of MUSCLES.filter((n) => !common.includes(n))) {
        await idle();
        if (document.hidden) break;
        await loadModel(name);
      }
  })().finally(() => {
    running = undefined;
  });
  return running;
}
