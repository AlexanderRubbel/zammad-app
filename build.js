// Reliable Windows build.
// Works around the well-known electron-builder issue where extracting the
// winCodeSign package fails on Windows because it contains macOS symlinks
// (".dylib") that need a privilege the normal user account lacks.
// We pre-extract winCodeSign into a local cache WITHOUT the macOS folder
// (only Windows tools like rcedit/signtool are needed here), then run
// electron-builder against that prepared cache.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

require('./make-icon'); // (re)generate build/*.png

const ROOT = __dirname;
const EB_CACHE = path.join(ROOT, '.ebcache');
const WCS_DIR = path.join(EB_CACHE, 'winCodeSign', 'winCodeSign-2.6.0');
const SEVEN_ZIP = path.join(ROOT, 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');

function dirReady(d) {
  try {
    return fs.existsSync(d) && fs.readdirSync(d).length > 0;
  } catch {
    return false;
  }
}

function findWinCodeSignArchive() {
  const base = path.join(
    process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local'),
    'electron-builder',
    'Cache',
    'winCodeSign'
  );
  try {
    const sz = fs.readdirSync(base).filter((f) => f.endsWith('.7z'));
    if (sz.length) return path.join(base, sz[0]);
  } catch {
    /* no default cache yet */
  }
  return null;
}

if (!dirReady(WCS_DIR)) {
  const archive = findWinCodeSignArchive();
  if (archive) {
    console.log('Preparing winCodeSign cache (excluding macOS symlinks)…');
    fs.mkdirSync(WCS_DIR, { recursive: true });
    const r = spawnSync(
      SEVEN_ZIP,
      ['x', archive, `-o${WCS_DIR}`, '-xr!darwin', '-y', '-bso0', '-bsp0'],
      { stdio: 'inherit' }
    );
    if (r.status !== 0) {
      console.error('Failed to extract winCodeSign.');
      process.exit(1);
    }
  } else {
    // Cold cache: let electron-builder download winCodeSign once. Its own
    // extraction will fail on the macOS symlinks, but the .7z download is
    // cached afterwards — just run `npm run dist` a second time.
    console.warn(
      '\n[!] winCodeSign not in cache yet. Running build once to download it;\n' +
        '    if it fails on a symlink error, simply run "npm run dist" again.\n'
    );
  }
}

const env = {
  ...process.env,
  ELECTRON_BUILDER_CACHE: EB_CACHE,
  CSC_IDENTITY_AUTO_DISCOVERY: 'false',
};

const builder = path.join(
  ROOT,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder'
);

const res = spawnSync(builder, ['--win'], { stdio: 'inherit', env, shell: true });
process.exit(res.status === null ? 1 : res.status);
