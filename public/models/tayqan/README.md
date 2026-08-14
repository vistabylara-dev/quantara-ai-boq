# TAYQAN 3D model

**Source:** a Meshy AI export (`generator: meshy-scene` in the GLB metadata),
provided by the user. The original, unoptimized export (~80 MB — 1 mesh,
~1.04M vertices, 1 material, three 2048×2048 JPEG textures, **no skeleton, no
animation clips**) is kept locally only and is never committed here (see
`.gitignore`).

**Deployable asset:** `tayqan-web.glb` — the only file actually shipped to
the browser (`TAYQAN_MODEL_URL` in
`src/components/tayqan/tayqan-robot-3d.tsx`).

## No animations

The source model has no skeleton and no animation clips at all — confirmed
with `npx gltf-transform inspect`, which reports "No animations found." The
robot's idle motion is a small, code-driven bob/turn
(`src/components/tayqan/tayqan-robot-3d.tsx`), never a referenced clip name.
If a future model revision does add real clips, name them explicitly in the
model component rather than guessing.

## Optimization pipeline

Run from the repo root, with the original source copied to
`public/models/tayqan/tayqan.glb` (git-ignored):

```bash
# 1. Geometry: simplify to ~20% of vertices and apply meshopt compression.
npx gltf-transform optimize public/models/tayqan/tayqan.glb public/models/tayqan/tayqan-web.glb \
  --compress meshopt --meshopt-level high \
  --simplify true --simplify-ratio 0.20 --simplify-error 0.01 \
  --texture-compress false --instance false
```

```js
// 2. Textures: resized to 1024x1024 WebP via sharp directly (see below for why).
const { NodeIO } = require("@gltf-transform/core");
const { MeshoptDecoder, MeshoptEncoder } = require("meshoptimizer");
const { ALL_EXTENSIONS, EXTTextureWebP } = require("@gltf-transform/extensions");
const sharp = require("sharp");

(async () => {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
  const doc = await io.read("public/models/tayqan/tayqan-web.glb");
  doc.createExtension(EXTTextureWebP).setRequired(true);
  for (const tex of doc.getRoot().listTextures()) {
    const resized = await sharp(Buffer.from(tex.getImage()))
      .resize(1024, 1024, { fit: "fill" })
      .webp({ quality: 82 })
      .toBuffer();
    tex.setImage(resized);
    tex.setMimeType("image/webp");
  }
  await io.write("public/models/tayqan/tayqan-web.glb", doc);
})();
```

**Why step 2 isn't just `gltf-transform optimize --texture-compress webp`:**
the CLI's built-in texture-compress step crashes on this environment's
`sharp`/libvips build ("colourspace: parameter space not set") the moment it
touches this model's normal-map texture. Calling `sharp` directly on the
extracted image buffers (proven to work — same resize/webp call, no glTF
colorspace metadata involved) sidesteps it entirely. `EXTTextureWebP` is
registered explicitly so the output stays glTF-spec-valid (a bare
`image/webp` mimeType without the extension declaration fails
`gltf-transform validate`).

**Result:** 79.86 MB → 3.5 MB (well under the 15 MB target), 1.04M → ~240K
vertices, 3× 2048² JPEG → 3× 1024² WebP (~250 KB total). Verified with
`npx gltf-transform validate public/models/tayqan/tayqan-web.glb` — no
errors, no warnings.
