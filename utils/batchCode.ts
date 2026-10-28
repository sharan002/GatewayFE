// Short-code helpers for batch codes like "Moha-PYT-2307-0930-1030"
// (TrainerCode-CourseCode-DDMM-StartTime-EndTime). Mirrors the backend's
// buildBatchCode() in index.js so display truncation matches generated codes.

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export type Weekday = typeof WEEKDAYS[number];

export function getTrainerShortCode(trainerName?: string | null): string {
  const raw = (trainerName || '').trim().replace(/\s+/g, '').slice(0, 4);
  if (!raw) return '';
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

export function getCourseShortCode(courseName?: string | null): string {
  return (courseName || '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
}

// "8 Hours" -> "8hr", "2 Hours" -> "2hr"
export function getProgramTypeShortCode(programType?: string | null): string {
  const hours = (String(programType || '').match(/(\d+)/) || [])[1];
  return hours ? `${hours}hr` : '';
}

// Total course duration by program type, per business rule: 2-hour batches run
// 3 months 10 days end-to-end, 8-hour batches run 4 months 10 days.
function getProgramDuration(programType?: string | null): { months: number; days: number } | null {
  const hours = (String(programType || '').match(/(\d+)/) || [])[1];
  if (hours === '2') return { months: 3, days: 10 };
  if (hours === '8') return { months: 4, days: 10 };
  return null;
}

// Days remaining until the batch's expected completion date (batch start + program duration).
// Returns null if batch_date/programType aren't set or don't map to a known duration.
export function getBatchDaysRemaining(batchDate?: string | null, programType?: string | null): number | null {
  if (!batchDate) return null;
  const duration = getProgramDuration(programType);
  if (!duration) return null;

  const start = new Date(batchDate);
  if (Number.isNaN(start.getTime())) return null;

  const completion = new Date(start);
  completion.setMonth(completion.getMonth() + duration.months);
  completion.setDate(completion.getDate() + duration.days);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  completion.setHours(0, 0, 0, 0);

  return Math.round((completion.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// Short label for tiles, e.g. "45 days left" / "Ends today" / "Completed".
export function getBatchRemainingLabel(batchDate?: string | null, programType?: string | null): string | null {
  const days = getBatchDaysRemaining(batchDate, programType);
  if (days === null) return null;
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} left`;
  if (days === 0) return 'Ends today';
  return 'Completed';
}

export type BatchStatus = 'upcoming' | 'ongoing' | 'completed';

// Buckets a batch by its start date (batch_date) vs today, and — once started —
// by whether it has run past its expected completion date (start + program duration).
// Falls back to 'ongoing' whenever the date/duration can't be determined, so batches
// with incomplete data keep showing up rather than disappearing from every tab.
export function getBatchStatus(batchDate?: string | null, programType?: string | null): BatchStatus {
  if (!batchDate) return 'ongoing';
  const start = new Date(batchDate);
  if (Number.isNaN(start.getTime())) return 'ongoing';
  start.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (start.getTime() > today.getTime()) return 'upcoming';

  const daysRemaining = getBatchDaysRemaining(batchDate, programType);
  if (daysRemaining !== null && daysRemaining < 0) return 'completed';
  return 'ongoing';
}

// True once a started batch is within `thresholdDays` of its expected completion date, or already past it.
export function isBatchEndingSoon(batchDate?: string | null, programType?: string | null, thresholdDays = 10): boolean {
  const days = getBatchDaysRemaining(batchDate, programType);
  return days !== null && days <= thresholdDays;
}

// "09:30" -> "9:30 AM"
export function formatTime12h(hhmm?: string | null): string {
  if (!hhmm) return '';
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${period}`;
}

// Minutes since midnight, for positioning on the timetable grid.
export function timeToMinutes(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}
