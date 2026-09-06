import { RepeatRule, RepeatFrequency, CustomRepeatUnit } from '../types/reminder';

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}

/**
 * Format repeat rule into a clean, human-readable summary string
 * Examples:
 * - "Every day"
 * - "Weekdays (Mon - Fri)"
 * - "Every week on Thursday"
 * - "Every month on the 15th"
 * - "Every 2 weeks on Mon, Wed"
 * - "Every 3 days"
 */
export function formatRepeatSummary(
  rule?: RepeatRule | null,
  baseDate?: Date
): string {
  if (!rule || rule.frequency === 'none') {
    return 'Does not repeat';
  }

  const d = baseDate || new Date();

  let summary = '';

  switch (rule.frequency) {
    case 'daily':
      summary = 'Every day';
      break;

    case 'weekdays':
      summary = 'Weekdays (Mon - Fri)';
      break;

    case 'weekly': {
      let weekdayName = DAY_NAMES[d.getDay()];
      if (rule.daysOfWeek && rule.daysOfWeek.length === 1) {
        weekdayName = DAY_NAMES[rule.daysOfWeek[0]];
      } else if (rule.daysOfWeek && rule.daysOfWeek.length > 1) {
        const sortedDays = [...rule.daysOfWeek].sort((a, b) => a - b);
        weekdayName = sortedDays.map((idx) => DAY_SHORT[idx]).join(', ');
      }
      summary = `Every week on ${weekdayName}`;
      break;
    }

    case 'monthly': {
      const dayOfMonth = d.getDate();
      summary = `Every month on the ${getOrdinalSuffix(dayOfMonth)}`;
      break;
    }

    case 'custom': {
      const interval = Math.max(1, rule.interval || 1);
      const unit = rule.unit || 'days';

      if (unit === 'days') {
        summary = interval === 1 ? 'Every day' : `Every ${interval} days`;
      } else if (unit === 'weeks') {
        const days = rule.daysOfWeek && rule.daysOfWeek.length > 0
          ? [...rule.daysOfWeek].sort((a, b) => a - b).map((idx) => DAY_SHORT[idx]).join(', ')
          : DAY_SHORT[d.getDay()];

        summary = interval === 1
          ? `Every week on ${days}`
          : `Every ${interval} weeks on ${days}`;
      } else if (unit === 'months') {
        summary = interval === 1
          ? `Every month on the ${getOrdinalSuffix(d.getDate())}`
          : `Every ${interval} months on the ${getOrdinalSuffix(d.getDate())}`;
      }
      break;
    }

    default:
      summary = 'Does not repeat';
  }

  if (rule.endDate) {
    const end = new Date(rule.endDate);
    const endStr = `${MONTH_NAMES[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
    summary += ` (until ${endStr})`;
  }

  return summary;
}

/**
 * Helper to check whether a candidate timestamp exceeds the end date rule
 */
function checkEndDate(candidate: Date, endDate?: number | null): number | null {
  if (endDate && candidate.getTime() > endDate) {
    return null;
  }
  return candidate.getTime();
}

/**
 * Returns number of days in a specific year and month
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Calculate the exact next occurrence timestamp for a recurring reminder.
 * Returns null if the recurrence has completed (e.g. past endDate).
 *
 * @param currentDueAt Original or current due timestamp in ms
 * @param rule Repeat configuration
 * @param fromTime Optional reference point to advance from (default: now)
 */
export function calculateNextOccurrence(
  currentDueAt: number,
  rule: RepeatRule,
  fromTime?: number
): number | null {
  if (!rule || rule.frequency === 'none') {
    return null;
  }

  const now = fromTime !== undefined ? fromTime : Date.now();
  const referenceTime = Math.max(currentDueAt, now);

  const targetDate = new Date(currentDueAt);
  const targetHours = targetDate.getHours();
  const targetMinutes = targetDate.getMinutes();
  const targetSeconds = targetDate.getSeconds();

  switch (rule.frequency) {
    case 'daily': {
      const candidate = new Date(referenceTime);
      candidate.setHours(targetHours, targetMinutes, targetSeconds, 0);

      if (candidate.getTime() <= referenceTime) {
        candidate.setDate(candidate.getDate() + 1);
      }
      return checkEndDate(candidate, rule.endDate);
    }

    case 'weekdays': {
      const candidate = new Date(referenceTime);
      candidate.setHours(targetHours, targetMinutes, targetSeconds, 0);

      if (candidate.getTime() <= referenceTime) {
        candidate.setDate(candidate.getDate() + 1);
      }

      // Skip Saturdays (6) and Sundays (0)
      while (candidate.getDay() === 0 || candidate.getDay() === 6) {
        candidate.setDate(candidate.getDate() + 1);
      }

      return checkEndDate(candidate, rule.endDate);
    }

    case 'weekly': {
      const targetDayOfWeek =
        rule.daysOfWeek && rule.daysOfWeek.length > 0
          ? rule.daysOfWeek[0]
          : targetDate.getDay();

      const candidate = new Date(referenceTime);
      candidate.setHours(targetHours, targetMinutes, targetSeconds, 0);

      if (candidate.getTime() <= referenceTime) {
        candidate.setDate(candidate.getDate() + 1);
      }

      while (candidate.getDay() !== targetDayOfWeek) {
        candidate.setDate(candidate.getDate() + 1);
      }

      return checkEndDate(candidate, rule.endDate);
    }

    case 'monthly': {
      const targetDayOfMonth = targetDate.getDate();
      let candidateYear = new Date(referenceTime).getFullYear();
      let candidateMonth = new Date(referenceTime).getMonth();

      let maxDay = getDaysInMonth(candidateYear, candidateMonth);
      let day = Math.min(targetDayOfMonth, maxDay);

      let candidate = new Date(
        candidateYear,
        candidateMonth,
        day,
        targetHours,
        targetMinutes,
        targetSeconds,
        0
      );

      if (candidate.getTime() <= referenceTime) {
        candidateMonth++;
        if (candidateMonth > 11) {
          candidateMonth = 0;
          candidateYear++;
        }
        maxDay = getDaysInMonth(candidateYear, candidateMonth);
        day = Math.min(targetDayOfMonth, maxDay);
        candidate = new Date(
          candidateYear,
          candidateMonth,
          day,
          targetHours,
          targetMinutes,
          targetSeconds,
          0
        );
      }

      return checkEndDate(candidate, rule.endDate);
    }

    case 'custom': {
      const interval = Math.max(1, rule.interval || 1);
      const unit: CustomRepeatUnit = rule.unit || 'days';

      if (unit === 'days') {
        const candidate = new Date(currentDueAt);
        while (candidate.getTime() <= referenceTime) {
          candidate.setDate(candidate.getDate() + interval);
        }
        return checkEndDate(candidate, rule.endDate);
      }

      if (unit === 'weeks') {
        const activeDays = rule.daysOfWeek && rule.daysOfWeek.length > 0
          ? [...new Set(rule.daysOfWeek)].sort((a, b) => a - b)
          : [targetDate.getDay()];

        let candidate = new Date(referenceTime);
        candidate.setHours(targetHours, targetMinutes, targetSeconds, 0);

        if (candidate.getTime() <= referenceTime) {
          candidate.setDate(candidate.getDate() + 1);
        }

        // Search for the next active day
        let found = false;
        for (let i = 0; i < 520; i++) {
          if (activeDays.includes(candidate.getDay())) {
            found = true;
            break;
          }
          candidate.setDate(candidate.getDate() + 1);
        }

        if (!found) return null;
        return checkEndDate(candidate, rule.endDate);
      }

      if (unit === 'months') {
        let candidateYear = targetDate.getFullYear();
        let candidateMonth = targetDate.getMonth();
        const targetDay = targetDate.getDate();

        let candidate = new Date(currentDueAt);

        while (candidate.getTime() <= referenceTime) {
          candidateMonth += interval;
          candidateYear += Math.floor(candidateMonth / 12);
          candidateMonth = candidateMonth % 12;

          const maxDay = getDaysInMonth(candidateYear, candidateMonth);
          const safeDay = Math.min(targetDay, maxDay);

          candidate = new Date(
            candidateYear,
            candidateMonth,
            safeDay,
            targetHours,
            targetMinutes,
            targetSeconds,
            0
          );
        }

        return checkEndDate(candidate, rule.endDate);
      }

      return null;
    }

    default:
      return null;
  }
}
