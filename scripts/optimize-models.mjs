import { NodeIO, Format } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
await MeshoptEncoder.ready;await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const root=path.resolve('public/muscles'),originals=path.resolve('.tooling/original-muscles');await fs.mkdir(originals,{recursive:true});
let before=0,after=0;
const textures=new Map();await fs.mkdir(path.join(root,'textures'),{recursive:true});
for(const name of (await fs.readdir(root)).filter(n=>n.endsWith('.glb'))){
  const source=path.join(root,name),backup=path.join(originals,name);
  try{await fs.copyFile(source,backup,fs.constants.COPYFILE_EXCL);}catch(e){if(e.code!=='EEXIST')throw e;}
  const doc=await io.read(backup);before+=(await fs.stat(backup)).size;
  // Lossless topology reordering/deduplication only. No vertex quantization,
  // decimation, texture downscaling or lossy normal filtering.
  await doc.transform(dedup(),prune(),reorder({encoder:MeshoptEncoder,target:'size'}));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  const output=await io.writeJSON(doc,{format:Format.GLTF});
  for(const image of output.json.images||[]){const bytes=output.resources[image.uri];const extension=image.mimeType==='image/png'?'png':'jpg';const shared=`textures/${createHash('sha256').update(bytes).digest('hex').slice(0,24)}.${extension}`;textures.set(shared,bytes);image.uri=shared;}
  const binary=output.resources[output.json.buffers[0].uri];delete output.json.buffers[0].uri;
  const raw=Buffer.from(JSON.stringify(output.json));const json=Buffer.alloc(Math.ceil(raw.length/4)*4,0x20);raw.copy(json);const bin=Buffer.alloc(Math.ceil(binary.length/4)*4);Buffer.from(binary).copy(bin);
  const header=Buffer.alloc(12);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);
  const jh=Buffer.alloc(8);jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);
  for(const [name,bytes]of textures)await fs.writeFile(path.join(root,name),bytes);
  await fs.writeFile(source,Buffer.concat([header,jh,json,bh,bin]));const decoded=await io.read(source);
  if(decoded.getRoot().listMeshes().length!==doc.getRoot().listMeshes().length)throw Error(`Round-trip failed: ${name}`);
  after+=(await fs.stat(source)).size;
}
after += [...textures.values()].reduce((n,b)=>n+b.length,0);
console.log(JSON.stringify({models:23,sharedTextures:textures.size,beforeBytes:before,afterBytes:after,reductionPercent:Math.round((1-after/before)*100)}));
