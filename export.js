import { DB } from './storage.js';
import { currency, dateBR } from './utils.js';

export function exportCSV(data, filename, columns = null) {
  if (!data.length) {
    return false;
  }

  const exportColumns = columns?.length
    ? columns.map(column => ({ key: column.key, label: column.label || column.key }))
    : Object.keys(data[0]).map(key => ({ key, label: key }));
  const csv = [
    exportColumns.map(column => csvCell(column.label)).join(','),
    ...data.map(item => exportColumns.map(column => csvCell(item[column.key])).join(','))
  ].join('\n');

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}

export async function exportPDF() {
  if (!window.jspdf?.jsPDF) {
    window.print();
    return 'print';
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const entradas = DB.fluxo.filter(item => item.tipo === 'Entrada').reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const saidas = DB.fluxo.filter(item => item.tipo === 'Saida' || item.tipo === 'Saída').reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const saldo = entradas - saidas;
  const comissaoRecebida = DB.vendas.reduce((acc, item) => acc + Number(item.comissaoImobiliariaValor || 0), 0);
  const comissoes = DB.vendas.reduce((acc, item) => acc + Number(item.comissaoCorretorValor || 0), 0);
  const custosVendas = DB.vendas.reduce((acc, item) => acc + Number(item.custosEncaminhados || 0), 0);
  const impostosGuias = DB.vendas.reduce((acc, item) => acc + Number(item.impostosGuias || 0), 0);
  const caixaEmpresa = DB.vendas.reduce((acc, item) => acc + Number(item.caixaEmpresa || 0), 0);

  doc.setFontSize(16);
  doc.text('Relatorio ERP De Oliveira', 12, 14);
  doc.setFontSize(10);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 12, 22);

  const lines = [
    `Vendas cadastradas: ${DB.vendas.length}`,
    `Valor em pipeline: ${currency(DB.vendas.reduce((acc, item) => acc + Number(item.valor || 0), 0))}`,
    `Comissao recebida pela imobiliaria: ${currency(comissaoRecebida)}`,
    `Caixa empresa previsto: ${currency(caixaEmpresa)}`,
    `Comissoes corretores: ${currency(comissoes)}`,
    `Custos encaminhados: ${currency(custosVendas)}`,
    `Impostos/guias: ${currency(impostosGuias)}`,
    `Entradas: ${currency(entradas)}`,
    `Saidas: ${currency(saidas)}`,
    `Saldo: ${currency(saldo)}`,
    `Contas a pagar: ${DB.cp.length}`
  ];

  lines.forEach((line, index) => doc.text(line, 12, 34 + index * 8));

  doc.setFontSize(12);
  doc.text('Vendas recentes por Data da Venda', 12, 98);
  doc.setFontSize(9);
  sortVendasByData(DB.vendas).slice(0, 8).forEach((item, index) => {
    doc.text(`Data da Venda: ${dateBR(item.dataVenda || item.dtPrev || item.dataRecebimento)} | Data prevista da comissão: ${dateBR(item.dtPrev)} | Data de recebimento da comissão: ${dateBR(item.dataRecebimento)} | ${item.cliente || '-'}`, 12, 108 + index * 7);
  });

  doc.setFontSize(12);
  doc.text('Proximas contas', 12, 172);
  doc.setFontSize(9);
  DB.cp.slice(0, 12).forEach((item, index) => {
    doc.text(`${dateBR(item.vencimento)} - ${item.fornecedor} - ${currency(item.valor)} - ${item.status}`, 12, 182 + index * 7);
  });

  doc.save('relatorio-erp-de-oliveira.pdf');
  return 'pdf';
}

function csvCell(value) {
  const text = String(value ?? '').replaceAll('"', '""');
  return /[",\n]/.test(text) ? `"${text}"` : text;
}

function sortVendasByData(items) {
  return [...items].sort((a, b) => {
    const dateA = String(a.dataVenda || a.dtPrev || a.dataRecebimento || '');
    const dateB = String(b.dataVenda || b.dtPrev || b.dataRecebimento || '');
    const dateCompare = dateB.localeCompare(dateA);
    if (dateCompare !== 0) return dateCompare;
    return Number(b.id || 0) - Number(a.id || 0);
  });
}
