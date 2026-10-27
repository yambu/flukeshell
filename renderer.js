const $ = s => document.querySelector(s);
const tabs = new Map(); // id → { id, term, fit, search, el, li, status, meta: { cwd, title, sessionId, name } }
let active = null;
const prefs = { fontSize: 14, muted: false, lang: 'en' };

// Testi dell'interfaccia: inglese (predefinito) e italiano
const I18N = {
  en: {
    tabs: 'Tabs', newTabTip: 'New tab (Ctrl+Shift+T)', settingsTip: 'Settings: account, usage, options',
    soundOnTip: 'Sounds on (click to mute)', soundOffTip: 'Sounds off (click to turn on)',
    closedSessions: 'Closed sessions', closedTip: 'Closed Claude sessions: click one to reopen it',
    close: 'Close', closeEsc: 'Close (Esc)', searchPh: 'Search… (Enter / Shift+Enter, Esc)',
    settings: 'Settings', account: 'Claude account', checking: 'Checking…', login: 'Log in', logout: 'Log out',
    usage: 'Usage', refresh: 'refresh', loading: 'Loading…', options: 'Options', sounds: 'Alert sounds',
    textSize: 'Text size', language: 'Language', shortcuts: 'Shortcuts',
    makeLinks: 'Create Desktop and Start menu shortcuts',
    linksOk: 'Done: “Flukeshell” is on the Desktop and in the Start menu.',
    linksFail: (d, s) => `Didn’t work: Desktop ${d ? 'ok' : 'no'}, Start menu ${s ? 'ok' : 'no'}.`,
    confirmCloseClaude: n => `Close “${n}”? Claude is open: you’ll find the session under “Closed sessions”.`,
    confirmCloseTab: n => `Close the tab “${n}”?`,
    copied: 'Copied',
    claudeDied: 'Claude quit unexpectedly', waiting: 'Claude is waiting for you', plan: 'Plan to approve',
    question: 'Claude has a question', done: 'Done', error: e => `Error: ${e}`,
    reopenTip: 'click: reopen the session', removeTip: 'Remove from the list', noClosed: 'No closed sessions',
    notInstalled: 'Claude Code isn’t installed: “Start Flukeshell.bat” installs it.',
    loggedIn: 'Logged in', plan_: p => `${p} plan`, notLoggedIn: 'You’re not logged in.',
    confirmLogout: 'Log out of your Claude account? Open sessions will stop working until you log in again.',
    loggingOut: 'Logging out…',
    today: t => `today at ${t}`, at: (d, t) => `${d} at ${t}`, resets: w => `resets ${w}`,
    session5: 'Session (5 hours)', week: 'Week', extra: 'Extra credits this month', of: (a, b) => `${a} of ${b}`,
    nosub: 'No Claude subscription login: usage is shown only with Pro or Max.',
    expired: 'The login has expired: open Claude in a tab and it renews itself.',
    http: s => `Anthropic answered ${s}: try again shortly.`, net: m => `Can’t reach Anthropic: ${m}`,
  },
  it: {
    tabs: 'Schede', newTabTip: 'Nuova scheda (Ctrl+Shift+T)', settingsTip: 'Impostazioni: account, consumi, opzioni',
    soundOnTip: 'Suoni attivi (clic per silenziare)', soundOffTip: 'Suoni spenti (clic per riattivarli)',
    closedSessions: 'Sessioni chiuse', closedTip: 'Sessioni di Claude chiuse: clic per riaprirne una',
    close: 'Chiudi', closeEsc: 'Chiudi (Esc)', searchPh: 'Cerca… (Invio / Maiusc+Invio, Esc)',
    settings: 'Impostazioni', account: 'Account Claude', checking: 'Controllo…', login: 'Accedi', logout: 'Esci',
    usage: 'Consumi', refresh: 'aggiorna', loading: 'Carico…', options: 'Opzioni', sounds: 'Suoni di avviso',
    textSize: 'Dimensione del testo', language: 'Lingua', shortcuts: 'Collegamenti',
    makeLinks: 'Crea i collegamenti sul Desktop e nel menu Start',
    linksOk: 'Fatto: «Flukeshell» è sul Desktop e nel menu Start.',
    linksFail: (d, s) => `Non riuscito: Desktop ${d ? 'ok' : 'no'}, menu Start ${s ? 'ok' : 'no'}.`,
    confirmCloseClaude: n => `Chiudere «${n}»? Claude è aperto: la sessione la ritrovi in «Sessioni chiuse».`,
    confirmCloseTab: n => `Chiudere la scheda «${n}»?`,
    copied: 'Copiato',
    claudeDied: 'Claude si è chiuso di colpo', waiting: 'Claude ti aspetta', plan: 'Piano da approvare',
    question: 'Ti fa una domanda', done: 'Ha finito', error: e => `Errore: ${e}`,
    reopenTip: 'clic: riapri la sessione', removeTip: 'Togli dall’elenco', noClosed: 'Nessuna sessione chiusa',
    notInstalled: 'Claude Code non è installato: lo installa «Start Flukeshell.bat».',
    loggedIn: 'Accesso fatto', plan_: p => `piano ${p}`, notLoggedIn: 'Non hai fatto l’accesso.',
    confirmLogout: 'Uscire dall’account Claude? Le sessioni aperte smetteranno di funzionare finché non rifai l’accesso.',
    loggingOut: 'Esco…',
    today: t => `oggi alle ${t}`, at: (d, t) => `${d} alle ${t}`, resets: w => `si azzera ${w}`,
    session5: 'Sessione (5 ore)', week: 'Settimana', extra: 'Crediti extra del mese', of: (a, b) => `${a} su ${b}`,
    nosub: 'Nessun login con un abbonamento Claude: i consumi si vedono solo con Pro o Max.',
    expired: 'Il login è scaduto: apri Claude in una scheda e si rinnova da solo.',
    http: s => `Anthropic ha risposto ${s}: riprova tra poco.`, net: m => `Non riesco a raggiungere Anthropic: ${m}`,
  },
};
const tr = (k, ...a) => { const v = (I18N[prefs.lang] || I18N.en)[k] ?? I18N.en[k]; return typeof v === 'function' ? v(...a) : v; };
const locale = () => (prefs.lang === 'it' ? 'it-IT' : 'en-GB');
// Testi fissi dell'HTML: data-i18n (testo), data-i18n-title (suggerimento), data-i18n-ph (segnaposto)
function applyLang() {
  document.documentElement.lang = prefs.lang;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = tr(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = tr(el.dataset.i18nTitle);
  for (const el of document.querySelectorAll('[data-i18n-ph]')) el.placeholder = tr(el.dataset.i18nPh);
  for (const t of tabs.values()) t.li.querySelector('.x').title = tr('close');
  $('#opt-lang').value = prefs.lang;
  renderMute(); renderClosed();
  api.setLang(prefs.lang);
}

const THEME = {
  background: '#14161b', foreground: '#d8dee9', cursor: '#d8dee9', selectionBackground: '#3b4252',
  black: '#3b4252', red: '#e06c75', green: '#98c379', yellow: '#e5c07b', blue: '#61afef', magenta: '#c678dd', cyan: '#56b6c2', white: '#d8dee9',
  brightBlack: '#5c6370', brightRed: '#ef8a91', brightGreen: '#b0d99a', brightYellow: '#f0d197', brightBlue: '#82c0f5', brightMagenta: '#d69ae6', brightCyan: '#7accd6', brightWhite: '#ffffff',
};
// Percorsi tipo C:\x\y.ts:42 o src/app.js:10 (niente spazi; ponytail: percorsi con spazi non cliccabili)
const PATH_RE = /(?:[A-Za-z]:[\\/]|\.{1,2}[\\/])?(?:[\w.\-]+[\\/])*[\w\-][\w.\-]*\.[A-Za-z]\w{0,7}(?::\d+){0,2}/g;
const base = p => (p || '').split(/[\\/]/).filter(Boolean).pop() || '~';
let closed = []; // sessioni di Claude chiuse, la più recente prima: { sessionId, name, cwd, at }
const save = () => api.save({ prefs, closed, tabs: [...tabs.values()].map(t => t.meta) });

function newTab({ cwd = '', cmd = '', sessionId = null, title = '', name = '' } = {}) {
  const id = crypto.randomUUID();
  const el = Object.assign(document.createElement('div'), { className: 'term' });
  $('#terms').append(el);
  const t = { id, el, status: null, meta: { cwd, title, sessionId, name } };
  const term = t.term = new Terminal({
    fontFamily: '"Cascadia Mono", Consolas, monospace', fontSize: prefs.fontSize, cursorBlink: true, scrollback: 20000,
    allowProposedApi: true, theme: THEME,
    linkHandler: { activate: (e, uri) => e.ctrlKey && api.open(uri, t.meta.cwd), allowNonHttpProtocols: true },
  });
  t.fit = new FitAddon.FitAddon(); t.search = new SearchAddon.SearchAddon();
  term.loadAddon(t.fit); term.loadAddon(t.search);
  term.loadAddon(new WebLinksAddon.WebLinksAddon((e, uri) => e.ctrlKey && api.open(uri)));
  term.loadAddon(new Unicode11Addon.Unicode11Addon()); term.unicode.activeVersion = '11';
  term.open(el);
  try { const gl = new WebglAddon.WebglAddon(); gl.onContextLoss(() => gl.dispose()); term.loadAddon(gl); } catch {}

  term.registerLinkProvider({ provideLinks(y, cb) {
    const line = term.buffer.active.getLine(y - 1)?.translateToString(true) || '';
    cb([...line.matchAll(PATH_RE)].map(m => ({
      text: m[0], range: { start: { x: m.index + 1, y }, end: { x: m.index + m[0].length, y } },
      activate: (e, text) => e.ctrlKey && api.open(text, t.meta.cwd),
    })));
  } });

  term.onData(d => {
    api.write(id, d);
    if (/^\x1b\[(<|M|I$|O$)/.test(d)) return; // mouse e focus non contano come "hai risposto"
    if (t.status === 'waiting') setStatus(t, 'working');
    else if (t.status === 'done' || t.status === 'error') setStatus(t, 'idle');
  });
  term.onResize(({ cols, rows }) => api.resize(id, cols, rows));
  term.onTitleChange(s => { t.meta.title = s; render(t); });
  term.attachCustomKeyEventHandler(e => onKey(e, t));

  // Trascinare col sinistro seleziona sempre il testo, anche se l'app (Claude fullscreen) cattura il mouse:
  // si ripete il clic con Maiusc premuto, che in xterm forza la selezione.
  el.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.shiftKey || !e.isTrusted || term.modes.mouseTrackingMode === 'none') return;
    e.stopImmediatePropagation(); e.preventDefault();
    const { detail, screenX, screenY, clientX, clientY, buttons, ctrlKey, altKey } = e;
    e.target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window,
      detail, screenX, screenY, clientX, clientY, buttons, ctrlKey, altKey, shiftKey: true }));
  }, true);
  // Tasto destro: copia se c'è una selezione, altrimenti incolla. Non arriva mai all'app (Claude fullscreen).
  for (const ev of ['mousedown', 'mouseup']) el.addEventListener(ev, e => e.button === 2 && e.stopPropagation(), true);
  el.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); term.hasSelection() ? copy(t) : paste(t); }, true);
  // File trascinati → percorsi tra virgolette
  el.addEventListener('dragover', e => e.preventDefault());
  el.addEventListener('drop', e => {
    e.preventDefault();
    const ps = [...e.dataTransfer.files].map(api.pathFor).filter(Boolean);
    if (ps.length) term.paste(ps.map(p => `"${p}"`).join(' ') + ' ');
  });

  t.li = document.createElement('li');
  t.li.innerHTML = '<span class="dot"></span><span class="txt"><div class="name"></div><div class="sub"></div></span><span class="x">✕</span>';
  t.li.querySelector('.x').title = tr('close');
  t.li.onclick = e => e.target.classList.contains('x') ? closeTab(id) : activate(id);
  t.li.ondblclick = e => !e.target.classList.contains('x') && rename(t);
  $('#tabs').append(t.li);

  tabs.set(id, t);
  render(t);
  api.spawn(id, cwd, cmd);
  activate(id);
  save();
  return t;
}

function label(t) {
  const title = /\.exe$/i.test(t.meta.title) ? '' : t.meta.title; // PowerShell mette come titolo il percorso dell'exe
  return t.meta.name || title || (t.meta.sessionId ? 'claude' : 'shell');
}

function render(t) {
  t.li.querySelector('.dot').className = 'dot ' + (t.status || '');
  t.li.dataset.status = t.status || '';
  const name = t.li.querySelector('.name');
  if (name) name.textContent = label(t); // durante la rinomina al suo posto c'è il campo di testo
  t.li.querySelector('.sub').textContent = base(t.meta.cwd);
  t.li.classList.toggle('active', t.id === active);
  sync();
}

// Doppio clic sulla tile: nome scelto da te (vuoto = torna al titolo automatico)
function rename(t) {
  const name = t.li.querySelector('.name'); if (!name) return;
  const inp = Object.assign(document.createElement('input'), { className: 'rename', value: label(t) });
  name.replaceWith(inp);
  let fin = false;
  const end = ok => {
    if (fin) return; fin = true;
    if (ok) t.meta.name = inp.value.trim();
    inp.replaceWith(name); render(t); save(); t.term.focus();
  };
  inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') end(true); if (e.key === 'Escape') end(false); };
  inp.onclick = inp.ondblclick = e => e.stopPropagation();
  // due frame: il clic ha appena chiesto il fuoco per il terminale
  requestAnimationFrame(() => requestAnimationFrame(() => { inp.focus(); inp.select(); inp.onblur = () => end(true); }));
}

function setStatus(t, s) {
  t.status = s; render(t);
}

// Badge sull'icona della barra delle applicazioni (quante schede ti aspettano, col colore della più urgente)
// e l'elenco delle sessioni al lavoro, che main usa per l'avviso alla chiusura.
const BADGE = { error: ['#ff5c5c', '#fff'], waiting: ['#f5d742', '#14161b'], done: ['#5fbf6f', '#14161b'] };
let syncing = false;
function sync() {
  if (syncing) return; syncing = true;
  queueMicrotask(() => {
    syncing = false;
    const all = [...tabs.values()];
    api.busy(all.filter(t => t.status === 'working').map(label));
    const need = all.filter(t => BADGE[t.status]);
    if (!need.length) return api.badge(null, 0);
    const [bg, fg] = BADGE[['error', 'waiting', 'done'].find(s => need.some(t => t.status === s))];
    const c = Object.assign(document.createElement('canvas'), { width: 32, height: 32 }), x = c.getContext('2d');
    x.fillStyle = bg; x.beginPath(); x.arc(16, 16, 16, 0, 2 * Math.PI); x.fill();
    x.fillStyle = fg; x.font = 'bold 20px "Segoe UI"'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(need.length > 9 ? '9+' : String(need.length), 16, 17);
    api.badge(c.toDataURL(), need.length);
  });
}

function activate(id) {
  const t = tabs.get(id); if (!t) return;
  active = id;
  for (const x of tabs.values()) { x.el.classList.toggle('active', x === t); render(x); }
  if (t.status === 'done') setStatus(t, 'idle');
  requestAnimationFrame(() => { t.fit.fit(); t.term.focus(); });
}

async function closeTab(id, ask = true) {
  const t = tabs.get(id); if (!t) return;
  if (ask && !await api.confirm(t.meta.sessionId ? tr('confirmCloseClaude', label(t)) : tr('confirmCloseTab', label(t)))) return;
  remember(t);
  api.kill(id); t.term.dispose(); t.el.remove(); t.li.remove(); tabs.delete(id);
  if (active === id) { const ids = [...tabs.keys()]; ids.length ? activate(ids.at(-1)) : newTab(); }
  sync(); save();
}

function cycle(dir) {
  const ids = [...tabs.keys()];
  activate(ids[(ids.indexOf(active) + dir + ids.length) % ids.length]);
}

function copy(t) { api.clipWrite(t.term.getSelection()); t.term.clearSelection(); toast(tr('copied')); }

// Come cmd/Windows Terminal: rilasciato il mouse (anche fuori dalla finestra), la selezione va subito negli appunti
let selecting = false;
$('#terms').addEventListener('mousedown', e => { selecting = e.button === 0; }, true);
window.addEventListener('mouseup', e => {
  if (e.button !== 0 || !selecting) return;
  selecting = false;
  setTimeout(() => {
    const t = tabs.get(active);
    if (t?.term.hasSelection()) { api.clipWrite(t.term.getSelection()); toast(tr('copied')); }
  });
});

// Messaggio breve in alto a destra del terminale
let toastTimer;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 1200);
}
async function paste(t) {
  const { text, image } = await api.clipRead();
  if (text) t.term.paste(text);
  else if (image) api.write(t.id, '\x1bv'); // Alt+V: Claude Code su Windows incolla l'immagine dagli appunti
}

function onKey(e, t) {
  if (e.type !== 'keydown') return true;
  const k = e.key.toLowerCase(), ctrl = e.ctrlKey && !e.altKey;
  const act = fn => { e.preventDefault(); fn(); return false; };
  if (ctrl && e.shiftKey) {
    if (k === 't') return act(() => newTab({ cwd: t.meta.cwd }));
    if (k === 'w') return act(() => closeTab(t.id));
    if (k === 'f') return act(openSearch);
    if (k === 'c') return act(() => copy(t));
    if (k === 'v') return act(() => paste(t));
  }
  if (ctrl && e.key === 'Tab') return act(() => cycle(e.shiftKey ? -1 : 1));
  if (ctrl && !e.shiftKey && k === 'c' && t.term.hasSelection()) return act(() => copy(t));
  if (ctrl && !e.shiftKey && k === 'v') return act(() => paste(t));
  if (e.shiftKey && !e.ctrlKey && e.key === 'Enter') return act(() => api.write(t.id, '\x1b\r')); // a capo in Claude
  return true;
}

// Ricerca nell'output
const box = $('#search'), input = box.querySelector('input');
function openSearch() { box.hidden = false; input.select(); input.focus(); }
input.onkeydown = e => {
  const t = tabs.get(active);
  if (e.key === 'Escape') { box.hidden = true; t.search.clearDecorations(); t.term.focus(); }
  if (e.key === 'Enter') t.search[e.shiftKey ? 'findPrevious' : 'findNext'](input.value, {
    decorations: { matchOverviewRuler: '#e5c07b', activeMatchColorOverviewRuler: '#f0a030', matchBackground: '#5c4a1a', activeMatchBackground: '#a06a10' },
  });
};

// Eventi dagli hook di Claude Code
api.onHook((id, h) => {
  const t = tabs.get(id); if (!t) return;
  const ev = h.hook_event_name;
  if (ev === 'SessionEnd') { remember(t); t.meta.sessionId = null; setStatus(t, null); return save(); }
  if (ev === 'ClaudeDied') { // il processo è sparito senza SessionEnd: crash, chiuso dal task manager, ecc.
    if (t.meta.sessionId) { remember(t); t.meta.sessionId = null; alertTab(t, 'error', tr('claudeDied')); save(); }
    return;
  }
  if (h.session_id) t.meta.sessionId = h.session_id;
  if (h.cwd) t.meta.cwd = h.cwd;
  if (ev === 'SessionStart') setStatus(t, 'idle');
  if (ev === 'UserPromptSubmit') setStatus(t, 'working');
  if (ev === 'Notification' && ASK.includes(h.notification_type)) alertTab(t, 'waiting', h.message || tr('waiting'));
  if (ev === 'PreToolUse') alertTab(t, 'waiting', h.tool_name === 'ExitPlanMode' ? tr('plan') : tr('question'));
  if (ev === 'Stop') alertTab(t, 'done', tr('done'));
  if (ev === 'StopFailure') alertTab(t, 'error', h.last_assistant_message || tr('error', h.error));
  save();
});
const ASK = ['permission_prompt', 'elicitation_dialog', 'elicitation_url_dialog', 'agent_needs_input'];

// Suono di attenzione: due note, diverse per stato
const TONES = { done: [660, 880], waiting: [880, 880], error: [440, 220] };
const audio = new AudioContext();
function chime(s) {
  if (prefs.muted) return;
  TONES[s].forEach((f, i) => {
    const o = audio.createOscillator(), g = audio.createGain(), at = audio.currentTime + i * 0.16;
    o.frequency.value = f; o.connect(g).connect(audio.destination);
    g.gain.setValueAtTime(0.25, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.15);
    o.start(at); o.stop(at + 0.15);
  });
}
function alertTab(t, s, msg) {
  setStatus(t, s); chime(s);
  if (t.id !== active || !document.hasFocus()) api.notify(label(t), msg, t.id);
}

// Muto: solo i suoni, le notifiche restano
const muteBtn = $('#mute');
function renderMute() {
  muteBtn.textContent = prefs.muted ? '🔕' : '🔔';
  muteBtn.title = tr(prefs.muted ? 'soundOffTip' : 'soundOnTip');
  $('#opt-sound').checked = !prefs.muted;
}
muteBtn.onclick = () => { prefs.muted = !prefs.muted; renderMute(); save(); };

// Ctrl+rotella: dimensione del testo in tutte le schede, salvata
$('#terms').addEventListener('wheel', e => {
  if (!e.ctrlKey) return;
  e.preventDefault(); e.stopPropagation();
  setFont(prefs.fontSize + (e.deltaY < 0 ? 1 : -1));
}, { capture: true, passive: false });
function setFont(n) {
  prefs.fontSize = Math.min(32, Math.max(8, n));
  for (const t of tabs.values()) t.term.options.fontSize = prefs.fontSize;
  tabs.get(active)?.fit.fit();
  $('#font-size').textContent = prefs.fontSize;
  save();
}

api.onData((id, d) => tabs.get(id)?.term.write(d));
api.onExit(id => closeTab(id, false)); // la shell è uscita da sola (exit): niente domanda
api.onFocusTab(activate);
new ResizeObserver(() => tabs.get(active)?.fit.fit()).observe($('#terms'));

$('#new-tab').onclick = () => newTab(); // cartella home

// Sessioni chiuse: ogni sessione di Claude che finisce (scheda chiusa, /exit, crash) si può riaprire da qui
const SID = /^[\w-]+$/;
function remember(t) {
  const sid = t.meta.sessionId; if (!sid || !SID.test(sid)) return;
  closed = [{ sessionId: sid, name: label(t), cwd: t.meta.cwd, at: Date.now() }, ...closed.filter(c => c.sessionId !== sid)].slice(0, 100);
  renderClosed();
}
function renderClosed() {
  $('#history-count').textContent = closed.length || '';
  const when = at => new Date(at).toLocaleString(locale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  $('#history-list').replaceChildren(...(closed.length ? closed.map(c => {
    const li = document.createElement('li');
    li.title = `${c.cwd || '~'}\n${tr('reopenTip')}`;
    li.innerHTML = '<span class="txt"><div class="name"></div><div class="sub"></div></span><span class="x">✕</span>';
    li.querySelector('.x').title = tr('removeTip');
    li.querySelector('.name').textContent = c.name;
    li.querySelector('.sub').textContent = `${base(c.cwd)} · ${when(c.at)}`;
    li.onclick = e => {
      closed = closed.filter(x => x !== c); renderClosed(); save();
      if (e.target.classList.contains('x')) return;
      $('#history').hidden = true;
      newTab({ cwd: c.cwd, name: c.name, sessionId: c.sessionId, cmd: `claude --resume ${c.sessionId}` });
    };
    return li;
  }) : [Object.assign(document.createElement('div'), { className: 'empty', textContent: tr('noClosed') })]));
}
$('#history-btn').onclick = () => { $('#history').hidden = !$('#history').hidden; };
$('#history-close').onclick = () => { $('#history').hidden = true; tabs.get(active)?.term.focus(); };

// ⚙ Impostazioni: account e consumi di Claude Code, opzioni, collegamenti
const settings = $('#settings');
function closeSettings() { settings.hidden = true; tabs.get(active)?.term.focus(); }
$('#settings-btn').onclick = () => { if (settings.hidden) { settings.hidden = false; loadAccount(); loadUsage(); } else closeSettings(); };
$('#settings-close').onclick = closeSettings;
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !settings.hidden) closeSettings(); });

async function loadAccount() {
  const acc = $('#acc'); acc.className = 'dim'; acc.textContent = tr('checking');
  const a = await api.account();
  const plan = a.subscriptionType ? ' · ' + tr('plan_', a.subscriptionType[0].toUpperCase() + a.subscriptionType.slice(1)) : '';
  acc.textContent = !a.installed ? tr('notInstalled') : a.loggedIn ? (a.email || tr('loggedIn')) + plan : tr('notLoggedIn');
  acc.className = a.loggedIn ? '' : 'dim';
  $('#login').hidden = !a.installed || a.loggedIn;
  $('#logout').hidden = !a.loggedIn;
}
$('#login').onclick = () => { closeSettings(); newTab({ cmd: 'claude auth login' }); };
$('#logout').onclick = async () => {
  if (!await api.confirm(tr('confirmLogout'))) return;
  $('#acc').textContent = tr('loggingOut');
  await api.logout(); loadAccount(); loadUsage();
};

const pct = n => Math.max(0, Math.min(100, Math.round(n || 0)));
function when(iso) {
  const d = new Date(iso), today = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  return today ? tr('today', time) : tr('at', d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric' }), time);
}
function meter(label, p, sub) {
  const el = document.createElement('div'); el.className = 'meter';
  el.innerHTML = '<div class="lbl"><span></span><b></b></div><div class="bar"><div class="fill"></div></div><div class="dim sub"></div>';
  el.querySelector('span').textContent = label; el.querySelector('b').textContent = p + '%';
  const f = el.querySelector('.fill'); f.style.width = p + '%'; f.classList.add(p >= 90 ? 'crit' : p >= 70 ? 'warn' : 'ok');
  el.querySelector('.sub').textContent = sub;
  return el;
}
function showUsage(u) {
  const box = $('#usage');
  if (u.error) { box.className = 'dim'; box.textContent = tr(u.error, u.detail); return; }
  box.className = ''; box.replaceChildren();
  if (u.five) box.append(meter(tr('session5'), pct(u.five.utilization), u.five.resets_at ? tr('resets', when(u.five.resets_at)) : ''));
  if (u.week) box.append(meter(tr('week'), pct(u.week.utilization), u.week.resets_at ? tr('resets', when(u.week.resets_at)) : ''));
  const x = u.extra;
  if (x?.is_enabled && x.monthly_limit) {
    const k = 10 ** (x.decimal_places ?? 2), used = (x.used_credits || 0) / k, lim = x.monthly_limit / k;
    const money = n => n.toLocaleString(locale(), { style: 'currency', currency: x.currency || 'USD' });
    box.append(meter(tr('extra'), pct(used / lim * 100), tr('of', money(used), money(lim))));
  }
}
async function loadUsage() {
  const box = $('#usage'); box.className = 'dim'; box.textContent = tr('loading');
  showUsage(await api.usage());
}
$('#usage-refresh').onclick = loadUsage;

$('#opt-sound').onchange = e => { prefs.muted = !e.target.checked; renderMute(); save(); };
$('#opt-lang').onchange = e => {
  prefs.lang = e.target.value; applyLang(); save();
  if (!settings.hidden) { loadAccount(); loadUsage(); }
};
$('#font-minus').onclick = () => setFont(prefs.fontSize - 1);
$('#font-plus').onclick = () => setFont(prefs.fontSize + 1);
$('#make-links').onclick = async () => {
  const r = await api.shortcuts();
  $('#links-msg').textContent = r.desktop && r.start ? tr('linksOk') : tr('linksFail', r.desktop, r.start);
};

// Avvio: ripristina le schede di prima (claude riprende la sua sessione)
api.load().then(s => {
  Object.assign(prefs, s.prefs); if (!I18N[prefs.lang]) prefs.lang = 'en';
  $('#font-size').textContent = prefs.fontSize;
  closed = (s.closed || []).filter(c => SID.test(c.sessionId || ''));
  applyLang();
  for (const m of s.tabs || []) {
    const sid = /^[\w-]+$/.test(m.sessionId || '') ? m.sessionId : null;
    newTab({ cwd: m.cwd, title: m.title, name: m.name, sessionId: sid, cmd: sid ? `claude --resume ${sid}` : '' });
  }
  if (!tabs.size) newTab();
});
