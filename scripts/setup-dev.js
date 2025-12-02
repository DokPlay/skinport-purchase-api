#!/usr/bin/env node
import {spawn} from 'child_process';
import {readFileSync, copyFileSync, existsSync} from 'fs';
import path from 'path';

const cwd = process.cwd();
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    // Use shell:true for better cross-platform command resolution (npm, docker, etc.)
    const p = spawn(cmd, args, {stdio: 'inherit', shell: true, ...opts});
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args ? args.join(' ') : ''} exited ${code}`))));
    p.on('error', reject);
  });
}

async function main() {
  try {
    console.log('1) Installing dependencies...');
    await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install']);

    console.log('2) Starting PostgreSQL and Redis (docker compose up -d)...');
    await run('docker', ['compose', 'up', '-d']);

    console.log('3) Applying database schema to Postgres container...');
    const schema = readFileSync(path.join(cwd, 'schema.sql'));
    const psql = spawn('docker', ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'skinport'], {stdio: ['pipe', 'inherit', 'inherit']});
    psql.stdin.write(schema);
    psql.stdin.end();
    await new Promise((resolve, reject) => {
      psql.on('close', (code) => (code === 0 ? resolve() : reject(new Error('psql failed: ' + code))));
    });

    if (!existsSync(path.join(cwd, '.env'))) {
      console.log('4) Copying .env.example to .env');
      copyFileSync(path.join(cwd, '.env.example'), path.join(cwd, '.env'));
    } else {
      console.log('4) .env already exists, skipping copy');
    }

    console.log('5) Starting dev server (detached)...');
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    // Use a single command string with shell:true when detaching to improve Windows compatibility
    const devCommand = `${npmCmd} run dev`;
    const child = spawn(devCommand, {detached: true, stdio: 'ignore', shell: true});
    child.unref();
    console.log('Dev server started (detached). Use `npm run dev` to see logs if needed.');

    console.log('Setup complete.');
  } catch (err) {
    console.error('Setup failed:', err);
    process.exit(1);
  }
}

main();
