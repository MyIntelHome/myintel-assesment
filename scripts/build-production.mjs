import { cp, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
await mkdir('web-production/public', { recursive: true });
await cp('public', 'web-production/public', { recursive: true });
const result = spawnSync(process.execPath, [require.resolve('next/dist/bin/next'), 'build', 'web-production'], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
