import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
const art={};
for(const name of ['registration','assignment']) {
  const svg=await readFile(`docs/email-previews/art/${name}.svg`);
  const png=await sharp(svg).resize(1120,400).png({palette:true}).toBuffer();
  art[name]={filename:`blitz-${name}.png`,contentType:'image/png',content:png.toString('base64'),encoding:'base64',cid:`blitz-${name}@mail.tiss.ac.in`};
}
await writeFile('supabase/functions/deliver-mail/email-art.ts', '// Generated from the repository-owned SVGs by npm run build:email-assets.\nexport const EMAIL_ART = '+JSON.stringify(art)+' as const;\n');
console.log('Built two inline PNG assets from the email SVG artwork.');
