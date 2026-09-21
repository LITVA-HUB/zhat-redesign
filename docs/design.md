# ЖАТ — новая главная

## Outcome and causal map

The current public homepage prioritizes a large institutional header, nested menus and banners. Students need a short path to schedule and resources; applicants need program discovery and admission information. Public source content → curated data.js → accessible interactive sections → official source links. Build a separate local React prototype; no access to or mutation of zhat.ru production. Existing domashka project is outside scope.

User delegated visual and implementation choices. Selected coordinated native ImageGen references: ../design/hero-concept.png, programs-concept.png and life-concept.png (relative to parent project). Use editorial aviation direction: white #fff, sky #e6f2fb, ink #14222d, orange #ff6337. Golos Text Variable 400–900; spacious open sections, large titles, restrained rounded media and pill CTAs. Phosphor icons with consistent regular/bold weights. Header utility bar, hero, three audience shortcuts, filterable program catalogue, dark student-life band, three editorial news articles, pale sky contacts and footer.

Above fold copy: ЖАТ / имени В. А. Казакова; О техникуме; Специальности; Студентам; Контакты; Как поступить; Твоё будущее набирает высоту.; Авиация, технологии и твои большие планы. Начни свой путь в техникуме имени В. А. Казакова.; Выбрать специальность; Знакомство с техникумом; Жуковский · Раменское; Хочу поступить; Я уже студент; Родителям. Utilities: official information, accessible version.

Assets: generated unbranded airplane/sky hero, engine, coding and circuit board. Actual photographs/poster from official site for editorial articles and life band. Do not represent generated people as actual students. The news-meeting source images return404, replace that article with verified parentforum article/photos. Preserve actual institutional logo. No decorative imagegen pseudo-handwriting or unnecessary asterisk.

Interactions: category filters update cards; show all expands catalogue; cards open native dialog with course length/funding and official source; admissions dialog links real admission office and document list; students/parents dialogs link actual official resources. Native dialog traps focus, Esc closes and focus restores. Header mobile menu, keyboard focus, reduced motion, contrast toggle. No fake application submission/backend/analytics.

Verification: npm run build; IAB desktop1440x1024 and mobile390x844; all filters, program/admission/student/parent dialogs, navigation menu, keyboard escape, contrast, links and image loading. Compare screenshots with reference using view_image; record purposeful deviations. Rollback: stop local server/remove standalone prototype folder; production remains unchanged.
