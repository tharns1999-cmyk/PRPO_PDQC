import fontkit from '@pdf-lib/fontkit';

async function testGlyphAdvance() {
  const fontUrl = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/sarabun/Sarabun-Regular.ttf';
  const res = await fetch(fontUrl);
  const fontBytes = await res.arrayBuffer();
  const font = fontkit.create(Buffer.from(fontBytes));

  const g733 = font.getGlyph(733);
  const g736 = font.getGlyph(736);
  const g758 = font.getGlyph(758);
  const g739 = font.getGlyph(739);
  console.log('g733 uni0E31 advanceWidth:', g733.advanceWidth);
  console.log('g736 uni0E48.small advanceWidth:', g736.advanceWidth);
  console.log('g758 uni0E37 advanceWidth:', g758.advanceWidth);
  console.log('g739 uni0E49.small advanceWidth:', g739.advanceWidth);
}

testGlyphAdvance().catch(console.error);
