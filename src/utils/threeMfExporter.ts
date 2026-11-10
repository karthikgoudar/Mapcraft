import * as THREE from 'three';

/**
 * Bambu Studio 3MF export.
 *
 * Writes a 3MF package (a ZIP, stored without compression) that holds the trail mesh plus
 * per-object slicer settings: Wall generator = Classic and Wall loops = N, so the settings
 * do not have to be remembered per route. Units are millimetres, Z is up, and the object is
 * centred on a 256 x 256 mm bed (Bambu A1) and sits on Z = 0.
 */

const encoder = new TextEncoder();

let crcTable: Uint32Array | null = null;
function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** Minimal ZIP writer, stored (method 0) entries only. */
function buildZip(entries: ZipEntry[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 names
    lv.setUint16(8, 0, true); // stored
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0x21, true); // 1980-01-01
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);

    chunks.push(local, entry.data);
    central.push(cd);
    offset += local.length + size;
  }

  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);

  const all = [...chunks, ...central, end];
  const total = all.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of all) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface ThreeMfOptions {
  name: string;
  /** Wall loops per object, from snapTrailWidth().loopsPerSide */
  wallLoops: number;
  /** Bed size in mm used to centre the object, default 256 (Bambu A1) */
  bedMm?: number;
}

export interface ThreeMfResult {
  data: Uint8Array;
  vertexCount: number;
  triangleCount: number;
}

export function buildBambu3MF(geometry: THREE.BufferGeometry, options: ThreeMfOptions): ThreeMfResult {
  const bed = options.bedMm ?? 256;
  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
  const positions = nonIndexed.attributes.position.array as ArrayLike<number>;

  // De-duplicate vertices so the mesh is indexed and watertight.
  const vertexIndex = new Map<string, number>();
  const verts: number[] = [];
  const tris: number[] = [];
  const idxFor = (x: number, y: number, z: number) => {
    const fx = Math.fround(x);
    const fy = Math.fround(y);
    const fz = Math.fround(z);
    const key = `${fx},${fy},${fz}`;
    let i = vertexIndex.get(key);
    if (i === undefined) {
      i = verts.length / 3;
      vertexIndex.set(key, i);
      verts.push(fx, fy, fz);
    }
    return i;
  };
  for (let i = 0; i < positions.length; i += 9) {
    const a = idxFor(positions[i], positions[i + 1], positions[i + 2]);
    const b = idxFor(positions[i + 3], positions[i + 4], positions[i + 5]);
    const c = idxFor(positions[i + 6], positions[i + 7], positions[i + 8]);
    if (a !== b && b !== c && a !== c) tris.push(a, b, c);
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < verts.length; i += 3) {
    minX = Math.min(minX, verts[i]);
    maxX = Math.max(maxX, verts[i]);
    minY = Math.min(minY, verts[i + 1]);
    maxY = Math.max(maxY, verts[i + 1]);
    minZ = Math.min(minZ, verts[i + 2]);
  }
  const tx = bed / 2 - (minX + maxX) / 2;
  const ty = bed / 2 - (minY + maxY) / 2;
  const tz = -minZ;

  const name = escapeXml(options.name);
  const loops = Math.max(1, Math.round(options.wallLoops));
  const triangleCount = tris.length / 3;

  const vertexXml: string[] = [];
  for (let i = 0; i < verts.length; i += 3) {
    vertexXml.push(`<vertex x="${verts[i]}" y="${verts[i + 1]}" z="${verts[i + 2]}"/>`);
  }
  const triangleXml: string[] = [];
  for (let i = 0; i < tris.length; i += 3) {
    triangleXml.push(`<triangle v1="${tris[i]}" v2="${tris[i + 1]}" v3="${tris[i + 2]}"/>`);
  }

  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021">
 <metadata name="Application">MapCraft</metadata>
 <metadata name="BambuStudio:3mfVersion">1</metadata>
 <metadata name="Title">${name}</metadata>
 <resources>
  <object id="1" name="${name}" type="model">
   <mesh>
    <vertices>
${vertexXml.join('\n')}
    </vertices>
    <triangles>
${triangleXml.join('\n')}
    </triangles>
   </mesh>
  </object>
 </resources>
 <build>
  <item objectid="1" transform="1 0 0 0 1 0 0 0 1 ${tx} ${ty} ${tz}" printable="1"/>
 </build>
</model>
`;

  const modelSettings = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="1">
    <metadata key="name" value="${name}"/>
    <metadata key="extruder" value="1"/>
    <metadata key="wall_generator" value="classic"/>
    <metadata key="wall_loops" value="${loops}"/>
    <part id="1" subtype="normal_part">
      <metadata key="name" value="${name}"/>
      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>
      <mesh_stat face_count="${triangleCount}" edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>
    </part>
  </object>
  <plate>
    <metadata key="plater_id" value="1"/>
    <metadata key="plater_name" value=""/>
    <metadata key="locked" value="false"/>
    <model_instance>
      <metadata key="object_id" value="1"/>
      <metadata key="instance_id" value="0"/>
    </model_instance>
  </plate>
</config>
`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
 <Default Extension="config" ContentType="text/xml"/>
</Types>
`;

  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>
`;

  const data = buildZip([
    { name: '[Content_Types].xml', data: encoder.encode(contentTypes) },
    { name: '_rels/.rels', data: encoder.encode(rels) },
    { name: '3D/3dmodel.model', data: encoder.encode(model) },
    { name: 'Metadata/model_settings.config', data: encoder.encode(modelSettings) }
  ]);

  return { data, vertexCount: verts.length / 3, triangleCount };
}

export function download3MF(data: Uint8Array, filename: string) {
  const blob = new Blob([data as unknown as BlobPart], { type: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
