import * as T from "three";

/** A shallow folded sheet rendered over the painting by the same WebGL context. */
export function createPaperLift() {
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera();
  camera.position.z = 2000;
  camera.near = 0.1;
  camera.far = 4000;
  const geometry = new T.PlaneGeometry(1, 1, 72, 20);
  const source = geometry.attributes.position.array.slice();
  // Deterministic fine fibers; no downloaded texture or changes to source art.
  const fibers = new Uint8Array(128 * 128 * 4);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const i = (y * 128 + x) * 4;
    const value = 250 + ((x * 17 + y * 31 + (x * y % 13)) % 6);
    fibers[i] = fibers[i + 1] = fibers[i + 2] = value;
    fibers[i + 3] = 255;
  }
  const texture = new T.DataTexture(fibers, 128, 128);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  const material = new T.MeshStandardMaterial({ color: 0xf7f3e7, map: texture, bumpMap: texture, bumpScale: 0.08, roughness: 0.97, metalness: 0, side: T.FrontSide, toneMapped: false });
  const sheet = new T.Mesh(geometry, material);
  scene.add(sheet, new T.AmbientLight(0xffffff, 1.85));
  const light = new T.DirectionalLight(0xfff8ef, 0.9);
  light.position.set(-300, 500, 1000);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.camera.left = light.shadow.camera.bottom = -800;
  light.shadow.camera.right = light.shadow.camera.top = 800;
  light.shadow.camera.near = 1;
  light.shadow.camera.far = 3000;
  light.shadow.normalBias = 0.08;
  light.shadow.radius = 5;
  sheet.castShadow = true;
  const shadowGeometry = new T.PlaneGeometry(3000, 3000);
  const shadowMaterial = new T.ShadowMaterial({ opacity: 0.12, depthWrite: false });
  const shadow = new T.Mesh(shadowGeometry, shadowMaterial);
  shadow.receiveShadow = true;
  shadow.position.z = -18;
  scene.add(light, light.target, shadow);
  // A physical back sheet gives the paper a fine warm edge without touching the artwork.
  const backMaterial = new T.MeshStandardMaterial({ color: 0xe9ddc7, roughness: 1, side: T.BackSide, toneMapped: false });
  const back = new T.Mesh(geometry, backMaterial);
  back.position.z = -0.7;
  scene.add(back);
  let progress = 0;
  let open = false;
  let hovered = false;
  let ready = false;
  let origin = { x: 0, y: 0 };
  let onReady: (ready: boolean) => void = () => {};
  return {
    set(next: boolean, hover: boolean, callback: (ready: boolean) => void) {
      onReady = callback;
      hovered = hover;
      if (open !== next) {
        open = next;
        ready = false;
        onReady(false);
      }
    },
    draw(renderer: T.WebGLRenderer, dt: number, bounds: DOMRect, anchor: { x: number; y: number }, still: boolean) {
      if (!progress) origin = { ...anchor };
      const target = open ? 1 : 0;
      progress = still ? target : T.MathUtils.clamp(progress + (open ? dt / 1.22 : -dt / 0.68), 0, 1);
      if (!progress) return open;
      // Three overlapping gestures: release, unfold, then settle. The crease
      // timing differs on each side so this reads as a sheet, not a growing card.
      const smooth = (value: number) => {
        const t = T.MathUtils.clamp(value, 0, 1);
        return t * t * (3 - 2 * t);
      };
      const travel = smooth(progress / 0.88);
      const scale = smooth((progress - 0.08) / 0.8);
      const release = Math.sin(Math.PI * smooth(progress / 0.72));
      const settle = 1 - smooth((progress - 0.72) / 0.28);
      const width = Math.min(620, window.innerWidth - 32);
      const height = Math.min(640, window.innerHeight - 48);
      const cx = T.MathUtils.lerp(origin.x, window.innerWidth / 2 - bounds.left, travel);
      const cy = T.MathUtils.lerp(origin.y, window.innerHeight / 2 - bounds.top, travel)
        - Math.sin(Math.PI * travel) * Math.min(45, bounds.height * 0.05);
      const leftFold = (1 - smooth((progress - 0.12) / 0.64)) * 1.49;
      const rightFold = (1 - smooth((progress - 0.24) / 0.62)) * 1.49;
      const w = T.MathUtils.lerp(196, width, scale);
      const h = T.MathUtils.lerp(50, height, scale);
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = source[i * 3];
        const y = source[i * 3 + 1];
        const fold = x < 0 ? leftFold : rightFold;
        const wing = Math.max(0, Math.abs(x) - 1 / 6);
        const foldedX = Math.sign(x) * (Math.min(Math.abs(x), 1 / 6) + wing * Math.cos(fold));
        // A shallow bow disappears exactly at rest; crease relief remains tiny
        // enough that readable DOM content can take over without a visual jump.
        const bow = Math.sin(Math.PI * (x + 0.5)) * Math.sin(Math.PI * progress) * 14;
        const curl = Math.pow(Math.abs(y) * 2, 3) * Math.sin(Math.PI * progress) * 7;
        const crease = Math.exp(-Math.pow((Math.abs(x) - 1 / 6) / 0.014, 2)) * 0.23 * scale;
        positions.setXYZ(i, foldedX * w, y * h, wing * w * Math.sin(fold) + bow + curl + crease);
      }
      positions.needsUpdate = true;
      geometry.computeVertexNormals();
      const lift = release * 26 + (hovered && !still ? (1 - scale) * 5 : 0);
      sheet.position.set(cx, bounds.height - cy, lift);
      back.position.set(cx, bounds.height - cy, lift - 0.55);
      sheet.rotation.set(-0.16 * release, -0.11 * release, -0.12 * (1 - scale) + 0.035 * release * settle);
      back.rotation.copy(sheet.rotation);
      camera.left = 0; camera.right = bounds.width;
      camera.top = bounds.height; camera.bottom = 0;
      camera.updateProjectionMatrix();
      shadow.position.set(cx, bounds.height - cy, -18);
      // Tight shadow projection retains a soft but legible folded-paper shadow.
      light.shadow.camera.left = -width * 0.8;
      light.shadow.camera.right = width * 0.8;
      light.shadow.camera.top = height * 0.8;
      light.shadow.camera.bottom = -height * 0.8;
      light.shadow.camera.updateProjectionMatrix();
      light.position.set(cx - 300, bounds.height - cy + 500, 1000);
      light.target.position.set(cx, bounds.height - cy, 0);
      const shadows = renderer.shadowMap.enabled;
      renderer.shadowMap.enabled = true;
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(scene, camera);
      renderer.autoClear = autoClear;
      renderer.shadowMap.enabled = shadows;
      if (progress === 1 && !ready) { ready = true; onReady(true); }
      return progress !== target;
    },
    get active() { return open || progress > 0; },
    dispose() { geometry.dispose(); texture.dispose(); material.dispose(); backMaterial.dispose(); shadowGeometry.dispose(); shadowMaterial.dispose(); light.shadow.map?.dispose(); },
  };
}
