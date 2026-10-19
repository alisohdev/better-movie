import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.doUnmock('../lib/model'); vi.resetModules(); });

describe('advanced score source labels', () => {
  for (const real of [false, true]) for (const locale of ['en', 'fa'] as const) {
    it(`${real ? 'TMDB' : 'synthetic'} mode uses the correct ${locale} source in controls and chips`, async () => {
      vi.resetModules();
      vi.doMock('../lib/model', async () => ({
        ...await vi.importActual<typeof import('../lib/model')>('../lib/model'), IS_TMDB: real,
      }));
      const { AdvancedFilters, AdvancedChips } = await import('./AdvancedFilters');
      const { defaultFilters } = await import('../lib/filters');
      const filters = { ...defaultFilters(), ratingMin: 7 };
      const props = { filters, locale, genres: [], onApply: () => {} };
      const controls = renderToStaticMarkup(createElement(AdvancedFilters, props));
      const chips = renderToStaticMarkup(createElement(AdvancedChips, props));
      if (real) {
        expect(controls).toContain(locale === 'en' ? 'TMDB community scores' : 'امتیازهای کاربران TMDB');
        expect(controls).toContain(locale === 'en'
          ? 'TMDB community ratings. No minimum vote count is applied unless you set one.'
          : 'امتیازهای کاربران TMDB. حداقل تعداد رأی تنها با انتخاب شما اعمال می‌شود.');
        expect(chips).toContain(locale === 'en' ? 'TMDB score' : 'امتیاز TMDB');
        expect(controls + chips).not.toMatch(/fictional|Fictional|خیالی|ساختگی/);
      } else {
        expect(controls).toContain(locale === 'en' ? 'Fictional scores' : 'امتیازهای خیالی');
        expect(controls).toContain(locale === 'en'
          ? 'Synthetic fictional scores, not real TMDB or IMDb ratings. No minimum vote count is applied unless you set one.'
          : 'امتیازها ساختگی و خیالی‌اند، نه امتیاز واقعی TMDB یا IMDb. حداقل تعداد رأی تنها با انتخاب شما اعمال می‌شود.');
        expect(chips).toContain(locale === 'en' ? 'Fictional score' : 'امتیاز خیالی');
      }
    });
  }
});
