# Repository Guidelines

## Project Structure & Module Organization
Genki Study Resources is a static site. `index.html` is the entry for the 2nd edition; `lessons/` organizes 2nd edition exercises by lesson and exercise type; `lessons-3rd/` parallels it for the 3rd edition. Shared assets live under `resources/` (CSS in `resources/css/*.css`, JavaScript logic in `resources/javascript/` with `genki.js` powering quizzes and `study-tools.js` for custom builders, media in `audio/`, `images/`, and `fonts/`). Content pages such as `help/`, `donate/`, `report/`, and `privacy/` provide ancillary docs; adjust within each directory to keep routing intact. `.github/` holds community configuration, while `resources/notes/` and `resources/tools/` contain internal references and helper scripts.

## Build, Test, and Development Commands
No bundler is required; edit HTML, CSS, and JS directly. To preview locally, launch a static server from the repository root:
```bash
python3 -m http.server 4000
```
Then open `http://localhost:4000/index.html` (2nd edition) or `/lessons-3rd/index.html` (3rd edition). For quick smoke checks, you can also open the HTML files directly in a browser, but prefer the server to exercise relative paths, analytics guards, and audio loading.

## Coding Style & Naming Conventions
Match the existing two-space indentation used across HTML, CSS, and JavaScript. Follow the repository’s preference for single quotes in JS and the established attribute ordering in HTML head sections. Core logic lives on the global `Genki` object; expose new helpers as `Genki.fooBar` and keep related state under `Genki.stats` or `Genki.toggle` instead of introducing globals. File names stay lowercase with hyphens (`lesson-05/index.html`, `resources/javascript/kanji-canvas.js`). When adjusting minified assets, update the readable source alongside them.

## Testing Guidelines
There is no automated test suite; rely on manual verification. After modifying shared scripts, test representative exercises in both editions, ensuring drag-and-drop, multiple choice, and written inputs still function. Confirm localStorage-backed preferences (furigana, dark mode, timers) and audio playback where applicable. Document edge cases or browser-specific notes in your pull request.

## Commit & Pull Request Guidelines
Commit messages in this repository are short, imperative statements (e.g. `fix live checker`, `add dev readme`). Keep commits focused and describe what changed and why in the pull request body. Every PR should outline testing steps, list affected lessons or pages, and link related issues or discussions. Include before/after screenshots or screen recordings for UI tweaks, and mention any required asset regeneration so reviewers can reproduce the change set.
