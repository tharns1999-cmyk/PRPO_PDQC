/**
 * Centralized Formatting Utilities
 * Single Source of Truth for:
 * 1. Timezone-bound Thai Date/Time (Asia/Bangkok: UTC+7)
 * 2. Currency & Number Formatting (THB / ฿)
 */

/**
 * Format a Date, ISO timestamp, or string into Thai format:
 * "DD/MM/YYYY เวลา HH:mm น." (or "DD/MM/YYYY" if date-only)
 * Handles Buddhist Era years (> 2400) converting down to Christian Era (e.g. 2569 -> 2026).
 * Strictly bound to Asia/Bangkok (UTC+7).
 *
 * @param {Date|string|number|null|undefined} dt
 * @returns {string} Formatted Thai date/time string, or "..... / ..... / ........." if empty/invalid
 */
export function formatThaiDateTime(dt) {
  if (!dt || dt === '-') return '..... / ..... / .........';

  try {
    const str = String(dt).trim();
    const cleanStr = str.replace(/^วันที่\s*/, '');

    // 1. If it's a date-only Thai format string like "DD/MM/YYYY" without time:
    const dateOnlyMatch = cleanStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dateOnlyMatch) {
      const [, day, month, rawYear] = dateOnlyMatch;
      let year = Number(rawYear);
      if (year > 2400) year -= 543;
      return `${String(Number(day)).padStart(2, '0')}/${String(Number(month)).padStart(2, '0')}/${year}`;
    }

    // 2. If it's a Thai string with time e.g. "12/09/2569 เวลา 10:15 น." or "12/09/2026 10:15"
    const thaiWithTimeMatch = cleanStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(?:เวลา\s*)?(\d{1,2}):(\d{1,2})(?::\d{1,2})?(?:\s*น\.)?)?$/);
    if (thaiWithTimeMatch && thaiWithTimeMatch[4] !== undefined) {
      const [, day, month, rawYear, hh, mm] = thaiWithTimeMatch;
      let year = Number(rawYear);
      if (year > 2400) year -= 543;
      const dd = String(Number(day)).padStart(2, '0');
      const mmStr = String(Number(month)).padStart(2, '0');
      const hhStr = String(Number(hh)).padStart(2, '0');
      const minStr = String(Number(mm)).padStart(2, '0');
      return `${dd}/${mmStr}/${year} เวลา ${hhStr}:${minStr} น.`;
    }

    // 3. Date instance, ISO 8601 string, or timestamp -> parse with Intl strictly in Asia/Bangkok
    const d = !cleanStr.includes('/') ? new Date(cleanStr) : new Date(NaN);
    if (!isNaN(d.getTime())) {
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      const parts = formatter.formatToParts(d);
      const partMap = {};
      for (const p of parts) {
        partMap[p.type] = p.value;
      }

      let year = Number(partMap.year);
      if (year > 2400) year -= 543;

      const day = String(partMap.day).padStart(2, '0');
      const month = String(partMap.month).padStart(2, '0');
      const hours = String(partMap.hour).padStart(2, '0');
      const minutes = String(partMap.minute).padStart(2, '0');

      return `${day}/${month}/${year} เวลา ${hours}:${minutes} น.`;
    }

    return cleanStr;
  } catch {
    return String(dt);
  }
}

/**
 * Format document date/time with authoritative "วันที่ " prefix.
 * e.g. "วันที่ 12/09/2026 เวลา 10:15 น." or "วันที่ ..... / ..... / ........."
 *
 * @param {Date|string|number|null|undefined} dt
 * @returns {string}
 */
export function formatDocDateTime(dt) {
  if (!dt || dt === '-') return 'วันที่ ..... / ..... / .........';
  const formatted = formatThaiDateTime(dt);
  if (formatted === '..... / ..... / .........') return 'วันที่ ..... / ..... / .........';
  return formatted.startsWith('วันที่') ? formatted : `วันที่ ${formatted}`;
}

/**
 * Format a number as currency (THB) with customizable decimals and prefix.
 *
 * @param {number|string} amount - Numerical value
 * @param {object} [options]
 * @param {number} [options.minimumFractionDigits=2]
 * @param {number} [options.maximumFractionDigits=2]
 * @param {boolean} [options.withSymbol=false] - Whether to prefix with ฿
 * @returns {string} e.g. "1,250.00" or "฿1,250.00"
 */
export function formatCurrency(amount, options = {}) {
  const num = (amount === null || amount === undefined || amount === '' || isNaN(Number(amount))) ? 0 : Number(amount);
  const minDec = options.minimumFractionDigits ?? 2;
  const maxDec = options.maximumFractionDigits ?? 2;

  const formatted = num.toLocaleString('th-TH', {
    minimumFractionDigits: minDec,
    maximumFractionDigits: maxDec
  });

  return options.withSymbol ? `฿${formatted}` : formatted;
}

/**
 * Convenience helper to format monetary amounts with ฿ symbol.
 * e.g. formatTHB(500) -> "฿500.00"
 *
 * @param {number|string} amount
 * @returns {string}
 */
export function formatTHB(amount) {
  return formatCurrency(amount, { withSymbol: true });
}

/**
 * Format general numbers with thousands separator.
 *
 * @param {number|string} num
 * @param {number} [maxDecimals=2]
 * @returns {string}
 */
export function formatNumber(num, maxDecimals = 2) {
  const n = Number(num) || 0;
  return n.toLocaleString('th-TH', {
    maximumFractionDigits: maxDecimals
  });
}
