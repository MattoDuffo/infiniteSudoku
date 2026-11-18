# Infinite Sudoku

An endless, ad-free sudoku web app built for the phone. It collects the best features of the top sudoku apps and leaves out their drawbacks.

**Play:** https://mattoduffo.github.io/infiniteSudoku/

## Install on iPhone
1. Open the link above in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Launch it from the home screen. It runs fullscreen and works offline.

## Features
- **Two ways to play:**
  - **Choose difficulty**: start any Easy, Medium, Hard or Expert game.
  - **Progressive mode**: an endless ladder of levels that slowly gets harder. Levels 1–6 are Easy, starting at about 42 clues and dropping to 32. Levels 7–14 are Medium and need more and more Medium techniques. Levels 15–22 are Hard and allow fewer and fewer clues. From level 23 it's Expert, needing more and more Expert techniques. Solve a level to unlock the next, and earn ★★★ with no hints or mistakes. The next level is prepared in the background while you play.
- **Endless puzzles**: every puzzle has exactly one solution and is rated by the hardest technique it needs (Easy, Medium, Hard, Expert), not by how many clues it has.
- **Teaching hints** in three steps: where to look, which technique applies, then the exact move with an explanation.
- **Daily puzzle**: a calendar of past days you can still play, plus a streak.
- **Input**: cell-first or digit-first, pencil notes, corner marks, colours, drag to select several cells, unlimited undo and redo, one-tap fill notes, notes removed automatically.
- **No lives, no mistake limit.** Mistake checking can be off, show conflicts, or show wrong digits instantly.
- Highlighting of the current row, column and box and of matching digits, a count of each digit left, and animations when you finish a row, column or box.
- Stats per difficulty with best and average times and streaks, plus a history of past games.
- Enter a puzzle from a newspaper, or share a puzzle as a link.
- Dark mode, haptic feedback, backup and restore.
- No account, no ads, no tracking. Everything stays on the device.

## Development
```
npm install
npm run dev      # local dev server
npm test         # engine + game tests
npm run build    # production build in dist/
```
Every push to `main` is tested and deployed to GitHub Pages by `.github/workflows/deploy.yml`.

### Layout
- `src/engine/`: the solver, the step-by-step human solver (also used for difficulty ratings and hints), and the generator.
- `src/worker.ts`, `src/generator-client.ts`: puzzles are generated in a background thread and kept ready in a small pool.
- `src/game.ts`: the game model (moves, notes, undo, hints).
- `src/store.ts`: saved settings, games, stats and the daily calendar.
- `src/ui/`: the screens, built with Preact.
