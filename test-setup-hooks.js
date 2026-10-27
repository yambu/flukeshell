// Prova di setup-hooks.js su un settings.json finto: mantiene le voci altrui, toglie le vecchie, è idempotente
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { install, remove } = require('./setup-hooks.js');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-hooks-'));
const file = path.join(dir, 'settings.json');
const NEW = 'C:/X/Flukeshell/flukeshell-hook.js';
fs.writeFileSync(file, JSON.stringify({
  model: 'opus',
  hooks: {
    Stop: [{ hooks: [
      { type: 'command', command: '[ -n "$FLUKESHELL_PORT" ] || powershell -c beep', async: true },  // dell'utente: resta
      { type: 'command', command: 'node "C:/Old/Flukeshell/hook.js"', async: true },                  // vecchia: via
    ] }],
    PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo altro' }] }],              // altrui: resta
  },
}));

assert.strictEqual(install(file, NEW), true);
let s = JSON.parse(fs.readFileSync(file, 'utf8'));
assert.strictEqual(s.model, 'opus');
assert.ok(fs.existsSync(file + '.flukeshell.bak'), 'copia di sicurezza');
const all = Object.values(s.hooks).flat().flatMap(g => g.hooks.map(h => h.command));
assert.ok(!all.some(c => c.includes('C:/Old/')), 'voce vecchia tolta');
assert.ok(all.includes('[ -n "$FLUKESHELL_PORT" ] || powershell -c beep'), 'voce utente rimasta');
assert.ok(all.includes('echo altro'), 'voce altrui rimasta');
assert.strictEqual(all.filter(c => c === `node "${NEW}"`).length, 7, 'una voce per ognuno dei 7 eventi');
assert.strictEqual(s.hooks.SessionEnd[0].hooks[0].async, undefined, 'SessionEnd sincrono');
assert.strictEqual(s.hooks.PreToolUse.at(-1).matcher, 'AskUserQuestion|ExitPlanMode');

assert.strictEqual(install(file, NEW), false, 'secondo avvio: niente da cambiare');

assert.strictEqual(remove(file), true);
s = JSON.parse(fs.readFileSync(file, 'utf8'));
const left = Object.values(s.hooks).flat().flatMap(g => g.hooks.map(h => h.command));
assert.deepStrictEqual(left.sort(), ['[ -n "$FLUKESHELL_PORT" ] || powershell -c beep', 'echo altro'].sort());

// file assente → lo crea
const f2 = path.join(dir, 'nuovo', 'settings.json');
assert.strictEqual(install(f2, NEW), true);
assert.ok(JSON.parse(fs.readFileSync(f2, 'utf8')).hooks.Stop);
fs.rmSync(dir, { recursive: true });
console.log('OK setup-hooks: 13 controlli passati');
