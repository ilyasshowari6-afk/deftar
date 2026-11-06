import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
let db;
if (/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url || '') && /^sb_publishable_[A-Za-z0-9_-]+$/.test(key || '')) {
  db = createClient(url, key, { auth: { detectSessionInUrl: false, flowType: 'pkce' } });
}

async function checked(request) {
  const { data, error } = await request;
  if (!error) return data;
  if (error.code === '23505') throw { error: 'duplicatePhone' };
  if (error.code === 'invalid_credentials') throw { error: 'credentials' };
  if (error.code === 'email_not_confirmed') throw { error: 'confirmEmailFirst' };
  if (error.code === 'captcha_failed') throw { error: 'captchaFailed' };
  if (error.code === 'weak_password') throw { error: 'weakPassword' };
  if (error.code === 'signup_disabled') throw { error: 'signupDisabled' };
  if (error.code === 'same_password') throw { error: 'samePassword' };
  if (error.code === 'email_address_not_authorized') throw { error: 'emailUnavailable' };
  if (error.status === 429) throw { error: 'rateLimit' };
  if (error.status === 401 || error.code === '42501') throw { error: 'signIn' };
  if (error.name === 'AuthRetryableFetchError' || error.message?.includes('Failed to fetch')) throw { error: 'network' };
  throw { error: 'serverError' };
}

async function readAll(table, columns) {
  const rows = [];
  const batchSize = 500;
  let after;
  for (;;) {
    let query = db.from(table).select(columns).order('id').limit(batchSize);
    if (after) query = query.gt('id', after);
    const batch = await checked(query);
    rows.push(...batch);
    if (batch.length < batchSize) return rows;
    after = batch.at(-1).id;
  }
}

const cardFields = ({ first, last, phone, notes }) => ({
  first: first.trim(), last: last.trim(), phone: phone || '', notes: notes || '',
});

export function onSignOut(callback) {
  db?.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') callback();
  });
}

export async function cloudApi(path, method = 'GET', data) {
  if (!db) throw { error: 'configuration' };
  if (path === 'me') {
    const { session } = await checked(db.auth.getSession());
    return { user: session?.user ?? null };
  }
  if (path === 'auth/callback') {
    return checked(db.auth.exchangeCodeForSession(data.code));
  }
  if (path === 'auth/update-password') {
    await checked(db.auth.updateUser({ password: data.password }));
    return checked(db.auth.signOut());
  }
  if (path === 'auth' || path === 'auth/signup' || path === 'auth/recover') {
    const email = data.email.trim();
    const redirect = new URL('/', window.location.origin).href;
    const options = { captchaToken: data.captchaToken || undefined };
    if (path === 'auth/recover') {
      return checked(db.auth.resetPasswordForEmail(email, { ...options, redirectTo: redirect }));
    }
    const credentials = { email, password: data.password, options };
    if (path === 'auth/signup') {
      return checked(db.auth.signUp({ ...credentials, options: { ...options, emailRedirectTo: redirect } }));
    }
    const result = await checked(db.auth.signInWithPassword(credentials));
    return result.user;
  }
  if (path === 'logout') return checked(db.auth.signOut({ scope: 'local' }));
  if (path === 'import') return checked(db.rpc('daftar_import', { records: data }));
  if (path === 'clients' && method === 'GET') {
    const [cards, visits] = await Promise.all([
      readAll('clients', 'id,first,last,phone,notes'),
      readAll('visits', 'id,client_id,date,notes'),
    ]);
    const byId = new Map(cards.map(card => [card.id, { ...card, entries: [] }]));
    for (const visit of visits.sort((a, b) => b.date.localeCompare(a.date))) {
      byId.get(visit.client_id)?.entries.push(visit);
    }
    return { clients: [...byId.values()].sort((a, b) => (b.entries[0]?.date || '').localeCompare(a.entries[0]?.date || '')) };
  }
  if (path === 'clients' && method === 'POST') {
    const id = await checked(db.rpc('daftar_add_client', { card: cardFields(data), visit: data.entry }));
    return { id };
  }
  const [table, id, child] = path.split('/');
  if (table === 'clients' && child === 'entries' && method === 'POST') {
    return checked(db.from('visits').insert({ ...data, client_id: id }));
  }
  if (table === 'clients' && method === 'PATCH') {
    return checked(db.from('clients').update(cardFields(data)).eq('id', id).select('id').single());
  }
  if (table === 'clients' && method === 'DELETE') {
    return checked(db.from('clients').delete().eq('id', id).select('id').single());
  }
  if (table === 'entries' && method === 'PATCH') {
    return checked(db.from('visits').update(data).eq('id', id).select('id').single());
  }
  throw { error: 'notFound' };
}
