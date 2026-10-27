const { contextBridge, ipcRenderer, webUtils } = require('electron');

const on = ch => fn => ipcRenderer.on(ch, (e, ...a) => fn(...a));
contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('state:load'),
  save: s => ipcRenderer.send('state:save', s),
  spawn: (id, cwd, cmd) => ipcRenderer.send('pty:spawn', id, cwd, cmd),
  write: (id, d) => ipcRenderer.send('pty:write', id, d),
  resize: (id, c, r) => ipcRenderer.send('pty:resize', id, c, r),
  kill: id => ipcRenderer.send('pty:kill', id),
  clipRead: () => ipcRenderer.invoke('clip:read'),
  clipWrite: t => ipcRenderer.send('clip:write', t),
  confirm: msg => ipcRenderer.invoke('confirm', msg),
  notify: (title, body, id) => ipcRenderer.send('notify', title, body, id),
  open: (target, cwd) => ipcRenderer.send('open', target, cwd),
  pathFor: f => webUtils.getPathForFile(f),
  busy: names => ipcRenderer.send('busy', names),
  badge: (url, n) => ipcRenderer.send('badge', url, n),
  account: () => ipcRenderer.invoke('account'),
  logout: () => ipcRenderer.invoke('logout'),
  usage: () => ipcRenderer.invoke('usage'),
  shortcuts: () => ipcRenderer.invoke('shortcuts'),
  setLang: l => ipcRenderer.send('lang', l),
  onData: on('pty:data'), onExit: on('pty:exit'), onHook: on('hook'), onFocusTab: on('focus-tab'),
});
