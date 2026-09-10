import fontkit from '@pdf-lib/fontkit';

async function test() {
  const fontUrl = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/sarabun/Sarabun-Regular.ttf';
  const res = await fetch(fontUrl);
  const fontBytes = await res.arrayBuffer();
  const font = fontkit.create(Buffer.from(fontBytes));

  const testWords = ['ใบสั่งซื้อ', 'ผู้ขอซื้อ', 'ลงชื่อ', 'ยิ่งยง'];
  for (const word of testWords) {
    const layout = font.layout(word);
    console.log(`\nWord: "${word}"`);
    for (let i = 0; i < layout.glyphs.length; i++) {
      const g = layout.glyphs[i];
      const p = layout.positions[i];
      console.log(`  glyph: id=${g.id}, name=${g.name}, codePoints=${g.codePoints.map(c => c.toString(16))}, xAdv=${p.xAdvance}, xOff=${p.xOffset}, yOff=${p.yOffset}`);
    }
  }
}

test().catch(console.error);
