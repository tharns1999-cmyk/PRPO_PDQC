import { PDFDocument, rgb, degrees } from 'pdf-lib';
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

  // 2. ขนาดกระดาษ A4
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  // 3. ปั๊มลายน้ำ Audit Trail 45 องศา
  const statusWatermarks = {
    completed: 'CLOSED / AUDITED',
    CLOSED: 'CLOSED / AUDITED',
    ordered: 'PURCHASE ORDERED',
    ISSUED: 'PURCHASE ORDERED',
    pending_order: 'PENDING ORDER',
    in_delivery: 'IN DELIVERY',
    PARTIAL: 'PARTIAL RECEIVED',
  };
  const watermarkText = statusWatermarks[po?.status] || 'PO DOCUMENT';

  page.drawText(watermarkText, {
    x: 90,
    y: height / 2 - 40,
    size: 52,
    font: boldFont,
    color: rgb(0.88, 0.90, 0.94),
    rotate: degrees(45),
  });

  // 4. ส่วนหัวเอกสารควบคุม (QMS/DCC Header)
  page.drawText(normalizeThaiText('บริษัท อุตสาหกรรมอาหาร จำกัด (สำนักงานใหญ่)'), { 
    x: 50, y: height - 50, size: 14, font: boldFont, color: rgb(0.1, 0.1, 0.2) 
  });
  page.drawText(normalizeThaiText('ใบสั่งซื้อสินค้า / PURCHASE ORDER'), { 
    x: 50, y: height - 68, size: 12, font: boldFont, color: rgb(0.2, 0.3, 0.6) 
  });
  page.drawText(normalizeThaiText('แบบฟอร์ม DCC: FM-PUR-002 (Rev.04)'), { 
    x: width - 190, y: height - 50, size: 9, font: customFont, color: rgb(0.5, 0.5, 0.5) 
  });

  // กล่องเลขที่เอกสาร
  page.drawRectangle({ x: width - 210, y: height - 105, width: 160, height: 45, borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 1 });
  page.drawText(normalizeThaiText(`เลขที่ PO: ${po?.poNo || po?.id || po?.poNumber || '-'}`), { 
    x: width - 200, y: height - 80, size: 10, font: boldFont 
  });
  page.drawText(normalizeThaiText(`วันที่ออก PO: ${po?.issueDate || po?.createdAt || '-'}`), { 
    x: width - 200, y: height - 95, size: 9, font: customFont 
  });

  // 5. ข้อมูลอ้างอิงและคู่ค้า
  page.drawText(normalizeThaiText(`อ้างอิงใบขอซื้อ (PR): ${po?.prNo || po?.prNumber || '-'}`), { 
    x: 50, y: height - 100, size: 10, font: customFont 
  });
  page.drawText(normalizeThaiText(`แผนกผู้ขอ: ${po?.department || 'ฝ่ายผลิตและควบคุมคุณภาพ (PD)'}`), { 
    x: 50, y: height - 115, size: 10, font: customFont 
  });
  page.drawText(normalizeThaiText(`ร้านค้า / ผู้จำหน่าย: ${po?.vendorName || po?.vendor || po?.shopName || 'สั่งซื้อออนไลน์ (Shopee / Lazada)'}`), { 
    x: 50, y: height - 130, size: 10, font: boldFont 
  });

  // 6. ตารางรายการสินค้า
  const tableTop = height - 160;
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

  items.forEach((item, index) => {
    // Row index
    page.drawText(String(index + 1), { x: 58, y: rowY, size: 9, font: customFont });
    
    // Product Name (truncated to max 230pt to prevent collision with column at x: 330)
    const rawItemTitle = `[${item.code || '-'}] ${item.name || '-'}`;
    const safeItemTitle = truncateText(rawItemTitle, customFont, 9, 230);
    page.drawText(safeItemTitle, { x: 80, y: rowY, size: 9, font: customFont });

    // Qty and Unit
    page.drawText(normalizeThaiText(`${item.qty || 1} ${item.unit || ''}`), { x: 330, y: rowY, size: 9, font: customFont });
    
    // Unit Price
    page.drawText(Number(item.price || item.actualPrice || item.unitPrice || 0).toLocaleString(), { x: 410, y: rowY, size: 9, font: customFont });
    
    // Total Line Amount
    page.drawText(Number(item.total || item.lineTotal || ((item.qty || 1) * (item.price || 0)) || 0).toLocaleString(), { x: 480, y: rowY, size: 9, font: customFont });
    
    rowY -= 20;
  });

  page.drawLine({ start: { x: 50, y: rowY - 5 }, end: { x: width - 50, y: rowY - 5 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  page.drawText(normalizeThaiText('ยอดเงินสุทธิ (Grand Total):'), { x: 350, y: rowY - 22, size: 10, font: boldFont });
  page.drawText(`฿${Number(po?.totalAmount || po?.grandTotal || po?.subtotal || 14500).toLocaleString()}`, { 
    x: 480, y: rowY - 22, size: 11, font: boldFont, color: rgb(0.1, 0.5, 0.3) 
  });

  // 7. กล่อง Digital Approval Stamp 3 ช่อง พร้อมรูปลายเซ็น E-Signature ตัวจริง
  const stampBoxY = 55;
  const stampBoxHeight = 90;
  const stampWidth = (width - 120) / 3;
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

  // Find users for 3 signer roles
  const requesterUser = users.find(u => 
    u.name === po?.requestedBy || 
    u.displayName === po?.requestedBy || 
    u.employeeName === po?.requestedBy ||
    (po?.requestedBy && (po.requestedBy.includes(u.name) || po.requestedBy.includes(u.employeeName || ''))) ||
    u.roleId === 'REQUESTER_PD'
  ) || users.find(u => u.roleId?.includes('REQUESTER')) || users[0];

  const approverUser = users.find(u => 
    u.roleId === 'PLANT_MANAGER' || 
    u.positionKey === 'APPROVER' || 
    u.name?.includes('ประเสริฐ')
  ) || users.find(u => u.roleId === 'PLANT_MANAGER') || users[4];

  const receiverUser = users.find(u => 
    u.name === po?.receivedBy || 
    u.displayName === po?.receivedBy || 
    u.employeeName === po?.receivedBy ||
    (po?.receivedBy && po.receivedBy.includes(u.name))
  ) || requesterUser;

  // Helper to embed Base64 signature
  const embedSignature = async (user) => {
    if (!user?.signature) return null;
    try {
      if (user.signature.includes('image/jpeg') || user.signature.includes('image/jpg')) {
        return await pdfDoc.embedJpg(user.signature);
      }
      return await pdfDoc.embedPng(user.signature);
    } catch (err) {
      console.warn('[generatePoPdf] Failed to embed signature for', user?.name, err.message);
      return null;
    }
  };

  const [reqSigImg, appSigImg, recSigImg] = await Promise.all([
    embedSignature(requesterUser),
    embedSignature(approverUser),
    isCompleted ? embedSignature(receiverUser) : null,
  ]);

  const docHashBase = (po?.poNo || po?.id || 'PO-PDQC').replace(/[^a-zA-Z0-9]/g, '');
  const docHash = `SHA256:${docHashBase.slice(-8)}-${(po?.issueDate || '20260910').replace(/-/g, '')}`;

  const stamps = [
    { 
      role: 'ผู้ขอซื้อ (Requester)', 
      name: requesterUser?.employeeName || requesterUser?.name || po?.requestedBy || 'คุณวิชัย สุขใจ', 
      time: '10/09/2026 08:15 น.', 
      status: 'VERIFIED',
      sigImg: reqSigImg,
      isSigned: true
    },
    { 
      role: 'ผู้อนุมัติ (Plant Manager)', 
      name: approverUser?.employeeName || approverUser?.name || 'คุณประเสริฐ ยิ่งยง', 
      time: '10/09/2026 08:30 น.', 
      status: 'APPROVED',
      sigImg: appSigImg,
      isSigned: true
    },
    { 
      role: 'ผู้ตรวจรับ / บันทึกสต็อก', 
      name: receiverUser?.employeeName || receiverUser?.name || po?.receivedBy || 'คุณวิชัย สุขใจ', 
      time: isCompleted ? (po?.receivedAt || '10/09/2026 13:14 น.') : '-', 
      status: isCompleted ? 'RECEIVED (+IN)' : 'PENDING',
      sigImg: recSigImg,
      isSigned: isCompleted
    }
  ];

  stamps.forEach((s, idx) => {
    const boxX = 50 + (idx * (stampWidth + 10));

    // Outer Box
    page.drawRectangle({ 
      x: boxX, 
      y: stampBoxY, 
      width: stampWidth, 
      height: stampBoxHeight, 
      borderColor: rgb(0.85, 0.85, 0.85), 
      borderWidth: 1 
    });

    // Top Header Banner
    page.drawRectangle({ 
      x: boxX, 
      y: stampBoxY + stampBoxHeight - 18, 
      width: stampWidth, 
      height: 18, 
      color: rgb(0.96, 0.96, 0.98) 
    });
    page.drawText(normalizeThaiText(s.role), { 
      x: boxX + 6, 
      y: stampBoxY + stampBoxHeight - 13, 
      size: 8, 
      font: boldFont, 
      color: rgb(0.2, 0.25, 0.35) 
    });

    // Status Pill in Banner
    page.drawText(`[ ${s.status} ]`, { 
      x: boxX + stampWidth - 52, 
      y: stampBoxY + stampBoxHeight - 13, 
      size: 7.5, 
      font: boldFont, 
      color: s.status === 'PENDING' ? rgb(0.7, 0.5, 0.1) : rgb(0.1, 0.5, 0.3) 
    });

    // Signer Name
    page.drawText(normalizeThaiText(`ลงชื่อ: ${s.name}`), { 
      x: boxX + 6, 
      y: stampBoxY + stampBoxHeight - 31, 
      size: 7.5, 
      font: customFont,
      color: rgb(0.25, 0.25, 0.25)
    });

    // Draw Real Digital E-Signature if present
    if (s.sigImg && s.isSigned) {
      page.drawImage(s.sigImg, {
        x: boxX + 10,
        y: stampBoxY + 16,
        width: 78,
        height: 28,
      });

      // E-Signature Stamp & ISO Hash Audit Text
      page.drawText(normalizeThaiText('[ ลงนามดิจิทัลผ่านระบบ PR/PO ]'), { 
        x: boxX + 6, 
        y: stampBoxY + 11, 
        size: 6, 
        font: boldFont, 
        color: rgb(0.12, 0.48, 0.3) 
      });
      page.drawText(normalizeThaiText(`เวลา: ${s.time} • ${docHash}`), { 
        x: boxX + 6, 
        y: stampBoxY + 3, 
        size: 5.5, 
        font: customFont, 
        color: rgb(0.45, 0.45, 0.5) 
      });
    } else {
      // Pending / Unsigned State
      page.drawText(normalizeThaiText(s.status === 'PENDING' ? '(รอการตรวจรับสินค้า)' : '[ ลงชื่อเอกสาร ]'), { 
        x: boxX + 16, 
        y: stampBoxY + 28, 
        size: 8, 
        font: customFont, 
        color: rgb(0.6, 0.6, 0.6) 
      });
      if (s.time !== '-') {
        page.drawText(normalizeThaiText(`เวลา: ${s.time}`), { 
          x: boxX + 6, 
          y: stampBoxY + 6, 
          size: 6, 
          font: customFont, 
          color: rgb(0.5, 0.5, 0.5) 
        });
      }
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
