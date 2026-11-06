import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
let db;
if (/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url || '') && /^sb_publishable_[A-Za-z0-9_-]+$/.test(key || '')) {
  db = createClient(url, key, { auth: { detectSessionInUrl: false } });
}

async function checked(request) {
  const { data, error } = await request;
  if (!error) return data;
  if (error.code === '23505') throw { error: 'duplicatePhone' };
  if (error.code === 'invalid_credentials' || error.code === 'email_not_confirmed') throw { error: 'credentials' };
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
  if (path === 'auth') {
    const result = await checked(db.auth.signInWithPassword({ email: data.email.trim(), password: data.password }));
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
