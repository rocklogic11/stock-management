const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
const LOCAL_WEB_DIST = path.join(__dirname, 'web/dist');
const REMOTE_WEB = '/opt/stock-management/web/dist';

conn.on('ready', () => {
  console.log('✅ SSH connected');
  
  // Step 1: Backup and clean remote dist
  conn.exec(`rm -rf ${REMOTE_WEB} && mkdir -p ${REMOTE_WEB}`, (err, stream) => {
    if (err) { console.error('Clean failed:', err); conn.end(); return; }
    stream.on('close', () => {
      console.log('✅ Remote dist cleaned');
      
      // Step 2: Upload all dist files via SFTP
      const sftp = require('ssh2').utils.sftp;
      conn.sftp((err, sftp) => {
        if (err) { console.error('SFTP failed:', err); conn.end(); return; }
        
        const files = [];
        function walkDir(dir, base) {
          const items = fs.readdirSync(dir);
          for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            const relPath = base ? `${base}/${item}` : item;
            if (stat.isDirectory()) {
              walkDir(fullPath, relPath);
            } else {
              files.push({ local: fullPath, remote: `${REMOTE_WEB}/${relPath}` });
            }
          }
        }
        walkDir(LOCAL_WEB_DIST, '');
        console.log(`📁 Found ${files.length} files to upload`);
        
        let uploaded = 0;
        let errors = 0;
        
        function uploadNext() {
          if (uploaded + errors >= files.length) {
            console.log(`✅ Upload complete: ${uploaded} success, ${errors} errors`);
            
            // Step 3: Ensure nginx is serving correctly
            conn.exec(`nginx -t && nginx -s reload && echo 'NGINX_OK'`, (err, stream) => {
              if (err) console.error('Nginx reload error:', err);
              stream.on('data', d => process.stdout.write(d));
              stream.stderr.on('data', d => process.stdout.write(d));
              stream.on('close', () => {
                // Step 4: Verify
                conn.exec(`curl -s -o /dev/null -w '%{http_code}' http://localhost/ && echo '' && ls -la ${REMOTE_WEB}/f1-speed.jpg 2>/dev/null && echo 'IMAGE_OK' || echo 'NO_IMAGE'`, (err, stream) => {
                  if (err) console.error('Verify error:', err);
                  stream.on('data', d => console.log('Verify:', d.toString().trim()));
                  stream.stderr.on('data', d => process.stdout.write(d));
                  stream.on('close', () => {
                    conn.end();
                  });
                });
              });
            });
            return;
          }
          
          const file = files[uploaded + errors];
          const remoteDir = path.dirname(file.remote);
          
          // Create remote directory first
          conn.exec(`mkdir -p ${remoteDir}`, (err, stream) => {
            stream.on('close', () => {
              const readStream = fs.createReadStream(file.local);
              const writeStream = sftp.createWriteStream(file.remote);
              
              writeStream.on('close', () => {
                uploaded++;
                if (uploaded % 10 === 0) console.log(`  Uploaded ${uploaded}/${files.length}`);
                uploadNext();
              });
              
              writeStream.on('error', (err) => {
                console.error(`  Error uploading ${file.remote}:`, err.message);
                errors++;
                uploadNext();
              });
              
              readStream.on('error', (err) => {
                console.error(`  Error reading ${file.local}:`, err.message);
                errors++;
                uploadNext();
              });
              
              readStream.pipe(writeStream);
            });
          });
        }
        
        uploadNext();
      });
    });
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stdout.write(d));
  });
});

conn.on('error', (err) => {
  console.error('SSH connection error:', err.message);
});

conn.connect({
  host: '121.40.110.240',
  port: 22,
  username: 'root',
  password: 'zuBu-5567',
  readyTimeout: 30000
});
