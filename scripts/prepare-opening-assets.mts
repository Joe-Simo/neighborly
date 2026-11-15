// Run with glTF Transform available via NODE_PATH tooling or from its tool directory.
// Keeps the source GLB untouched; retained geometry and images are lossless; hand deformation tracks are removed.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
type AssetChannel = { getTargetNode(): unknown; getTargetPath(): string; getSampler(): { getOutput(): { getArray(): Float32Array; getElementSize(): number } | null } | null };
type AssetAnimation = { getName(): string; listChannels(): AssetChannel[] };
const require = createRequire(process.env.GLTF_TOOLS_PACKAGE ?? import.meta.url);
const { NodeIO } = await import(pathToFileURL(require.resolve('@gltf-transform/core')).href);
const { ALL_EXTENSIONS } = await import(pathToFileURL(require.resolve('@gltf-transform/extensions')).href);
const { prune } = await import(pathToFileURL(require.resolve('@gltf-transform/functions')).href);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const [variant, name] of [['desktop','BackgroundDesktop'],['mobile','BackgroundMobile'],['narrow','BackgroundNarrow']]) {
  const document = await io.read('public/assets/living-relief.glb');
  for (const node of document.getRoot().listNodes()) {
    if (node.getName().startsWith('Background') && node.getName() !== name) node.dispose();
  }
  // Freeze weighted hand joints at rest while preserving the guide animation.
  const rest = document.getRoot().listAnimations().find((animation: AssetAnimation) => animation.getName() === 'rest');
  for (const animation of document.getRoot().listAnimations()) {
    for (const channel of animation.listChannels()) {
      if (!['Donor', 'DonorPalm', 'Receiver', 'ReceiverPalm'].includes(channel.getTargetNode()?.getName() ?? '')) continue;
      const reference = rest?.listChannels().find((candidate: AssetChannel) => candidate.getTargetNode() === channel.getTargetNode() && candidate.getTargetPath() === channel.getTargetPath());
      const sampler = channel.getSampler();
      const output = sampler?.getOutput();
      const referenceOutput = reference?.getSampler()?.getOutput();
      if (!output || !referenceOutput) continue;
      const values = output.getArray();
      const referenceValues = referenceOutput.getArray();
      const size = output.getElementSize();
      const endpoint = referenceValues.slice(referenceValues.length - size);
      for (let offset = 0; offset < values.length; offset += size) values.set(endpoint, offset);
    }
  }
  await document.transform(prune({ keepLeaves: true, keepAttributes: true, keepIndices: true }));
  await io.write(`public/assets/living-relief-opening-${variant}.glb`, document);
}
