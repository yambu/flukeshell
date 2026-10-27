const { app, BrowserWindow, ipcMain, clipboard, shell, Notification, dialog, nativeImage, net } = require('electron');
const pty = require('@lydell/node-pty');
const { spawn, execFile } = require('child_process');
const crypto = require('crypto');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { fileURLToPath } = require('url');

const AUMID = 'Flukeshell.Terminal'; // cambiata: Windows teneva in cache l'icona di Electron per 'Flukeshell'
const STATE = path.join(app.getPath('userData'), 'state.json');
const TOKEN = crypto.randomBytes(16).toString('hex');
const NPP = 'C:/Program Files/Notepad++/notepad++.exe';
const ICON = path.join(__dirname, 'flukeshell.ico');
const ptys = new Map();
const claudePids = new Map(); // scheda → pid di claude.exe, per accorgersi se si chiude senza SessionEnd
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const CLAUDE = [path.join(os.homedir(), '.local', 'bin', 'claude.exe')].find(f => fs.existsSync(f)) || 'claude';
const notifications = new Set(); // tenute in vita: se il garbage collector le prende, il clic non arriva più
let win, port, quitting = false, busy = [], closeOk = false, lastAlert = null;

// Testi delle finestre di dialogo native: la lingua la sceglie il renderer (preferenze), all'avvio si legge dallo stato
let lang = (() => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')).prefs?.lang || 'en'; } catch { return 'en'; } })();
const M = {
  en: {
    yes: 'Yes', no: 'No', closeAnyway: 'Close anyway', cancel: 'Cancel',
    busyOne: 'Claude is still working:', busyMany: n => `${n} Claude sessions are still working:`,
    busyDetail: 'Closing stops them. Next time you can resume the conversation, but the work in progress stops.',
    hookTitle: 'Can’t connect Claude Code.', hookDetail: 'Tabs work, but without colors and notifications.',
    badge: n => `${n} tabs waiting for you`,
  },
  it: {
    yes: 'Sì', no: 'No', closeAnyway: 'Chiudi lo stesso', cancel: 'Annulla',
    busyOne: 'Claude sta ancora lavorando:', busyMany: n => `${n} sessioni di Claude stanno ancora lavorando:`,
    busyDetail: 'Chiudendo si interrompono. Al prossimo avvio riprendi la conversazione, ma il lavoro in corso si ferma.',
    hookTitle: 'Non riesco a collegare Claude Code.', hookDetail: 'Le schede funzionano, ma senza colori e notifiche.',
    badge: n => `${n} schede ti aspettano`,
  },
};
const tr = (k, ...a) => { const v = (M[lang] || M.en)[k]; return typeof v === 'function' ? v(...a) : v; };
ipcMain.on('lang', (e, l) => { if (M[l]) lang = l; });

if (!app.requestSingleInstanceLock()) app.exit();
// Riaperto mentre è già aperto (anche dal clic su una notifica rimasta nel centro notifiche): porta avanti la
// finestra e la scheda dell'ultimo avviso
app.on('second-instance', () => { bring(); if (lastAlert) toUI('focus-tab', lastAlert); });
app.setAppUserModelId(AUMID);

// Le notifiche toast di Windows vogliono un collegamento nel menu Start con lo stesso AUMID
const lnk = path.join(app.getPath('appData'), 'Microsoft/Windows/Start Menu/Programs/Flukeshell.lnk');
const makeShortcut = file => shell.writeShortcutLink(file, {
  target: process.execPath, args: `"${app.getAppPath()}"`, cwd: app.getAppPath(), appUserModelId: AUMID, icon: ICON, iconIndex: 0,
  description: 'Flukeshell',
});
makeShortcut(lnk);

// Collega Claude Code a questa cartella (hook in ~/.claude/settings.json). Se non riesce l'app funziona lo stesso,
// solo senza tile colorate e notifiche: lo si dice all'utente appena la finestra è aperta.
let hookError = null;
try { require('./setup-hooks').install(); } catch (e) { hookError = e.message; }

// Gli hook di Claude Code (flukeshell-hook.js) arrivano qui e vengono girati alla scheda giusta
const srv = http.createServer((req, res) => {
  let body = '';
  req.on('data', d => body += d).on('end', () => {
    res.end();
    if (req.headers['x-token'] !== TOKEN || quitting) return;
    const tab = req.headers['x-tab'];
    try {
      const h = JSON.parse(body);
      if (h.claude_pid) claudePids.set(tab, h.claude_pid);
      if (h.hook_event_name === 'SessionEnd') claudePids.delete(tab);
      toUI('hook', tab, h);
    } catch {}
  });
});
setInterval(() => {
  if (quitting) return;
  for (const [tab, pid] of claudePids) {
    try { process.kill(pid, 0); } catch (e) {
      if (e.code !== 'ESRCH') continue;
      claudePids.delete(tab);
      toUI('hook', tab, { hook_event_name: 'ClaudeDied' });
    }
  }
}, 3000);
// Tutto quello che va alla finestra passa da qui: i terminali possono mandare dati anche dopo che si è chiusa
const alive = () => win && !win.isDestroyed();
const toUI = (ch, ...a) => { if (alive()) win.webContents.send(ch, ...a); };
function bring() {
  if (!alive()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.setAlwaysOnTop(true); win.focus(); win.setAlwaysOnTop(false); // Windows non lascia prendere il primo piano: così sì
}

srv.listen(0, '127.0.0.1', () => { port = String(srv.address().port); app.whenReady().then(createWindow); });

function createWindow() {
  win = new BrowserWindow({
    width: 1300, height: 820, backgroundColor: '#14161b', autoHideMenuBar: true, title: 'Flukeshell', icon: ICON,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.setMenu(null);
  // Con un AUMID la barra delle applicazioni prende l'icona da queste proprietà, non dall'icona della finestra
  win.setAppDetails({ appId: AUMID, appIconPath: ICON, appIconIndex: 0, relaunchDisplayName: 'Flukeshell',
    relaunchCommand: `"${process.execPath}" "${app.getAppPath()}"` });
  win.loadFile(path.join(__dirname, 'index.html'));
  if (hookError) dialog.showMessageBox(win, { type: 'warning', title: 'Flukeshell', message: tr('hookTitle'),
    detail: `${tr('hookDetail')}\n\n${hookError}` });
  win.on('focus', () => win.flashFrame(false));
  win.on('closed', () => { win = null; });
  win.on('close', async e => {
    if (busy.length && !closeOk) {
      e.preventDefault();
      const r = await dialog.showMessageBox(win, {
        type: 'warning', buttons: [tr('closeAnyway'), tr('cancel')], defaultId: 1, cancelId: 1, title: 'Flukeshell',
        message: busy.length === 1 ? tr('busyOne') : tr('busyMany', busy.length),
        detail: busy.map(n => '• ' + n).join('\n') + '\n\n' + tr('busyDetail'),
      });
      if (r.response === 0) { closeOk = true; win.close(); }
      return;
    }
    quitting = true; for (const p of ptys.values()) p.kill();
  });
}
app.on('window-all-closed', () => app.quit());

ipcMain.handle('state:load', () => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; } });
ipcMain.on('state:save', (e, s) => { if (!quitting) fs.writeFileSync(STATE, JSON.stringify(s, null, 2)); });

ipcMain.on('pty:spawn', (e, id, cwd, cmd) => {
  const p = pty.spawn('powershell.exe', cmd ? ['-NoExit', '-Command', cmd] : ['-NoLogo'], {
    cwd: cwd && fs.existsSync(cwd) ? cwd : os.homedir(), cols: 120, rows: 30,
    env: { ...process.env, FLUKESHELL_PORT: port, FLUKESHELL_TAB: id, FLUKESHELL_TOKEN: TOKEN, COLORTERM: 'truecolor' },
  });
  ptys.set(id, p);
  p.onData(d => toUI('pty:data', id, d));
  p.onExit(() => { ptys.delete(id); if (!quitting) toUI('pty:exit', id); });
});
ipcMain.on('pty:write', (e, id, d) => ptys.get(id)?.write(d));
ipcMain.on('pty:resize', (e, id, c, r) => { try { ptys.get(id)?.resize(c, r); } catch {} });
ipcMain.on('pty:kill', (e, id) => { claudePids.delete(id); ptys.get(id)?.kill(); ptys.delete(id); });
ipcMain.on('busy', (e, names) => busy = names);
ipcMain.on('badge', (e, url, n) => alive() && win.setOverlayIcon(url ? nativeImage.createFromDataURL(url) : null, url ? tr('badge', n) : ''));

ipcMain.handle('clip:read', async () => ({ text: await clipboard.readText(), image: await clipboard.has('image/png') }));
ipcMain.on('clip:write', (e, t) => clipboard.writeText(t));
ipcMain.handle('confirm', async (e, msg) => (await dialog.showMessageBox(win, { type: 'question', buttons: [tr('yes'), tr('no')], defaultId: 1, title: 'Flukeshell', message: msg })).response === 0);

ipcMain.on('notify', (e, title, body, id) => {
  if (!alive()) return;
  if (!win.isFocused()) win.flashFrame(true);
  lastAlert = id;
  const n = new Notification({ title, body, icon: path.join(__dirname, 'flukeshell.png'), silent: true }); // il suono lo fa già la scheda
  notifications.add(n);
  n.on('click', () => { notifications.delete(n); bring(); toUI('focus-tab', id); });
  n.on('close', () => notifications.delete(n));
  n.show();
});

ipcMain.on('open', (e, target, cwd) => {
  if (/^https?:\/\//i.test(target)) return shell.openExternal(target);
  if (/^file:/i.test(target)) target = fileURLToPath(target);
  const m = target.match(/^(.*?)(?::(\d+))?(?::\d+)?$/);
  const file = path.resolve(cwd || os.homedir(), m[1]);
  if (!fs.existsSync(file)) return;
  if (m[2] && fs.existsSync(NPP)) spawn(NPP, [`-n${m[2]}`, file], { detached: true, stdio: 'ignore' }).unref();
  else shell.openPath(file);
});

// ⚙ Impostazioni: account e consumi di Claude Code, collegamenti
ipcMain.handle('account', () => new Promise(res => execFile(CLAUDE, ['auth', 'status'], { timeout: 20000, windowsHide: true }, (err, out) => {
  try { res({ installed: true, ...JSON.parse(out) }); } catch { res({ installed: err?.code !== 'ENOENT', loggedIn: false }); }
})));
ipcMain.handle('logout', () => new Promise(res => execFile(CLAUDE, ['auth', 'logout'], { timeout: 20000, windowsHide: true }, err => res(!err))));
// Gli stessi numeri di /usage: li dà Anthropic col login dell'abbonamento (solo Pro/Max)
ipcMain.handle('usage', async () => {
  let c;
  try { c = JSON.parse(fs.readFileSync(path.join(CLAUDE_DIR, '.credentials.json'), 'utf8')).claudeAiOauth; } catch {}
  // gli errori sono chiavi: li traduce il renderer
  if (!c?.accessToken) return { error: 'nosub' };
  if (c.expiresAt && c.expiresAt < Date.now()) return { error: 'expired' };
  try {
    const r = await net.fetch('https://api.anthropic.com/api/oauth/usage', {
      headers: { Authorization: `Bearer ${c.accessToken}`, 'anthropic-beta': 'oauth-2025-04-20', 'User-Agent': 'claude-code/2.1' } });
    if (!r.ok) return { error: 'http', detail: r.status };
    const j = await r.json();
    return { five: j.five_hour, week: j.seven_day, extra: j.extra_usage };
  } catch (e) { return { error: 'net', detail: e.message }; }
});
ipcMain.handle('shortcuts', () => ({
  desktop: makeShortcut(path.join(app.getPath('desktop'), 'Flukeshell.lnk')), start: makeShortcut(lnk),
}));
