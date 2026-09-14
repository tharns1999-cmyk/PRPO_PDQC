// Test Setup: In-Memory LocalStorage Mock for Vitest / Node environment
import { beforeEach } from 'vitest';

class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  clear() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] !== undefined ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
}

global.localStorage = new LocalStorageMock();

// Fallback fetch in test/node environment: reject with standard network error so services cleanly fall back to storageService
global.fetch = () => Promise.reject(new TypeError('Failed to fetch'));

beforeEach(() => {
  global.localStorage.clear();
});
