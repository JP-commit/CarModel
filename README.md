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
    │   ├── CarLoader.ts              # Manifest car loader, In-memory ArrayBuffer cache, Outline/X-Ray rig
    │   ├── ProceduralHelpers.ts      # Extruded gears, coil springs, particle flow streams, part tagging
    │   ├── systems/
    │   │   ├── registry.ts           # Lazy per-system & EV drive cutaway loader
    │   │   ├── evDrive.ts            # EV Permanent-Magnet Motor & Regenerative Braking cutaway
    │   │   └── *.ts                  # Engine (petrol/diesel), Transmission, Brakes, Suspension, etc.
    │   └── compare/
    │       └── drivetrains.ts        # Synchronized Petrol/Diesel/Electric 3D comparison sub-scenes
    ├── ui/
    │   ├── HeaderBar.ts              # Top bar, mode switcher, Car Picker button & Outline/Solid toggle
    │   ├── CarPicker.ts              # Keyboard-accessible vehicle grid popover / mobile bottom sheet
    │   ├── HomeOverlay.ts            # Dynamic system rail, mobile swipe sheet, layer toggles & hint
    │   ├── LessonPanel.ts            # Cutaway lesson controls, phase pills & Part Inspector
    │   ├── TourOverlay.ts            # Step chain card & auto-play controls
    │   ├── CompareOverlay.ts         # Throttle slider, play/pause & comparison table/tabs
    │   ├── QuizModal.ts              # Powertrain-scoped 5-question quiz modal
    │   ├── GlossaryDrawer.ts         # Filterable terminology side drawer
    │   └── WebGLFallback.ts          # Accessible 2D schematic fallback when WebGL is unavailable
    └── styles/
        ├── theme.css                 # Centralized design system CSS custom properties
        ├── layout.css                # Transparent header, rail, desktop side panels & mobile sheets
        └── components.css            # Picker popover, buttons, hotspots, modals & compare UI
```

## Adding a New Car

1. **Add assets:**
   - Place a Draco/meshopt-compressed or lightweight `.glb` file under `public/models/` (keep files under `~3 MB`).
   - Add an outline SVG side-profile thumbnail under `public/thumbnails/`.
2. **Author named anchors in the glTF (recommended):**
   - Create empty `Object3D` nodes matching `Anchor_engine`, `Anchor_transmission`, `Anchor_brakes`, `Anchor_suspension`, `Anchor_steering`, `Anchor_electrical`, `Anchor_cooling`, and (if ICE) `Anchor_exhaust`.
   - If any `anchorNode` is missing from the `.glb`, [`CarLoader.ts`](src/models/CarLoader.ts) logs a console warning and falls back to an approximate coordinate computed from the normalized body bounding box.
3. **Register the vehicle in `public/cars.json`:**
   ```json
   {
     "id": "wagon",
     "name": "Touring Wagon",
     "bodyType": "5-Door Estate",
     "powertrain": "petrol",
     "modelFile": "/models/Wagon.glb",
     "thumbnail": "/thumbnails/wagon.svg",
     "defaultCamera": {
       "position": [3.95, 1.95, 4.35],
       "target": [0, 0.58, 0],
       "mobilePosition": [7.8, 3.1, 8.7],
       "mobileTarget": [0, -0.16, 0]
     },
     "systems": {
       "engine": {
         "anchorNode": "Anchor_engine",
         "cameraTarget": [0, 0.05, 0],
         "cameraOffset": [1.55, 0.98, 1.45],
         "meshNames": ["BodyHood"]
       }
     }
   }
   ```
   - `powertrain`: `'petrol' | 'diesel' | 'ev'` controls which lesson copy, animations, quiz bank, and tour flow are active. Omit `exhaust` in `systems` for EVs (`systems` keys determine which rail icons and hotspots render).
   - You can test deep-linking directly with `?car=<id>`.
4. **Update credits:** Add source, author, and license details in `CREDITS.md`.

## Theme Variables (`src/styles/theme.css`)

All colors, typography, spacing, radii, shadows, and easing tokens live in `src/styles/theme.css`:

- **Surfaces & Ink:** `--bg-radial`, `--bg-canvas` (`#f6f6f3`), `--bg-panel` (`#fffdf8`), `--bg-panel-muted` (`#f5f4ef`), `--bg-panel-hover` (`#eeece5`), `--ink` / `--text-primary` (`#1c1b19`), `--text-secondary` (`#5e584e`), `--text-muted` (`#787166`), `--border` (`#dcdcd8`), `--border-strong` (`#c4c2bb`)
- **Accent & Active State:** `--accent` (`#d93a1e`), `--accent-hover` (`#bf3016`), `--accent-ink` (`#ffffff`), `--accent-soft` (`rgba(217, 58, 30, 0.09)`), `--accent-border` (`#d93a1e`), `--accent-glow` (`rgba(217, 58, 30, 0.24)`), `--tag-dark-bg` (`#1c1b19`), `--tag-dark-ink` (`#ffffff`)
- **Typography:** `--font-sans` (`Inter`), `--font-display` (`Space Grotesk`), `--font-mono`
- **Spacing & Radii:** `--space-1`..`--space-6` (`4px`–`24px`), `--radius-sm` (`8px`), `--radius-md` (`12px`), `--radius-panel` / `--radius-lg` (`18px`), `--radius-pill` (`999px`)
- **Elevation & Motion:** `--shadow-panel`, `--shadow-dot`, `--shadow-tag`, `--focus-ring`, `--ease-ui` (`240ms`), `--ease-fast` (`180ms`), `--header-height` (`68px`), `--panel-width` (`352px`) (automatically switches transitions to `1ms linear` under `prefers-reduced-motion: reduce` or `[data-reduce-motion='true']`)

## License & Credits
See [CREDITS.md](CREDITS.md) for 3D model attributions (`CarConcept` CC-BY-4.0, procedural models CC0-1.0) and open-source library notices.
# CarModel
