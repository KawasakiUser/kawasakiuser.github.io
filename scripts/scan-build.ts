import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const forbidden = ['PRIVATE_CONTENT', 'private fixture', 'real Draft', 'publicationStatus":"Draft"', '<script'];
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name: string) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}
const paths = files('dist');
for (const path of paths) {
  const text = readFileSync(path, 'utf8');
  for (const token of forbidden) if (text.includes(token)) throw new Error('Build output contains forbidden token ' + token + ' in ' + path);
  if (path.includes('private') || path.includes('draft')) throw new Error('Build output contains forbidden path ' + path);
}
console.log('PASS output scan: ' + paths.length + ' files, no forbidden content or paths');
