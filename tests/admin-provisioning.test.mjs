import { test } from 'node:test';
import assert from 'node:assert/strict';
import { provisionAdmin } from '../scripts/admin-provisioning.mjs';

const options = { url: 'https://example.supabase.co', secretKey: 'sb_secret_test', publishableKey: 'sb_publishable_test', email: 'admin@example.test', password: 'fixture-only-password' };
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function mock({ users = [], failLogin = false, failGrant = false } = {}) {
  const calls = [];
  return { calls, fetcher: async (url, init = {}) => {
    const path = new URL(url).pathname, body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path, method: init.method, body, headers: init.headers });
    if (path === '/auth/v1/admin/users' && init.method === 'GET') return response({ users });
    if (path === '/auth/v1/admin/users') return response({ id: 'new-admin-id', email: options.email });
    if (path === '/auth/v1/token') return failLogin ? response({ message: 'private upstream detail' }, 400) : response({ access_token: 'private-test-token' });
    if (path.endsWith('blitz_bootstrap_organiser')) return failGrant ? response({ message: 'private upstream detail' }, 403) : response({ enabled: true });
    if (path.endsWith('blitz_admin_me')) return response({ authenticated: true });
    if (path === '/auth/v1/logout') return new Response(null, { status: 204 });
    throw new Error(`Unexpected path ${path}`);
  } };
}
test('first admin is confirmed without sending email, granted membership and verified by password login', async () => {
  const fake = mock();
  const result = await provisionAdmin({ ...options, fetcher: fake.fetcher });
  assert.deepEqual(result, { email: options.email, created: true, enabled: true });
  const create = fake.calls.find(call => call.path.endsWith('/admin/users') && call.method === 'POST');
  assert.deepEqual(create.body, { email: options.email, password: options.password, email_confirm: true });
  assert.equal(create.headers.apikey, options.secretKey);
  assert.equal(create.headers.Authorization, undefined);
  const grant = fake.calls.find(call => call.path.endsWith('blitz_bootstrap_organiser'));
  assert.deepEqual(grant.body, { p_user_id: 'new-admin-id', p_email: options.email });
  assert.equal(fake.calls.at(-1).path, '/auth/v1/logout');
});
test('rerun reuses an existing account without changing its password', async () => {
  const fake = mock({ users: [{ id: 'existing', email: options.email.toUpperCase() }] });
  const result = await provisionAdmin({ ...options, fetcher: fake.fetcher });
  assert.equal(result.created, false);
  assert.equal(fake.calls.filter(call => call.path.includes('/admin/users') && call.method !== 'GET').length, 0);
  assert.equal(fake.calls.find(call => call.path.endsWith('blitz_bootstrap_organiser')).body.p_user_id, 'existing');
});
test('incorrect existing password never grants admin membership', async () => {
  const fake = mock({ users: [{ id: 'existing', email: options.email }], failLogin: true });
  await assert.rejects(provisionAdmin({ ...options, fetcher: fake.fetcher }), /password sign-in failed/);
  assert.equal(fake.calls.some(call => call.path.includes('/rpc/')), false);
});
test('grant failure cleans up the temporary auth session and omits credentials from errors', async () => {
  const fake = mock({ failGrant: true });
  await assert.rejects(provisionAdmin({ ...options, fetcher: fake.fetcher }), error => {
    assert.match(error.message, /Apply all migrations/);
    assert.ok(!error.message.includes('private upstream detail'));
    assert.ok(!error.message.includes(options.password));
    return true;
  });
  assert.equal(fake.calls.at(-1).path, '/auth/v1/logout');
});
test('missing configuration fails before any network request', async () => {
  await assert.rejects(provisionAdmin({ ...options, secretKey: '', fetcher: () => { throw new Error('Must not call'); } }), /Set the Supabase/);
});
test('user lookup follows pages before creating any account', async () => {
  const fake = mock({ users: [{ id: 'existing', email: options.email }] });
  let listed = 0;
  const fetcher = async (url, init) => {
    if (url.includes('/admin/users?page=1')) {
      listed++;
      return response({ users: Array.from({ length: 100 }, (_, i) => ({ id: `${i}`, email: `other${i}@example.test` })) });
    }
    return fake.fetcher(url, init);
  };
  const result = await provisionAdmin({ ...options, fetcher });
  assert.equal(listed, 1);
  assert.equal(result.created, false);
});
