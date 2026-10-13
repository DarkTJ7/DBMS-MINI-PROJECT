import { readFileSync } from 'node:fs';
import { join } from 'node:path';
let model;
export function embed(text) {
 model ||= JSON.parse(readFileSync(join(process.cwd(),'.generated/lsa.json'),'utf8'));
 const counts=new Array(model.idf.length).fill(0);
 for(const word of text.toLowerCase().match(/[\p{L}\p{N}_]{2,}/gu)||[]) {
  const index=model.vocabulary[word];if(index!==undefined)counts[index]++;
 }
 const tfidf=counts.map((n,i)=>n*model.idf[i]);
 const norm=Math.hypot(...tfidf)||1;
 const vector=model.components.map(component=>component.reduce((sum,w,i)=>sum+w*tfidf[i]/norm,0));
 const vn=Math.hypot(...vector);
 if(!vn) return null;
 while(vector.length<128)vector.push(0);
 return '['+vector.map(x=>x/vn).join(',')+']';
}
