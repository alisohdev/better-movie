import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { groups, sample, sampleHash, template, validateSample, validateAudit, summarize, run } from '../../scripts/catalog-audit.mjs';

// All responses below are self-authored test data. They say nothing about the
// real sample's provider coverage. No fixture comes from a provider or API.
function filled(day = '2026-01-01') {
  const audit = template();
  audit.provider = 'SELF-AUTHORED TEST PROVIDER';
  audit.permissionRecord = 'SYNTHETIC TEST ONLY; no provider permission asserted';
  for (const [index, row] of audit.rows.entries()) {
    Object.assign(row, {
      sourceId: `synthetic-${index}`, sourceUrl: `https://audit.invalid/record/${index}`,
      checkedAt: `${day}T12:00:00Z`, retentionDeadline: '2026-12-31',
      identity: 'matched', identityNote: 'Synthetic title/year review; not a real film record', movieType: 'feature',
      originalLanguage: 'en', productionCountries: ['US'], rating: 8, voteCount: 100,
      persianTitleReview: 'accepted', posterRights: 'cleared', posterRightsRecord: 'synthetic-test-permission',
      unsupportedFileClaim: 'none', correctionMinutes: 0,
    });
    for (const field of Object.keys(row.fields)) row.fields[field] = 'usable';
    if (row.release) for (const source of ['provider', 'official']) row.release[source] = {
      country: 'US', type: 'digital', date: '2025-12-01', status: 'observed', sourceUrl: `https://audit.invalid/${source}/${index}`, checkedAt: row.checkedAt,
    };
  }
  return audit;
}
const report = (audit, previous = null) => summarize(audit, previous, '2026-01-10');

test('frozen sample is forty distinct films in five disjoint groups; twelve preselected releases', () => {
  assert.equal(sample.films.length, 40);
  assert.equal(sample.films.filter((film) => film.releaseCheck).length, 12);
  for (const group of groups) assert.equal(sample.films.filter((film) => film.group === group).length, 8);
  assert.equal(sampleHash, '5b1757318405f276b46e2370e45184840ff65bad1199e48c5cfeb53b0e90e62c');
  const copy = structuredClone(sample); copy.films[1] = structuredClone(copy.films[0]);
  assert.throws(() => validateSample(copy), /Duplicate/);
  copy.films[1].id = 'another-id';
  assert.throws(() => validateSample(copy), /duplicate title\/year/);
});

test('blank template produces NOT VERIFIED, zero observations and fixed denominators', () => {
  const result = report(template());
  assert.equal(result.evaluatedRows, 0);
  for (const criterion of Object.values(result.criteria)) {
    assert.equal(criterion.status, 'NOT VERIFIED'); assert.equal(criterion.count, 0);
  }
  assert.equal(result.criteria.core.total, 40); assert.equal(result.criteria.release.total, 12);
  assert.equal(result.recheck.status, 'NOT VERIFIED');
  assert.equal(result.ingestionAuthorization, 'NOT GRANTED BY THIS TOOL');
});

test('duplicate rows, changed groups/subset, missing rows, source collisions and sample drift fail', () => {
  for (const mutate of [
    (a) => a.rows.pop(),
    (a) => { a.rows[1] = structuredClone(a.rows[0]); },
    (a) => { a.rows[0].sampleId = 'not-in-sample'; },
    (a) => { a.rows[0].group = 'iranian'; },
    (a) => { a.rows[0].releaseCheck = false; },
    (a) => { a.rows[1].sourceId = a.rows[0].sourceId; },
    (a) => { a.sampleHash = 'edited-sample'; },
  ]) { const audit = filled(); mutate(audit); assert.throws(() => validateAudit(audit)); }
});

test('recorded observations require permission reference, provenance, retention and correct value states', () => {
  for (const mutate of [
    (a) => { a.permissionRecord = null; }, (a) => { a.provider = null; },
    (a) => { a.rows[0].sourceUrl = null; }, (a) => { a.rows[0].checkedAt = null; },
    (a) => { a.rows[0].retentionDeadline = null; }, (a) => { a.rows[0].retentionDeadline = '2025-01-01'; },
    (a) => { a.rows[0].sourceUrl = 'https://audit.invalid/x?api_key=example'; },
    (a) => { a.rows[0].sourceUrl = 'https://user:example@audit.invalid/x'; },
    (a) => { a.rows[0].fields.runtime = 'yes'; }, (a) => { delete a.rows[0].fields.year; },
    (a) => { a.rows[0].fields.extra = 'usable'; }, (a) => { a.rows[0].rating = null; },
    (a) => { a.rows[0].voteCount = -1; }, (a) => { a.rows[0].rating = 10.1; },
    (a) => { a.rows[0].movieType = 'series'; }, (a) => { a.rows[0].identityNote = ''; },
    (a) => { a.rows[0].posterRightsRecord = null; },
    (a) => { a.rows[0].checkedAt = '2026-02-30T12:00:00Z'; },
  ]) { const audit = filled(); mutate(audit); assert.throws(() => validateAudit(audit)); }
});

test('threshold boundaries retain unknowns and disallow unresolved remake ambiguity', () => {
  const audit = filled();
  audit.rows[0].identity = 'mismatch'; audit.rows[1].identity = 'mismatch';
  assert.equal(report(audit).criteria.identity.status, 'PASS');
  audit.rows[2].identity = 'mismatch';
  assert.equal(report(audit).criteria.identity.status, 'FAIL');
  audit.rows[2].identity = 'ambiguous';
  assert.deepEqual(report(audit).ambiguous, [audit.rows[2].sampleId]);
  audit.rows[0].identity = 'matched'; audit.rows[1].identity = 'matched';
  assert.equal(report(audit).criteria.identity.count, 39);
  assert.equal(report(audit).criteria.identity.status, 'FAIL');
});

test('36/40 core and language-country coverage also require six per group', () => {
  for (const field of ['runtime', 'originalLanguage']) {
    const audit = filled();
    for (let index = 0; index < 4; index++) {
      audit.rows[index].fields[field] = 'missing';
      if (field === 'originalLanguage') audit.rows[index].originalLanguage = null;
    }
    const key = field === 'runtime' ? 'core' : 'languageCountry';
    assert.equal(report(audit).criteria[key].count, 36);
    assert.equal(report(audit).criteria[key].status, 'FAIL');
    audit.rows[2].fields[field] = 'usable'; if (field === 'originalLanguage') audit.rows[2].originalLanguage = 'en';
    audit.rows[3].fields[field] = 'usable'; if (field === 'originalLanguage') audit.rows[3].originalLanguage = 'en';
    for (const index of [8, 9]) { audit.rows[index].fields[field] = 'missing'; if (field === 'originalLanguage') audit.rows[index].originalLanguage = null; }
    assert.equal(report(audit).criteria[key].count, 36);
    assert.equal(report(audit).criteria[key].status, 'PASS');
    audit.rows[16].fields[field] = 'missing'; if (field === 'originalLanguage') audit.rows[16].originalLanguage = null;
    assert.equal(report(audit).criteria[key].status, 'FAIL');
  }
});

test('Persian title requires review; synopsis fallback and zero ratings/votes are independent', () => {
  const audit = filled();
  for (let i = 0; i < 8; i++) audit.rows[i].persianTitleReview = 'rejected';
  assert.equal(report(audit).criteria.persianTitle.count, 32);
  assert.equal(report(audit).criteria.persianTitle.status, 'PASS');
  audit.rows[8].persianTitleReview = 'rejected';
  assert.equal(report(audit).criteria.persianTitle.status, 'FAIL');
  audit.rows[0].rating = 0; audit.rows[0].voteCount = 0;
  audit.rows[1].rating = null; audit.rows[1].fields.rating = 'missing';
  audit.rows[2].voteCount = null; audit.rows[2].fields.voteCount = 'missing';
  audit.rows[3].fields.synopsisFa = 'missing';
  assert.doesNotThrow(() => validateAudit(audit));
  assert.equal(report(audit).fieldStates.rating.missing, 1);
  assert.equal(report(audit).fieldStates.voteCount.missing, 1);
});

test('release comparison uses country/type/date, excludes schedules, and surfaces every disagreement', () => {
  const audit = filled();
  audit.rows[0].release.official.country = 'GB';
  audit.rows[1].release.official.type = 'physical';
  let result = report(audit);
  assert.equal(result.criteria.release.count, 10); assert.equal(result.criteria.release.status, 'PASS');
  assert.equal(result.releaseDisagreements.length, 2); // Numeric pass is NOT clearance to publish.
  audit.rows[2].release.official.date = '2025-12-02';
  assert.equal(report(audit).criteria.release.status, 'FAIL');
  audit.rows[2].release.official.status = 'scheduled'; audit.rows[2].release.official.date = '2026-02-01';
  result = report(audit); assert.equal(result.criteria.release.count, 9);
  assert.equal(result.criteria.release.status, 'NOT VERIFIED');
  audit.rows[2].release.official.status = 'observed';
  assert.throws(() => validateAudit(audit), /scheduled/);
  audit.rows[2].release.official.date = '2025-02-30';
  assert.throws(() => validateAudit(audit), /calendar/);
});

test('seven-day recheck records changes, disappearing offers, effort and expired retention', () => {
  const before = filled(), early = filled('2026-01-07'), after = filled('2026-01-08');
  assert.equal(report(early, before).recheck.status, 'NOT VERIFIED');
  assert.equal(report(after, before).recheck.status, 'PASS');
  const copiedRelease = filled('2026-01-08'); copiedRelease.rows[0].release = structuredClone(before.rows[0].release);
  assert.equal(report(copiedRelease, before).recheck.checkedAfterSevenDays, 39);
  after.rows[0].rating = 7; after.rows[0].correctionMinutes = 3;
  after.rows[0].release.official = { country: null, type: null, date: null, status: 'missing', sourceUrl: 'https://audit.invalid/removed', checkedAt: after.rows[0].checkedAt };
  after.rows[1].retentionDeadline = '2026-01-09';
  const result = report(after, before);
  assert.deepEqual(result.recheck.changedRows, [after.rows[0].sampleId]);
  assert.deepEqual(result.recheck.changedReleaseDates, [after.rows[0].sampleId]);
  assert.deepEqual(result.recheck.disappearingOffers, [after.rows[0].sampleId]);
  assert.equal(result.recheck.correctionMinutes, 3); assert.equal(result.expiredRows.length, 1);
  after.rows[2].correctionMinutes = null; assert.equal(report(after, before).recheck.status, 'NOT VERIFIED');
  after.rows[2].correctionMinutes = 0; after.rows[2].fields.runtime = 'unknown';
  assert.equal(report(after, before).recheck.checkedAfterSevenDays, 39);
  after.provider = 'OTHER'; assert.throws(() => report(after, before), /same provider/);
});

test('file claims are explicit blockers; numeric passes never grant ingestion permission', () => {
  const audit = filled(); audit.rows[0].unsupportedFileClaim = 'present';
  const result = report(audit);
  assert.deepEqual(result.unsupportedFileClaims, [audit.rows[0].sampleId]);
  assert.equal(result.ingestionAuthorization, 'NOT GRANTED BY THIS TOOL');
  assert.equal(result.recheck.status, 'NOT VERIFIED');
  assert.throws(() => summarize(audit, null, '2025-12-01'), /after report date/);
});

test('recheck ignores JSON property order but detects changed release countries and types', () => {
  const before = filled(), after = filled('2026-01-08');
  after.rows[0].fields = Object.fromEntries(Object.entries(after.rows[0].fields).reverse());
  assert.deepEqual(report(after, before).recheck.changedRows, []);
  after.rows[0].release.official.country = 'GB';
  assert.deepEqual(report(after, before).recheck.changedRows, [after.rows[0].sampleId]);
  assert.deepEqual(report(after, before).recheck.changedReleaseDates, []);
});

test('CLI generates a reproducible blank template, reports offline, and rejects malformed input', () => {
  const dir = mkdtempSync(join(tmpdir(), 'movie-audit-'));
  try {
    assert.deepEqual(run(['init']), template());
    const file = join(dir, 'private.json'); writeFileSync(file, JSON.stringify(run(['init'])));
    assert.equal(run(['report', file]).evaluatedRows, 0);
    writeFileSync(file, '{}');
    assert.throws(() => run(['report', file]), /frozen sample/);
    writeFileSync(file, 'not json');
    assert.throws(() => run(['report', file]), SyntaxError);
    assert.throws(() => run(['unknown']), /Usage/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
