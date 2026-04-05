/**
 * Unit tests for site-pattern.js — matchSiteRule() and isBlacklisted() wrapper
 */

import { matchSiteRule, isBlacklisted } from '../../../src/utils/site-pattern.js';

// --- matchSiteRule() ---

describe('SitePattern', () => {
  it('matchSiteRule returns null for empty rules array', () => {
    expect(matchSiteRule([], 'https://youtube.com')).toBe(null);
  });

  it('matchSiteRule returns null for null/undefined rules', () => {
    expect(matchSiteRule(null, 'https://youtube.com')).toBe(null);
    expect(matchSiteRule(undefined, 'https://youtube.com')).toBe(null);
  });

  it('matchSiteRule matches domain pattern', () => {
    const rules = [{ pattern: 'youtube.com', enabled: true, speed: 2.0 }];
    const match = matchSiteRule(rules, 'https://www.youtube.com/watch?v=123');
    expect(match).toBeDefined();
    expect(match.speed).toBe(2.0);
    expect(match.enabled).toBe(true);
  });

  it('matchSiteRule does not match unrelated domain', () => {
    const rules = [{ pattern: 'youtube.com', enabled: false, speed: null }];
    expect(matchSiteRule(rules, 'https://netflix.com')).toBe(null);
  });

  it('matchSiteRule returns first match (priority)', () => {
    const rules = [
      { pattern: 'youtube.com', enabled: true, speed: 1.5 },
      { pattern: 'youtube.com', enabled: false, speed: 2.0 },
    ];
    const match = matchSiteRule(rules, 'https://youtube.com/');
    expect(match.speed).toBe(1.5);
    expect(match.enabled).toBe(true);
  });

  it('matchSiteRule matches regex pattern with flags', () => {
    const rules = [{ pattern: '/(.+)youtube\\.com(\\/*)$/gi', enabled: false, speed: null }];
    const match = matchSiteRule(rules, 'https://www.youtube.com/');
    expect(match).toBeDefined();
    expect(match.enabled).toBe(false);
  });

  it('matchSiteRule matches regex pattern without flags', () => {
    const rules = [{ pattern: '/\\.edu$/', enabled: true, speed: 1.25 }];
    const match = matchSiteRule(rules, 'https://mit.edu');
    expect(match).toBeDefined();
    expect(match.speed).toBe(1.25);
  });

  it('matchSiteRule skips invalid regex gracefully', () => {
    const rules = [
      { pattern: '/[unclosed/', enabled: false, speed: null },
      { pattern: 'youtube.com', enabled: true, speed: 2.0 },
    ];
    const match = matchSiteRule(rules, 'https://youtube.com/');
    expect(match).toBeDefined();
    expect(match.speed).toBe(2.0);
  });

  it('matchSiteRule skips empty/null patterns', () => {
    const rules = [
      { pattern: '', enabled: false, speed: null },
      { pattern: null, enabled: false, speed: null },
      { pattern: 'youtube.com', enabled: true, speed: 1.5 },
    ];
    const match = matchSiteRule(rules, 'https://youtube.com/');
    expect(match.speed).toBe(1.5);
  });

  it('matchSiteRule domain boundary: x.com does not match netflix.com', () => {
    const rules = [{ pattern: 'x.com', enabled: false, speed: null }];
    expect(matchSiteRule(rules, 'https://netflix.com')).toBe(null);
  });

  it('matchSiteRule preserves all rule fields in result', () => {
    const rules = [{ pattern: 'example.com', enabled: true, speed: 1.75, extra: 'data' }];
    const match = matchSiteRule(rules, 'https://example.com/page');
    expect(match.pattern).toBe('example.com');
    expect(match.enabled).toBe(true);
    expect(match.speed).toBe(1.75);
    expect(match.extra).toBe('data');
  });

  // --- isBlacklisted() backward compat ---

  it('isBlacklisted still works with legacy string format', () => {
    expect(isBlacklisted('youtube.com\nnetflix.com', 'https://youtube.com/')).toBe(true);
    expect(isBlacklisted('youtube.com\nnetflix.com', 'https://netflix.com/')).toBe(true);
    expect(isBlacklisted('youtube.com\nnetflix.com', 'https://example.com/')).toBe(false);
  });

  it('isBlacklisted returns false for empty/null blacklist', () => {
    expect(isBlacklisted('', 'https://youtube.com/')).toBe(false);
    expect(isBlacklisted(null, 'https://youtube.com/')).toBe(false);
    expect(isBlacklisted(undefined, 'https://youtube.com/')).toBe(false);
  });
});
