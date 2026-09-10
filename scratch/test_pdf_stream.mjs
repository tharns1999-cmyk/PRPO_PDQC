import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import zlib from 'zlib';

async function testPdfStream() {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontUrl = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/sarabun/Sarabun-Regular.ttf';
  const res = await fetch(fontUrl);
  const fontBytes = await res.arrayBuffer();
  const font = await pdfDoc.embedFont(fontBytes);

  const page = pdfDoc.addPage([500, 500]);
  page.drawText('ใบสั่งซื้อ ผู้ขอซื้อ ลงชื่อ ยิ่งยง', {
    x: 50,
    y: 400,
    size: 14,
    font
  });

  const pdfBytes = await pdfDoc.save();
  const buf = Buffer.from(pdfBytes);
  const streamIdx = buf.indexOf('stream\r\n');
  const endStreamIdx = buf.indexOf('\r\nendstream');
  const compressed = buf.subarray(streamIdx + 8, endStreamIdx);
  const decompressed = zlib.inflateSync(compressed).toString('utf-8');
  console.log('Decompressed operators:\n', decompressed);
}

testPdfStream().catch(console.error);
