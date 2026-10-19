# Movie discovery product context

## Platform

Web. Mobile-first, with Persian RTL and English LTR interfaces. Internal documentation and code comments are in English.

## Product and audience

Movie enthusiasts in Iran choosing international or Iranian films without a title in mind. The core task is narrowing choices with understandable constraints, then opening a lightweight movie detail page. See `docs/product/mvp.md` for scope and `docs/engineering/plan.md` for the current slice.

## Confirmed constraints

Go API, Astro public HTML, React discovery island, PostgreSQL, pgx, sqlc, TypeScript, Tailwind, and TanStack Query. Initial infrastructure costs must remain $0. TMDB is the selected real-film metadata provider. The owner declares a free, noncommercial project operated by an individual in Iran. Bounded integration development with self-authored test responses is authorized; live account eligibility, accepted terms, permitted retention and public real-data publication remain separate gates. The existing protected Preview continues using only 32 owned fictional films and original art. No video, Iranian provider-listing integration, AI, accounts, billing, or external model providers. See docs/engineering/tmdb-staging.md for private activation and rollback; no provider inquiry is required to write or test this code.

## Visual commitments and open assumptions

The explicit brief calls for a cinematic, modern, quiet consumer interface with readable filters and fast mobile interactions. No existing brand, logo, or asset library is supplied. Frame is a reversible working name, not a confirmed brand. A dark blue reading surface, warm paper text, and sharply differentiated original poster artwork are implementation assumptions. Controls, source explanations, and unknown states must remain legible and accessible.

## Performance and trust

See `docs/engineering/performance.md`. Responsive controls, bounded caches, intentional prefetch, stable layout, graceful network failures, and correct Back behavior are part of the first slice. Synthetic catalog labels and uncertain release claims must stay explicit.
