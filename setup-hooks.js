// Connects Claude Code to Flukeshell: writes (or removes) the hooks in ~/.claude/settings.json.
// main.js runs it on every start; by hand: `node setup-hooks.js` installs, `node setup-hooks.js --remove` removes.
// Flukeshell's entries are recognised by the file name (flukeshell-hook.js), so moving the folder leaves no
// duplicates: old entries are removed and rewritten with the new path. Nothing else in the file is touched.
const fs = require('fs');
const os = require('os');
const path = require('path');

const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const HOOK = path.join(__dirname, 'flukeshell-hook.js').replace(/\\/g, '/');
// SessionEnd è sincrono: Claude aspetta che arrivi prima di uscire, così l'uscita normale non sembra un crash
const EVENTS = {
  SessionStart: {}, SessionEnd: { sync: true }, UserPromptSubmit: {}, Notification: {},
  Stop: {}, StopFailure: {}, PreToolUse: { matcher: 'AskUserQuestion|ExitPlanMode' },
};
const ours = h => /flukeshell/i.test(h.command || '') && /hook\.js/.test(h.command || '');

function update(install, file = SETTINGS, hookPath = HOOK) {
  let s = {};
  try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
    if (e.code !== 'ENOENT') throw new Error(`${file} is not valid JSON: hooks left untouched (${e.message})`);
  }
  const before = JSON.stringify(s);
  const hooks = s.hooks || {};
  for (const ev of Object.keys(hooks)) {
    hooks[ev] = hooks[ev].map(g => ({ ...g, hooks: (g.hooks || []).filter(h => !ours(h)) })).filter(g => g.hooks.length);
    if (!hooks[ev].length) delete hooks[ev];
  }
  if (install) for (const [ev, o] of Object.entries(EVENTS)) {
    const hook = { type: 'command', command: `node "${hookPath}"`, ...(o.sync ? {} : { async: true }) };
    (hooks[ev] ||= []).push({ ...(o.matcher ? { matcher: o.matcher } : {}), hooks: [hook] });
  }
  if (Object.keys(hooks).length) s.hooks = hooks; else delete s.hooks;
  if (JSON.stringify(s) === before) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file) && !fs.existsSync(file + '.flukeshell.bak')) fs.copyFileSync(file, file + '.flukeshell.bak');
  fs.writeFileSync(file + '.tmp', JSON.stringify(s, null, 2) + '\n');
  fs.renameSync(file + '.tmp', file);
  return true;
}

module.exports = { install: (...a) => update(true, ...a), remove: (...a) => update(false, ...a) };

if (require.main === module) {
  const remove = process.argv.includes('--remove');
  const changed = update(!remove);
  console.log(remove ? (changed ? 'Flukeshell hooks removed.' : 'No Flukeshell hooks to remove.')
    : (changed ? 'Flukeshell hooks installed.' : 'Flukeshell hooks already in place.'), '→', SETTINGS);
}
