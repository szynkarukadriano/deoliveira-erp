import { resources } from './dataConfig.js';
import { logout, requireAuth } from './auth.js';
import { renderDashboard, financialAlerts } from './dashboard.js';
import { exportCSV, exportPDF } from './export.js';
import { backupERP, DB, persist, seedIfEmpty, upsert } from './storage.js';
import { applyFilters, buildFilters, renderTable } from './table.js';
import { openCreate, openEdit, deleteEntity } from './crud.js';
import { closeModal, openModal, setLoading, toast } from './ui.js';
import { currency, dateBR, escapeHTML, generateId, todayISO } from './utils.js';
import { renderPipeline } from './vendas.js';
import { renderFluxo } from './fluxo.js';
import { renderCartoes } from './cartoes.js';
import { renderAportes } from './aportes.js';
import { renderContasPagar } from './cp.js';

const filters = Object.keys(resources).reduce((acc, key) => {
  acc[key] = { query: '', status: '', from: '', to: '' };
  return acc;
}, {});

let globalTerm = '';
let pendingFocus = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;

  seedIfEmpty();
  bindNavigation();
  bindActions();
  renderAll();
  setLoading(false);

  if (financialAlerts()) {
    toast('Atenção: caixa negativo');
  }
});

function bindNavigation() {
  document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', () => showSection(button.dataset.section));
  });

  document.getElementById('menu-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

function bindActions() {
  document.getElementById('global-search').addEventListener('input', globalSearch);
  document.getElementById('backup-btn').addEventListener('click', () => {
    backupERP();
    toast('Backup local atualizado');
  });

  document.getElementById('logout-btn').addEventListener('click', logout);

  document.getElementById('export-pdf-btn').addEventListener('click', async () => {
    const result = await exportPDF();
    toast(result === 'print' ? 'PDF indisponível: janela de impressão aberta' : 'PDF exportado');
  });

  document.querySelectorAll('[data-create]').forEach(button => {
    button.addEventListener('click', () => openCreate(button.dataset.create, renderAll));
  });

  document.querySelectorAll('[data-export]').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.dataset.export;
      const exported = exportCSV(DB[key], `${key}.csv`);
      toast(exported ? 'CSV exportado com sucesso' : 'Não há dados para exportar');
    });
  });
}

function showSection(sectionId) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.toggle('active', page.id === sectionId);
  });
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.section === sectionId);
  });
  document.getElementById('sidebar').classList.remove('open');
}

export function renderAll(resourceKey = null, filterKey = null) {
  if (resourceKey && filterKey) {
    pendingFocus = { resourceKey, filterKey };
  }

  renderDashboard();
  renderReceivables();
  renderResource('vendas', renderPipeline());
  renderResource('fluxo', renderFluxo());
  renderResource('cartoes', renderCartoes());
  renderResource('aportes', renderAportes());
  renderResource('cp', renderContasPagar());
  restoreFocus();
}

function renderResource(resourceKey, items) {
  const config = resources[resourceKey];
  const state = filters[resourceKey];
  buildFilters(resourceKey, config, DB[resourceKey], state, renderAll);
  const filtered = applyFilters(items, config, state, globalTerm);
  renderTable(resourceKey, config, filtered, {
    onEdit: id => openEdit(resourceKey, id, renderAll),
    onDelete: id => deleteEntity(resourceKey, id, renderAll),
    onReceive: id => openReceiveSale(id),
    onPay: id => openPayBill(id)
  });
}

function renderReceivables() {
  const host = document.getElementById('receivables-list');
  if (!host) return;

  const pending = DB.vendas
    .filter(venda => venda.recebimentoStatus !== 'Recebido')
    .sort((a, b) => String(a.dtPrev || '').localeCompare(String(b.dtPrev || '')));

  if (!pending.length) {
    host.innerHTML = '<div class="empty">Nenhuma venda pendente de recebimento.</div>';
    return;
  }

  host.innerHTML = pending.map(venda => `
    <article class="compact-item receivable-item">
      <div>
        <strong>${escapeHTML(venda.cliente)} / ${escapeHTML(venda.empreend)}</strong>
        <small>Previsto: ${dateBR(venda.dtPrev)} - Comissao a receber: ${currency(venda.comissaoImobiliariaValor)}</small>
      </div>
      <button class="primary-button" data-receive="${venda.id}">Receber</button>
    </article>
  `).join('');

  host.querySelectorAll('[data-receive]').forEach(button => {
    button.addEventListener('click', () => openReceiveSale(Number(button.dataset.receive)));
  });
}

function openReceiveSale(id) {
  const venda = DB.vendas.find(item => item.id === id);
  if (!venda) return;

  openModal({
    title: 'Registrar recebimento',
    fields: [
      { name: 'dataRecebimento', label: 'Data do recebimento', type: 'date', required: true },
      { name: 'valorRecebido', label: 'Comissao recebida pela imobiliaria', type: 'number', required: true }
    ],
    values: {
      dataRecebimento: venda.dataRecebimento || todayISO(),
      valorRecebido: venda.valorRecebido || venda.comissaoImobiliariaValor || 0
    },
    onSubmit: payload => receiveSale(venda, payload)
  });
}

function receiveSale(venda, payload) {
  const fluxoId = venda.fluxoId || generateId();
  const valorRecebido = Number(payload.valorRecebido || venda.comissaoImobiliariaValor || 0);
  const dataRecebimento = payload.dataRecebimento || todayISO();

  venda.recebimentoStatus = 'Recebido';
  venda.recebido = true;
  venda.dataRecebimento = dataRecebimento;
  venda.valorRecebido = valorRecebido;
  venda.fluxoId = fluxoId;

  upsert('fluxo', {
    id: fluxoId,
    descricao: `Comissao imobiliaria recebida - ${venda.cliente} / ${venda.empreend}`,
    tipo: 'Entrada',
    categoria: 'Vendas',
    valor: valorRecebido,
    data: dataRecebimento,
    status: 'Pago',
    vendaId: venda.id
  });

  createSalePayables(venda, dataRecebimento);
  persist();
  closeModal();
  renderAll();
  toast('Comissao recebida e custos separados para pagamento');
}

function createSalePayables(venda, dataRecebimento) {
  const ids = venda.pagamentosIds || {};
  const dueDate = venda.dtPrev || dataRecebimento;
  const items = [
    {
      key: 'corretor',
      fornecedor: `Corretor - ${venda.corretor || venda.cliente}`,
      categoria: 'Comissao corretor',
      valor: Number(venda.comissaoCorretorValor || 0),
      obs: `Pagamento de corretagem da venda ${venda.cliente} / ${venda.empreend}`
    },
    {
      key: 'impostos',
      fornecedor: 'Impostos e guias',
      categoria: 'Impostos/guias',
      valor: Number(venda.impostosGuias || 0),
      obs: `Guias e impostos da nota da venda ${venda.cliente} / ${venda.empreend}`
    },
    {
      key: 'custos',
      fornecedor: 'Custos da venda',
      categoria: 'Custos operacionais',
      valor: Number(venda.custosEncaminhados || 0),
      obs: `Custos vinculados a venda ${venda.cliente} / ${venda.empreend}`
    }
  ];

  items.filter(item => item.valor > 0).forEach(item => {
    const id = ids[item.key] || generateId();
    ids[item.key] = id;
    upsert('cp', {
      id,
      fornecedor: item.fornecedor,
      categoria: item.categoria,
      valor: item.valor,
      vencimento: dueDate,
      status: 'Pendente',
      obs: item.obs,
      vendaId: venda.id,
      origem: 'Recebimento de venda'
    });
  });

  venda.pagamentosIds = ids;
}

function openPayBill(id) {
  const conta = DB.cp.find(item => item.id === id);
  if (!conta) return;

  openModal({
    title: 'Registrar pagamento',
    fields: [
      { name: 'dataPagamento', label: 'Data do pagamento', type: 'date', required: true },
      { name: 'valorPago', label: 'Valor pago', type: 'number', required: true }
    ],
    values: {
      dataPagamento: conta.dataPagamento || todayISO(),
      valorPago: conta.valor || 0
    },
    onSubmit: payload => payBill(conta, payload)
  });
}

function payBill(conta, payload) {
  const fluxoId = conta.fluxoId || generateId();
  const valorPago = Number(payload.valorPago || conta.valor || 0);
  const dataPagamento = payload.dataPagamento || todayISO();

  conta.status = 'Pago';
  conta.pago = true;
  conta.dataPagamento = dataPagamento;
  conta.valorPago = valorPago;
  conta.fluxoId = fluxoId;

  upsert('fluxo', {
    id: fluxoId,
    descricao: `Pagamento - ${conta.fornecedor}`,
    tipo: 'Saida',
    categoria: conta.categoria || 'Contas a pagar',
    valor: valorPago,
    data: dataPagamento,
    status: 'Pago',
    contaPagarId: conta.id,
    vendaId: conta.vendaId || null
  });

  persist();
  closeModal();
  renderAll();
  toast('Pagamento lancado no fluxo de caixa');
}

export function globalSearch() {
  globalTerm = document.getElementById('global-search').value;
  renderAll();
  document.getElementById('global-search').focus();
}

export function addVenda() {
  openCreate('vendas', renderAll);
}

export function editVenda(id) {
  openEdit('vendas', Number(id), renderAll);
}

export function deleteVenda(id) {
  deleteEntity('vendas', Number(id), renderAll);
}

window.DB = DB;
window.renderAll = renderAll;
window.globalSearch = globalSearch;
window.addVenda = addVenda;
window.editVenda = editVenda;
window.deleteVenda = deleteVenda;
window.exportCSV = exportCSV;
window.exportPDF = exportPDF;

function restoreFocus() {
  if (!pendingFocus) return;
  const { resourceKey, filterKey } = pendingFocus;
  const input = document.querySelector(`#${resourceKey}-filters [data-filter="${filterKey}"]`);
  if (input) {
    input.focus();
    if (input.type === 'search' || input.tagName === 'INPUT') {
      const end = input.value.length;
      input.setSelectionRange?.(end, end);
    }
  }
  pendingFocus = null;
}
