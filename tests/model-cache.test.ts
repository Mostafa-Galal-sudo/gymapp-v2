import { expect, it, vi } from "vitest";
const loadAsync = vi.hoisted(() => vi.fn(async () => ({ scene: {} })));
vi.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class {
    loadAsync = loadAsync;
    setMeshoptDecoder() {
      return this;
    }
  },
}));
import { loadModel, getModel, modelSnapshot } from "../src/services/modelCache";
it("deduplicates concurrent model loads and reuses loaded resources", async () => {
  const [a, b] = await Promise.all([loadModel("body"), loadModel("body")]);
  expect(a).toBe(b);
  await loadModel("body");
  expect(loadAsync).toHaveBeenCalledTimes(1);
  expect(getModel("body")).toBe(a);
  expect(modelSnapshot().loaded).toContain("body");
});
