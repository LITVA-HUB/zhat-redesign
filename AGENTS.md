# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## User direction — 2026-09-21
Preserve the current visual identity, implement the public functionality and sections of zhat.ru as fully as available, check the site, and show real mobile screenshots. Distinguish imported public content from integrations that need the college's administrative access. Never fake form submission or automatic live data.

## User direction — 2026-09-27
The replacement must preserve the site's public navigation and functions while adding a genuinely usable publishing system. Photos show Joomla 3.10.12 with article/category, menu, media, user, module and extension managers. Design daily editing around clear Russian actions for nontechnical staff: news, pages, menu, files, draft, preview and publish. Keep the old site's closed data and third-party integrations distinct from public information that has actually been imported; do not claim a completed Joomla database migration without an export or server access.

## User direction — 2026-09-27, admin and programs
Make the admin panel feel mature while remaining easy for nontechnical staff. Include practical control over program cards and the public homepage contacts, with clear navigation, saved-state feedback and role boundaries. Each of the 11 specialties needs its own realistic image; conceptual generated imagery must not be described as a documentary photo of college facilities.

## User direction — 2026-09-27, block editing
Staff should manage the public site by clear, understandable blocks from the admin panel. Keep homepage text, images, visibility and order editable without code, while news, pages, programs, menu and contacts remain dedicated editors. Support a real preview, protect concurrent edits and preserve unfinished local changes.
