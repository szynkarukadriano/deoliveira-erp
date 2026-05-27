import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const USE_SUPABASE = true;
export const SUPABASE_URL = 'https://wzvacntxyyiygxxilbqa.supabase.co';
export const SUPABASE_PUBLIC_KEY = 'sb_publishable_EPIDn7RhBcLNpE5LXsLIhw_tn53W4pD';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export const TABLE_MAP = {
  vendas: 'vendas',
  fluxo: 'fluxo_caixa',
  cartoes: 'cartoes',
  cartaoCompras: 'cartao_compras',
  cartaoFaturas: 'cartao_faturas',
  cp: 'contas_pagar',
  aportes: 'aportes',
  configuracoes: 'configuracoes'
};

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function signIn(username, password) {
  const email = normalizeLogin(username);
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export function normalizeLogin(username) {
  const value = String(username || '').trim();
  if (value === 'admin') return 'admin@deoliveira.com.br';
  return value;
}

export async function loadRemoteDB() {
  const user = await getUser();
  const entries = await Promise.all(Object.entries(TABLE_MAP).map(async ([collection, table]) => {
    const { data, error } = await supabase
      .from(table)
      .select('id,data')
      .eq('user_id', user.id);

    if (error) throw error;

    return [
      collection,
      (data || []).map(row => ({
        id: normalizeId(row.id),
        ...row.data
      }))
    ];
  }));

  return Object.fromEntries(entries);
}

export async function upsertRemoteRecord(collection, item) {
  const table = TABLE_MAP[collection];
  if (!table || !item?.id) return;

  const user = await getUser();
  const { error } = await supabase.from(table).upsert({
    id: String(item.id),
    user_id: user.id,
    data: item,
    updated_at: new Date().toISOString()
  });

  if (error) throw error;
}

export async function deleteRemoteRecord(collection, id) {
  const table = TABLE_MAP[collection];
  if (!table || !id) return;

  const user = await getUser();
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('user_id', user.id)
    .eq('id', String(id));

  if (error) throw error;
}

export async function syncLocalToRemote(db) {
  const collections = Object.keys(TABLE_MAP);
  for (const collection of collections) {
    for (const item of db[collection] || []) {
      await upsertRemoteRecord(collection, item);
    }
  }
}

export function subscribeRemoteChanges(onChange) {
  const channel = supabase.channel('erp-de-oliveira-sync');

  Object.values(TABLE_MAP).forEach(table => {
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table
    }, onChange);
  });

  channel.subscribe();
  return () => supabase.removeChannel(channel);
}

function normalizeId(id) {
  const number = Number(id);
  return Number.isNaN(number) ? id : number;
}
