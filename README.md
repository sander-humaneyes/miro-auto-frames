# Shrink frame to content

Shrink frame to content is a Miro Web SDK app that shrinks selected frames so they tightly fit the items already inside them.

It is built as a static instant app, so it only uses the Miro Web SDK and doesn't require OAuth redirect URLs.

## What it does

- Opens from the Miro app toolbar.
- Watches the current board selection.
- Shrinks one or more selected frames to their contents with configurable padding.
- Preserves the absolute on-board positions of child items while the frame is resized around them.

## Project structure

- `public/index.html`: headless app entrypoint used by Miro.
- `public/panel.html`: the panel UI users interact with.
- `public/auto-frames.js`: the fitting logic shared by the panel.
- `miro/app-manifest.local.yaml`: manifest for local development.
- `miro/app-manifest.github-pages.yaml`: manifest template for GitHub Pages hosting.
- `.github/workflows/deploy-pages.yml`: deploys the `public/` directory to GitHub Pages.

## Run locally

1. Start a local static server from the repository root:

   ```bash
   python3 -m http.server 3000 --directory public
   ```

2. In Miro, create a new app named `Shrink frame to content`.
3. Open the app settings, choose **Edit in Manifest**, and paste in [`miro/app-manifest.local.yaml`](/Users/sandervandamme/Documents/GitHub/miro-auto-frames/miro/app-manifest.local.yaml).
4. Install the app to your developer team.
5. Open a board, run the app from the toolbar, select one or more frames, and click **Shrink**.

## Run local checks

```bash
node --test tests/auto-frames.test.js
```

## Host on GitHub Pages

1. Push this repository to GitHub.
2. In GitHub Pages settings, make sure the site is deployed with GitHub Actions.
3. Let the workflow in [`.github/workflows/deploy-pages.yml`](/Users/sandervandamme/Documents/GitHub/miro-auto-frames/.github/workflows/deploy-pages.yml) run once.
4. Copy the published Pages URL, which will look like:

   ```text
   https://YOUR-DOMAIN/YOUR-REPOSITORY-NAME/
   ```

5. Replace the placeholder values in [`miro/app-manifest.github-pages.yaml`](/Users/sandervandamme/Documents/GitHub/miro-auto-frames/miro/app-manifest.github-pages.yaml):
   - `sdkUri` should point to `https://YOUR-DOMAIN/YOUR-REPOSITORY-NAME/index.html`
   - `boardPicker.allowedDomains` should contain only the domain part, for example `YOUR-DOMAIN`
6. Paste the updated manifest into the Miro app settings and save.

## Notes and limitations

- The app only resizes frames that are currently selected.
- Empty frames are skipped.
- If a frame contains child items whose bounds can't be measured reliably through the Web SDK, that frame is skipped instead of risking a broken parent-child layout.
- Miro enforces a minimum frame size of `100 x 100`, so very small selections will still stop at that minimum.
