import { DB } from './storage.js';

export function filterByStatus(status) {
  return DB.vendas.filter(venda => venda.status === status);
}

export function renderPipeline(items = DB.vendas) {
  return items;
}
