/**
 * Unit Tests for formatters.js
 *
 * Tests all date/time formatting utilities with Korean locale
 */

import dayjs from 'dayjs';
import {
  formatDate,
  formatTime,
  formatDateTime,
  formatDuration,
  formatRelativeTime,
  formatMilliseconds,
  formatCustom,
} from '../formatters';

describe('formatters', () => {
  describe('formatDate', () => {
    it('should format date to YYYY-MM-DD', () => {
      expect(formatDate('2025-10-31T10:30:45Z')).toBe('2025-10-31');
      expect(formatDate('2024-01-01T00:00:00Z')).toBe('2024-01-01');
    });

    it('should handle Date objects', () => {
      const date = new Date('2025-03-15T14:20:00Z');
      const result = formatDate(date);
      expect(result).toMatch(/2025-03-15/);
    });

    it('should return empty string for null/undefined', () => {
      expect(formatDate(null)).toBe('');
      expect(formatDate(undefined)).toBe('');
      expect(formatDate('')).toBe('');
    });

    it('should handle invalid dates gracefully', () => {
      expect(formatDate('invalid')).toBe('Invalid Date');
    });
  });

  describe('formatTime', () => {
    it('should format time to HH:mm:ss', () => {
      const dateTime = '2025-10-31T14:30:45Z';
      const result = formatTime(dateTime);
      expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
    });

    it('should handle Date objects', () => {
      const date = new Date('2025-03-15T09:05:03Z');
      const result = formatTime(date);
      expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
    });

    it('should return empty string for null/undefined', () => {
      expect(formatTime(null)).toBe('');
      expect(formatTime(undefined)).toBe('');
    });

    it('should pad single digit hours/minutes/seconds with zero', () => {
      const date = new Date('2025-01-01T01:05:09Z');
      const result = formatTime(date);
      expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });
  });

  describe('formatDateTime', () => {
    it('should format to YYYY-MM-DD HH:mm:ss', () => {
      const dateTime = '2025-10-31T14:30:45Z';
      const result = formatDateTime(dateTime);
      expect(result).toMatch(/2025-10-31 \d{2}:\d{2}:\d{2}/);
    });

    it('should handle Date objects', () => {
      const date = new Date('2024-12-25T18:45:30Z');
      const result = formatDateTime(date);
      expect(result).toMatch(/2024-12-25 \d{2}:\d{2}:\d{2}/);
    });

    it('should return empty string for null/undefined', () => {
      expect(formatDateTime(null)).toBe('');
      expect(formatDateTime(undefined)).toBe('');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds to hours, minutes, seconds', () => {
      expect(formatDuration(3661)).toBe('1h 1m 1s');
      expect(formatDuration(7200)).toBe('2h');
      expect(formatDuration(90)).toBe('1m 30s');
      expect(formatDuration(5)).toBe('5s');
    });

    it('should handle zero seconds', () => {
      expect(formatDuration(0)).toBe('0s');
    });

    it('should handle large durations', () => {
      expect(formatDuration(86400)).toBe('24h'); // 1 day
      expect(formatDuration(3723)).toBe('1h 2m 3s');
    });

    it('should omit zero components', () => {
      expect(formatDuration(3600)).toBe('1h');
      expect(formatDuration(60)).toBe('1m');
      expect(formatDuration(3660)).toBe('1h 1m');
    });

    it('should return 0s for invalid inputs', () => {
      expect(formatDuration(-1)).toBe('0s');
      expect(formatDuration(null)).toBe('0s');
      expect(formatDuration(undefined)).toBe('0s');
      expect(formatDuration('invalid')).toBe('0s');
    });
  });

  describe('formatRelativeTime', () => {
    it('should format recent times in Korean', () => {
      const now = dayjs();
      const fiveMinutesAgo = now.subtract(5, 'minute').toDate();
      const result = formatRelativeTime(fiveMinutesAgo);
      expect(result).toContain('분');
    });

    it('should format hours ago in Korean', () => {
      const now = dayjs();
      const twoHoursAgo = now.subtract(2, 'hour').toDate();
      const result = formatRelativeTime(twoHoursAgo);
      expect(result).toContain('시간');
    });

    it('should format days ago in Korean', () => {
      const now = dayjs();
      const threeDaysAgo = now.subtract(3, 'day').toDate();
      const result = formatRelativeTime(threeDaysAgo);
      expect(result).toContain('일');
    });

    it('should return empty string for null/undefined', () => {
      expect(formatRelativeTime(null)).toBe('');
      expect(formatRelativeTime(undefined)).toBe('');
    });

    it('should handle future dates', () => {
      const now = dayjs();
      const inFiveMinutes = now.add(5, 'minute').toDate();
      const result = formatRelativeTime(inFiveMinutes);
      expect(result).toBeTruthy();
    });
  });

  describe('formatMilliseconds', () => {
    it('should format milliseconds with appropriate precision', () => {
      expect(formatMilliseconds(1234)).toBe('1.23s');
      expect(formatMilliseconds(100)).toBe('100ms');
      expect(formatMilliseconds(50)).toBe('50ms');
    });

    it('should handle zero milliseconds', () => {
      expect(formatMilliseconds(0)).toBe('0ms');
    });

    it('should handle large millisecond values', () => {
      expect(formatMilliseconds(10000)).toBe('10.00s');
      expect(formatMilliseconds(5500)).toBe('5.50s');
    });

    it('should return 0ms for invalid inputs', () => {
      expect(formatMilliseconds(-1)).toBe('0ms');
      expect(formatMilliseconds(null)).toBe('0ms');
      expect(formatMilliseconds(undefined)).toBe('0ms');
    });
  });

  describe('formatCustom', () => {
    it('should apply custom format string', () => {
      const date = '2025-10-31T14:30:45Z';
      expect(formatCustom(date, 'MM/DD/YYYY')).toBe('10/31/2025');
      expect(formatCustom(date, 'YYYY년 MM월 DD일')).toContain('2025년');
    });

    it('should handle Date objects', () => {
      const date = new Date('2024-12-25T10:00:00Z');
      const result = formatCustom(date, 'YYYY-MM-DD');
      expect(result).toBe('2024-12-25');
    });

    it('should return empty string for null/undefined date', () => {
      expect(formatCustom(null, 'YYYY-MM-DD')).toBe('');
      expect(formatCustom(undefined, 'YYYY-MM-DD')).toBe('');
    });

    it('should handle complex format strings', () => {
      const date = '2025-10-31T14:30:45Z';
      const result = formatCustom(date, 'dddd, MMMM D, YYYY [at] h:mm A');
      expect(result).toBeTruthy();
      expect(result).toContain('2025');
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle ISO 8601 strings consistently', () => {
      const iso = '2025-10-31T10:30:45.123Z';
      expect(formatDate(iso)).toBe('2025-10-31');
      expect(formatTime(iso)).toMatch(/\d{2}:\d{2}:\d{2}/);
      expect(formatDateTime(iso)).toMatch(/2025-10-31 \d{2}:\d{2}:\d{2}/);
    });

    it('should handle timezone conversions gracefully', () => {
      const date = new Date('2025-10-31T23:00:00+09:00'); // Korean time
      const formattedDate = formatDate(date);
      expect(formattedDate).toMatch(/2025-10-3[01]/); // Could be 30 or 31 depending on UTC conversion
    });

    it('should handle leap year dates', () => {
      const leapDay = '2024-02-29T12:00:00Z';
      expect(formatDate(leapDay)).toBe('2024-02-29');
    });

    it('should handle year boundaries', () => {
      const newYear = '2025-01-01T00:00:00Z';
      expect(formatDate(newYear)).toBe('2025-01-01');

      const newYearsEve = '2024-12-31T23:59:59Z';
      expect(formatDate(newYearsEve)).toBe('2024-12-31');
    });
  });
});
