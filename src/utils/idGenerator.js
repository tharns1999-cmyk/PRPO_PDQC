/**
 * Document ID & Sequence Generator with Max Sequence Scan and Collision Guard
 * 
 * Rules:
 * 1. Scans existing documents to find true maximum numeric sequence using Regex.
 *    (e.g., from 'PD004/2026' extracts '4' and avoids mixing with the year '2026')
 * 2. Next ID = currentMax + 1, padded with zeros.
 * 3. Collision Guard: Ensures generated ID is never duplicated against existing list.
 */

/**
 * Generate next PR Number (e.g. PD005/2026)
 * @param {Array} existingPRs - List of PR objects
 * @param {string} department - Department code (e.g. 'PD', 'QC')
 * @param {number|string} year - Document year (default: current year)
 * @returns {string} Next unique PR Number
 */
export function generateNextPRId(existingPRs = [], department = 'PD', year = new Date().getFullYear()) {
  const dept = (department || 'PD').toUpperCase().trim();
  const yr = year || new Date().getFullYear();
  const regex = new RegExp(`^${dept}(\\d+)/${yr}$`, 'i');

  const numbers = [];
  const existingSet = new Set();

  (existingPRs || []).forEach(pr => {
    if (!pr) return;
    const candidates = [pr.prNo, pr.prNumber, pr.id].filter(Boolean);
    candidates.forEach(val => {
      const str = String(val).trim();
      existingSet.add(str.toUpperCase());
      const match = str.match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num)) numbers.push(num);
      }
    });
  });

  const currentMax = numbers.length > 0 ? Math.max(...numbers) : 0;
  let nextSeq = currentMax + 1;
  let nextId = `${dept}${String(nextSeq).padStart(3, '0')}/${yr}`;

  // Collision Guard: Ensure nextId does not collide with any existing PR id or prNo
  while (existingSet.has(nextId.toUpperCase())) {
    nextSeq++;
    nextId = `${dept}${String(nextSeq).padStart(3, '0')}/${yr}`;
  }

  return nextId;
}

/**
 * Generate next PO Number (e.g. PO-PD-2026-005)
 * @param {Array} existingPOs - List of PO objects
 * @param {string} department - Department code (e.g. 'PD', 'QC')
 * @param {number|string} year - Document year (default: current year)
 * @param {number} offset - Optional offset for batch generation
 * @returns {string} Next unique PO Number
 */
export function generateNextPOId(existingPOs = [], department = 'PD', year = new Date().getFullYear(), offset = 0) {
  const dept = (department || 'PD').toUpperCase().trim();
  const yr = year || new Date().getFullYear();
  const regex = new RegExp(`^PO-${dept}-${yr}-(\\d+)`, 'i');

  const numbers = [];
  const existingSet = new Set();

  (existingPOs || []).forEach(po => {
    if (!po) return;
    const candidates = [po.poNo, po.poNumber, po.id].filter(Boolean);
    candidates.forEach(val => {
      const str = String(val).trim();
      existingSet.add(str.toUpperCase());
      const match = str.match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num)) numbers.push(num);
      }
    });
  });

  const currentMax = numbers.length > 0 ? Math.max(...numbers) : 0;
  let nextSeq = currentMax + 1 + offset;
  let nextId = `PO-${dept}-${yr}-${String(nextSeq).padStart(3, '0')}`;

  // Collision Guard
  while (existingSet.has(nextId.toUpperCase())) {
    nextSeq++;
    nextId = `PO-${dept}-${yr}-${String(nextSeq).padStart(3, '0')}`;
  }

  return nextId;
}
