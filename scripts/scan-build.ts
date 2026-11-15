import {readdirSync,readFileSync,statSync} from 'node:fs'; import {join} from 'node:path'; const forbidden=['private fixture','real Draft','PRIVATE_CONTENT','<script'];
function files(dir:string):string[]{return readdirSync(dir).flatMap((n:string)=>{const p=join(dir,n);return statSync(p).isDirectory()?files(p):[p]})}
const paths=files('dist');for(const p of paths){const t=readFileSync(p,'utf8');for(const x of forbidden)if(t.includes(x))throw new Error('Build output contains forbidden token '+x+' in '+p)}console.log('PASS output scan: '+paths.length+' files, no forbidden content');
