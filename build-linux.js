const path = require('path');
const { spawnSync } = require('child_process');

require('./make-icon');

const builder = path.join(__dirname, 'node_modules', '.bin', 'electron-builder');
const res = spawnSync(builder, ['--linux'], { stdio: 'inherit', shell: true });
process.exit(res.status === null ? 1 : res.status);
