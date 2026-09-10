import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';

export function shapeThaiText(text) {
  if (!text) return '';
  let str = String(text).normalize('NFC');
  
  // Swap misordered tone marks and upper vowels
  str = str.replace(/([\u0E48-\u0E4C])([\u0E31\u0E34-\u0E37\u0E47\u0E4D])/g, '$2$1');
  // Remove consecutive duplicates
  str = str.replace(/([\u0E31\u0E34-\u0E37\u0E47\u0E4D])\1+/g, '$1');
  str = str.replace(/([\u0E48-\u0E4C])\1+/g, '$1');
  // Strip control chars
  str = str.replace(/[\u200B-\u200D\uFEFF]/g, '');

  const chars = Array.from(str);
  const result = [];

  const isAscender = (c) => /[\u0E1B\u0E1D\u0E1F]/.test(c);
  const isDescenderCut = (c) => /[\u0E0D\u0E10]/.test(c);
  const isDescenderDeep = (c) => /[\u0E0E\u0E0F]/.test(c);
  const isUpperVowel = (c) => /[\u0E31\u0E34-\u0E37\u0E47\u0E4D\uF701-\uF704\uF710-\uF712]/.test(c);
  const isToneMark = (c) => /[\u0E48-\u0E4C]/.test(c);
  const isLowerVowel = (c) => /[\u0E38-\u0E3A]/.test(c);

  const toneToLevel2 = {
    '\u0E48': '\uF713', // mai ek
    '\u0E49': '\uF714', // mai tho
    '\u0E4A': '\uF715', // mai tri
    '\u0E4B': '\uF716', // mai chattawa
    '\u0E4C': '\uF717', // thanthakhat
  };

  const toneToShiftLeft = {
    '\u0E48': '\uF705',
    '\u0E49': '\uF706',
    '\u0E4A': '\uF707',
    '\u0E4B': '\uF708',
    '\u0E4C': '\uF709',
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

    if (isDescenderCut(c) && i + 1 < chars.length && isLowerVowel(chars[i + 1])) {
      c = c === '\u0E0D' ? '\uF700' : '\uF70F';
    } else if (isLowerVowel(c) && (isDescenderDeep(prev1) || prev1 === '\uF700' || prev1 === '\uF70F')) {
      c = lowerVowelShiftDown[c] || c;
    } else if (isToneMark(c) && isUpperVowel(prev1)) {
      c = toneToLevel2[c] || c;
    } else if (isToneMark(c) && isAscender(prev1)) {
      c = toneToShiftLeft[c] || c;
    } else if (isUpperVowel(c) && isAscender(prev1)) {
      c = upperVowelToShiftLeft[c] || c;
    }

    result.push(c);
  }

  return result.join('');
}

async function run() {
  const fontPath = path.join(process.cwd(), 'public', 'fonts', 'THSarabunNew.ttf');
  const fontBytes = fs.readFileSync(fontPath);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(fontBytes);

  const page = pdfDoc.addPage([600, 800]);
  const text = shapeThaiText('ใบสั่งซื้อสินค้า / PURCHASE ORDER ผู้ขอซื้อ ลงชื่อ คุณประเสริฐ ยิ่งยง');
  console.log('Original: "ใบสั่งซื้อสินค้า / PURCHASE ORDER ผู้ขอซื้อ ลงชื่อ คุณประเสริฐ ยิ่งยง"');
  console.log('Shaped:   "' + text + '"');
  console.log('Shaped has F713 (level 2 mai ek):', text.includes('\uF713'));
  console.log('Shaped has F714 (level 2 mai tho):', text.includes('\uF714'));

  page.drawText(text, { x: 50, y: 700, size: 14, font });

  const pdfBytes = await pdfDoc.save();
  console.log('PDF successfully generated, size:', pdfBytes.length);
}

run().catch(console.error);
