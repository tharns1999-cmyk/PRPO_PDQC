import { describe, it, expect } from 'vitest';
import { parseSafeDate, formatThaiDateTime, formatDocDateTime } from '../src/utils/dateHelper.js';

describe('Suite: Robust Safe Date Parsing & Formatting (Anti-Invalid Date Guard)', () => {
  describe('1. parseSafeDate Utility Function', () => {
    it('correctly parses ISO 8601 strings into valid Date objects', () => {
      const iso = '2026-09-16T10:30:00.000Z';
      const d = parseSafeDate(iso);
      expect(d instanceof Date).toBe(true);
      expect(isNaN(d.getTime())).toBe(false);
      expect(d.toISOString()).toBe(iso);
    });

    it('correctly parses epoch numeric timestamps (milliseconds and seconds)', () => {
      const ms = 1789555800000;
      const d1 = parseSafeDate(ms);
      expect(d1.getTime()).toBe(ms);

      const sec = 1789555800;
      const d2 = parseSafeDate(sec);
      expect(d2.getTime()).toBe(sec * 1000);
    });

    it('returns existing valid Date objects directly', () => {
      const original = new Date(2026, 8, 16, 15, 45, 0);
      const d = parseSafeDate(original);
      expect(d).toBe(original);
      expect(d.getFullYear()).toBe(2026);
    });

    it('parses Thai date strings with Buddhist Era year (>2500) converting to CE (-543)', () => {
      // 16/9/2569 -> 2026-09-16
      const thaiShort = '16/9/2569';
      const d1 = parseSafeDate(thaiShort);
      expect(d1.getFullYear()).toBe(2026);
      expect(d1.getMonth()).toBe(8); // September is month 8 (0-indexed)
      expect(d1.getDate()).toBe(16);

      // 16/09/2569 เวลา 14:30 น.
      const thaiWithTime = '16/09/2569 เวลา 14:30 น.';
      const d2 = parseSafeDate(thaiWithTime);
      expect(d2.getFullYear()).toBe(2026);
      expect(d2.getMonth()).toBe(8);
      expect(d2.getDate()).toBe(16);
      expect(d2.getHours()).toBe(14);
      expect(d2.getMinutes()).toBe(30);

      // 16/09/2569, 14:30:45
      const thaiWithSeconds = '16/09/2569, 14:30:45';
      const d3 = parseSafeDate(thaiWithSeconds);
      expect(d3.getFullYear()).toBe(2026);
      expect(d3.getSeconds()).toBe(45);
    });

    it('parses CE slash date strings correctly', () => {
      const ceDate = '16/09/2026 09:15:00';
      const d = parseSafeDate(ceDate);
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(8);
      expect(d.getDate()).toBe(16);
      expect(d.getHours()).toBe(9);
      expect(d.getMinutes()).toBe(15);
    });

    it('safely fallbacks to valid Date without throwing or returning NaN on invalid/corrupt inputs', () => {
      const fallback = new Date(2026, 0, 1);
      expect(isNaN(parseSafeDate('Invalid Date', fallback).getTime())).toBe(false);
      expect(isNaN(parseSafeDate('corrupt string', fallback).getTime())).toBe(false);
      expect(isNaN(parseSafeDate(new Date(NaN), fallback).getTime())).toBe(false);
      expect(isNaN(parseSafeDate(null).getTime())).toBe(false);
      expect(isNaN(parseSafeDate(undefined).getTime())).toBe(false);
      expect(isNaN(parseSafeDate('').getTime())).toBe(false);
      expect(isNaN(parseSafeDate('-').getTime())).toBe(false);
    });
  });

  describe('2. formatThaiDateTime Guaranteed Safe Formatting', () => {
    it('never returns "Invalid Date" under any circumstances', () => {
      expect(formatThaiDateTime('Invalid Date')).not.toContain('Invalid Date');
      expect(formatThaiDateTime('corrupt')).not.toContain('Invalid Date');
      expect(formatThaiDateTime(new Date(NaN))).not.toContain('Invalid Date');
      expect(formatThaiDateTime(undefined)).not.toContain('Invalid Date');
      expect(formatThaiDateTime(null)).not.toContain('Invalid Date');
    });

    it('formats ISO 8601 into DD/MM/2569 HH:mm น.', () => {
      const iso = '2026-09-12T10:15:00.000Z';
      const formatted = formatThaiDateTime(iso);
      expect(formatted).toMatch(/^\d{2}\/\d{2}\/2569 \d{2}:\d{2} น\.$/);
    });

    it('formats Thai string "12/09/2569 เวลา 10:15 น." correctly without double adding 543', () => {
      const input = '12/09/2569 เวลา 10:15 น.';
      const formatted = formatThaiDateTime(input);
      expect(formatted).toBe('12/09/2569 10:15 น.');
      expect(formatDocDateTime(input)).toBe('วันที่ 12/09/2569 10:15 น.');
    });

    it('formats date-only strings into DD/MM/2569', () => {
      expect(formatThaiDateTime('12/09/2026')).toBe('12/09/2569');
      expect(formatThaiDateTime('12/09/2569')).toBe('12/09/2569');
    });

    it('returns placeholder dots for empty values', () => {
      expect(formatThaiDateTime(null)).toBe('..... / ..... / .........');
      expect(formatThaiDateTime('')).toBe('..... / ..... / .........');
      expect(formatThaiDateTime('-')).toBe('..... / ..... / .........');
      expect(formatDocDateTime(null)).toBe('วันที่ ..... / ..... / .........');
    });
  });

  describe('3. Strict LIFO Sorting, Deduplication & Windowing (Quick Issue History)', () => {
    it('sorts records descending (latest first) even when dates are mixed formats (Thai string, ISO, Date)', () => {
      const logs = [
        { id: '1', timestamp: '16/09/2569 10:00:00', reason: 'Oldest' },
        { id: '2', timestamp: '2026-09-16T12:00:00.000Z', reason: 'Newest' },
        { id: '3', timestamp: '16/09/2569 11:00:00', reason: 'Middle' }
      ];

      // Strict LIFO sort using parseSafeDate
      logs.sort((a, b) => {
        const timeB = parseSafeDate(b.timestamp || b.date).getTime();
        const timeA = parseSafeDate(a.timestamp || a.date).getTime();
        return timeB - timeA;
      });

      // Validating sort order: Newest (12:00 UTC / 19:00 Thai) > Middle (11:00) > Oldest (10:00)
      expect(logs[0].id).toBe('2');
      expect(logs[1].id).toBe('3');
      expect(logs[2].id).toBe('1');
    });

    it('deduplicates optimistic items colliding with synced items from Google Sheets', () => {
      const nowIso = '2026-09-16T12:30:15.000Z';
      const sheetDate = '16/09/2569 19:30:18'; // Corresponds to approx 12:30 UTC

      const rawLogs = [
        {
          id: 'LOG-PD-1726489815000', // Optimistic ID
          productId: 'PROD-01',
          productCode: 'SKU-001',
          changeQty: -5,
          qty: 5,
          location: 'ห้อง K1',
          timestamp: nowIso
        },
        {
          id: 'ROW_884', // Real Google Sheet Row ID synced back
          productId: 'PROD-01',
          productCode: 'SKU-001',
          changeQty: -5,
          qty: 5,
          location: 'ห้อง K1',
          timestamp: sheetDate
        },
        {
          id: 'ROW_883', // Another distinct transaction
          productId: 'PROD-01',
          productCode: 'SKU-001',
          changeQty: -2,
          qty: 2,
          location: 'ห้อง K2',
          timestamp: '16/09/2569 18:00:00'
        }
      ];

      // Deduplication implementation
      const seenIds = new Set();
      const seenSignatures = new Set();
      const deduped = [];

      for (const log of rawLogs) {
        const logId = log.id ? String(log.id).trim() : '';
        if (logId && seenIds.has(logId)) continue;

        const pId = String(log.productId || log.productCode).trim();
        const qty = Math.abs(Number(log.qty || log.changeQty || 0));
        const safeTime = parseSafeDate(log.timestamp || log.date).getTime();
        const timeMinute = Math.floor(safeTime / 60000);
        const signature = `${pId}_${qty}_${timeMinute}_${String(log.issuedTo || log.location || '').trim()}`;

        if (seenSignatures.has(signature)) continue;

        if (logId) seenIds.add(logId);
        seenSignatures.add(signature);
        deduped.push(log);
      }

      // The duplicate optimistic vs sheet record should be collapsed into 1
      expect(deduped.length).toBe(2);
      expect(deduped.map(d => d.id)).toContain('LOG-PD-1726489815000');
      expect(deduped.map(d => d.id)).toContain('ROW_883');
    });

    it('windows recent history to maximum 20 records', () => {
      const largeList = Array.from({ length: 45 }, (_, i) => ({
        id: `LOG-${i}`,
        productId: 'PROD-01',
        changeQty: -1,
        timestamp: new Date(2026, 8, 1, 10, i).toISOString()
      }));

      const windowed = largeList.slice(0, 20);
      expect(windowed.length).toBe(20);
    });
  });
});
