# FLL Schedule Extractor

A browser-based tool for extracting robot-game schedules from event ZIP files or individual PDFs and exporting the results as CSV. Files are processed locally in your browser and are not uploaded.

## Run locally

```sh
npm ci
npm run dev
```

Run the test suite with `npm test` and create a production build with `npm run build`.

## Deployment

The `Deploy to GitHub Pages` workflow runs on pushes to `main` and can also be started manually. It tests and builds the app, then deploys it to [GitHub Pages](https://tcflanag.github.io/fll_schedule_converter/).
