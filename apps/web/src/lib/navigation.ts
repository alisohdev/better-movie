import { prefetch } from 'astro:prefetch';
import { z } from 'zod';

const storedSelection = z.object({ url: z.string(), scroll: z.number().nonnegative() }).strict();
const started = new Set<string>();
try {
  const previous = z.array(z.string()).max(2).safeParse(JSON.parse(sessionStorage.getItem('frame:document-intents') ?? '[]'));
  if (previous.success) for (const destination of previous.data) started.add(destination);
} catch { /* The in-memory bound remains when storage is unavailable. */ }
let queued: { link: HTMLAnchorElement; timer: ReturnType<typeof setTimeout> } | undefined;
let running = false;

function speculationAllowed() {
  if (!navigator.onLine) return false;
  if ('deviceMemory' in navigator && typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 2) return false;
  if ('connection' in navigator && typeof navigator.connection === 'object' && navigator.connection !== null) {
    const connection = navigator.connection;
    if ('saveData' in connection && connection.saveData === true) return false;
    if ('effectiveType' in connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g')) return false;
  }
  return true;
}

function movieLink(target: EventTarget | null) {
  const link = target instanceof Element ? target.closest('a[data-movie-link]') : null;
  return link instanceof HTMLAnchorElement ? link : null;
}

function cancelQueued(link?: HTMLAnchorElement) {
  if (queued && (!link || queued.link === link)) { clearTimeout(queued.timer); queued = undefined; }
}

function schedule(link: HTMLAnchorElement) {
  cancelQueued();
  if (running || started.size >= 2 || started.has(link.href) || !speculationAllowed()) return;
  queued = { link, timer: setTimeout(() => {
    queued = undefined;
    if (running || !speculationAllowed()) return;
    started.add(link.href);
    running = true;
    try { sessionStorage.setItem('frame:document-intents', JSON.stringify([...started])); } catch { /* Optional persistence. */ }
    // Astro returns no request handle. Cancel only queued work; observe link completion when available.
    prefetch(link.href);
    const hint = [...document.querySelectorAll('link[rel="prefetch"]')].find((element) => element instanceof HTMLLinkElement && element.href === link.href);
    if (hint) {
      const completed = () => { running = false; };
      hint.addEventListener('load', completed, { once: true });
      hint.addEventListener('error', completed, { once: true });
    }
    // WebKit uses Astro's unobservable fetch fallback; keep the one-start bound for that document.
  }, 140) };
}

export function rememberDiscovery() {
  const match = /^\/(en|fa)\/discover\/$/.exec(location.pathname);
  const locale = match?.[1];
  if (!locale) return;
  try {
    sessionStorage.setItem(`frame:selection:${locale}`, JSON.stringify({ url: location.pathname + location.search, scroll: window.scrollY }));
    history.replaceState({ ...history.state, frameScroll: window.scrollY }, '', location.href);
  } catch { /* Navigation remains available when session storage is disabled. */ }
}

export function restoreDiscovery(locale: string) {
  try {
    const result = storedSelection.safeParse(JSON.parse(sessionStorage.getItem(`frame:selection:${locale}`) ?? 'null'));
    const marker = sessionStorage.getItem('frame:restore');
    if (result.success && marker === result.data.url && result.data.url === location.pathname + location.search) {
      sessionStorage.removeItem('frame:restore');
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: result.data.scroll, behavior: 'instant' })));
    }
  } catch { /* Browser history still works without session storage. */ }
}

document.addEventListener('mouseover', (event) => {
  const link = movieLink(event.target);
  if (link && (!(event.relatedTarget instanceof Node) || !link.contains(event.relatedTarget))) schedule(link);
});
document.addEventListener('focusin', (event) => { const link = movieLink(event.target); if (link) schedule(link); });
document.addEventListener('mouseout', (event) => {
  const link = movieLink(event.target);
  if (link && (!(event.relatedTarget instanceof Node) || !link.contains(event.relatedTarget))) cancelQueued(link);
});
document.addEventListener('focusout', (event) => { const link = movieLink(event.target); if (link) cancelQueued(link); });
document.addEventListener('astro:before-preparation', (event) => {
  if (event.navigationType !== 'traverse') rememberDiscovery();
  cancelQueued();
});
window.addEventListener('pagehide', rememberDiscovery);

document.addEventListener('click', (event) => {
  const link = event.target instanceof Element ? event.target.closest('a') : null;
  if (!(link instanceof HTMLAnchorElement)) return;
  if (link.hasAttribute('data-locale-toggle') && location.pathname.includes('/discover/')) link.search = location.search;
  if (link.hasAttribute('data-movie-link')) rememberDiscovery();
  if (link.hasAttribute('data-return-discovery')) {
    try { sessionStorage.setItem('frame:restore', new URL(link.href).pathname + new URL(link.href).search); } catch { /* Optional scroll persistence. */ }
  }
}, true);

document.addEventListener('astro:page-load', () => {
  const link = document.querySelector('a[data-return-discovery]');
  if (!(link instanceof HTMLAnchorElement)) return;
  const locale = document.documentElement.lang;
  try {
    const result = storedSelection.safeParse(JSON.parse(sessionStorage.getItem(`frame:selection:${locale}`) ?? 'null'));
    if (result.success && result.data.url.startsWith(`/${locale}/discover/`) && !result.data.url.startsWith('//')) link.href = result.data.url;
  } catch { /* The static discovery link is a full-document fallback. */ }
});
