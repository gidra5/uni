import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const coverageReport = resolve('test-results/coverage/index.html');

if (!existsSync(coverageReport)) {
  console.error(`Coverage report not found: ${coverageReport}`);
  console.error('Run `npm run coverage` first.');
  process.exit(1);
}

if (process.argv.includes('--print')) {
  console.log(coverageReport);
  process.exit(0);
}

const command =
  process.platform === 'darwin'
    ? { file: 'open', args: [coverageReport] }
    : process.platform === 'win32'
      ? { file: 'cmd', args: ['/c', 'start', '', coverageReport] }
      : { file: 'xdg-open', args: [coverageReport] };

const result = spawnSync(command.file, command.args, { stdio: 'inherit' });

if (result.error) {
  console.error(`Failed to open coverage report: ${result.error.message}`);
  console.error(`Open this file manually: ${coverageReport}`);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`Failed to open coverage report, exit code ${result.status}.`);
  console.error(`Open this file manually: ${coverageReport}`);
  process.exit(result.status ?? 1);
}
