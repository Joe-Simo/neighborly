import * as T from "three";

/** A folded architectural shell. Broad plaster leaves open around a real oculus. */
export function createSanctuaryCanopy() {
  const group = new T.Group();
  group.position.set(0, 5.8, -5);
  const segments = 56;
  const across = 20;
  const geometries: T.BufferGeometry[] = [];
  const front = new T.MeshPhysicalMaterial({ color: "#e0d2b2", roughness: 0.56, metalness: 0.06, side: T.FrontSide, clearcoat: 0.16, clearcoatRoughness: 0.55 });
  const back = new T.MeshPhysicalMaterial({ color: "#4d6554", roughness: 0.64, metalness: 0.025, side: T.BackSide });
  const gold = new T.MeshStandardMaterial({ color: "#bca26a", roughness: 0.36, metalness: 0.7 });
  for (const surface of [front, back]) {
    surface.onBeforeCompile = (shader) => {
      shader.vertexShader = "varying vec2 canopyUv;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\ncanopyUv = uv;");
      shader.fragmentShader = "varying vec2 canopyUv;\n" + shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
        float edgeDistance = min(min(canopyUv.x, 1.0-canopyUv.x), min(canopyUv.y, 1.0-canopyUv.y));
        float gilding = 1.0-smoothstep(0.007, 0.016, edgeDistance);
        diffuseColor.rgb=mix(diffuseColor.rgb, vec3(0.58,0.40,0.16), gilding);`);
    };
    surface.customProgramCacheKey = () => "neighborly-folded-canopy-v1";
  }
  const leaves: Array<{ geometry: T.BufferGeometry; material: T.MeshPhysicalMaterial; phase: number }> = [];
  for (let leaf = 0; leaf < 12; leaf++) {
    const positions = new Float32Array((segments + 1) * (across + 1) * 3);
    const uv: number[] = [];
    const indices: number[] = [];
    for (let row = 0; row <= segments; row++) {
      for (let column = 0; column <= across; column++) {
        uv.push(row / segments, column / across);
        if (row < segments && column < across) {
          const n = row * (across + 1) + column;
          indices.push(n, n + 1, n + across + 1, n + 1, n + across + 2, n + across + 1);
        }
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometries.push(geometry);
    const leafGroup = new T.Group();
    leafGroup.rotation.y = leaf / 12 * Math.PI * 2;
    const face = new T.Mesh(geometry, front);
    face.castShadow = face.receiveShadow = true;
    const insideMaterial = leaf % 3 === 0 ? back.clone() : back;
    if (leaf % 3 === 0) insideMaterial.color.set("#68576a");
    const lining = new T.Mesh(geometry, insideMaterial);
    lining.castShadow = lining.receiveShadow = true;
    leafGroup.add(face, lining);
    group.add(leafGroup);
    leaves.push({ geometry, material: insideMaterial, phase: leaf % 3 * 0.018 });
  }
  const rimGeometry = new T.TorusGeometry(0.76, 0.035, 12, 96);
  const rim = new T.Mesh(rimGeometry, gold);
  rim.rotation.x = Math.PI / 2;
  rim.castShadow = true;
  group.add(rim);
  const coreGeometry = new T.CircleGeometry(0.7, 64);
  const coreMaterial = new T.MeshBasicMaterial({ color: "#fff1bb", side: T.DoubleSide, transparent: true, opacity: 0 });
  const core = new T.Mesh(coreGeometry, coreMaterial);
  core.rotation.x = Math.PI / 2;
  core.position.y = 0.06;
  group.add(core);
  let last = -1;
  const setOpen = (value: number) => {
    const open = T.MathUtils.clamp(value, 0, 1);
    if (Math.abs(last - open) < 0.00001) return;
    last = open;
    for (const leaf of leaves) {
      const progress = T.MathUtils.smoothstep(open, leaf.phase, 0.95);
      const position = leaf.geometry.attributes.position;
      for (let row = 0; row <= segments; row++) {
        const u = row / segments;
        // Elliptical shoulders make the end broad and rounded, not a star point.
        const lobe = Math.pow(Math.sin(Math.PI * u), 0.42);
        const closedRadius = 0.76 + Math.sin(Math.PI * u) * 0.86 - u * 0.5;
        const openRadius = 0.76 + u * 3.5;
        for (let column = 0; column <= across; column++) {
          const v = column / across * 2 - 1;
          const width = T.MathUtils.lerp(0.45, 1.06, progress) * lobe;
          const folded = Math.pow(Math.abs(v), 1.8) * 0.2 * lobe;
          const ridge = (1 - v * v) * 0.095 * Math.sin(Math.PI * u);
          const closedHeight = u * 3.3 - folded;
          const openHeight = Math.sin(Math.PI * u) * 0.84 + u * 0.24 + folded + ridge;
          const x = T.MathUtils.lerp(closedRadius, openRadius, progress);
          const y = T.MathUtils.lerp(closedHeight, openHeight, progress);
          position.setXYZ(row * (across + 1) + column, x, y, v * width);
        }
      }
      position.needsUpdate = true;
      leaf.geometry.computeVertexNormals();
      leaf.geometry.computeBoundingSphere();
    }
    rim.position.y = 0;
    coreMaterial.opacity = T.MathUtils.smoothstep(open, 0.3, 0.95) * 0.8;
    coreMaterial.color.setRGB(1 + open * 1.6, 0.86 + open * 1.2, 0.56 + open * 0.55);
  };
  setOpen(0);
  return {
    group,
    setOpen,
    dispose() {
      geometries.forEach((geometry) => geometry.dispose());
      const insideMaterials = new Set(leaves.map((leaf) => leaf.material));
      insideMaterials.forEach((surface) => surface.dispose());
      front.dispose();
      gold.dispose();
      rimGeometry.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
    },
  };
}
