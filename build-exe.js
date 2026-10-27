// Builds node_modules/electron/dist/Flukeshell.exe: electron.exe with Flukeshell's icon and name,
// so the taskbar and Task Manager show Flukeshell instead of Electron.
// Run by `npm install` (postinstall) and by "Start Flukeshell.bat" when the exe is missing.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const dist = path.join(__dirname, 'node_modules', 'electron', 'dist');
const exe = path.join(dist, 'Flukeshell.exe');
try {
  fs.copyFileSync(path.join(dist, 'electron.exe'), exe);
} catch (e) {
  if (e.code !== 'EBUSY' && e.code !== 'EPERM') throw e;
  console.log('Flukeshell.exe is running: it will be rebuilt next time.');
  process.exit(0);
}
const v = (k, val) => ['--set-version-string', k, val];
execFileSync(path.join(__dirname, 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe'), [exe,
  '--set-icon', path.join(__dirname, 'flukeshell.ico'),
  ...v('FileDescription', 'Flukeshell'), ...v('ProductName', 'Flukeshell'),
  ...v('InternalName', 'Flukeshell'), ...v('OriginalFilename', 'Flukeshell.exe')]);
console.log('Built', exe);
