import fs from 'fs';
// 1x1 transparent PNG in base64
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
fs.writeFileSync('e2e/fixtures/dummy-image.png', Buffer.from(pngBase64, 'base64'));
console.log('Dummy PNG created successfully');
