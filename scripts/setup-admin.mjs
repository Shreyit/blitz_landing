import { emitKeypressEvents } from 'node:readline';
import { provisionAdmin } from './admin-provisioning.mjs';

function hiddenPassword() {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) return reject(new Error('Run this command in an interactive terminal to enter the password privately.'));
    let value = '';
    emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true); process.stdin.resume();
    process.stdout.write('Admin password (hidden): ');
    function finish() { process.stdin.off('keypress', onKey); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); }
    function onKey(text, key = {}) {
      if (key.ctrl && key.name === 'c') { finish(); reject(new Error('Setup cancelled.')); }
      else if (key.name === 'return' || key.name === 'enter') { finish(); resolve(value); }
      else if (key.name === 'backspace') value = [...value].slice(0, -1).join('');
      else if (!key.ctrl && !key.meta && text && !/[\u0000-\u001f\u007f]/.test(text)) value += text;
    }
    process.stdin.on('keypress', onKey);
  });
}

try {
  const email = process.env.BLITZ_ADMIN_EMAIL || 'cuba@2024.com';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !secretKey || !publishableKey) throw new Error('Complete the Supabase values in .env.local first.');
  console.log(`Preparing admin access for ${email}`);
  const password = await hiddenPassword();
  const result = await provisionAdmin({ url, secretKey, publishableKey, email, password });
  console.log(`Admin access enabled for ${result.email}. Open /admin and sign in with the password you entered.`);
} catch (error) {
  console.error(error?.cause?.code ? `Could not reach Supabase (${error.cause.code}). Check your internet connection and retry.` : error.message);
  process.exitCode = 1;
}
