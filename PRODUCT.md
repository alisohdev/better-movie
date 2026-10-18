# Movie discovery product context

## Platform

Web. Mobile-first, with Persian RTL and English LTR interfaces. Internal documentation and code comments are in English.

## Product and audience

Movie enthusiasts in Iran choosing international or Iranian films without a title in mind. The core task is narrowing choices with understandable constraints, then opening a lightweight movie detail page. See `docs/product/mvp.md` for scope and `docs/engineering/plan.md` for the current slice.

## Confirmed constraints

Go API, Astro public HTML, React discovery island, PostgreSQL, pgx, sqlc, TypeScript, Tailwind, and TanStack Query. Initial infrastructure costs must remain $0. Use only owned synthetic data and artwork until real-data rights are established. No provider integration, video, AI, accounts, billing, or external model providers.

## Visual commitments and open assumptions

The explicit brief calls for a cinematic, modern, quiet consumer interface with readable filters and fast mobile interactions. No existing brand, logo, or asset library is supplied. Frame is a reversible working name, not a confirmed brand. A dark blue reading surface, warm paper text, and sharply differentiated original poster artwork are implementation assumptions. Controls, source explanations, and unknown states must remain legible and accessible.

## Performance and trust

See `docs/engineering/performance.md`. Responsive controls, bounded caches, intentional prefetch, stable layout, graceful network failures, and correct Back behavior are part of the first slice. Synthetic catalog labels and uncertain release claims must stay explicit.
