// Test PNG pHYs chunk insertion
function crc32(buf: Uint8Array): number {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const ppm = Math.round((300 / 25.4) * 1000); // 11811
const chunk = new Uint8Array(13);
chunk[0] = 0x70; chunk[1] = 0x48; chunk[2] = 0x79; chunk[3] = 0x73;
const view = new DataView(chunk.buffer);
view.setUint32(4, ppm);
view.setUint32(8, ppm);
chunk[12] = 1;
const crc = crc32(chunk);
console.log('PPM for 300 DPI:', ppm);
console.log('CRC32:', crc.toString(16));
