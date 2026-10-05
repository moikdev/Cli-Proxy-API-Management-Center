import { describe, expect, test } from 'bun:test';
import type { TFunction } from 'i18next';
import { buildWindowsFromRateLimitHeaders } from '@/features/quota/providers/claude/data';

const t = ((key: string) => key) as TFunction;

const headers = (entries: Record<string, string>): Record<string, string[]> =>
  Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, [value]]));

describe('Claude rate-limit header windows', () => {
  test('converts 0–1 utilization fractions to the percent scale', () => {
    const windows = buildWindowsFromRateLimitHeaders(
      headers({
        'anthropic-ratelimit-unified-5h-utilization': '0.9',
        'anthropic-ratelimit-unified-5h-reset': '1791201600',
        'anthropic-ratelimit-unified-7d-utilization': '0.29',
        'anthropic-ratelimit-unified-7d-reset': '1791694800',
      }),
      t
    );

    expect(windows.map((w) => [w.id, w.usedPercent])).toEqual([
      ['five-hour', 90],
      ['seven-day', 29],
    ]);
    expect(windows[0].resetAtMs).toBe(1791201600 * 1000);
    expect(windows[1].resetAtMs).toBe(1791694800 * 1000);
  });

  test('treats a utilization of exactly 1 as fully used, not 1 percent', () => {
    const windows = buildWindowsFromRateLimitHeaders(
      headers({
        'anthropic-ratelimit-unified-5h-utilization': '1.0',
        'anthropic-ratelimit-unified-5h-reset': '1791201600',
      }),
      t
    );

    expect(windows).toHaveLength(1);
    expect(windows[0].usedPercent).toBe(100);
  });

  test('reads header names case-insensitively', () => {
    const windows = buildWindowsFromRateLimitHeaders(
      headers({
        'ANTHROPIC-RATELIMIT-UNIFIED-7D-UTILIZATION': '0.62',
        'Anthropic-Ratelimit-Unified-7d-Reset': '1791565200',
      }),
      t
    );

    expect(windows).toHaveLength(1);
    expect(windows[0].id).toBe('seven-day');
    expect(windows[0].usedPercent).toBe(62);
  });

  test('skips windows whose utilization is missing or invalid', () => {
    const windows = buildWindowsFromRateLimitHeaders(
      headers({
        'anthropic-ratelimit-unified-5h-utilization': 'not-a-number',
        'anthropic-ratelimit-unified-5h-reset': '1791201600',
        'anthropic-ratelimit-unified-7d-reset': '1791694800',
      }),
      t
    );

    expect(windows).toHaveLength(0);
  });
});
