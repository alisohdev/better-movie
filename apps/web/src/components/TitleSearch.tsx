import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { copy, movieTitle, type Locale } from '../lib/model';
import { titleQuery } from '../lib/query-client';

export function TitleSearch({ locale }: { locale: Locale }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const [active, setActive] = useState(-1);
  const text = input.trim().replace(/\s+/gu, ' ');
  const valid = [...input].length <= 120 && !/[\p{Cc}\p{Cf}]/u.test(input.replace(/[\s\u200c]/gu, ''));
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text), 200);
    return () => clearTimeout(timer);
  }, [text]);
  const ready = open && valid && !!text && text === debounced && !composing;
  // Switching away from the previous key immediately aborts obsolete requests,
  // including while waiting for the next debounce. Never show placeholder data.
  const query = useQuery({ ...titleQuery(ready ? debounced : ''), enabled: ready });
  const items = ready && !query.isError ? query.data?.items ?? [] : [];
  const offline = query.fetchStatus === 'paused';
  const busy = !!text && valid && !offline && (!ready || query.isPending || query.isFetching);
  const expanded = open && !!text;
  const selected = items[active];
  useEffect(() => {
    if (selected) document.getElementById(`${id}-${selected.id}`)?.scrollIntoView({ block: 'nearest' });
  }, [id, selected]);
  const status = !valid ? copy(locale, 'Use up to 120 characters, without control characters.', 'حداکثر ۱۲۰ نویسه، بدون نویسه‌های کنترلی وارد کن.')
    : offline ? copy(locale, 'You’re offline. Reconnect to search titles.', 'اتصال قطع است. برای جست‌وجوی عنوان دوباره متصل شو.')
    : busy ? copy(locale, 'Looking up titles…', 'در حال جست‌وجوی عنوان‌ها…')
    : query.isError ? copy(locale, 'Title search is unavailable. Check your connection and try again.', 'جست‌وجوی عنوان در دسترس نیست. اتصال را بررسی و دوباره تلاش کن.')
    : items.length ? copy(locale, `${items.length} suggestions. Use arrow keys and Enter to open.`, `${items.length} پیشنهاد. با کلیدهای جهت و Enter انتخاب کن.`)
    : copy(locale, 'No matches in this small pilot catalog. Try another recorded title.', 'در این مجموعهٔ کوچک پیدا نشد. عنوان ثبت‌شدهٔ دیگری را امتحان کن.');

  return <section className="title-search" aria-label={copy(locale, 'Find a known film', 'پیدا کردن فیلم با عنوان')}>
    <label htmlFor={`${id}-input`}>{copy(locale, 'Have a title in mind?', 'عنوان فیلمی را می‌دانی؟')}</label>
    <p id={`${id}-hint`} className="title-search-hint">{copy(locale, 'Search English or Persian titles, independently of the filters below.', 'عنوان انگلیسی یا فارسی را مستقل از فیلترهای پایین جست‌وجو کن.')}</p>
    <div ref={root} className="title-search-control" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActive(-1); }
    }}>
      <div className="title-search-input">
        <span aria-hidden="true">⌕</span>
        <input id={`${id}-input`} role="combobox" type="search" maxLength={240} dir="auto" autoComplete="off" spellCheck={false}
          aria-label={copy(locale, 'Search movie titles', 'جست‌وجوی عنوان فیلم')}
          aria-describedby={`${id}-hint`} aria-autocomplete="list" aria-expanded={expanded}
          aria-controls={expanded ? `${id}-list` : undefined} aria-activedescendant={expanded && selected ? `${id}-${selected.id}` : undefined}
          placeholder={copy(locale, 'English or Persian title…', 'عنوان انگلیسی یا فارسی…')} value={input}
          onFocus={() => {
            setOpen(true);
            // Bring the input above its suggestions on narrow screens. This is
            // deliberate focus scrolling; the collection's layout stays stable.
            if (window.matchMedia('(max-width: 599px)').matches) root.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
          }} onChange={(event) => { setInput(event.target.value); setActive(-1); setOpen(true); }}
          onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || composing) return;
            if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setActive(-1); }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault(); setOpen(true);
              if (items.length) setActive(event.key === 'ArrowDown' ? (active + 1) % items.length : (active <= 0 ? items.length : active) - 1);
            }
            if (event.key === 'Enter' && expanded && items.length) {
              event.preventDefault();
              root.current?.querySelector<HTMLAnchorElement>(`[data-suggestion-index="${active < 0 ? 0 : active}"]`)?.click();
            }
          }} />
        {input ? <button type="button" className="title-search-clear" aria-label={copy(locale, 'Clear title search', 'پاک کردن جست‌وجوی عنوان')} onClick={() => { setInput(''); setActive(-1); root.current?.querySelector('input')?.focus(); }}>×</button> : null}
      </div>
      {expanded ? <div className="title-search-popup">
        <p className="title-search-status" role="status" aria-live="polite">{status}</p>
        <div role="listbox" id={`${id}-list`} aria-label={copy(locale, 'Title suggestions', 'پیشنهادهای عنوان')} aria-busy={busy}>
          {items.map((movie, index) => {
            const title = movieTitle(movie, locale);
            return <a key={movie.id} id={`${id}-${movie.id}`} role="option" aria-selected={active === index} tabIndex={-1}
              data-suggestion-index={index} data-movie-link href={`/${locale}/movies/${movie.id}/`} className="title-suggestion"
              onPointerMove={() => setActive(index)}>
              <span className="title-suggestion-text"><strong dir="auto">{title}</strong>{movie.originalTitle !== title ? <span dir="auto">{movie.originalTitle}</span> : null}</span>
              <bdi className="title-suggestion-year">{movie.year ?? copy(locale, 'Year unknown', 'سال نامشخص')}</bdi><svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M5 15 15 5M5 5h10v10" stroke="currentColor" strokeWidth="1.5" /></svg>
            </a>;
          })}
        </div>
        {ready && query.isError ? <button type="button" className="secondary-button" onClick={() => void query.refetch()}>{copy(locale, 'Retry title search', 'تلاش دوباره برای عنوان')}</button> : null}
      </div> : null}
    </div>
  </section>;
}
