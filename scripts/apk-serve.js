// apk-serve.js — hand the APK to the phone over the house wifi.
//
// When no cable is attached, the shortest honest path from a Windows desktop to
// an Android phone is a URL. Serves one file and one page on the LAN; the phone
// opens the address, taps once, and Android's installer takes it from there.
//
//   node scripts/apk-serve.js <path-to-apk> <version> [port]

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const apkPath = process.argv[2];
const version = process.argv[3] || '';
const port = Number(process.argv[4] || 8770);

if (!apkPath || !fs.existsSync(apkPath)) {
  console.error('apk-serve: no such APK: ' + apkPath);
  process.exit(1);
}

const size = (fs.statSync(apkPath).size / (1024 * 1024)).toFixed(1);
const fileName = 'renaissance-man-' + (version || 'latest') + '.apk';

/** The address the phone can actually reach — not loopback, not a virtual adapter. */
function lanAddress() {
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const [name, addrs] of Object.entries(nets)) {
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      // WSL/Docker/VirtualBox bridges are reachable from this machine only
      const virtual = /vEthernet|WSL|Docker|VirtualBox|Hyper-V|Loopback/i.test(name);
      candidates.push({ address: a.address, name, virtual });
    }
  }
  candidates.sort((x, y) => Number(x.virtual) - Number(y.virtual));
  return candidates.length ? candidates[0].address : '127.0.0.1';
}

const host = lanAddress();

const page = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Renaissance Man ${version}</title>
<style>
 :root{color-scheme:dark}
 body{margin:0;min-height:100vh;display:grid;place-items:center;
   background:#0d0906;color:#e7d9b8;font-family:Georgia,'Times New Roman',serif;padding:24px}
 .card{max-width:420px;text-align:center}
 h1{font-weight:500;font-size:28px;margin:0 0 6px}
 .v{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#b58a3b;margin-bottom:26px}
 a.get{display:block;padding:18px 24px;border:1px solid #caa64c;border-radius:6px;
   color:#ecd089;text-decoration:none;font-size:19px;letter-spacing:.04em}
 a.get:active{background:rgba(202,166,76,.14)}
 p{font-size:14px;line-height:1.6;color:#a08a68;margin-top:26px}
</style></head><body><div class="card">
 <h1>Renaissance&nbsp;Man</h1>
 <div class="v">version ${version} &middot; ${size}&nbsp;MB</div>
 <a class="get" href="/${fileName}" download>install on this phone</a>
 <p>Installs over the copy you already have and keeps your vault.
    If Android asks, allow installs from your browser this once.</p>
</div></body></html>`;

const server = http
  .createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(page);
    }
    if (req.url === '/' + fileName) {
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': fs.statSync(apkPath).size,
        'Content-Disposition': `attachment; filename="${fileName}"`,
      });
      return fs.createReadStream(apkPath).pipe(res);
    }
    res.writeHead(404);
    res.end('not here');
  });

// A previous hand-over that was never Ctrl-C'd still holds the port. That is not
// worth a stack trace and a failed ship — step along to the next free one.
let attempt = port;
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && attempt < port + 12) {
    attempt += 1;
    console.log('  port ' + (attempt - 1) + ' is busy — trying ' + attempt);
    setTimeout(() => server.listen(attempt, '0.0.0.0'), 60);
    return;
  }
  console.error('apk-serve: ' + err.message);
  process.exit(1);
});

server.on('listening', () => {
  const live = `http://${host}:${server.address().port}/`;
  console.log('');
  console.log('  On the phone, open:   ' + live);
  console.log('  (same wifi as this machine · ' + size + ' MB · v' + version + ')');
  console.log('');
  console.log('  Ctrl-C when the phone has it.');
  console.log('');
});

server.listen(attempt, '0.0.0.0');
