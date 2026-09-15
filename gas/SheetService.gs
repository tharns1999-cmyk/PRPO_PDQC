/**
 * @file SheetService.gs
 * @description High-Performance Batch Database Service for Google Sheets
 * Implements full CRUD, header-mapped serialization, auto JSON handling,
 * and thread-safe sequential counter generation with LockService.
 * @version 2.0.0
 */

/**
 * Reads all records from a sheet tab into an array of JavaScript objects.
 * Automatically parses JSON fields and normalizes data types.
 * 
 * @param {string} sheetName Name of the sheet tab
 * @returns {Object[]} Array of row objects mapped by header keys
 */
function batchReadRecords(sheetName) {
  const sheet = getSheet(sheetName);
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  if (!values || values.length <= 1) {
    return []; // Only header or empty
  }

  const headers = values[0].map(h => String(h).trim());
  const records = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    // Skip empty rows (where first column or all columns are empty)
    const isRowEmpty = row.every(cell => cell === '' || cell === null || cell === undefined);
    if (isRowEmpty) continue;

    const record = {};
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      if (!header) continue;
      
      let val = row[c];
      
      // Auto-parse JSON string if it looks like an array or object
      if (typeof val === 'string' && val.length > 1) {
        const trimmed = val.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
            (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try {
            val = JSON.parse(trimmed);
          } catch (e) {
            // Keep as string if parsing fails
          }
        }
      } else if (val instanceof Date) {
        // Format ISO string for consistent frontend consumption
        val = val.toISOString();
      }

      record[header] = val;
    }

    records.push(record);
  }

  return records;
}

/**
 * Writes an array of records to a sheet tab in a single batch operation,
 * completely replacing existing data rows while preserving headers.
 * 
 * @param {string} sheetName Name of the sheet tab
 * @param {Object[]} records Array of objects to write
 * @returns {number} Number of rows written
 */
function batchWriteRecords(sheetName, records = []) {
  const sheet = getSheet(sheetName);
  const headers = getSheetHeaders(sheet);

  if (headers.length === 0) {
    throw new Error(`SCHEMA_ERROR: Sheet "${sheetName}" has no defined header row.`);
  }

  // Clear existing data rows (keep row 1 header)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }

  if (records.length === 0) {
    return 0;
  }

  // Map objects into 2D row array
  const rowValues = records.map(record => serializeRecordToRow(record, headers));

  // Batch write all rows
  sheet.getRange(2, 1, rowValues.length, headers.length).setValues(rowValues);
  SpreadsheetApp.flush();

  return rowValues.length;
}

/**
 * Appends a single record to the target sheet tab.
 * 
 * @param {string} sheetName Name of the sheet tab
 * @param {Object} record Record object to append
 * @returns {Object} The inserted record
 */
function appendRecord(sheetName, record) {
  const sheet = getSheet(sheetName);
  const headers = getSheetHeaders(sheet);

  if (headers.length === 0) {
    throw new Error(`SCHEMA_ERROR: Sheet "${sheetName}" has no defined header row.`);
  }

  const rowValues = serializeRecordToRow(record, headers);
  sheet.appendRow(rowValues);
  SpreadsheetApp.flush();

  return record;
}

/**
 * Batch appends multiple records to the sheet in a single setValues call.
 * 
 * @param {string} sheetName Name of the sheet tab
 * @param {Object[]} records Array of records to append
 * @returns {number} Number of appended rows
 */
function batchAppendRecords(sheetName, records = []) {
  if (!records || records.length === 0) return 0;

  const sheet = getSheet(sheetName);
  const headers = getSheetHeaders(sheet);
  const rowValues = records.map(rec => serializeRecordToRow(rec, headers));

  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rowValues.length, headers.length).setValues(rowValues);
  SpreadsheetApp.flush();

  return rowValues.length;
}

/**
 * Inserts or updates a record by a unique identifier key.
 * 
 * @param {string} sheetName Name of the sheet tab
 * @param {string} idField Column name representing unique key (e.g. 'id', 'poNo')
 * @param {Object} record The record payload
 * @returns {Object} Upserted record with status
 */
function upsertRecordById(sheetName, idField, record) {
  const targetId = record[idField];
  if (!targetId) {
    throw new Error(`VALIDATION_ERROR: Record missing required unique key "${idField}".`);
  }

  const sheet = getSheet(sheetName);
  const headers = getSheetHeaders(sheet);
  const idColIndex = headers.indexOf(idField);

  if (idColIndex === -1) {
    throw new Error(`SCHEMA_ERROR: Header "${idField}" not found in sheet "${sheetName}".`);
  }

  const lastRow = sheet.getLastRow();
  let rowIndexToUpdate = -1;

  if (lastRow > 1) {
    // Read only the ID column for fast lookup
    const idValues = sheet.getRange(2, idColIndex + 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < idValues.length; i++) {
      if (String(idValues[i][0]).trim() === String(targetId).trim()) {
        rowIndexToUpdate = i + 2; // 1-based index (+1 for header, +1 for 0-index)
        break;
      }
    }
  }

  const rowValues = serializeRecordToRow(record, headers);

  if (rowIndexToUpdate !== -1) {
    // Update existing row
    sheet.getRange(rowIndexToUpdate, 1, 1, headers.length).setValues([rowValues]);
  } else {
    // Append new row
    sheet.appendRow(rowValues);
  }

  SpreadsheetApp.flush();
  return record;
}

/**
 * Deletes a row matching the given unique key.
 * 
 * @param {string} sheetName Name of the sheet tab
 * @param {string} idField Column name representing unique key
 * @param {string|number} idValue Value to match
 * @returns {boolean} True if a row was found and deleted
 */
function deleteRecordById(sheetName, idField, idValue) {
  const sheet = getSheet(sheetName);
  const headers = getSheetHeaders(sheet);
  const idColIndex = headers.indexOf(idField);

  if (idColIndex === -1) {
    throw new Error(`SCHEMA_ERROR: Header "${idField}" not found in sheet "${sheetName}".`);
  }

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;

  const idValues = sheet.getRange(2, idColIndex + 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < idValues.length; i++) {
    if (String(idValues[i][0]).trim() === String(idValue).trim()) {
      sheet.deleteRow(i + 2);
      SpreadsheetApp.flush();
      return true;
    }
  }

  return false;
}

/**
 * Returns array of header column names from row 1.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {string[]}
 */
function getSheetHeaders(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  const headerValues = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  return headerValues.map(h => String(h).trim()).filter(Boolean);
}

/**
 * Serializes a JavaScript object into a 1D row array matching the given headers.
 * Safely stringifies nested objects and arrays.
 * 
 * @param {Object} record Record object
 * @param {string[]} headers Array of header keys
 * @returns {Array} 1D array of cell values
 */
function serializeRecordToRow(record, headers) {
  const MAX_CELL_LENGTH = 49000; // Google Sheets limit is 50,000 chars per cell

  return headers.map(header => {
    let val = record[header];

    if (val === null || val === undefined) {
      return '';
    }

    if (typeof val === 'boolean') {
      return val;
    }

    if (typeof val === 'number') {
      return val;
    }

    let strVal = '';
    if (typeof val === 'object') {
      try {
        strVal = JSON.stringify(val);
      } catch (e) {
        strVal = String(val);
      }
    } else {
      strVal = String(val);
    }

    // Safety guard against Google Sheets 50,000 characters cell overflow
    if (strVal.length > MAX_CELL_LENGTH) {
      console.warn(`[SheetService] Cell value for header "${header}" exceeds ${MAX_CELL_LENGTH} characters (${strVal.length} chars). Stripping inline Base64 data...`);
      // Replace inline base64 payloads: data:image/... or data:application/...
      strVal = strVal.replace(/data:(image|application)\/[a-zA-Z0-9.-]+;base64,[A-Za-z0-9+/=]{100,}/g, '[BASE64_ATTACHMENT_STORED_IN_DRIVE]');
      
      if (strVal.length > MAX_CELL_LENGTH) {
        console.warn(`[SheetService] Cell value for "${header}" still exceeds limit after regex strip. Truncating to ${MAX_CELL_LENGTH} characters.`);
        strVal = strVal.substring(0, MAX_CELL_LENGTH);
      }
    }

    return strVal;
  });
}

/**
 * Thread-safe Sequential ID Generator with LockService mutex.
 * Generates document numbers such as:
 * - PO: "PO-PD-2026-001"
 * - PR: "PD001/2026" or "PR-PD-2026-001"
 * 
 * @param {string} department 'PD' | 'QC' | 'WH' | 'ALL'
 * @param {string} docType 'PO' | 'PR'
 * @returns {string} Generated sequential document number
 */
function generateSequentialDocId(department, docType) {
  const dept = String(department || 'ALL').toUpperCase().trim();
  const type = String(docType || 'PO').toUpperCase().trim();
  const currentYear = new Date().getFullYear();

  return withScriptLock(function() {
    const sheet = getSheet(SHEET_NAMES.PR_COUNTERS);
    const records = batchReadRecords(SHEET_NAMES.PR_COUNTERS);

    // Find counter row for department and docType
    let counterRecord = records.find(r => 
      String(r.dept).toUpperCase() === dept && 
      String(r.docType).toUpperCase() === type &&
      Number(r.year || currentYear) === currentYear
    );

    let nextNumber = 1;

    if (counterRecord) {
      nextNumber = Number(counterRecord.lastNumber || 0) + 1;
      counterRecord.lastNumber = nextNumber;
      counterRecord.updatedAt = new Date().toISOString();
      upsertRecordById(SHEET_NAMES.PR_COUNTERS, 'dept', counterRecord);
    } else {
      // First document of the year for this dept/type
      counterRecord = {
        dept: dept,
        docType: type,
        lastNumber: 1,
        prefix: type,
        year: currentYear,
        updatedAt: new Date().toISOString()
      };
      appendRecord(SHEET_NAMES.PR_COUNTERS, counterRecord);
    }

    // Format output
    const seqStr = String(nextNumber).padStart(3, '0');

    if (type === 'PO') {
      // Format: PO-PD-2026-001
      return `PO-${dept}-${currentYear}-${seqStr}`;
    } else if (type === 'PR') {
      // Format: PD001/2026 (matching legacy format)
      return `${dept}${seqStr}/${currentYear}`;
    }

    return `${type}-${dept}-${currentYear}-${seqStr}`;
  }, CONFIG.DEFAULTS.SCRIPT_LOCK_TIMEOUT_MS, `GenerateSequentialId_${type}_${dept}`);
}
