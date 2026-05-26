import { DB } from './storage.js';
import { currency, dateBR, daysUntil, escapeHTML } from './utils.js';

export function calcDashboard() {
  const entradas = DB.fluxo
    .filter(item => item.tipo === 'Entrada')
    .reduce((acc, item) => acc + Number(item.valor || 0), 0);

  const saidas = DB.fluxo
    .filter(item => item.tipo === 'Saida' || item.tipo === 'Saída')
    .reduce((acc, item) => acc + Number(item.valor || 0), 0);

  const saldo = entradas - saidas;
  const pipeline = DB.vendas.reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const comissaoRecebida = DB.vendas.reduce((acc, item) => acc + getComissaoRecebida(item), 0);
  const comissoesCorretores = DB.vendas.reduce((acc, item) => acc + Number(item.comissaoCorretorValor || 0), 0);
  const custosVendas = DB.vendas.reduce((acc, item) => acc + Number(item.custosEncaminhados || 0), 0);
  const impostosGuias = DB.vendas.reduce((acc, item) => acc + Number(item.impostosGuias || 0), 0);
  const caixaEmpresa = DB.vendas.reduce((acc, item) => acc + getCaixaEmpresa(item), 0);
  const aReceber = DB.vendas
    .filter(item => item.recebimentoStatus !== 'Recebido')
    .reduce((acc, item) => acc + getComissaoRecebida(item), 0);
  const contasPendentes = DB.cp.filter(item => item.status !== 'Pago').reduce((acc, item) => acc + Number(item.valor || 0), 0);

  return {
    entradas,
    saidas,
    saldo,
    pipeline,
    comissaoRecebida,
    comissoesCorretores,
    custosVendas,
    impostosGuias,
    caixaEmpresa,
    aReceber,
    contasPendentes
  };
}

export function renderDashboard() {
  const data = calcDashboard();
  document.getElementById('dashboard-cards').innerHTML = `
    ${metric('Pipeline', currency(data.pipeline), `${DB.vendas.length} vendas cadastradas`)}
    ${metric('Comissao recebida', currency(data.comissaoRecebida), 'Parte da imobiliaria sobre os imoveis')}
    ${metric('A receber', currency(data.aReceber), 'Comissoes da imobiliaria ainda nao recebidas')}
    ${metric('Caixa empresa', currency(data.caixaEmpresa), 'Comissao recebida menos corretor, custos e guias')}
    ${metric('Corretores', currency(data.comissoesCorretores), 'Parte repassada aos corretores')}
    ${metric('Impostos/guias', currency(data.impostosGuias), 'Notas e obrigacoes')}
    ${metric('Custos', currency(data.custosVendas), 'Valores ja encaminhados')}
    ${metric('Entradas', currency(data.entradas), 'Fluxo recebido')}
    ${metric('Saldo', currency(data.saldo), 'Resultado operacional')}
  `;

  renderPipelineSummary();
  renderDueSummary();
  renderAlerts(data);
}

export function financialAlerts() {
  return calcDashboard().saldo < 0;
}

function metric(label, value, helper) {
  return `
    <article class="metric">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${helper}</small>
    </article>
  `;
}

function renderPipelineSummary() {
  const counts = DB.vendas.reduce((acc, venda) => {
    acc[venda.status] = (acc[venda.status] || 0) + 1;
    return acc;
  }, {});

  const entries = Object.entries(counts);
  document.getElementById('pipeline-summary').innerHTML = entries.length
    ? entries.map(([status, count]) => `
      <article class="status-card">
        <strong>${escapeHTML(status)}</strong>
        <small>${count} registro${count > 1 ? 's' : ''}</small>
      </article>
    `).join('')
    : '<div class="empty">Sem vendas cadastradas.</div>';
}

function renderDueSummary() {
  const dues = [
    ...DB.cp.map(item => ({ label: item.fornecedor, date: item.vencimento, value: item.valor, type: 'Conta' })),
    ...DB.cartoes.map(item => ({ label: item.nome, date: item.vencimento, value: item.limite, type: 'Cartao' }))
  ]
    .filter(item => item.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  document.getElementById('due-summary').innerHTML = dues.length
    ? dues.map(item => `
      <article class="compact-item">
        <strong>${escapeHTML(item.label)}</strong>
        <small>${escapeHTML(item.type)} - ${dateBR(item.date)} - ${currency(item.value)}</small>
      </article>
    `).join('')
    : '<div class="empty">Nenhum vencimento proximo.</div>';
}

function renderAlerts(data) {
  const overdue = DB.cp.filter(item => item.status !== 'Pago' && daysUntil(item.vencimento) !== null && daysUntil(item.vencimento) < 0);
  const alerts = [];

  if (data.saldo < 0) {
    alerts.push('<div class="alert danger">Atencao: caixa negativo.</div>');
  }

  if (overdue.length) {
    alerts.push(`<div class="alert warning">${overdue.length} conta${overdue.length > 1 ? 's' : ''} em atraso.</div>`);
  }

  document.getElementById('alerts').innerHTML = alerts.join('');
}

function getComissaoRecebida(item) {
  return Number(item.comissaoImobiliariaValor ?? Number(item.valor || 0) * (Number(item.comissaoImobiliariaPct || 0) / 100));
}

function getCaixaEmpresa(item) {
  const fallback = getComissaoRecebida(item)
    - Number(item.comissaoCorretorValor || 0)
    - Number(item.custosEncaminhados || 0)
    - Number(item.impostosGuias || 0);

  return Number(item.caixaEmpresa ?? fallback);
}
