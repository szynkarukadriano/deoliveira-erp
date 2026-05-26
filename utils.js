export function generateId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

export function currency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

export function dateBR(value) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR');
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function normalize(value) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function matchesSearch(item, term) {
  if (!term) return true;
  const haystack = normalize(Object.values(item).join(' '));
  return haystack.includes(normalize(term));
}

export function daysUntil(value) {
  if (!value) return null;
  const target = new Date(`${value}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target - now) / 86400000);
}

export function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function badgeClass(value) {
  const status = normalize(value);
  if (status.includes('pago') || status.includes('ganho') || status.includes('entrada') || status.includes('ativo')) return 'success';
  if (status.includes('atras') || status.includes('perd') || status.includes('saida')) return 'danger';
  if (status.includes('pend') || status.includes('analise') || status.includes('andamento')) return 'warning';
  return '';
}
