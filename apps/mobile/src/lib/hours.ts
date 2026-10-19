export type Shift = readonly [open: number, close: number];
export type WeekHours = readonly (readonly Shift[])[]; // index 0 = Sunday

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function minutesOf(text: unknown): number | null {
  const match = typeof text === 'string' ? /^(\d{1,2}):(\d{2})$/.exec(text) : null;
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function parseHours(value: unknown): WeekHours | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const week: Shift[][] = [];
  for (const day of DAYS) {
    const shifts = record[day];
    if (!Array.isArray(shifts)) return undefined;
    const parsed: Shift[] = [];
    for (const shift of shifts) {
      const open = Array.isArray(shift) ? minutesOf(shift[0]) : null;
      const close = Array.isArray(shift) ? minutesOf(shift[1]) : null;
      if (open === null || close === null) return undefined;
      parsed.push([open, close <= open ? close + 1440 : close]);
    }
    week.push(parsed);
  }
  return week;
}

export const CAMPUS_TIME_ZONE = 'America/Chicago';

export type HallStatus = { open: boolean; label: string };

export function campusClock(now: Date, timeZone = CAMPUS_TIME_ZONE): { day: number; minutes: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const day = WEEKDAYS.indexOf(get('weekday'));
    if (day >= 0) return { day, minutes: (Number(get('hour')) % 24) * 60 + Number(get('minute')) };
  } catch { /* Intl time zones unavailable: fall back to the device clock. */ }
  return { day: now.getDay(), minutes: now.getHours() * 60 + now.getMinutes() };
}

function formatTime(total: number): string {
  const m = ((total % 1440) + 1440) % 1440;
  const hour = Math.floor(m / 60);
  const minute = m % 60;
  return `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, '0')}` : ''} ${hour < 12 ? 'AM' : 'PM'}`;
}

// When the hall next opens after today's last shift: "7 AM tomorrow", or "Mon 7 AM" for a later day.
// Null for a hall with no shifts all week.
function nextOpening(week: WeekHours, day: number): string | null {
  for (let ahead = 1; ahead <= 7; ahead++) {
    const weekday = (day + ahead) % 7;
    if (!week[weekday].length) continue;
    const time = formatTime(Math.min(...week[weekday].map(([open]) => open)));
    return ahead === 1 ? `${time} tomorrow` : `${WEEKDAYS[weekday]} ${time}`;
  }
  return null;
}

export function getHallStatus(week: WeekHours | undefined, now: Date, timeZone?: string): HallStatus | null {
  if (!week) return null;
  const { day, minutes } = campusClock(now, timeZone);
  const yesterday = week[(day + 6) % 7];
  // A shift from yesterday that runs past midnight is still open this morning.
  for (const [, close] of yesterday) if (close > 1440 && minutes < close - 1440) return { open: true, label: `Open until ${formatTime(close)}` };
  for (const [open, close] of week[day]) if (minutes >= open && minutes < close) return { open: true, label: `Open until ${formatTime(close)}` };
  const laterToday = week[day].map(([open]) => open).filter((open) => open > minutes);
  const opens = laterToday.length ? formatTime(Math.min(...laterToday)) : nextOpening(week, day);
  return { open: false, label: opens ? `Closed · opens ${opens}` : 'Closed' };
}

export const hallStatus = (hours: unknown, now: Date = new Date()) => getHallStatus(parseHours(hours), now);
