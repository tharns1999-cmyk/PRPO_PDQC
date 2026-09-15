/**
 * @file LockService.gs
 * @description Concurrency Control and Distributed Mutex Locking for PRPO_PDQC
 * Uses Google Apps Script LockService to ensure ACID-like transactional integrity
 * on document sequence counters, inventory updates, and budget reconciliation.
 * @version 2.0.0
 */

/**
 * Executes a callback function inside a Google Apps Script ScriptLock mutex.
 * Automatically handles lock acquisition, execution, and guaranteed lock release in `finally`.
 * 
 * @param {Function} callback Function to execute within the critical section
 * @param {number} [timeoutMs=15000] Maximum milliseconds to wait for lock acquisition
 * @param {string} [operationName='Operation'] Descriptive name for log/error context
 * @returns {*} Result of the callback function
 * @throws {Error} If lock acquisition times out or callback throws
 */
function withScriptLock(callback, timeoutMs = 15000, operationName = 'Operation') {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    lockAcquired = lock.tryLock(timeoutMs);
    if (!lockAcquired) {
      const errMsg = `LOCK_TIMEOUT: ไม่สามารถทำรายการได้ในขณะนี้เนื่องจากมีผู้ใช้งานอื่นกำลังทำธุรกรรมในส่วน "${operationName}" (รอเกิน ${timeoutMs / 1000} วินาที) กรุณาลองใหม่อีกครั้ง`;
      console.warn(`[LockService] Failed to acquire lock for "${operationName}" after ${timeoutMs}ms.`);
      throw new Error(errMsg);
    }

    console.info(`[LockService] Lock acquired for "${operationName}". Executing critical section...`);
    const result = callback();
    return result;
  } catch (err) {
    console.error(`[LockService] Error during locked operation "${operationName}": ${err.message}`);
    throw err;
  } finally {
    if (lockAcquired) {
      try {
        lock.releaseLock();
        console.info(`[LockService] Lock released for "${operationName}".`);
      } catch (releaseErr) {
        console.warn(`[LockService] Error releasing lock for "${operationName}": ${releaseErr.message}`);
      }
    }
  }
}

/**
 * Executes a callback function inside a DocumentLock mutex (bound to active spreadsheet).
 * 
 * @param {Function} callback Function to execute
 * @param {number} [timeoutMs=10000] Timeout in milliseconds
 * @param {string} [operationName='DocOperation'] Descriptive name
 * @returns {*}
 */
function withDocumentLock(callback, timeoutMs = 10000, operationName = 'DocOperation') {
  const lock = LockService.getDocumentLock();
  if (!lock) {
    // If standalone and document lock unavailable, fallback to script lock
    return withScriptLock(callback, timeoutMs, operationName);
  }

  let lockAcquired = false;
  try {
    lockAcquired = lock.tryLock(timeoutMs);
    if (!lockAcquired) {
      throw new Error(`DOC_LOCK_TIMEOUT: ระบบกำลังมีผู้ใช้งานอื่นทำรายการ "${operationName}" กรุณาลองใหม่`);
    }
    return callback();
  } finally {
    if (lockAcquired) {
      try { lock.releaseLock(); } catch (e) {}
    }
  }
}
