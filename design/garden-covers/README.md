# Meiqiu's Garden covers

Eight covers share the A4 portrait ratio, 210:297.

The [Chinese edition](zh-CN/README.md) keeps the same scene art and page ratio.

- `*.svg`: vector covers at 210 × 297 mm. Each file embeds Paper Mono.
- `*.png`: 1680 × 2376 px covers.
- `*-scene.svg`: the pixel scene used in each cover, without text.
- `manifest.json`: titles, colours and sequence numbers for the Paper boards.
- `overview.png`: all eight covers on one sheet. Open `index.html` for the gallery.

Run `pnpm garden:covers` to rebuild all covers. The script uses the live garden's
scene, weather, palette and sprite functions. It selects a fixed animation frame
and an illustrative moon phase. The website continues to use the real moon phase.

Paper uses editable text over the exported scene art. Covers have a taller sky
than the website banner so the complete garden fits the portrait composition.

Paper Mono uses the SIL Open Font License. See
[`PaperMono-OFL.txt`](../../src/assets/fonts/PaperMono-OFL.txt).
