# Credits & Licenses

## 3D Assets

### Sports Coupe (`public/models/CarConcept.glb`, `public/thumbnails/coupe.svg`)
- **Source:** [KhronosGroup/glTF-Sample-Assets — CarConcept](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept) (`glTF-WEBP` variant packed into single Draco-compressed `.glb` via `@gltf-transform/cli`)
- **Author & Optimization:** Eric Chadwick / Darmstadt Graphics Group GmbH (2024), derived from a CC0 public domain 3D model by *Unity Fan*
- **License:** [Creative Commons Attribution 4.0 International (CC-BY-4.0)](https://creativecommons.org/licenses/by/4.0/legalcode)
- **Notice:** Khronos trademarks/logos remain subject to Khronos trademark guidelines and are excluded from the CC-BY-4.0 license. Coupe outline SVG thumbnail (`public/thumbnails/coupe.svg`) authored for HowCarsWork (CC0-1.0).

### BMW M8 Competition (`public/models/bmw-m8.glb`)
- **Source:** [Sketchfab — Free Hyper-Realistic Model of BMW M8 Competition](https://sketchfab.com/3d-models/free-hyper-realistic-model-of-bmw-m8-competition-12dd4e73b65245e0b755343d33df6360) (normalized, welded, simplified, WebP-compressed & Draco-packed via `scripts/import-car.mjs`)
- **Author:** [rohaanwaqas05](https://sketchfab.com/rohaanwaqas05)
- **License:** [Creative Commons Attribution 4.0 International (CC-BY-4.0)](https://creativecommons.org/licenses/by/4.0/)

### Alpine A390 (`public/models/alpine-a390.glb`)
- **Source:** [Sketchfab — Alpine A390](https://sketchfab.com/3d-models/alpine-a390-98fbad54b9984a078dc9b21f64746a9e) (normalized, welded, simplified & Draco-packed via `scripts/import-car.mjs`)
- **Author:** [GARAGISTA](https://sketchfab.com/-garagista1753d1)
- **License:** [Creative Commons Attribution 4.0 International (CC-BY-4.0)](https://creativecommons.org/licenses/by/4.0/)

### Sedan, SUV, Hatchback & Electric Car (Stylized) (`public/models/Sedan.glb`, `SUV.glb`, `Hatchback.glb`, `EV.glb`)
- **Source & Generator:** Generated in-repo via [`scripts/build-car-models.mjs`](scripts/build-car-models.mjs) alongside matching vector outline thumbnails (`public/thumbnails/sedan.svg`, `suv.svg`, `hatchback.svg`, `ev.svg`).
- **Author:** HowCarsWork Procedural Studio
- **License:** [CC0-1.0 Universal (Public Domain Dedication)](https://creativecommons.org/publicdomain/zero/1.0/)

### Procedural System Models & Studio HDR (`src/models/systems/`, `src/models/rig/`, `src/models/compare/`, `public/env/studio_1k.hdr`)
- Custom procedural 3D mechanical cutaways (Petrol/Diesel 4-Stroke Engine, EV Electric Motor & Regenerative Braking Drive Unit, Transmission, Brakes, Suspension, Steering, Electrical/Battery, Cooling, Exhaust, and Petrol/Diesel/Electric drivetrains), mechanical rigs, and synthetic 1k equirectangular studio HDR environment authored specifically for **HowCarsWork** using Three.js geometries.

## Libraries & Decoders
- **Three.js** (MIT License) — 3D WebGL rendering, `GLTFLoader`, `DRACOLoader`, `HDRLoader`, `OrbitControls`, `LineSegments2` / `LineMaterial` outline passes, and Draco WASM decoder (`public/libs/draco/`).
- **@gltf-transform / meshoptimizer / draco3dgltf / sharp** (MIT / Apache-2.0) — Asset import normalization and compression pipeline.
- **GSAP** (Standard GreenSock License) — Camera flight transitions, exploded-view interpolation, and X-Ray transitions.
- **Google Fonts (`Inter` & `Space Grotesk`)** — SIL Open Font License (OFL-1.1).
- **Vite** & **TypeScript** — Build tooling and static type checking.
