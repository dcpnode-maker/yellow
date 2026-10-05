/**
 * Curated adaptation of God's Eye View MapStackController (MIT, Bilawal Sidhu).
 * Upstream 759652207fd1279ece97f0f19af566feb9a82146, src/mapStackController.js.
 * Yellow changes: OSM-only allowlist, typed API, no credentials or external
 * terrain, bounded zoom, and explicit disposal across React view transitions.
 * The native Cesium imagery stack and generation-based async ownership remain.
 */
import {
  ImageryLayer, OpenStreetMapImageryProvider, EllipsoidTerrainProvider,
  type CesiumWidget,
} from "@cesium/engine";

export class MapStackController {
  private generation = 0;
  private disposed = false;
  private layer: ImageryLayer | null = null;
  private removeErrorListener: (() => void) | null = null;
  constructor(private readonly viewer: CesiumWidget, private readonly onError: () => void) {}

  async setStack(id: "osm"): Promise<void> {
    if (id !== "osm" || this.disposed || this.viewer.isDestroyed()) return;
    const generation = ++this.generation;
    const provider = new OpenStreetMapImageryProvider({
      url: "https://tile.openstreetmap.org/",
      credit: "© OpenStreetMap contributors",
      maximumLevel: 19,
    });
    // Keep the upstream async ownership boundary even for this synchronous source.
    await Promise.resolve();
    if (this.disposed || generation !== this.generation || this.viewer.isDestroyed()) return;
    this.removeErrorListener?.();
    this.removeErrorListener = provider.errorEvent.addEventListener(() => {
      if (!this.disposed && generation === this.generation) this.onError();
    });
    if (this.layer) this.viewer.imageryLayers.remove(this.layer, true);
    this.layer = new ImageryLayer(provider);
    this.viewer.imageryLayers.add(this.layer, 0);
    this.viewer.scene.globe.show = true;
    this.viewer.terrainProvider = new EllipsoidTerrainProvider();
    this.viewer.scene.requestRender();
  }

  dispose(): void {
    this.disposed = true;
    this.generation++;
    this.removeErrorListener?.();
    this.removeErrorListener = null;
    if (!this.viewer.isDestroyed() && this.layer) this.viewer.imageryLayers.remove(this.layer, true);
    this.layer = null;
  }
}
