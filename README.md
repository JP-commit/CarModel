# HowCarsWork

An interactive, beginner-friendly 3D web application that teaches how cars work—featuring a clean architectural **Outline Mode** technical drafting UI, a **Solid** material toggle, a data-driven 5-vehicle **Car Picker**, and powertrain-aware lessons covering **Petrol**, **Diesel**, and **Electric (EV)** vehicles.

## Features
- **Outline Drafting Studio & Solid Toggle:** Crisp feature-edge technical outlines (`EdgesGeometry` + `LineSegments2` + silhouette hull extrusion) with dashed hidden internal systems on a clean radial white paper backdrop (`#FFFFFF` → `#F6F6F3` → `#EDEDE9`), switchable anytime to **Solid** shaded materials (persisted in `localStorage`).
- **Data-Driven Car Model Picker (`?car=` & `localStorage`):** Switch between 5 vehicles defined in `public/cars.json`:
  1. **Sports Coupe** (`petrol`)
  2. **Sedan** (`petrol`)
  3. **SUV** (`diesel`) — compression-ignition engine copy & diesel quiz
  4. **Hatchback** (`petrol`)
  5. **Electric Car** (`ev`) — swaps to **Electric Motor**, **Single-Speed Reducer**, **Battery and Inverter**, **Battery Cooling**, removes **Exhaust** (7 systems total), and launches a dedicated **Electric Motor & Regenerative Braking** cutaway
- **Layer Toggles & Exploded View:** Independently toggle `Outline`, `Mesh`, and `Inner systems` visibility alongside X-Ray body shell and `0%–100%` Exploded View.
- **Interactive System Cutaways & Quizzes:** Every vehicle system opens an animated 3D cutaway (`Play/Pause`, `0.25×–2×` speed, `Exploded view`, `X-Ray Casing`, `Part Labels`, Part Inspector, and glossary tooltips) paired with a powertrain-specific 5-question quiz saved per vehicle powertrain.
- **Powertrain-Aware Guided Tour & Compare Mode:** Step-by-step narrated flow tour (`Fuel/Air/...` or 5-step `Battery → Cooling → Motor → Reducer → Regen` on EVs) plus synchronized side-by-side **Petrol vs. Diesel vs. Electric** 3D comparison panes.
- **Accessibility & Error Fallbacks:** Full keyboard navigation (`Tab`, `Arrow` keys inside rails/cards/grid, `Enter`, `Escape`, `+`/`-` zoom on focused canvas), `Reduce Motion` mode, mobile draggable bottom sheet, graceful model-load error card (`Retry` / `Load Default Car`), and interactive 2D WebGL fallback.

## Tech Stack
- **Vite** + **TypeScript**
- **Three.js** (`GLTFLoader`, `DRACOLoader`, `OrbitControls`, `LineSegments2`, `EdgesGeometry`, `RoomEnvironment`)
- **GSAP** (smooth camera flights, X-Ray fading, and panel transitions)
- **Plain CSS** (centralized design tokens in `src/styles/theme.css`)

## Prerequisites
- Node.js `>= 18` and `npm`

## Setup, Run & Build

```bash
# 1. Install dependencies
npm install

# 2. Regenerate procedural vehicle GLBs (optional, outputs Sedan/SUV/Hatchback/EV under public/models/)
node scripts/build-car-models.mjs

# 3. Start the development server
npm run dev

# 4. Typecheck without emitting files
npm run typecheck

# 5. Build the production bundle into dist/
npm run build

# 6. Preview the production build locally
npm run preview
```

## Folder Structure

```text
.
├── index.html                        # App shell, Google Fonts (Inter, Space Grotesk), canvas & UI roots
├── package.json                      # Scripts & dependencies (Vite, TypeScript, Three.js, GSAP)
├── vite.config.ts                    # Code-splitting & production build configuration
├── tsconfig.json                     # Strict TypeScript compiler options
├── CREDITS.md                        # 3D model licenses & attributions
├── scripts/
│   └── build-car-models.mjs          # Procedural GLB exporter for Sedan, SUV, Hatchback & EV
├── public/
│   ├── cars.json                     # Vehicle manifest (id, powertrain, cameras, system anchors/meshes)
│   ├── libs/draco/                   # Local Draco WASM/JS mesh decoders
│   ├── models/                       # Vehicle glTF/GLB assets (< 3 MB each)
│   └── thumbnails/                   # Outline SVG side-profile thumbnails for the Car Picker
└── src/
    ├── main.ts                       # App bootstrap, manifest loading, car switching & interaction loop
    ├── state/
    │   └── appState.ts               # Reactive store, ?car= / localStorage persistence
    ├── data/
    │   ├── cars.ts                   # Manifest loader, thumbnail preloading & Powertrain labels
    │   ├── systems.ts                # System metadata & getSystemMetadata(id, powertrain) overrides
    │   ├── lessons.ts                # Petrol, Diesel & EV lesson breakdowns + 5-question quizzes
    │   ├── tour.ts                   # Powertrain-adapted Guided Tour stop sequences
    │   ├── compare.ts                # Petrol vs. Diesel vs. Electric spec table
    │   └── glossary.ts               # Searchable automotive terminology drawer entries
    ├── scene/
    │   ├── SceneManager.ts           # Transparent MSAA WebGLRenderer, scissor panes, GPU disposal
    │   ├── LightingStage.ts          # Studio lighting, soft blurred contact shadow & ground hairline
    │   ├── OutlineBuilder.ts         # EdgesGeometry -> LineSegments2 & BackSide silhouette hulls
    │   ├── CameraRig.ts              # OrbitControls, setHomeCamera() & GSAP focus transitions
    │   └── LabelProjector.ts         # 3D-to-2D hotspot projection, backface hiding & edge flip
    ├── models/
    │   ├── CarLoader.ts              # Manifest car loader, nodeMap lookup, PBR normalizer, Outline/X-Ray
    │   ├── ProceduralHelpers.ts      # Extruded gears, coil springs, particle flow streams, part tagging
    │   ├── rig/
    │   │   ├── RigBuilder.ts         # Auto-fitted mechanical inner-system rigs from systems/*.ts
    │   │   ├── PartHighlight.ts      # Depth-tested Outline & Solid inverted-hull part highlights
    │   │   └── rigConfig.ts          # Anchor & target-size rig configurations per system
    │   ├── systems/
    │   │   ├── registry.ts           # Lazy per-system & EV drive cutaway loader
    │   │   ├── evDrive.ts            # EV Permanent-Magnet Motor & Regenerative Braking cutaway
    │   │   └── *.ts                  # Engine (petrol/diesel), Transmission, Brakes, Suspension, etc.
    │   └── compare/
    │       └── drivetrains.ts        # Synchronized Petrol/Diesel/Electric 3D comparison sub-scenes
    └── ui/
        ├── HeaderBar.ts              # Top bar, mode switcher, Car Picker button, Outline/Solid, HQ/LQ
        ├── CarPicker.ts              # Realistic / Stylized tabbed picker popover & mobile sheet
        ├── HomeOverlay.ts            # System rail, Isolation modes, Exploded bars, Paint & Credits triggers
        ├── LessonPanel.ts            # Cutaway lesson controls, phase pills & Part Inspector
        ├── TourOverlay.ts            # Step chain card & auto-play controls
        ├── CompareOverlay.ts         # Throttle slider, play/pause & comparison table/tabs
        ├── QuizModal.ts              # Powertrain-scoped 5-question quiz modal
        ├── GlossaryDrawer.ts         # Filterable terminology side drawer
        ├── CreditsModal.ts           # Open CC-BY & CC0 3D asset attribution modal
        └── WebGLFallback.ts          # Accessible 2D schematic fallback when WebGL is unavailable
```

## Isolation & Exploded Modes

- **With a system selected (`Exploded` + Isolation):**
  - **`Ghost` (default):** Dims shell and unrelated inner systems (~6% opacity, ghosted outlines at 20%), fading them out as the selected system explodes along its individual part vectors and refits the camera cleanly.
  - **`Isolate`:** Hides everything except the selected system's real mechanical rig parts.
  - **`All`:** Keeps the full vehicle and all inner systems visible alongside the selected system.
- **With no system selected:**
  - The bottom **Exploded** bar performs a manifest-driven whole-car explode using each vehicle's `shell` array (sliding doors, hood, roof, bumpers, glass, and wheels outward along their configured directions while slightly separating inner rigs).

## Importing & Adding Real glTF Cars

Drop raw `.glb` models into `public/models/incoming/` and run the automated normalizer/compressor:

```bash
npm run import-car -- public/models/incoming/my-car.glb --id sedan --name "Sedan" --powertrain petrol --body-type "4-Door Sedan"
```

The importer (`scripts/import-car.mjs` powered by `@gltf-transform`, `meshoptimizer`, `draco3dgltf`, and `sharp`):
- Normalizes scale (`4.25m` longest dimension), centers `X/Z`, rests `minY = 0`, and auto-corrects upside-down or front/rear-flipped exports (`--flip-front` to override).
- Detects and standardizes `BodyShell_*`, `Glass_*`, `BodyHood`, `BodyDoorL_*`/`BodyDoorR_*`, and `WheelFrontL`/`R`, `WheelRearL`/`R` pivots, plus inserts standardized `Anchor_*` nodes.
- Compresses geometry and WebP textures under `5 MB` and prints a manifest preview + report of any missing separable parts (noting limited whole-car explode if wheels/hood/doors are merged).
- Use `node scripts/build-car-models.mjs` to regenerate only the lightweight procedural stylized fleet (`Sedan.glb`, `SUV.glb`, `Hatchback.glb`, `EV.glb`).

## Vehicle Manifest Fields (`public/cars.json`)

Each entry in `public/cars.json` supports:
- `style`: `'realistic' | 'stylized'` — determines which tab in `CarPicker` lists the vehicle (`Realistic` defaults first; `Stylized` holds procedural vehicles).
- `quality`: `'full' | 'outline-only'` — `'outline-only'` disables the **Solid** toggle with a tooltip when a textured surface model is not yet available.
- `powertrain`: `'petrol' | 'diesel' | 'ev'` — selects active lesson copy, rig cutaways, quiz bank, and tour steps (omit `exhaust` in `systems` for EVs).
- `nodeMap`: `{ shell, glass, wheels: { fl, fr, rl, rr }, hood, doors }` — drives shell classification, Solid clearcoat paint / tinted glass / rubber / rim material normalization, and hood lift in `CarLoader.ts` without hardcoded node names.
- `shell`: `Array<{ nodeNames, direction, distance }>` — manifest-driven whole-car explode vectors and distances per exterior group.
- `credits`: `{ author, license, source }` — rendered automatically inside the in-app **Credits** attribution modal.

You can test deep-linking directly with `?car=<id>`.

## Theme Variables (`src/styles/theme.css`)

All colors, typography, spacing, radii, shadows, and easing tokens live in `src/styles/theme.css`:

- **Surfaces & Ink:** `--bg-radial`, `--bg-canvas` (`#f6f6f3`), `--bg-panel` (`#fffdf8`), `--bg-panel-muted` (`#f5f4ef`), `--bg-panel-hover` (`#eeece5`), `--ink` / `--text-primary` (`#1c1b19`), `--text-secondary` (`#5e584e`), `--text-muted` (`#787166`), `--border` (`#dcdcd8`), `--border-strong` (`#c4c2bb`)
- **Accent & Active State:** `--accent` (`#d93a1e`), `--accent-hover` (`#bf3016`), `--accent-ink` (`#ffffff`), `--accent-soft` (`rgba(217, 58, 30, 0.09)`), `--accent-border` (`#d93a1e`), `--accent-glow` (`rgba(217, 58, 30, 0.24)`), `--tag-dark-bg` (`#1c1b19`), `--tag-dark-ink` (`#ffffff`)
- **Typography:** `--font-sans` (`Inter`), `--font-display` (`Space Grotesk`), `--font-mono`
- **Spacing & Radii:** `--space-1`..`--space-6` (`4px`–`24px`), `--radius-sm` (`8px`), `--radius-md` (`12px`), `--radius-panel` / `--radius-lg` (`18px`), `--radius-pill` (`999px`)
- **Elevation & Motion:** `--shadow-panel`, `--shadow-dot`, `--shadow-tag`, `--focus-ring`, `--ease-ui` (`240ms`), `--ease-fast` (`180ms`), `--header-height` (`68px`), `--panel-width` (`352px`) (automatically switches transitions to `1ms linear` under `prefers-reduced-motion: reduce` or `[data-reduce-motion='true']`)

## License & Credits
See [CREDITS.md](CREDITS.md) for 3D model attributions (`CarConcept`, `BMW M8 Competition`, `Alpine A390` CC-BY-4.0, stylized procedural models CC0-1.0) and open-source library notices.
