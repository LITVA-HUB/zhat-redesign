# Design QA — ЖАТ

Source: `../design/hero-concept.png` (1487×1058), `programs-concept.png` (1487×1058), `life-concept.png` (1214×1295). User delegated visual choice; coordinator selected one coherent aviation editorial direction.

Browser: Codex In-app Browser. Desktop CSS viewports1280×920 and1440×1024, mobile390×844, DPR1. Evidence: `../design/desktop-latest.png`1280×920, `programs-latest.png`1440×1294, `life-latest.png`1440×1294, `mobile-latest.png`390×844, `mobile-programs.png`390×844, `mobile-admission.png`390×844. IAB sometimes returned a taller raster than the requested desktop viewport; compared content regions rather than claiming pixel-identical frames. Full-page stitching captured duplicates while smooth scrolling, so this artifact was rejected in favour of settled individual viewport captures. `../design/comparison.jpg` shows concept/render pairs. References and final images inspected with view_image.

## Fidelity surfaces

- Typography: Golos Text Variable, bold editorial Cyrillic headlines and clear smaller body/control text. Three-line hero retained. Larger program titles retain complete official names; no truncation.
- Layout: open white surface; pale utility strip; horizontal nav; full-width rounded hero; three audience shortcuts; three program columns; dark life band; three editorial news columns; sky contacts. Mobile collapses to single column and compact menu. No horizontal document overflow at390/1440.
- Palette: white/sky/ink/orange preserved. No extra gradients or hero tint on desktop. Mobile secondary CTA uses solidwhite to preserve contrast across aircraft image.
- Imagery: matching generated sky/aircraft, engine, code and electronics; WebP assets. Official logo and real source photographs replace imagined institution-specific visuals. Poster shown with contain to avoid cutting its content.
- Copy: main hero, nav, CTA, headings and three audience labels match selected concept. Facts independently verified against official pages. No invented admissions-open state, employment claims or backend.
- Icons: Phosphor uniform sizes/weights, functional arrow/eye/menu/close metaphors. Original institution emblem used rather than imitating the generated logo.

## Intentional differences

Original college logo; factual official news pictures and parentforum article replace fictional news imagery/unavailable meeting photos. Catalogue expanded from3 preview cards to11 source-listed specialties. Extraneous decorative asterisk, plane silhouettes and pseudo-handwriting omitted. Life headline wraps in3 lines to balance actual event photo. Footer includes both campuses and honest concept attribution. These are content/implementation decisions within user-delegated discretion.

## Fix history

1. Build: changed unsupported Phosphor Menu export to List. Production build passes.
2. Mobile secondary text link crossed aircraft wing: solid white pill fixes contrast; evidence mobile-latest.png.
3. Native dialog unmount lost keyboard focus: cleanup closes dialog and restores opener/fallback menu control. Escape retested; focus returned to header admission button.
4. Mobile eye control lost accessible name when its text was hidden: explicit aria-label added, contrast on/off retested successfully.
5. Added missing transportsecurity/law programs; full catalogue now11. Safetyfilter3, ITfilter4, transportfilter1, preview3 verified.

## Functional verification

IAB: mobile menu open and selection; student dialog displays schedule/material links; program detail displays correct09.02.11 paidfunding and3y10m; admission dialog has all3steps, actual2026dates, phone and source; parentlinks; expand/collapse catalogue; categoryfilters; nativeEsc/close/focusreturn; contrast toggles. All page images loaded. Browser warn/error log empty. Seven key official target links returnedHTTP200 (`../design/link-check.json`).

`npm run build` passed. `npm run test:sites`:4/4passed. No production publication, no actual admissions submission, no CMS synchronization. These are prototype boundaries, not working integrations.

final result: passed

## Public functionality expansion — 21 September 2026

- Imported navigation: 6 audience/section groups, 136 page entries, 133 successful source bodies. All menu targets resolve to a local page entry.
- Archived news: 3372 indexed titles, 30 per page, search and pagination; article bodies loaded on demand via allowlisted Node/Python API. Verified article 45 renders the 2018–19 scholarship story locally.
- Core content fetched per page, archive index and full-text search index fetched separately. No multi-megabyte archive HTML in the initial bundle.
- Browser QA: 390×844 and 1440×960; no document horizontal overflow on homepage, directory, teacher certification and documents. Mobile menu closes on selection; directory accordion opens; search finds scholarships; archive search finds a 2019 story, clearing returns 3372 entries; page 2/113 works. Contrast toggles and restores.
- No console warnings/errors in checked browser flows; homepage images load.
- Ten selected source document/schedule/form URLs return HTTP 200; forms were not submitted.
- Content API returns 200 for a real archived article, 404 for unlisted URLs and 405 for POST. Built Node server returns homepage, archive index and article API successfully.
- Automated: 5 Python content/sanitizer tests and 4 original worker tests pass. Production build passes.
- Evidence: ../design/mobile-2026-09-21/{home,sections,feedback}.png.
- Limitations: college CMS/auth/domain not connected; official documents and external forms remain at their providers. Public snapshots refresh at startup when stale or via refresh command. Two source 500 category pages have local child indexes; source rating page 404 has retry/source fallback. Full static-only hosting cannot serve the archive API; use documented Node server. Not every historical article or linked binary was individually fetched/tested.
