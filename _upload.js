const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();

conn.on('ready', () => {
  console.log('✅ SSH connected');
  conn.sftp((err, sftp) => {
    if (err) { console.error('SFTP error:', err); conn.end(); return; }
    console.log('✅ SFTP ready');

    const LOCAL_DIST = path.join(__dirname, 'web/dist');
    const REMOTE_DIST = '/opt/stock-management/web/dist';

    // Collect all files
    const files = [];
    function walk(dir, base) {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const rel = base ? base + '/' + name : name;
        if (fs.statSync(full).isDirectory()) walk(full, rel);
        else files.push({ local: full, remote: REMOTE_DIST + '/' + rel, rel });
      }
    }
    walk(LOCAL_DIST, '');
    console.log(`📁 ${files.length} files to upload`);

    let i = 0, ok = 0, fail = 0;

    function next() {
      if (i >= files.length) {
        console.log(`✅ Done: ${ok} ok, ${fail} fail`);
        // Reload nginx and verify
        conn.exec('nginx -s reload 2>/dev/null; sleep 1; curl -sI http://localhost/ | head -1; ls -la /opt/stock-management/web/dist/f1-speed.jpg 2>/dev/null | awk \'{print $5}\'', (e, s) => {
          s.on('data', d => console.log('VERIFY:', d.toString().trim()));
          s.stderr.on('data', d => console.log('ERR:', d.toString().trim()));
          s.on('close', () => conn.end());
        });
        return;
      }

      const f = files[i++];
      const remoteDir = path.dirname(f.remote);

      // mkdir then upload
      conn.exec('mkdir -p ' + remoteDir, (e, s) => {
        s.on('close', () => {
          const rs = fs.createReadStream(f.local);
          const ws = sftp.createWriteStream(f.remote);
          ws.on('close', () => { ok++; console.log(`  [${ok}/${files.length}] ${f.rel}`); next(); });
          ws.on('error', er => { fail++; console.error(`  FAIL ${f.rel}: ${er.message}`); next(); });
          rs.on('error', er => { fail++; console.error(`  READ FAIL ${f.rel}: ${er.message}`); next(); });
          rs.pipe(ws);
        });
      });
    }

    // First clean remote dir
    conn.exec(`rm -rf ${REMOTE_DIST} && mkdir -p ${REMOTE_DIST}`, (e, s) => {
      s.on('data', d => process.stdout.write(d));
      s.stderr.on('data', d => process.stdout.write(d));
      s.on('close', () => { console.log('✅ Remote cleaned'); next(); });
    });
  });
});

conn.on('error', e => console.error('SSH error:', e.message));
conn.connect({ host: '121.40.110.240', port: 22, username: 'root', password: 'zuBu-5567', readyTimeout: 30000 });
