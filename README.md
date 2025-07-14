# where-points

A Vite + React app to merge GPX/CSV cues and waypoints into a TCX for Garmin.

## Features

- Upload GPX route, optional POI GPX, and paste CSV cues
- Snap POIs/cues to nearest track point
- Merge and export a Garmin-compatible TCX
- Clean TailwindCSS UI

## Getting Started

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy to GitHub Pages

1. Set `base` in `vite.config.js` to your repo name:
   ```js
   export default defineConfig({ base: '/where-points/' })
   ```
2. Push to main branch.
3. Enable Pages in repo settings: `/docs` folder, or set up a deploy workflow.

## CSV Format

| Name       | Distance (KM) |
|------------|---------------|
| Resupply 1 | 23.5          |
| Hotel ABC  | 97.2          |

## License

MIT
