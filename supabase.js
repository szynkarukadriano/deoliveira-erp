// Futura integração: troque USE_SUPABASE para true e implemente o adapter remoto.
export const USE_SUPABASE = false;

export async function syncWithSupabase() {
  if (!USE_SUPABASE) return null;
  throw new Error('Integração com Supabase ainda não configurada.');
}
