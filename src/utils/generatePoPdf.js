import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { storageService } from '../services/storageService.js';

/**
 * Thai PUA Glyphs Shaper & Normalizer for PDF-lib / TrueType fonts
 *
 * Resolves fontkit / pdf-lib font shaping limitation where stacked combining marks
 * (e.g. upper vowel + tone mark like "สั่", "ซื้", "ชื่", "ยิ่") do not get HarfBuzz layout,
 * causing tone marks to have non-zero advance width and pushing following letters away.
 *
 * Converts Unicode decomposed tone marks & vowels into Thai PUA (U+F700 - U+F71A) glyphs:
 * - Level 2 tone marks on upper vowels: U+F713 - U+F717 (advance width = 0, placed above upper vowel)
 * - Level 1 tone marks on ascender consonants (ป, ฝ, ฟ): U+F705 - U+F709 (shifted left)
 * - Upper vowels on ascender consonants: U+F701 - U+F704, U+F710 - U+F712 (shifted left)
 * - Consonants with tails (ญ, ฐ) before lower vowels: U+F700, U+F70F (cut lower tail)
 * - Lower vowels below deep descenders (ฎ, ฏ): U+F718 - U+F71A (shifted down)
 */
export function shapeThaiText(str) {
  if (!str) return '';
  let text = String(str).normalize('NFC');

  // 1. Swap tone marks and upper vowels if tone mark was entered first
  // Upper vowels: ั (0E31), ิ-ื (0E34-0E37), ็ (0E47), ํ (0E4D)
  // Tone marks: ่-๋ (0E48-0E4B), ์ (0E4C)
  text = text.replace(/([\u0E48-\u0E4C])([\u0E31\u0E34-\u0E37\u0E47\u0E4D])/g, '$2$1');

  // 2. Remove duplicate consecutive vowels or tone marks
  text = text.replace(/([\u0E31\u0E34-\u0E37\u0E47\u0E4D])\1+/g, '$1');
  text = text.replace(/([\u0E48-\u0E4C])\1+/g, '$1');

  // 3. Strip zero-width or invisible control chars
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, '');

  const chars = Array.from(text);
  const result = [];

  const isAscender = (c) => /[\u0E1B\u0E1D\u0E1F]/.test(c); // ป ฝ ฟ
  const isDescenderCut = (c) => /[\u0E0D\u0E10]/.test(c); // ญ ฐ
  const isDescenderDeep = (c) => /[\u0E0E\u0E0F]/.test(c); // ฎ ฏ
  const isUpperVowel = (c) => /[\u0E31\u0E34-\u0E37\u0E47\u0E4D\uF701-\uF704\uF710-\uF712]/.test(c);
  const isToneMark = (c) => /[\u0E48-\u0E4C]/.test(c);
  const isLowerVowel = (c) => /[\u0E38-\u0E3A]/.test(c);

  const toneToLevel2 = {
    '\u0E48': '\uF713', // mai ek level 2
    '\u0E49': '\uF714', // mai tho level 2
    '\u0E4A': '\uF715', // mai tri level 2
    '\u0E4B': '\uF716', // mai chattawa level 2
    '\u0E4C': '\uF717', // thanthakhat level 2
  };

  const toneToShiftLeft = {
    '\u0E48': '\uF705', // mai ek shifted left
    '\u0E49': '\uF706', // mai tho shifted left
    '\u0E4A': '\uF707', // mai tri shifted left
    '\u0E4B': '\uF708', // mai chattawa shifted left
    '\u0E4C': '\uF709', // thanthakhat shifted left
  };

  const upperVowelToShiftLeft = {
    '\u0E34': '\uF701',
    '\u0E35': '\uF702',
    '\u0E36': '\uF703',
    '\u0E37': '\uF704',
    '\u0E31': '\uF710',
    '\u0E47': '\uF711',
    '\u0E4D': '\uF712',
  };

  const lowerVowelShiftDown = {
    '\u0E38': '\uF718',
    '\u0E39': '\uF719',
    '\u0E3A': '\uF71A',
  };

  for (let i = 0; i < chars.length; i++) {
    let c = chars[i];
    const prev1 = i > 0 ? result[i - 1] : '';

    // Consonant with lower tail followed by lower vowel (ตัดหางล่าง ญ, ฐ)
    if (isDescenderCut(c) && i + 1 < chars.length && isLowerVowel(chars[i + 1])) {
      c = c === '\u0E0D' ? '\uF700' : '\uF70F';
    } 
    // Lower vowel on deep descenders
    else if (isLowerVowel(c) && (isDescenderDeep(prev1) || prev1 === '\uF700' || prev1 === '\uF70F')) {
      c = lowerVowelShiftDown[c] || c;
    } 
    // Tone mark on top of upper vowel (LEVEL 2 STACKING) -> Prevents spacing detachment
    else if (isToneMark(c) && isUpperVowel(prev1)) {
      c = toneToLevel2[c] || c;
    } 
    // Tone mark directly on ascender consonant (no upper vowel)
    else if (isToneMark(c) && isAscender(prev1)) {
      c = toneToShiftLeft[c] || c;
    } 
    // Upper vowel on ascender consonant
    else if (isUpperVowel(c) && isAscender(prev1)) {
      c = upperVowelToShiftLeft[c] || c;
    }

    result.push(c);
  }

  return result.join('');
}

/**
 * Backwards-compatible Thai text normalizer (now with Thai PUA shaping enabled)
 */
export function normalizeThaiText(str) {
  return shapeThaiText(str);
}

/**
 * Truncate text according to exact font width in points
 * Uses Unicode Grapheme Clusters (Intl.Segmenter) so Thai compound vowels
 * and tone marks are not broken into separated code points.
 */
export function truncateText(text, font, size, maxWidth = 230) {
  if (!text) return '-';
  const clean = shapeThaiText(text);
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) {
    return clean;
  }

  const ellipsis = '...';
  const ellipsisWidth = font.widthOfTextAtSize(ellipsis, size);
  const targetWidth = maxWidth - ellipsisWidth;

  let truncated = '';
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('th', { granularity: 'grapheme' });
    for (const { segment } of segmenter.segment(text)) {
      const candidate = truncated + segment;
      const shapedCandidate = shapeThaiText(candidate);
      if (font.widthOfTextAtSize(shapedCandidate, size) > targetWidth) {
        break;
      }
      truncated = candidate;
    }
  } else {
    for (const char of Array.from(text)) {
      const candidate = truncated + char;
      const shapedCandidate = shapeThaiText(candidate);
      if (font.widthOfTextAtSize(shapedCandidate, size) > targetWidth) {
        break;
      }
      truncated = candidate;
    }
  }

  return shapeThaiText(truncated.trim() || Array.from(text).slice(0, 15).join('')) + ellipsis;
}

export function splitTextToLines(text, font, size, maxWidth) {
  if (!text) return [];
  const clean = shapeThaiText(text);
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) {
    return [clean];
  }

  const lines = [];
  let currentLine = '';

  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
    for (const { segment } of segmenter.segment(text)) {
      const candidate = currentLine + segment;
      const shapedCandidate = shapeThaiText(candidate);
      if (font.widthOfTextAtSize(shapedCandidate, size) > maxWidth && currentLine.length > 0) {
        lines.push(shapeThaiText(currentLine).trim());
        currentLine = segment;
      } else {
        currentLine = candidate;
      }
    }
  } else {
    for (const char of Array.from(text)) {
      const candidate = currentLine + char;
      const shapedCandidate = shapeThaiText(candidate);
      if (font.widthOfTextAtSize(shapedCandidate, size) > maxWidth && currentLine.length > 0) {
        lines.push(shapeThaiText(currentLine).trim());
        currentLine = char;
      } else {
        currentLine = candidate;
      }
    }
  }

  if (currentLine.trim()) {
    lines.push(shapeThaiText(currentLine).trim());
  }

  return lines;
}

export function wrapText(text, font, size, maxWidth) {
  if (!text) return [];
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    try {
      const segLines = splitTextToLines(text, font, size, maxWidth);
      if (segLines && segLines.length > 0) return segLines;
    } catch {}
  }

  const words = String(text).split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, size);
    if (width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [text];
}

/**
 * ฟังก์ชันจัดรูปแบบวันเวลาเอกสาร (ISO, YYYY-MM-DD, Thai String) ให้อยู่ในฟอร์แมต "วันที่ DD/MM/YYYY เวลา HH:mm น." (ค.ศ.)
 */
export function formatDocDateTime(dt) {
  if (!dt || dt === '-') return 'วันที่ ..... / ..... / .........';
  try {
    const str = String(dt).trim();
    const cleanStr = str.replace(/^วันที่\s*/, '');
    
    // 1. ตรวจสอบว่าเป็น ISO String หรือ Date Parseable (ยกเว้นรูปแบบ DD/MM/YYYY ที่มีเครื่องหมาย / เพื่อป้องกัน JS ตีความเป็น MM/DD/YYYY)
    const d = !cleanStr.includes('/') ? new Date(cleanStr) : new Date(NaN);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      let year = d.getFullYear();
      if (year > 2400) year -= 543; // บังคับแปลง พ.ศ. เป็น ค.ศ.
      
      if (cleanStr.includes('T') || cleanStr.includes(':')) {
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `วันที่ ${day}/${month}/${year} เวลา ${hours}:${minutes} น.`;
      }
      return `วันที่ ${day}/${month}/${year}`;
    }

    // 2. จัดการกรณีสตริงภาษาไทยที่มีเวลาปนมา เช่น "11/09/2026 08:30" หรือ "11/9/2569 เวลา 21:42 น."
    const match = cleanStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(?:เวลา\s*)?(\d{1,2}):(\d{1,2}))?/);
    if (match) {
      const [, day, month, rawYear, hh, mm] = match;
      let year = Number(rawYear);
      if (year > 2400) year -= 543;
      const dd = String(Number(day)).padStart(2, '0');
      const mmStr = String(Number(month)).padStart(2, '0');
      if (hh !== undefined && mm !== undefined) {
        return `วันที่ ${dd}/${mmStr}/${year} เวลา ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} น.`;
      }
      return `วันที่ ${dd}/${mmStr}/${year}`;
    }

    return str.startsWith('วันที่') ? str : `วันที่ ${str}`;
  } catch {
    return String(dt);
  }
}

export const formatDateTime = formatDocDateTime;

export async function generatePoPdf(po) {
  // Ensure Thai web fonts are loaded prior to rendering
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // 1. โหลดฟอนต์ TH Sarabun New รองรับภาษาไทยและชุดอักขระ Thai PUA Glyphs (U+F700 - U+F71A)
  const loadFontBytes = async (localPath, fallbackCdnUrl) => {
    try {
      const res = await fetch(localPath);
      if (res.ok) return await res.arrayBuffer();
    } catch {
      // ignore and fallback
    }
    const cdnRes = await fetch(fallbackCdnUrl);
    return await cdnRes.arrayBuffer();
  };

  const [fontBytes, boldFontBytes] = await Promise.all([
    loadFontBytes(
      '/fonts/THSarabunNew.ttf',
      'https://cdn.jsdelivr.net/npm/font-th-sarabun-new@1.0.0/fonts/THSarabunNew-webfont.ttf'
    ),
    loadFontBytes(
      '/fonts/THSarabunNew-Bold.ttf',
      'https://cdn.jsdelivr.net/npm/font-th-sarabun-new@1.0.0/fonts/THSarabunNew_bold-webfont.ttf'
    ),
  ]);

  const customFont = await pdfDoc.embedFont(fontBytes);
  const boldFont = await pdfDoc.embedFont(boldFontBytes);

  // 2. ขนาดกระดาษ A4 และขอบเขตหน้ากระดาษ (Page Boundaries)
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const rightX = 555; // width - marginX (595.28 - 40 ≈ 555.28)


  // โหลดรูปภาพตราสัญลักษณ์บริษัท (SC Logo)
  let logoImage = null;
  try {
    const logoRes = await fetch('/images/sc-logo.png');
    if (logoRes.ok) {
      const logoBytes = await logoRes.arrayBuffer();
      logoImage = await pdfDoc.embedPng(logoBytes);
    }
  } catch (err) {
    console.warn('Cannot load PO logo for PDF:', err);
  }

  // 4. ส่วนหัวเอกสารควบคุม (QMS/DCC Header)
  // ── Y เริ่มต้นของหัวเอกสาร (บรรทัดแรก = ชื่อบริษัท) ──
  const headerStartY = height - 52;

  // บริษัท เศรษฐชล จำกัด (ฝั่งซ้าย)
  if (logoImage) {
    // ── โลโก้รักษาสัดส่วนภาพจริง (scaleToFit 46×46) วางที่ x: 42, y: 752 ──
    const logoDims = logoImage.scaleToFit ? logoImage.scaleToFit(46, 46) : { width: 44, height: 44 };
    page.drawImage(logoImage, {
      x: 42,
      y: 752,
      width: logoDims.width,
      height: logoDims.height,
    });
    // บรรทัด 1: ชื่อบริษัท (Y = headerStartY)
    page.drawText(normalizeThaiText('บริษัท เศรษฐชล จำกัด (สำนักงานใหญ่)'), {
      x: 98, y: headerStartY, size: 14, font: boldFont, color: rgb(0.1, 0.1, 0.2)
    });
    // บรรทัด 2: ที่อยู่ บรรทัด 1 (ตัดคำป้องกันการทับซ้อนกับฝั่งขวา) (Y -= 16 pt)
    page.drawText(normalizeThaiText('ที่อยู่ 225 หมู่ที่ 12 ถนนเทพารักษ์ ตำบลบางพลีใหญ่'), {
      x: 98, y: headerStartY - 16, size: 9, font: customFont, color: rgb(0.3, 0.3, 0.3)
    });
    // บรรทัด 3: ที่อยู่ บรรทัด 2 (Y -= 15 pt = headerStartY - 31)
    page.drawText(normalizeThaiText('อำเภอบางพลี จังหวัดสมุทรปราการ 10540'), {
      x: 98, y: headerStartY - 31, size: 9, font: customFont, color: rgb(0.3, 0.3, 0.3)
    });
    // บรรทัด 4: TAX ID (Y -= 15 pt = headerStartY - 46)
    page.drawText(normalizeThaiText('เลขประจำตัวผู้เสียภาษี (TAX ID): 0-10553-2104-63-7'), {
      x: 98, y: headerStartY - 46, size: 9, font: customFont, color: rgb(0.3, 0.3, 0.3)
    });
  } else {
    // บรรทัด 1: ชื่อบริษัท
    page.drawText(normalizeThaiText('บริษัท เศรษฐชล จำกัด (สำนักงานใหญ่)'), {
      x: 42, y: headerStartY, size: 14, font: boldFont, color: rgb(0.1, 0.1, 0.2)
    });
    // บรรทัด 2: ที่อยู่ บรรทัด 1 (Y -= 16 pt)
    page.drawText(normalizeThaiText('ที่อยู่ 225 หมู่ที่ 12 ถนนเทพารักษ์ ตำบลบางพลีใหญ่'), {
      x: 42, y: headerStartY - 16, size: 9, font: customFont, color: rgb(0.3, 0.3, 0.3)
    });
    // บรรทัด 3: ที่อยู่ บรรทัด 2 (Y -= 15 pt)
    page.drawText(normalizeThaiText('อำเภอบางพลี จังหวัดสมุทรปราการ 10540'), {
      x: 42, y: headerStartY - 31, size: 9, font: customFont, color: rgb(0.3, 0.3, 0.3)
    });
    // บรรทัด 4: TAX ID (Y -= 15 pt)
    page.drawText(normalizeThaiText('เลขประจำตัวผู้เสียภาษี (TAX ID): 0-10553-2104-63-7'), {
      x: 42, y: headerStartY - 46, size: 9, font: customFont, color: rgb(0.3, 0.3, 0.3)
    });
  }

  // ── ข้อมูลเลขที่ PO และวันที่ออก PO (ชิดขอบขวาสุด rightX = 555, ไม่มีกรอบสี่เหลี่ยม) ──
  const poNoText = normalizeThaiText(`เลขที่ PO: ${po?.poNo || po?.id || po?.poNumber || '-'}`);
  const poDateText = normalizeThaiText(`วันที่ออก PO: ${po?.issueDate || po?.createdAt || '-'}`);
  const poMetaSize = 9;
  let poNoX = 440;
  let poDateX = 440;
  try {
    poNoX = rightX - boldFont.widthOfTextAtSize(poNoText, poMetaSize);
    poDateX = rightX - customFont.widthOfTextAtSize(poDateText, poMetaSize);
  } catch {
    poNoX = 440;
    poDateX = 440;
  }
  // บรรทัดที่ 1 (เลขที่ PO): ใช้พิกัด Y ระนาบเดียวกับ "บริษัท เศรษฐชล จำกัด"
  page.drawText(poNoText, {
    x: poNoX,
    y: headerStartY,
    size: poMetaSize,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.2),
  });
  // บรรทัดที่ 2 (วันที่ออก PO): ใช้พิกัด Y ระนาบเดียวกับที่อยู่บรรทัดที่ 1
  page.drawText(poDateText, {
    x: poDateX,
    y: headerStartY - 16,
    size: poMetaSize,
    font: customFont,
    color: rgb(0.3, 0.3, 0.3),
  });

  // ── ชื่อเอกสาร "ใบสั่งซื้อสินค้า / PURCHASE ORDER" (กึ่งกลางหน้ากระดาษ พร้อมระยะเว้นบนและล่าง) ──
  const titleText = normalizeThaiText('ใบสั่งซื้อสินค้า / PURCHASE ORDER');
  const titleSize = 14;
  const titleY = 700; // เว้นระยะห่างจาก TAX ID ด้านบนไม่น้อยกว่า 40 pt
  let titleX = 180;
  try {
    titleX = (width - boldFont.widthOfTextAtSize(titleText, titleSize)) / 2;
  } catch {
    titleX = 180;
  }
  page.drawText(titleText, {
    x: titleX,
    y: titleY,
    size: titleSize,
    font: boldFont,
    color: rgb(0.15, 0.25, 0.55),
  });

  // ── รวมบรรทัดอ้างอิง PR และแผนกผู้ขอ (Single Line) ──
  let currentY = 678;
  const prDeptText = `อ้างอิงใบขอซื้อ (PR): ${po?.prNo || po?.prNumber || po?.prId || '-'}   |   แผนกผู้ขอ: ${po?.department || 'ฝ่ายผลิตและควบคุมคุณภาพ (PD)'}`;
  page.drawText(normalizeThaiText(prDeptText), {
    x: 42,
    y: currentY,
    size: 9.5,
    font: customFont,
    color: rgb(0.2, 0.25, 0.3),
  });

  // เว้นระยะห่างก่อนขึ้นหัวข้อข้อมูลคู่ค้าอย่างน้อย 26 pt ป้องกันสระและวรรณยุกต์ชนกันเด็ดขาด
  currentY -= 26; // 678 - 26 = 652

  // Fetch Master Vendor Data
  let vendors = [];
  try {
    vendors = storageService.getVendors() || [];
  } catch {}

  const targetVendorId = po?.vendorId || (typeof po?.vendor === 'object' ? po?.vendor?.id : null) || po?.vendorCode;
  const targetVendorName = po?.vendorName || (typeof po?.vendor === 'string' ? po?.vendor : po?.vendor?.name) || po?.shopName;

  const masterVendor = vendors.find(v => 
    (targetVendorId && (v.id === targetVendorId || v.code === targetVendorId)) ||
    (targetVendorName && v.name && v.name.trim().toLowerCase() === targetVendorName.trim().toLowerCase()) ||
    (targetVendorName && v.code && v.code.trim().toLowerCase() === targetVendorName.trim().toLowerCase())
  );

  const vendorObj = po?.vendorDetails || (typeof po?.vendor === 'object' ? po?.vendor : null) || masterVendor || {};

  const vendorCode = masterVendor?.code || vendorObj.code || po?.vendorCode || po?.vendorId || '-';
  const rawVendorName = masterVendor?.name || vendorObj.name || vendorObj.companyName || targetVendorName || 'สั่งซื้อออนไลน์ (Shopee / Lazada)';
  const vendorName = String(rawVendorName).startsWith('ผู้จำหน่าย:') ? rawVendorName.replace(/^ผู้จำหน่าย:\s*/, '') : rawVendorName;
  const vendorTaxId = masterVendor?.taxId || vendorObj.taxId || '-';
  const vendorContactPerson = masterVendor?.contactPerson || vendorObj.contactPerson || '-';
  const vendorPhone = masterVendor?.phone || vendorObj.phone || '-';
  const vendorAddress = masterVendor?.address || vendorObj.address || '-';

  // ── Vendor Block: Grid Baseline Matching & Dynamic Y Flow ──
  const colLeftX = 42;
  const maxLeftWidth = 365; // รองรับความกว้างสูงสุดได้ถึง 365 pt ก่อนตัดบรรทัดใหม่
  const colRightX = 415; // แนวขนานกับตารางสินค้าและขอบขวาของเอกสาร

  // บรรทัดหัวข้อเดี่ยว (Standalone Title: ฝั่งขวาว่างไว้ ไม่วางรหัสผู้ขายที่บรรทัดนี้)
  page.drawText(normalizeThaiText('ข้อมูลคู่ค้า / ผู้จำหน่าย (VENDOR DETAILS):'), {
    x: colLeftX,
    y: currentY,
    size: 10,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  currentY -= 18; // 652 - 18 = 634 (เว้นระยะห่างก่อนเริ่มแถวข้อมูลแถวแรก)

  // แถวที่ 1 (y = 634): ชื่อบริษัท (ซ้าย, x=42) คู่กับ รหัสผู้ขาย (ขวา, x=415)
  let vendorY = currentY;
  const nameLines = wrapText(`ชื่อบริษัท/ร้านค้า: ${vendorName}`, customFont, 9, maxLeftWidth);
  nameLines.forEach((line, i) => {
    page.drawText(normalizeThaiText(line), { x: colLeftX, y: vendorY - (i * 16), size: 9, font: customFont });
  });
  page.drawText(normalizeThaiText(`รหัสผู้ขาย: ${vendorCode}`), {
    x: colRightX, y: vendorY, size: 9, font: customFont
  });
  vendorY -= (nameLines.length > 1 ? (nameLines.length - 1) * 16 + 18 : 18);

  // แถวที่ 2 (y = 616): เลขผู้เสียภาษี (ซ้าย, x=42) คู่กับ ผู้ติดต่อ (ขวา, x=415)
  page.drawText(normalizeThaiText(`เลขประจำตัวผู้เสียภาษี: ${vendorTaxId}`), {
    x: colLeftX, y: vendorY, size: 9, font: customFont
  });
  page.drawText(normalizeThaiText(`ผู้ติดต่อ: ${vendorContactPerson}`), {
    x: colRightX, y: vendorY, size: 9, font: customFont
  });
  vendorY -= 18;

  // แถวที่ 3 (y = 598): ที่อยู่ (ซ้าย, x=42) คู่กับ โทรศัพท์ (ขวา, x=415)
  const addrLines = wrapText(`ที่อยู่: ${vendorAddress}`, customFont, 9, maxLeftWidth);
  addrLines.forEach((line, i) => {
    page.drawText(normalizeThaiText(line), { x: colLeftX, y: vendorY - (i * 16), size: 9, font: customFont });
  });
  page.drawText(normalizeThaiText(`โทรศัพท์: ${vendorPhone}`), {
    x: colRightX, y: vendorY, size: 9, font: customFont
  });
  const lastAddrY = vendorY - (addrLines.length - 1) * 16;

  // 6. ตารางรายการสินค้า (tableStartY อยู่ใต้บรรทัดที่อยู่ลงมาอย่างน้อย 24 pt, ประมาณ y = 568 pt)
  const tableStartY = Math.min(568, lastAddrY - 24);
  const tableTop = tableStartY;
  page.drawRectangle({ x: 50, y: tableTop - 20, width: width - 100, height: 20, color: rgb(0.95, 0.96, 0.98) });
  page.drawText('#', { x: 58, y: tableTop - 14, size: 9, font: boldFont });
  page.drawText(normalizeThaiText('รหัสสินค้า / รายละเอียดพัสดุ'), { x: 80, y: tableTop - 14, size: 9, font: boldFont });
  page.drawText(normalizeThaiText('จำนวน'), { x: 330, y: tableTop - 14, size: 9, font: boldFont });
  page.drawText(normalizeThaiText('ราคา/หน่วย'), { x: 410, y: tableTop - 14, size: 9, font: boldFont });
  page.drawText(normalizeThaiText('รวมเงิน (บาท)'), { x: 480, y: tableTop - 14, size: 9, font: boldFont });

  let rowY = tableTop - 38;
  const items = po?.items || [
    { code: 'PD-OIL-068', name: 'น้ำมันไฮดรอลิกอุตสาหกรรม (Hydraulic Oil ISO VG 68)', qty: 1, unit: 'ถัง (200L)', price: 14500, total: 14500 }
  ];

  const isOnlinePO = Boolean(
    po?.purchaseChannel === 'ONLINE' || 
    po?.orderType === 'ONLINE' ||
    po?.channel === 'online'
  );

  items.forEach((item, index) => {
    // Row index
    page.drawText(String(index + 1), { x: 58, y: rowY, size: 9, font: customFont });
    
    // Product Name (Wrap text to max 230pt to prevent collision with column at x: 330)
    const rawItemTitle = `[${item.code || '-'}] ${item.name || '-'}`;
    const lines = splitTextToLines(rawItemTitle, customFont, 9, 230);
    if (isOnlinePO && (item.actualStoreName || item.storePlatform)) {
      const storeLine = `[ช่องทาง: ${item.storePlatform || 'ออนไลน์'} • ร้านค้า: ${item.actualStoreName || '-'}]`;
      lines.push(...splitTextToLines(storeLine, customFont, 8, 230));
    }
    
    lines.forEach((line, i) => {
      page.drawText(line, { x: 80, y: rowY - (i * 12), size: 9, font: customFont });
    });

    // Qty and Unit
    page.drawText(normalizeThaiText(`${item.qty || 1} ${item.unit || ''}`), { x: 330, y: rowY, size: 9, font: customFont });
    
    // Unit Price
    page.drawText(Number(item.price || item.actualPrice || item.unitPrice || 0).toLocaleString(), { x: 410, y: rowY, size: 9, font: customFont });
    
    // Total Line Amount
    page.drawText(Number(item.total || item.lineTotal || ((item.qty || 1) * (item.price || 0)) || 0).toLocaleString(), { x: 480, y: rowY, size: 9, font: customFont });
    
    const rowHeight = Math.max(1, lines.length) * 12 + 8;
    rowY -= rowHeight;
  });

  page.drawLine({ start: { x: 50, y: rowY - 5 }, end: { x: width - 50, y: rowY - 5 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });

  const itemsSubtotal = (po?.items || []).reduce((sum, item) => {
    const p = parseFloat(item.price) || 0;
    const q = parseFloat(item.qty ?? item.purchaseQty) || 1;
    const disc = parseFloat(item.discountAmount) || 0;
    const lineTotal = item.total !== undefined ? parseFloat(item.total) : ((p * q) - disc);
    return sum + (lineTotal > 0 ? lineTotal : 0);
  }, 0);

  const subtotal = (po?.financials?.subtotal !== undefined && Number(po.financials.subtotal) > 0)
    ? Number(po.financials.subtotal)
    : ((po?.subtotal !== undefined && Number(po.subtotal) > 0) ? Number(po.subtotal) : itemsSubtotal);

  const hasVat = po?.hasVat !== undefined
    ? Boolean(po.hasVat)
    : (po?.financials?.hasVat !== undefined
        ? Boolean(po.financials.hasVat)
        : (po?.financials?.vatMode ? po.financials.vatMode !== 'NONE' : Number(po?.vat) > 0));

  const vatAmount = hasVat
    ? (po?.financials?.vatAmount !== undefined
        ? Number(po.financials.vatAmount)
        : (po?.vat !== undefined && Number(po.vat) > 0 ? Number(po.vat) : parseFloat((subtotal * 0.07).toFixed(2))))
    : 0;

  const grandTotal = (po?.financials?.grandTotal !== undefined && Number(po.financials.grandTotal) > 0)
    ? Number(po.financials.grandTotal)
    : (po?.grandTotal !== undefined && Number(po.grandTotal) > 0
        ? Number(po.grandTotal)
        : (po?.totalAmount !== undefined && Number(po.totalAmount) > 0
            ? Number(po.totalAmount)
            : parseFloat((subtotal + vatAmount).toFixed(2))));

  // 3 Lines Financial Breakdown (Compact Official Document Typography with Comfortable Spacing)
  page.drawText(normalizeThaiText('รวมมูลค่าสินค้า (Subtotal):'), { x: 330, y: rowY - 28, size: 9, font: boldFont });
  page.drawText(`฿${subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, { 
    x: 480, y: rowY - 28, size: 9, font: boldFont
  });

  page.drawText(normalizeThaiText('ภาษีมูลค่าเพิ่ม 7% (VAT 7%):'), { x: 330, y: rowY - 41, size: 9, font: boldFont });
  page.drawText(hasVat && vatAmount > 0 ? `฿${vatAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : normalizeThaiText('ไม่มี VAT (0%)'), { 
    x: 480, y: rowY - 41, size: 9, font: boldFont
  });

  page.drawText(normalizeThaiText('ยอดเงินรวมสุทธิ (Grand Total):'), { x: 330, y: rowY - 55, size: 10, font: boldFont });
  page.drawText(`฿${grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, { 
    x: 480, y: rowY - 55, size: 10, font: boldFont, color: rgb(0.1, 0.5, 0.3) 
  });

  // 7. กล่อง Digital Approval Stamp 4 ช่อง (Continuous Table Layout)
  const stampBoxY = 55;
  const stampBoxHeight = 90;
  const totalStampWidth = width - 100;
  const stampWidth = totalStampWidth / 4;
  const isCompleted = ['completed', 'CLOSED', 'RECEIVED'].includes(po?.status);

  // Fetch users with signatures
  let users = [];
  try {
    const res = await fetch('http://localhost:3001/api/users');
    if (res.ok) users = await res.json();
  } catch {
    // fallback
  }
  if (!users || users.length === 0) {
    users = storageService.getUsers() || [];
  }

  // Retrieve linked PR data for approval history and timestamps
  const prs = storageService.getPRs() || [];
  let prData = po?.prData || prs.find(p => p.id === po.prId || p.prNo === po.prNo || p.id === po.prNumber || p.prNo === po.prNumber) || null;
  if (!prData && (po?.prId || po?.prNo || po?.prNumber)) {
    try {
      const res = await fetch('http://localhost:3001/api/storage');
      if (res.ok) {
        const storageData = await res.json();
        const apiPrs = storageData?.prs || storageData?.PRS;
        if (Array.isArray(apiPrs)) {
          prData = apiPrs.find(p => p.id === po.prId || p.prNo === po.prNo || p.id === po.prNumber || p.prNo === po.prNumber) || null;
        }
      }
    } catch { }
  }

  // Find users for 4 signer roles
  const requesterUser = users.find(u => 
    u.name === po?.requestedBy || 
    u.displayName === po?.requestedBy || 
    u.employeeName === po?.requestedBy ||
    (po?.requestedBy && (po.requestedBy.includes(u.name) || po.requestedBy.includes(u.employeeName || ''))) ||
    u.roleId === 'REQUESTER_PD'
  ) || users.find(u => u.roleId?.includes('REQUESTER')) || users[0];

  const reviewerUser = users.find(u => 
    u.name === po?.reviewedBy || 
    u.displayName === po?.reviewedBy || 
    u.employeeName === po?.reviewedBy ||
    (po?.reviewedBy && typeof po.reviewedBy === 'string' && po.reviewedBy.includes(u.name)) ||
    (po?.reviewerName && (u.name === po.reviewerName || u.employeeName === po.reviewerName)) ||
    u.roleId === 'REVIEWER' ||
    u.roleId === 'ASST_MANAGER'
  ) || users.find(u => u.roleId?.includes('REVIEWER') || u.roleId === 'ASST_MANAGER') || users[1] || users[0];

  const approverUser = users.find(u => 
    u.roleId === 'PLANT_MANAGER' || 
    u.positionKey === 'APPROVER' || 
    u.name?.includes('ประเสริฐ')
  ) || users.find(u => u.roleId === 'PLANT_MANAGER') || users[4] || users[0];

  const receiverUser = users.find(u => 
    (po?.receivingInfo?.receiverId && u.id === po.receivingInfo.receiverId) ||
    (po?.receivingInfo?.receiverName && (u.name === po.receivingInfo.receiverName || u.employeeName === po.receivingInfo.receiverName)) ||
    u.name === po?.receivedBy || 
    u.displayName === po?.receivedBy || 
    u.employeeName === po?.receivedBy ||
    (po?.receivedBy && po.receivedBy.includes(u.name))
  ) || requesterUser;

  // Helper to embed Base64 signature
  const embedSignature = async (user) => {
    const sigStr = user?.signature || (typeof user === 'string' ? user : null);
    if (!sigStr) return null;
    try {
      if (sigStr.includes('image/jpeg') || sigStr.includes('image/jpg')) {
        return await pdfDoc.embedJpg(sigStr);
      }
      if (sigStr.includes('image/png') || sigStr.startsWith('data:image/png')) {
        return await pdfDoc.embedPng(sigStr);
      }
      return null;
    } catch (err) {
      console.warn('[generatePoPdf] Failed to embed signature for', user?.name || 'user', err.message);
      return null;
    }
  };

  const isReceivedDoc = Boolean(
    po?.receivingInfo ||
    po?.receivedAt ||
    po?.receiverSignature ||
    isCompleted
  );

  const receiverSigData = po?.receivingInfo?.receiverSignature || po?.receiverSignature || receiverUser?.signature || '/signatures/receiver-default.png';

  const [reqSigImg, revSigImg, appSigImg, recSigImg] = await Promise.all([
    embedSignature(requesterUser),
    embedSignature(reviewerUser),
    embedSignature(approverUser),
    isReceivedDoc ? embedSignature(receiverSigData || receiverUser) : null,
  ]);

  // ดึงเวลาเปิด PR จาก Log แรก หรือ submittedAt / createdAt ของ PR
  const submitLog = Array.isArray(prData?.approvalHistory)
    ? prData.approvalHistory.find(h => h.action === 'SUBMITTED' || h.action === 'CREATED')
    : null;

  // ดึงเวลาของ PR เท่านั้น ห้ามดึง po.createdAt หรือ approverDate มาทับ
  const requesterDate = submitLog?.timestamp || 
                        prData?.submittedAt || 
                        prData?.createdAt || 
                        prData?.date || 
                        po.prCreatedAt || 
                        '';

  // 2. ข้อมูลผู้ทบทวน (Reviewer)
  const reviewedLog = Array.isArray(prData?.approvalHistory)
    ? prData.approvalHistory.find(h => h.action === 'REVIEWED')
    : null;

  const isReviewed = Boolean(
    po?.reviewedAt ||
    po?.reviewerName ||
    po?.reviewerSignature ||
    po?.reviewedBy ||
    prData?.reviewedBy ||
    reviewedLog ||
    ['REVIEWED', 'APPROVED', 'PO_ISSUED', 'IN_PROGRESS_ONLINE', 'CLOSED', 'COMPLETED'].includes(String(prData?.status || po?.status || '').toUpperCase())
  );

  const reviewerDate = isReviewed ? (
    po?.reviewedAt ||
    (prData?.reviewedBy && typeof prData.reviewedBy === 'object' ? prData.reviewedBy.timestamp : null) ||
    reviewedLog?.timestamp ||
    reviewedLog?.date ||
    po?.reviewedDate ||
    ''
  ) : '';

  // 3. ข้อมูลผู้อนุมัติ (Approver)
  const approvedLog = Array.isArray(prData?.approvalHistory)
    ? prData.approvalHistory.find(h => h.action === 'APPROVED')
    : null;

  const approverDate = po?.approvedAt ||
    approvedLog?.timestamp ||
    approvedLog?.date ||
    po?.createdAt ||
    '';

  // 4. ข้อมูลผู้ตรวจรับ (Receiver)
  const receiverDate = isReceivedDoc ? (po?.receivingInfo?.receivedAt || po?.receivedAt || (po?.grnHistory?.length > 0 ? po.grnHistory[po.grnHistory.length - 1].date : '') || po?.updatedAt || po?.date || new Date().toISOString()) : '';

  let rawRevName = po?.reviewerName || (typeof po?.reviewedBy === 'string' && po.reviewedBy !== 'Admin System' ? po.reviewedBy : null) || (isReviewed ? (reviewerUser?.employeeName || 'คุณสมชาย มุ่งมั่น') : '');
  if (!rawRevName || rawRevName === 'Admin System') {
    rawRevName = isReviewed ? 'คุณสมชาย มุ่งมั่น' : '';
  }
  const revName = isReviewed ? (rawRevName || 'คุณสมชาย มุ่งมั่น') : '( ............................................................ )';

  let rawRecName = isReceivedDoc ? (po?.receivingInfo?.receiverName || po?.receiverName || po?.receivedBy || receiverUser?.employeeName || '') : '';
  if (rawRecName === 'Admin System') {
    rawRecName = '';
  }
  const recName = isReceivedDoc
    ? (rawRecName || 'คุณวิชัย สุขใจ')
    : '( ............................................................ )';

  const stamps = [
    { 
      role: 'ผู้ขอซื้อ', 
      name: requesterUser?.employeeName || requesterUser?.name || po?.requestedBy || prData?.requestedBy || 'คุณวิชัย สุขใจ', 
      time: formatDocDateTime(requesterDate), 
      sigImg: reqSigImg,
      isSigned: true
    },
    { 
      role: 'ผู้ทบทวน', 
      name: revName, 
      time: formatDocDateTime(reviewerDate), 
      sigImg: isReviewed ? revSigImg : null,
      isSigned: isReviewed
    },
    { 
      role: 'ผู้อนุมัติ', 
      name: approverUser?.employeeName || approverUser?.name || po?.approvedBy || 'คุณประเสริฐ ยิ่งยง', 
      time: formatDocDateTime(approverDate), 
      sigImg: appSigImg,
      isSigned: true
    },
    { 
      role: 'ผู้ตรวจรับ / บันทึกสต็อก', 
      name: recName, 
      time: formatDocDateTime(receiverDate), 
      sigImg: isReceivedDoc ? recSigImg : null,
      isSigned: isReceivedDoc
    }
  ];

  // Draw full-width Header Background
  page.drawRectangle({
    x: 50,
    y: stampBoxY + stampBoxHeight - 18,
    width: totalStampWidth,
    height: 18,
    color: rgb(0.96, 0.96, 0.98)
  });

  // Draw Outer Box
  page.drawRectangle({
    x: 50,
    y: stampBoxY,
    width: totalStampWidth,
    height: stampBoxHeight,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1
  });

  // Draw Header Bottom Border
  page.drawLine({
    start: { x: 50, y: stampBoxY + stampBoxHeight - 18 },
    end: { x: 50 + totalStampWidth, y: stampBoxY + stampBoxHeight - 18 },
    thickness: 1,
    color: rgb(0, 0, 0)
  });

  // Draw Vertical Separators
  for (let i = 1; i <= 3; i++) {
    const lineX = 50 + (i * stampWidth);
    page.drawLine({
      start: { x: lineX, y: stampBoxY },
      end: { x: lineX, y: stampBoxY + stampBoxHeight },
      thickness: 1,
      color: rgb(0, 0, 0)
    });
  }

  // Draw Text and Images for each cell
  stamps.forEach((s, idx) => {
    const boxX = 50 + (idx * stampWidth);

    // Centered Role Text
    const roleText = normalizeThaiText(s.role);
    const roleWidth = boldFont.widthOfTextAtSize(roleText, 8);
    page.drawText(roleText, { 
      x: boxX + (stampWidth - roleWidth) / 2, 
      y: stampBoxY + stampBoxHeight - 13, 
      size: 8, 
      font: boldFont, 
      color: rgb(0.2, 0.25, 0.35) 
    });

    // Draw Real Digital E-Signature if present
    if (s.sigImg && s.isSigned) {
      const sigWidth = 78;
      const sigHeight = 28;
      page.drawImage(s.sigImg, {
        x: boxX + (stampWidth - sigWidth) / 2,
        y: stampBoxY + 40,
        width: sigWidth,
        height: sigHeight,
      });
    }

    // Centered Name `( คุณ... )`
    const displayName = s.name.startsWith('(') ? s.name : `( ${s.name} )`;
    const nameText = normalizeThaiText(displayName);
    const nameWidth = customFont.widthOfTextAtSize(nameText, 8);
    page.drawText(nameText, { 
      x: boxX + (stampWidth - nameWidth) / 2, 
      y: stampBoxY + 18, 
      size: 8, 
      font: customFont,
      color: rgb(0.25, 0.25, 0.25)
    });

    // Centered Date Time
    if (s.time !== '-') {
      const timeText = normalizeThaiText(s.time);
      const timeWidth = customFont.widthOfTextAtSize(timeText, 7);
      page.drawText(timeText, { 
        x: boxX + (stampWidth - timeWidth) / 2, 
        y: stampBoxY + 6, 
        size: 7, 
        font: customFont, 
        color: rgb(0.5, 0.5, 0.5) 
      });
    }
  });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${po?.poNo || po?.id || po?.poNumber || 'PO-Document'}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
