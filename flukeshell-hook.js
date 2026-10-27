// Hook di Claude Code: inoltra l'evento a Flukeshell. Fuori da Flukeshell non fa niente.
const { FLUKESHELL_PORT: port, FLUKESHELL_TAB: tab, FLUKESHELL_TOKEN: token } = process.env;
const { execFileSync } = require('child_process');

// Risale i processi padri fino a claude.exe: Flukeshell lo sorveglia per accorgersi se si chiude di colpo
function claudePid() {
  const ps = `$p=${process.ppid}; while ($p) { $x = Get-CimInstance Win32_Process -Filter "ProcessId=$p"; ` +
    `if (!$x) { break }; if ($x.Name -eq 'claude.exe') { $p; break }; $p = $x.ParentProcessId }`;
  try { return Number(execFileSync('powershell', ['-NoProfile', '-Command', ps], { timeout: 8000 }).toString().trim()) || undefined; } catch {}
}

let body = '';
process.stdin.on('data', d => body += d).on('end', () => {
  if (!port) return;
  try {
    const h = JSON.parse(body);
    if (h.hook_event_name === 'SessionStart') { h.claude_pid = claudePid(); body = JSON.stringify(h); }
  } catch {}
  const req = require('http').request({
    host: '127.0.0.1', port, path: '/hook', method: 'POST', timeout: 1000,
    headers: { 'x-tab': tab, 'x-token': token, 'content-type': 'application/json' },
  }, res => res.resume());
  req.on('error', () => {}).on('timeout', () => req.destroy());
  req.end(body);
});
