// Inspect PNG chunks
import fs from 'fs';

function inspectPngChunks(filePath: string) {
  const buf = fs.readFileSync(filePath);
  let offset = 8; // skip signature
  console.log(`Inspecting ${filePath} (${buf.length} bytes):`);
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    console.log(`Chunk: ${type}, length: ${len}, offset: ${offset}`);
    offset += 12 + len;
  }
}

// Find any user uploaded png or sample
const sample = '/Users/karthikgoudar/.gemini/antigravity/brain/a56c994b-6b9f-49c0-8f19-19f6f12564be/.user_uploaded/media_1793577481999_deeac83d.png';
if (fs.existsSync(sample)) {
  inspectPngChunks(sample);
}
