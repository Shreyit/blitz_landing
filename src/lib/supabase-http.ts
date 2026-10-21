// Framework-independent REST adapter: credentials are supplied by server code.
// No browser import may supply the secret key. Tests inject fetch without a network.
export class SupabaseError extends Error {
  status:number;
  code:string;
  constructor(message: string, status: number, code = '') { super(message); this.status=status; this.code=code; }
}
export class SupabaseHttp {
  private url:string;
  private key:string;
  private token?:string;
  private fetcher:typeof fetch;
  constructor(url: string, key: string, token?: string, fetcher: typeof fetch = fetch) {
    this.url=url; this.key=key; this.token=token; this.fetcher=fetcher;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('apikey', this.key);
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
    if (init.body && typeof init.body === 'string') headers.set('Content-Type', 'application/json');
    const response = await this.fetcher(`${this.url.replace(/\/$/,'')}${path}`, {
      ...init, headers, cache: 'no-store', signal: init.signal ?? AbortSignal.timeout(10_000),
    });
    if(response.status===204 && response.ok) return undefined as T;
    let data;
    try { data = await response.json(); }
    catch { throw new SupabaseError('The event service returned an invalid response.', 503); }
    if (!response.ok) {
      const code = data.code || '';
      const status = code === 'P0429' ? 429 : code === '40001' || code === '23505' ? 409
        : code === '42501' ? 403 : code.startsWith('22') || code.startsWith('23') ? 422
        : code === 'P0001' ? 409 : response.status;
      const message = code === '23505' ? 'This registration or command already exists.'
        : code.startsWith('23') ? 'Please check your registration details.'
        : data.message || data.msg || data.error_description || 'The event service is unavailable.';
      throw new SupabaseError(message, status, code);
    }
    return data as T;
  }
  rpc<T>(name: string, body: object = {}) {
    return this.request<T>(`/rest/v1/rpc/${name}`, {method:'POST', body:JSON.stringify(body)});
  }
}
