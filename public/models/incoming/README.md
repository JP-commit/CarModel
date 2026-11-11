# Incoming Realistic 3D Car Models

Place raw `.glb` vehicle models here temporarily and run:

```bash
npm run import-car -- public/models/incoming/your-car.glb --id sedan --powertrain petrol
```

The importer normalizes scale, orientation, and ground origin, detects/renames shell, glass, wheels (`FL`/`FR`/`RL`/`RR`), hood, and doors (falling back to world bounds when unlabelled), creates `Anchor_*` nodes, compresses textures to WebP and meshes with Draco/meshopt under 5 MB into `public/models/<id>.glb`, and prints a ready-to-use `cars.json` manifest block with `nodeMap`, `shell`, and `credits`.

> Remove raw incoming source files from `public/models/incoming/` after importing so `vite build` does not copy large uncompressed assets into `dist/`.

