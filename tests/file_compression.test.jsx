import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  compressImage,
  compressImageFile,
  getBase64SizeBytes,
  calculateScaledDimensions,
  formatFileSize,
  isImageFile,
  MAX_IMAGE_DIMENSION,
  DEFAULT_IMAGE_QUALITY,
  MAX_IMAGE_SIZE_BYTES
} from '../src/utils/fileUtils';

describe('Unit & Integration Suite: Client-Side Image Compression (fileUtils.js)', () => {

  describe('1. Dimension & Size Calculations', () => {
    it('accurately calculates byte size of Base64 strings and DataURLs', () => {
      // 4 Base64 chars = 3 bytes
      const testBase64 = 'data:image/jpeg;base64,QUJD'; // "ABC" -> 3 bytes
      expect(getBase64SizeBytes(testBase64)).toBe(3);

      const oneByte = 'data:image/jpeg;base64,QQ=='; // 1 byte ("A")
      expect(getBase64SizeBytes(oneByte)).toBe(1);

      const twoBytes = 'data:image/jpeg;base64,QUI='; // 2 bytes ("AB")
      expect(getBase64SizeBytes(twoBytes)).toBe(2);

      expect(getBase64SizeBytes('')).toBe(0);
      expect(getBase64SizeBytes(null)).toBe(0);
    });

    it('scales large landscape images so max dimension is <= 1280px preserving aspect ratio', () => {
      // 4000 x 3000 -> 1280 x 960 (ratio 0.32)
      const scaled = calculateScaledDimensions(4000, 3000, 1280, 1280);
      expect(scaled.width).toBe(1280);
      expect(scaled.height).toBe(960);
      expect(scaled.width).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
      expect(scaled.height).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
    });

    it('scales large portrait images so max height is <= 1280px preserving aspect ratio', () => {
      // 3000 x 4000 -> 960 x 1280
      const scaled = calculateScaledDimensions(3000, 4000, 1280, 1280);
      expect(scaled.width).toBe(960);
      expect(scaled.height).toBe(1280);
      expect(scaled.width).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
      expect(scaled.height).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
    });

    it('does not upscale images that are already smaller than 1280px', () => {
      const scaled = calculateScaledDimensions(800, 600, 1280, 1280);
      expect(scaled.width).toBe(800);
      expect(scaled.height).toBe(600);
    });

    it('formats file sizes into human-readable strings', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(150 * 1024)).toBe('150 KB');
      expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
    });

    it('identifies image files and non-image files correctly', () => {
      expect(isImageFile({ type: 'image/jpeg', name: 'photo.jpg' })).toBe(true);
      expect(isImageFile({ type: 'image/png', name: 'diagram.png' })).toBe(true);
      expect(isImageFile({ type: 'image/webp', name: 'item.webp' })).toBe(true);
      expect(isImageFile({ type: 'application/pdf', name: 'quote.pdf' })).toBe(false);
      expect(isImageFile('data:image/jpeg;base64,...')).toBe(true);
      expect(isImageFile(null)).toBe(false);
    });
  });

  describe('2. Canvas-Based Image Compression Lifecycle', () => {
    let originalDocument;
    let originalImage;
    let originalURL;

    beforeEach(() => {
      originalDocument = global.document;
      originalImage = global.Image;
      originalURL = global.URL;
    });

    afterEach(() => {
      global.document = originalDocument;
      global.Image = originalImage;
      global.URL = originalURL;
      vi.restoreAllMocks();
    });

    it('compresses a simulated large photo to <= 1280px, quality 0.7-0.75, and size < 150 KB', async () => {
      // Mock Canvas and Image in Node test environment
      class MockImage {
        constructor() {
          this.naturalWidth = 4032;
          this.naturalHeight = 3024;
          this.width = 4032;
          this.height = 3024;
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      }
      global.Image = MockImage;

      const mockCtx = {
        fillStyle: '#FFFFFF',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        imageSmoothingEnabled: false,
        imageSmoothingQuality: 'low'
      };

      let capturedQuality = null;
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => mockCtx),
        toDataURL: vi.fn((type, quality) => {
          capturedQuality = quality;
          // Simulate output base64 data under 150 KB (~110 KB)
          // 110 KB = ~146,000 characters
          const payload = 'A'.repeat(146000);
          return `data:${type};base64,${payload}`;
        })
      };

      global.document = {
        createElement: (tag) => (tag === 'canvas' ? mockCanvas : {})
      };

      const largeSource = 'data:image/jpeg;base64,' + 'B'.repeat(500000); // simulated 375 KB source
      const result = await compressImage(largeSource, {
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 0.75,
        maxSizeBytes: MAX_IMAGE_SIZE_BYTES
      });

      // Assertions
      expect(result.width).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
      expect(result.height).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
      expect(result.width).toBe(1280);
      expect(result.height).toBe(960);
      expect(capturedQuality).toBeGreaterThanOrEqual(0.70);
      expect(capturedQuality).toBeLessThanOrEqual(0.75);
      expect(result.size).toBeLessThan(MAX_IMAGE_SIZE_BYTES); // < 150 KB
      expect(result.dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.drawImage).toHaveBeenCalled();
    });

    it('iteratively lowers quality when canvas output initially exceeds 150 KB', async () => {
      class MockImage {
        constructor() {
          this.naturalWidth = 2000;
          this.naturalHeight = 2000;
          setTimeout(() => { if (this.onload) this.onload(); }, 0);
        }
      }
      global.Image = MockImage;

      const mockCtx = {
        fillRect: vi.fn(),
        drawImage: vi.fn()
      };

      let callCount = 0;
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: () => mockCtx,
        toDataURL: vi.fn((type, quality) => {
          callCount++;
          // First call: 200 KB (> 150 KB), Second call: 120 KB (< 150 KB)
          const charLen = callCount === 1 ? 280000 : 160000;
          return `data:${type};base64,${'X'.repeat(charLen)}`;
        })
      };

      global.document = {
        createElement: (tag) => (tag === 'canvas' ? mockCanvas : {})
      };

      const result = await compressImage('data:image/png;base64,dummy', {
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 0.75,
        maxSizeBytes: 150 * 1024
      });

      expect(callCount).toBeGreaterThan(1);
      expect(result.size).toBeLessThan(MAX_IMAGE_SIZE_BYTES);
    });

    it('compressImageFile processes a File object into compressed metadata', async () => {
      class MockImage {
        constructor() {
          this.naturalWidth = 1920;
          this.naturalHeight = 1080;
          setTimeout(() => { if (this.onload) this.onload(); }, 0);
        }
      }
      global.Image = MockImage;
      global.URL = {
        createObjectURL: () => 'blob:mock-url',
        revokeObjectURL: vi.fn()
      };

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: () => ({ fillRect: vi.fn(), drawImage: vi.fn() }),
        toDataURL: () => 'data:image/jpeg;base64,' + 'Z'.repeat(100000)
      };

      global.document = {
        createElement: (tag) => (tag === 'canvas' ? mockCanvas : {})
      };

      const fakeFile = new File(['mock content'], 'large-product-photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(fakeFile, 'size', { value: 5 * 1024 * 1024 }); // 5 MB

      const compressed = await compressImageFile(fakeFile, {
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 0.75,
        maxSizeBytes: 150 * 1024
      });

      expect(compressed.isImage).toBe(true);
      expect(compressed.isCompressed).toBe(true);
      expect(compressed.size).toBeLessThan(MAX_IMAGE_SIZE_BYTES);
      expect(compressed.previewUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
      expect(compressed.width).toBeLessThanOrEqual(1280);
      expect(compressed.originalSize).toBe(5 * 1024 * 1024);
    });

    it('compressImageFile passes through non-image files (e.g. PDF) untouched', async () => {
      const pdfFile = new File(['pdf data'], 'quotation.pdf', { type: 'application/pdf' });
      Object.defineProperty(pdfFile, 'size', { value: 250000 });

      const result = await compressImageFile(pdfFile);
      expect(result.isImage).toBe(false);
      expect(result.isCompressed).toBe(false);
      expect(result.name).toBe('quotation.pdf');
      expect(result.size).toBe(250000);
    });
  });

  describe('3. Fallback Environment Resilience', () => {
    it('handles non-DOM environment safely without throwing exceptions', async () => {
      const originalDoc = global.document;
      delete global.document;

      const fallbackResult = await compressImage('data:image/jpeg;base64,QUJD', {
        maxWidth: 1280,
        maxHeight: 1280
      });

      expect(fallbackResult).toBeDefined();
      expect(fallbackResult.dataUrl).toBe('data:image/jpeg;base64,QUJD');
      expect(fallbackResult.size).toBe(3);

      global.document = originalDoc;
    });
  });
});
