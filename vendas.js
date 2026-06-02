import { DB } from './storage.js';

export function filterByStatus(status) {
  return sortVendasByData(DB.vendas.filter(venda => venda.status === status));
}

export function renderPipeline(items = DB.vendas) {
  return sortVendasByData(items);
}

function sortVendasByData(items) {
  return [...items].sort((a, b) => {
    const dateA = getVendaDate(a);
    const dateB = getVendaDate(b);
    const dateCompare = dateB.localeCompare(dateA);
    if (dateCompare !== 0) return dateCompare;
    return Number(b.id || 0) - Number(a.id || 0);
  });
}

function getVendaDate(venda) {
  return String(venda.dataVenda || venda.dtPrev || venda.dataRecebimento || '');
}
