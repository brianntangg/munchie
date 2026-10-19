import { describe, expect, it } from '@jest/globals';
import { getHallStatus, hallStatus, parseHours, type WeekHours } from '../hours';

const week = (...shifts: [number, number][]): WeekHours => Array.from({ length: 7 }, () => shifts);
// 2026-10-14 is a Wednesday. Chicago is UTC-5 (CDT) in October, so 12:00Z is 7:00 AM there.
const at = (iso: string) => new Date(iso);

describe('getHallStatus', () => {
  const day = week([420, 1200]); // 7 AM - 8 PM

  it('is open at the moment of opening and closed at the moment of closing', () => {
    expect(getHallStatus(day, at('2026-10-14T12:00:00Z'))).toEqual({ open: true, label: 'Open until 8 PM' });
    expect(getHallStatus(day, at('2026-10-14T11:59:00Z'))).toEqual({ open: false, label: 'Closed · opens 7 AM' });
    expect(getHallStatus(day, at('2026-10-15T00:59:00Z'))?.open).toBe(true); // 7:59 PM
    expect(getHallStatus(day, at('2026-10-15T01:00:00Z'))).toEqual({ open: false, label: 'Closed · opens 7 AM tomorrow' }); // 8:00 PM
  });

  it('handles a split schedule', () => {
    const split = week([660, 840], [1020, 1260]);
    expect(getHallStatus(split, at('2026-10-14T20:00:00Z'))).toEqual({ open: false, label: 'Closed · opens 5 PM' }); // 3 PM
    expect(getHallStatus(split, at('2026-10-14T22:30:00Z'))?.open).toBe(true); // 5:30 PM
  });

  it('stays open past midnight when the close crosses it', () => {
    const late = week([420, 1470]); // 7 AM - 12:30 AM
    expect(getHallStatus(late, at('2026-10-15T05:29:00Z'))).toEqual({ open: true, label: 'Open until 12:30 AM' }); // 12:29 AM Thu
    expect(getHallStatus(late, at('2026-10-15T05:30:00Z'))?.open).toBe(false);
  });

  it('uses the campus time zone, not the device zone', () => {
    expect(getHallStatus(day, at('2026-10-14T12:00:00Z'), 'America/Chicago')?.open).toBe(true);
    expect(getHallStatus(day, at('2026-10-14T12:00:00Z'), 'Asia/Tokyo')?.open).toBe(false); // 9 PM
  });

  it('shows closed all day when a weekday has no shifts', () => {
    const noWed: WeekHours = [[[420, 1200]], [[420, 1200]], [[420, 1200]], [], [[420, 1200]], [[420, 1200]], [[420, 1200]]];
    expect(getHallStatus(noWed, at('2026-10-14T18:00:00Z'))).toEqual({ open: false, label: 'Closed · opens 7 AM tomorrow' });
  });

  describe('when it next opens after the last shift', () => {
    // Index 0 = Sunday. Pass the open days; every other day is closed.
    const openOn = (days: Record<number, [number, number][]>): WeekHours => Array.from({ length: 7 }, (_, d) => days[d] ?? []);

    it('says tomorrow when it opens the next day', () => {
      expect(getHallStatus(day, at('2026-10-15T02:00:00Z'))?.label).toBe('Closed · opens 7 AM tomorrow'); // Wed 9 PM
    });

    it('names the weekday when it stays closed tomorrow', () => {
      const hours = openOn({ 3: [[420, 1200]], 6: [[480, 1200]] }); // Wed and Sat
      expect(getHallStatus(hours, at('2026-10-15T02:00:00Z'))?.label).toBe('Closed · opens Sat 8 AM'); // Wed 9 PM
    });

    it('wraps around the week to the same weekday', () => {
      const hours = openOn({ 1: [[420, 1200]] }); // Mondays only
      expect(getHallStatus(hours, at('2026-10-20T02:00:00Z'))?.label).toBe('Closed · opens Mon 7 AM'); // Mon 9 PM
    });

    it("uses the next day's earliest shift, whatever order the shifts are in", () => {
      const hours = openOn({ 3: [[420, 1200]], 4: [[1020, 1260], [420, 600]] });
      expect(getHallStatus(hours, at('2026-10-15T02:00:00Z'))?.label).toBe('Closed · opens 7 AM tomorrow');
    });

    it('picks the soonest opening later today, whatever order the shifts are in', () => {
      const hours = openOn({ 3: [[1260, 1380], [1020, 1140]] }); // Wed 5 PM and 9 PM
      expect(getHallStatus(hours, at('2026-10-14T17:00:00Z'))?.label).toBe('Closed · opens 5 PM'); // Wed noon
    });

    it('just says Closed for a hall with no shifts all week', () => {
      expect(getHallStatus(openOn({}), at('2026-10-14T18:00:00Z'))).toEqual({ open: false, label: 'Closed' });
    });
  });

  it('returns null for a hall with no known hours', () => {
    expect(getHallStatus(undefined, new Date())).toBeNull();
  });
});

describe('parseHours', () => {
  const stored = (overrides: Record<string, unknown> = {}) => ({
    Sunday: [['08:00', '20:00']], Monday: [['07:00', '15:00']], Tuesday: [['07:00', '15:00']], Wednesday: [['07:00', '15:00']],
    Thursday: [['07:00', '15:00']], Friday: [['07:00', '15:00'], ['16:00', '20:00']], Saturday: [], ...overrides,
  });

  it('converts stored times to minutes, with Sunday first and a closed day empty', () => {
    const week = parseHours(stored())!;
    expect(week[0]).toEqual([[480, 1200]]);
    expect(week[5]).toEqual([[420, 900], [960, 1200]]);
    expect(week[6]).toEqual([]);
  });

  it('treats a close at or before the open as ending after midnight', () => {
    expect(parseHours(stored({ Friday: [['18:00', '00:30']] }))![5]).toEqual([[1080, 1470]]);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a missing day', { Monday: [] }],
    ['a bad time', stored({ Monday: [['7am', '3pm']] })],
    ['an out-of-range time', stored({ Monday: [['07:00', '25:00']] })],
    ['a shift missing its close', stored({ Monday: [['07:00']] })],
  ])('rejects %s', (_label, value) => {
    expect(parseHours(value)).toBeUndefined();
  });

  it('feeds hallStatus; unknown hours give no status', () => {
    expect(hallStatus(stored(), at('2026-10-14T12:00:00Z'))).toEqual({ open: true, label: 'Open until 3 PM' });
    expect(hallStatus(stored(), at('2026-10-17T12:00:00Z'))).toEqual({ open: false, label: 'Closed · opens 8 AM tomorrow' }); // Saturday, closed; Sunday opens
    expect(hallStatus(null)).toBeNull();
  });
});
