import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ValidationError } from '../src/lib/errors';

const inventoryPath = 'scripts/public-repo-paths.json';
const generatedRoots = new Set(['node_modules', 'dist', '.astro', 'artifacts', 'validation-output.json']);
const governedRoots = ['src/data/public', 'src/assets', 'public'];
const inside = (path: string, root: string) => path === root || path.startsWith(root + '/');

function checkPath(path: string): void {
  if (!/^[\w./[\]-]+$/.test(path) || path.split('/').some((part) => !part || part === '.' || part === '..' || part.endsWith('.'))) {
    throw new ValidationError('PUBLIC_REPO_PATH', 'Noncanonical repository path: ' + JSON.stringify(path));
  }
}

export function validateRepositorySource(root = process.cwd()): void {
  const inventoryFile = join(root, inventoryPath);
  if (!lstatSync(inventoryFile).isFile()) throw new ValidationError('PUBLIC_REPO_INVENTORY', 'Inventory must be a regular file');
  const inventory = JSON.parse(readFileSync(inventoryFile, 'utf8')) as Record<string, string | null>;
  if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory)) {
    throw new ValidationError('PUBLIC_REPO_INVENTORY', 'Repository inventory must be an object');
  }
  for (const [path, pin] of Object.entries(inventory)) {
    checkPath(path);
    if (pin !== null && (typeof pin !== 'string' || !/^[a-f0-9]{64}$/.test(pin))) {
      throw new ValidationError('PUBLIC_REPO_INVENTORY', 'Invalid reference SHA-256: ' + path);
    }
  }
  const names = new Map<string, string>();
  function checkFile(path: string): void {
    checkPath(path);
    if (path.split('/').some((part) => /^(?:\.env(?:\..*)?|private|drafts?|authoring|\.git)$/i.test(part))) {
      throw new ValidationError('PRIVATE_IN_PUBLIC_REPO', 'Private/authoring repository path: ' + path);
    }
    if (generatedRoots.has(path.split('/')[0]!)) {
      throw new ValidationError('PUBLIC_REPO_GENERATED', 'Generated file tracked in Git: ' + path);
    }
    const previous = names.get(path.toLowerCase());
    if (previous && previous !== path) throw new ValidationError('PUBLIC_REPO_CASE', 'Conflicting repository paths: ' + path);
    names.set(path.toLowerCase(), path);
    if (governedRoots.some((dir) => inside(path, dir))) return; // existing per-file provenance gate below
    if (path === inventoryPath) return; // policy changes require controlled review
    if (!Object.hasOwn(inventory, path)) throw new ValidationError('PUBLIC_REPO_UNLISTED', 'Unreviewed repository path: ' + path);
  }

  // Git index check also catches forced additions to ignored build/dependency paths.
  // The same gate can run on an archive without .git (used by pre-push and fixture builds).
  if (existsSync(join(root, '.git'))) {
    const index = execFileSync('git', ['ls-files', '--stage', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    for (const entry of index.split('\0').filter(Boolean)) {
      const tab = entry.indexOf('\t');
      const path = entry.slice(tab + 1);
      if (!/^100(644|755) [a-f0-9]+ 0$/.test(entry.slice(0, tab))) {
        throw new ValidationError('PUBLIC_REPO_GIT_MODE', 'Non-regular or unmerged Git entry: ' + JSON.stringify(path));
      }
      checkFile(path);
    }
  }

  function visit(dir: string, prefix = ''): void {
    for (const name of readdirSync(dir)) {
      if (!prefix && (name === '.git' || generatedRoots.has(name))) continue;
      const path = prefix + name;
      checkPath(path);
      const absolute = join(dir, name);
      const stat = lstatSync(absolute);
      if (stat.isSymbolicLink()) throw new ValidationError('PUBLIC_SYMLINK', 'Symlink in public repository: ' + path);
      if (stat.isDirectory()) visit(absolute, path + '/');
      else if (stat.isFile()) {
        checkFile(path);
        const pin = inventory[path];
        if (pin !== undefined && pin !== null &&
            createHash('sha256').update(readFileSync(absolute)).digest('hex') !== pin) {
          throw new ValidationError('PUBLIC_REPO_HASH', 'Repository reference differs from reviewed bytes: ' + path);
        }
      } else throw new ValidationError('PUBLIC_TYPE', 'Unexpected repository file type: ' + path);
    }
  }
  visit(root);
}
