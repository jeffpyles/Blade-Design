# Blade Design

Tools and test methods for choosing steel, heat treatment and edge angle for durable cutting edges in knives, plane irons and other tools.

## Edge Stability Lab

`index.html` is a static web app for plane iron edge-stability testing. It needs no build step and runs on GitHub Pages or straight from a local checkout.

- **Charts**: sharpness (grams to cut monofilament) vs cumulative strokes or linear feet planed, across irons and edge angles, with min–max of each reading triplet, reference lines (razor blade), and a % change view. Run summary shows start, plateau, change and within-triplet noise.
- **Runs**: log a test run (iron, bed/bevel/microbevel angle, wood, use case, shaving thickness, stroke length, sharpness media, outcome) and its checkpoints (3 spot readings, media override, failure mode, chip count and size, microscope notes, photos).
- **Irons & steels**: irons with steel, hardness and Charpy estimate; reference steels for the Pareto chart; sharpness references.
- **Findings**: the toughness threshold map (steel/hardness × edge angle, with the minimum safe angle), a Charpy vs minimum safe angle chart, the hardness–toughness Pareto frontier with a toughness-constraint picker, and the written argument, observations, test plan and sources.
- **Data**: export/import JSON, export a flat readings CSV, reset to seed data.

Data lives in the browser's localStorage. Export JSON to back it up or move between devices. Photos are downscaled to 1200 px JPEG, but storage is still limited to about 5 MB per browser, so export regularly if you attach many.

The seed data (`js/seed.js`) is the first AEB-L (~64 HRc, ~11.8 ft-lbs) vs vintage Stanley run at a 45° bed, 20° bevel and ~0.006" shavings.

### Run locally

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

### Publish on GitHub Pages

Settings → Pages → Deploy from a branch → `main`, folder `/ (root)`.
