import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const source=process.argv[2];
if(!source)throw Error('Provide the generated PNG path.');
const original=await fs.readFile(source);
const publicDir=path.resolve('public');
for(const size of [16,32,48,128,180,192,512]){
  await sharp(original).resize(size,size,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toFile(path.join(publicDir,`favicon-mp-v1-${size}.png`));
}
const sizes=[16,32,48,256],images=[];
for(const size of sizes)images.push(await sharp(original).resize(size,size).png().toBuffer());
const header=Buffer.alloc(6+16*images.length);header.writeUInt16LE(1,2);header.writeUInt16LE(images.length,4);
let offset=header.length;
images.forEach((buffer,i)=>{const p=6+i*16;header[p]=sizes[i]===256?0:sizes[i];header[p+1]=header[p];header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(buffer.length,p+8);header.writeUInt32LE(offset,p+12);offset+=buffer.length;});
await fs.writeFile(path.join(publicDir,'favicon-mp-v1.ico'),Buffer.concat([header,...images]));
await fs.copyFile(path.join(publicDir,'favicon-mp-v1.ico'),path.join(publicDir,'favicon.ico'));
console.log('Prepared PNG sizes 16–512 and multi-size ICO; original alpha preserved.');
