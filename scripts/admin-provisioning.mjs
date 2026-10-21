// Server/terminal only. The caller supplies credentials; nothing is saved to disk.
export async function provisionAdmin({ url, secretKey, publishableKey, email, password, fetcher = fetch }) {
  if (!url || !secretKey || !publishableKey) throw new Error('Set the Supabase URL, publishable key and SUPABASE_SECRET_KEY in .env.local first.');
  if (!email || !password || password.length < 8) throw new Error('Enter an admin email and a password of at least 8 characters.');
  const base = url.replace(/\/$/, '');
  async function request(path, { key = secretKey, token, method = 'GET', body } = {}) {
    const headers = { apikey: key, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const response = await fetcher(`${base}${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15_000) });
    let data;
    try { data = await response.json(); } catch { throw new Error('Supabase returned an invalid response. Check the project URL.'); }
    // Never print upstream bodies: Auth responses can contain credentials.
    if (!response.ok) {
      if (path.includes('blitz_bootstrap_organiser')) throw new Error('Admin membership could not be enabled. Apply all migrations first. If another organiser exists, use supabase/operations/add_organiser.sql after reviewing it.');
      if (path.includes('/token')) throw new Error('Admin password sign-in failed. Check the password and that the account is confirmed; existing passwords are never reset by this script.');
      throw new Error(`Supabase setup request failed (${response.status}). Check project credentials and Auth settings.`);
    }
    return data;
  }
  let user;
  for (let page = 1; ; page++) {
    const data = await request(`/auth/v1/admin/users?page=${page}&per_page=100`);
    const users = data.users || [];
    user = users.find(item => item.email?.toLowerCase() === email.toLowerCase());
    if (user || users.length < 100) break;
    if (page >= 1000) throw new Error('Could not locate admin account within the setup search limit.');
  }
  let created = false;
  if (!user) {
    user = await request('/auth/v1/admin/users', { method: 'POST', body: { email, password, email_confirm: true } });
    created = true;
  }
  // Validate possession of the existing password before attempting a grant.
  const session = await request('/auth/v1/token?grant_type=password', { key: publishableKey, method: 'POST', body: { email, password } });
  try {
    if (!user?.id || !session.access_token) throw new Error('Supabase did not return a valid admin identity/session.');
    await request('/rest/v1/rpc/blitz_bootstrap_organiser', { method: 'POST', body: { p_user_id: user.id, p_email: email } });
    await request('/rest/v1/rpc/blitz_admin_me', { key: publishableKey, token: session.access_token, method: 'POST', body: {} });
    return { email, created, enabled: true };
  } finally {
    if (session.access_token) {
      await fetcher(`${base}/auth/v1/logout?scope=local`, { method: 'POST', headers: { apikey: publishableKey, Authorization: `Bearer ${session.access_token}` }, signal: AbortSignal.timeout(5000) }).catch(() => {});
    }
  }
}
