import { resources } from './dataConfig.js';
import { logout, requireAuth } from './auth.js';
import { renderDashboard, financialAlerts } from './dashboard.js';
import { exportCSV, exportPDF } from './export.js';
import { backupERP, DB, persist, remove as removeRecord, seedIfEmpty, upsert } from './storage.js';
import { applyFilters, buildFilters, renderTable, sortByDate } from './table.js';
import { openCreate, openEdit, deleteEntity } from './crud.js';
import { closeModal, openModal, setLoading, toast } from './ui.js';
import { currency, dateBR, escapeHTML, generateId, todayISO } from './utils.js';
import { renderPipeline } from './vendas.js';
import { renderFluxo } from './fluxo.js';
import { renderCartoes } from './cartoes.js';
import { renderAportes } from './aportes.js';
import { renderContasPagar } from './cp.js';

const filters = Object.keys(resources).reduce((acc, key) => {
  acc[key] = { query: '', status: '', from: '', to: '', category: '', tipo: '', sort: 'asc', formaPagamento: '' };
  return acc;
}, {});

const cartoesState = {
  query: '',
  status: '',
  from: '',
  to: '',
  cartaoId: '',
  category: ''
};

let globalTerm = '';
let pendingFocus = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;

  seedIfEmpty();
  syncAutomaticFlows();
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
    button.addEventListener('click', () => openCreate(button.dataset.create, handleEntityChange));
  });

  document.getElementById('nova-compra-cartao')?.addEventListener('click', openCreateCardPurchase);

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
  renderCartoesWorkspace();
  renderResource('aportes', renderAportes());
  renderResource('cp', renderContasPagar());
  restoreFocus();
}

function renderCartoesWorkspace() {
  renderCardFilters();
  const invoices = getCardInvoices();
  const filteredInvoices = filterCardInvoices(invoices);
  const filteredPurchases = filterCardPurchases(DB.cartaoCompras || []);

  renderCardsSummary(filteredInvoices);
  renderCardList(invoices);
  renderInvoices(filteredInvoices);
  renderPurchasesTable(filteredPurchases);
  syncPaidCardInvoices(invoices);
}

function renderCardFilters() {
  const host = document.getElementById('cartoes-filters');
  if (!host) return;
  const categories = [...new Set((DB.cartaoCompras || []).map(item => item.categoria).filter(Boolean))].sort();

  host.innerHTML = `
    <label class="filter-field">
      <span>Pesquisa</span>
      <input type="search" data-card-filter="query" value="${escapeHTML(cartoesState.query)}" placeholder="Buscar compra ou fatura">
    </label>
    <label class="filter-field">
      <span>Cartao</span>
      <select data-card-filter="cartaoId">
        <option value="">Todos</option>
        ${DB.cartoes.map(cartao => `<option value="${cartao.id}" ${String(cartoesState.cartaoId) === String(cartao.id) ? 'selected' : ''}>${escapeHTML(cartao.nome)}</option>`).join('')}
      </select>
    </label>
    <label class="filter-field">
      <span>Status fatura</span>
      <select data-card-filter="status">
        <option value="">Todos</option>
        ${['Aberta', 'Fechada', 'Paga', 'Atrasada'].map(status => `<option value="${status}" ${cartoesState.status === status ? 'selected' : ''}>${status}</option>`).join('')}
      </select>
    </label>
    <label class="filter-field">
      <span>Data inicial</span>
      <input type="date" data-card-filter="from" value="${escapeHTML(cartoesState.from)}">
    </label>
    <label class="filter-field">
      <span>Data final</span>
      <input type="date" data-card-filter="to" value="${escapeHTML(cartoesState.to)}">
    </label>
    <div class="filter-field full-filter">
      <span>Categoria</span>
      <div class="category-filter">
        <button type="button" class="${!cartoesState.category ? 'active' : ''}" data-card-category="">Todas</button>
        ${categories.map(category => `<button type="button" class="${cartoesState.category === category ? 'active' : ''}" data-card-category="${escapeHTML(category)}">${escapeHTML(category)}</button>`).join('')}
      </div>
    </div>
  `;

  host.querySelectorAll('[data-card-filter]').forEach(input => {
    input.addEventListener('input', () => {
      cartoesState[input.dataset.cardFilter] = input.value;
      renderCartoesWorkspace();
    });
  });

  host.querySelectorAll('[data-card-category]').forEach(button => {
    button.addEventListener('click', () => {
      cartoesState.category = button.dataset.cardCategory;
      renderCartoesWorkspace();
    });
  });
}

function renderCardsSummary(invoices) {
  const host = document.getElementById('cartoes-summary');
  if (!host) return;
  const selectedCardIds = new Set(invoices.map(item => item.cartaoId));
  const cards = cartoesState.cartaoId
    ? DB.cartoes.filter(card => String(card.id) === String(cartoesState.cartaoId))
    : DB.cartoes.filter(card => !selectedCardIds.size || selectedCardIds.has(card.id));
  const limiteTotal = cards.reduce((acc, card) => acc + Number(card.limiteTotal || 0), 0);
  const limiteUtilizado = invoices.filter(item => item.status !== 'Paga').reduce((acc, item) => acc + item.total, 0);
  const limiteDisponivel = limiteTotal - limiteUtilizado;
  const abertas = invoices.filter(item => item.status === 'Aberta' || item.status === 'Fechada' || item.status === 'Atrasada').reduce((acc, item) => acc + item.total, 0);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const pagasMes = invoices.filter(item => item.status === 'Paga' && String(item.dataPagamento || '').startsWith(currentMonth)).reduce((acc, item) => acc + item.total, 0);
  const vencendo7 = invoices.filter(item => {
    const diff = daysBetween(todayISO(), item.vencimento);
    return item.status !== 'Paga' && diff >= 0 && diff <= 7;
  }).reduce((acc, item) => acc + item.total, 0);

  host.innerHTML = `
    ${summaryCard('Limite total', currency(limiteTotal), 'Cartoes filtrados')}
    ${summaryCard('Limite utilizado', currency(limiteUtilizado), 'Faturas em aberto')}
    ${summaryCard('Limite disponivel', currency(limiteDisponivel), 'Limite menos aberto')}
    ${summaryCard('Faturas abertas', currency(abertas), 'Aberta, fechada ou atrasada')}
    ${summaryCard('Pagas no mes', currency(pagasMes), 'Faturas pagas no mes atual')}
    ${summaryCard('Vence em 7 dias', currency(vencendo7), 'Proximos vencimentos')}
  `;
}

function renderCardList(invoices) {
  const host = document.getElementById('cartoes-card-list');
  if (!host) return;
  if (!DB.cartoes.length) {
    host.innerHTML = '<div class="empty">Nenhum cartao cadastrado.</div>';
    return;
  }

  host.innerHTML = DB.cartoes.map(card => {
    const cardInvoices = invoices.filter(invoice => invoice.cartaoId === card.id && invoice.status !== 'Paga');
    const utilizado = cardInvoices.reduce((acc, item) => acc + item.total, 0);
    const disponivel = Number(card.limiteTotal || 0) - utilizado;
    return `
      <article class="card-account">
        <div class="card-account-head">
          <div>
            <strong>${escapeHTML(card.nome)}</strong>
            <small>${escapeHTML(card.bandeira || '-')} - ${escapeHTML(card.banco || '-')}</small>
          </div>
          <div class="card-actions">
            <span class="badge ${card.status === 'Ativo' ? 'success' : 'warning'}">${escapeHTML(card.status)}</span>
            <button class="ghost-button" data-edit-card="${card.id}">Editar</button>
            <button class="danger-button" data-delete-card="${card.id}">Excluir</button>
          </div>
        </div>
        <div class="card-account-grid">
          <span>Limite <strong>${currency(card.limiteTotal)}</strong></span>
          <span>Utilizado <strong>${currency(utilizado)}</strong></span>
          <span>Disponivel <strong>${currency(disponivel)}</strong></span>
          <span>Fechamento <strong>Dia ${card.diaFechamento || '-'}</strong></span>
          <span>Vencimento <strong>Dia ${card.diaVencimento || '-'}</strong></span>
          <span>Melhor compra <strong>Dia ${card.melhorDiaCompra || '-'}</strong></span>
        </div>
      </article>
    `;
  }).join('');

  host.querySelectorAll('[data-edit-card]').forEach(button => {
    button.addEventListener('click', () => openEdit('cartoes', Number(button.dataset.editCard), handleEntityChange));
  });

  host.querySelectorAll('[data-delete-card]').forEach(button => {
    button.addEventListener('click', () => deleteCardFromCard(Number(button.dataset.deleteCard)));
  });
}

function renderInvoices(invoices) {
  const host = document.getElementById('cartoes-invoices');
  if (!host) return;
  if (!invoices.length) {
    host.innerHTML = '<div class="empty">Nenhuma fatura encontrada para os filtros.</div>';
    return;
  }

  host.innerHTML = `
    <div class="invoice-grid">
      ${invoices.map(invoice => `
        <article class="invoice-card">
          <div class="card-account-head">
            <div>
              <strong>${escapeHTML(invoice.cartaoNome)} - ${escapeHTML(invoice.label)}</strong>
              <small>Fechamento: ${dateBR(invoice.fechamento)} - Vencimento: ${dateBR(invoice.vencimento)}</small>
            </div>
            <span class="badge ${invoice.status === 'Paga' ? 'success' : invoice.status === 'Atrasada' ? 'danger' : 'warning'}">${escapeHTML(invoice.status)}</span>
          </div>
          <div class="card-account-grid">
            <span>Total <strong>${currency(invoice.total)}</strong></span>
            <span>Compras <strong>${invoice.items.length}</strong></span>
            <span>Limite usado <strong>${currency(invoice.total)}</strong></span>
          </div>
          <div class="row-actions">
            ${invoice.status === 'Paga'
              ? `<button class="ghost-button" data-reopen-invoice="${invoice.id}">Reabrir fatura</button>`
              : `<button class="primary-button" data-pay-invoice="${invoice.id}">Marcar fatura como paga</button>`}
          </div>
        </article>
      `).join('')}
    </div>
  `;

  host.querySelectorAll('[data-pay-invoice]').forEach(button => {
    button.addEventListener('click', () => openPayCardInvoice(button.dataset.payInvoice));
  });
  host.querySelectorAll('[data-reopen-invoice]').forEach(button => {
    button.addEventListener('click', () => reopenCardInvoice(button.dataset.reopenInvoice));
  });
}

function renderPurchasesTable(purchases) {
  const host = document.getElementById('cartoes-table');
  if (!host) return;
  if (!purchases.length) {
    host.innerHTML = '<div class="empty">Nenhuma compra cadastrada.</div>';
    return;
  }

  host.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Descricao</th>
          <th>Categoria</th>
          <th>Valor</th>
          <th>Parcelas</th>
          <th>Cartao</th>
          <th>Acoes</th>
        </tr>
      </thead>
      <tbody>
        ${purchases.map(purchase => `
          <tr>
            <td>${dateBR(purchase.dataCompra)}</td>
            <td>${escapeHTML(purchase.descricao)}</td>
            <td>${escapeHTML(purchase.categoria || '-')}</td>
            <td>${currency(purchase.valor)}</td>
            <td>${purchase.parcelaAtual || 1}/${purchase.parcelas || 1}</td>
            <td>${escapeHTML(getCardName(purchase.cartaoId))}</td>
            <td>
              <div class="row-actions">
                <button class="ghost-button" data-edit-purchase="${purchase.id}">Editar</button>
                <button class="danger-button" data-delete-purchase="${purchase.id}">Excluir</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  host.querySelectorAll('[data-edit-purchase]').forEach(button => {
    button.addEventListener('click', () => openEditCardPurchase(Number(button.dataset.editPurchase)));
  });
  host.querySelectorAll('[data-delete-purchase]').forEach(button => {
    button.addEventListener('click', () => deleteCardPurchase(Number(button.dataset.deletePurchase)));
  });
}

function renderResource(resourceKey, items) {
  const config = resources[resourceKey];
  const state = filters[resourceKey];
  buildFilters(resourceKey, config, DB[resourceKey], state, renderAll);
  const filtered = applyFilters(items, config, state, globalTerm);
  const visibleItems = resourceKey === 'fluxo'
    ? sortByDate(filtered, state.sort || 'asc')
    : filtered;

  if (resourceKey === 'fluxo') {
    renderFluxoSummary(visibleItems, state);
  }

  renderTable(resourceKey, config, visibleItems, {
    onEdit: id => openEdit(resourceKey, id, handleEntityChange),
    onDelete: id => deleteEntity(resourceKey, id, handleEntityChange),
    onReceive: id => openReceiveSale(id),
    onPay: id => openPayBill(id)
  });
}

function handleEntityChange(resourceKey, item, action) {
  if (resourceKey === 'aportes') {
    syncAporteFlow(item, action);
  }

  if (resourceKey === 'cp') {
    syncContaPagarFlow(item, action);
  }

  if (resourceKey === 'cartoes') {
    syncCartaoAfterChange(item, action);
  }

  renderAll();
}

function syncAutomaticFlows() {
  DB.aportes.forEach(aporte => syncAporteFlow(aporte, 'sync'));
  DB.cp.forEach(conta => syncContaPagarFlow(conta, 'sync'));
  persist();
}

function renderFluxoSummary(items, state) {
  const host = document.getElementById('fluxo-summary');
  if (!host) return;

  const entradas = items
    .filter(item => item.tipo === 'Entrada')
    .reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const saidas = items
    .filter(item => item.tipo === 'Saida' || item.tipo === 'Saída')
    .reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const saldo = entradas - saidas;
  const totalConta = DB.fluxo.reduce((acc, item) => {
    const valor = Number(item.valor || 0);
    return item.tipo === 'Entrada' ? acc + valor : acc - valor;
  }, 0);
  const labelFiltro = [
    state.from || state.to ? 'periodo' : '',
    state.category ? `categoria: ${state.category}` : '',
    state.tipo ? `tipo: ${state.tipo}` : '',
    state.status ? `status: ${state.status}` : '',
    state.formaPagamento ? `forma: ${state.formaPagamento}` : '',
    state.query ? 'pesquisa' : ''
  ].filter(Boolean).join(' / ') || 'todos os lancamentos visiveis';
  const byPayment = paymentMethodTotals(items);

  host.innerHTML = `
    ${summaryCard('Entradas', currency(entradas), 'Total filtrado de entradas')}
    ${summaryCard('Saidas', currency(saidas), 'Total filtrado de saidas')}
    ${summaryCard('Saldo final', currency(saldo), 'Entradas menos saidas filtradas')}
    ${summaryCard('Total em conta', currency(totalConta), 'Saldo geral do fluxo')}
    ${summaryCard('Total filtrado', currency(entradas + saidas), labelFiltro)}
    ${byPayment.map(item => summaryCard(`Pago por ${item.label}`, currency(item.total), 'Saidas filtradas')).join('')}
  `;
}

function summaryCard(label, value, helper) {
  return `
    <article class="metric">
      <span>${escapeHTML(label)}</span>
      <strong>${escapeHTML(value)}</strong>
      <small>${escapeHTML(helper)}</small>
    </article>
  `;
}

function paymentMethodTotals(items) {
  const totals = items
    .filter(item => item.tipo === 'Saida' || item.tipo === 'Saída')
    .reduce((acc, item) => {
      const key = item.formaPagamento || 'Nao informado';
      acc[key] = (acc[key] || 0) + Number(item.valor || 0);
      return acc;
    }, {});

  return Object.entries(totals)
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);
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
    formaPagamento: payload.formaPagamento || '',
    contaUtilizada: payload.contaUtilizada || '',
    vendaId: venda.id,
    origem: 'venda',
    origemId: venda.id
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

function syncAporteFlow(aporte, action) {
  if (!aporte) return;

  if (action === 'delete' || aporte.status === 'Cancelado') {
    removeAutoFlow('aporte', aporte.id);
    return;
  }

  const flow = getAutoFlow('aporte', aporte.id);
  const id = flow?.id || aporte.fluxoId || generateId();
  const tipo = aporte.tipoAporte === 'Adiantamento pago para corretor' ? 'Saida' : 'Entrada';
  const categoria = getAporteCategory(aporte.tipoAporte);

  aporte.fluxoId = id;
  upsert('fluxo', {
    id,
    descricao: `${aporte.tipoAporte || 'Aporte'} - ${aporte.investidor}`,
    tipo,
    categoria,
    valor: Number(aporte.valor || 0),
    data: aporte.data || todayISO(),
    status: 'Realizado',
    formaPagamento: aporte.formaPagamento || '',
    contaUtilizada: aporte.contaUtilizada || '',
    origem: 'aporte',
    origemId: aporte.id,
    aporteId: aporte.id
  });
  persist();
}

function syncContaPagarFlow(conta, action) {
  if (!conta) return;

  const isPaid = conta.status === 'Pago' || conta.pago;

  if (action === 'delete' || !isPaid) {
    removeAutoFlow('conta_pagar', conta.id);
    return;
  }

  if (!conta.formaPagamento || !conta.contaUtilizada || !conta.dataPagamento) {
    removeAutoFlow('conta_pagar', conta.id);
    return;
  }

  const flow = getAutoFlow('conta_pagar', conta.id);
  const id = flow?.id || conta.fluxoId || generateId();
  const data = conta.dataPagamento || conta.vencimento || todayISO();

  conta.fluxoId = id;
  conta.pago = true;
  conta.status = 'Pago';
  upsert('fluxo', {
    id,
    descricao: `Pagamento - ${conta.fornecedor}`,
    tipo: 'Saida',
    categoria: conta.categoria || 'Contas a pagar',
    valor: Number(conta.valorPago || conta.valor || 0),
    data,
    status: 'Pago',
    formaPagamento: conta.formaPagamento || '',
    contaUtilizada: conta.contaUtilizada || '',
    origem: 'conta_pagar',
    origemId: conta.id,
    contaPagarId: conta.id,
    vendaId: conta.vendaId || null
  });
  persist();
}

function getAutoFlow(origem, origemId) {
  return DB.fluxo.find(item => {
    const linkedByOrigin = item.origem === origem && Number(item.origemId) === Number(origemId);
    const linkedByLegacyAporte = origem === 'aporte' && Number(item.aporteId) === Number(origemId);
    const linkedByLegacyConta = origem === 'conta_pagar' && Number(item.contaPagarId) === Number(origemId);
    return linkedByOrigin || linkedByLegacyAporte || linkedByLegacyConta;
  });
}

function removeAutoFlow(origem, origemId) {
  const flow = getAutoFlow(origem, origemId);
  if (flow) {
    removeRecord('fluxo', flow.id);
  }
}

function getAporteCategory(tipoAporte = '') {
  if (tipoAporte === 'Emprestimo recebido') return 'Emprestimos';
  if (tipoAporte === 'Adiantamento pago para corretor') return 'Adiantamentos';
  return 'Aportes';
}

function openPayBill(id) {
  const conta = DB.cp.find(item => item.id === id);
  if (!conta) return;

  openModal({
    title: 'Registrar pagamento',
    fields: [
      { name: 'dataPagamento', label: 'Data do pagamento', type: 'date', required: true },
      { name: 'valorPago', label: 'Valor pago', type: 'number', required: true },
      { name: 'formaPagamento', label: 'Forma de pagamento', type: 'select', options: ['Pix', 'Transferencia', 'Dinheiro', 'Cartao', 'Boleto', 'Debito automatico', 'Outro'], required: true },
      { name: 'contaUtilizada', label: 'Conta utilizada', type: 'text', required: true }
    ],
    values: {
      dataPagamento: conta.dataPagamento || todayISO(),
      valorPago: conta.valor || 0,
      formaPagamento: conta.formaPagamento || '',
      contaUtilizada: conta.contaUtilizada || ''
    },
    onSubmit: payload => payBill(conta, payload)
  });
}

function payBill(conta, payload) {
  const fluxoId = conta.fluxoId || generateId();
  const valorPago = Number(payload.valorPago || conta.valor || 0);
  const dataPagamento = payload.dataPagamento || todayISO();
  const formaPagamento = payload.formaPagamento || '';
  const contaUtilizada = payload.contaUtilizada || '';

  conta.status = 'Pago';
  conta.pago = true;
  conta.dataPagamento = dataPagamento;
  conta.valorPago = valorPago;
  conta.formaPagamento = formaPagamento;
  conta.contaUtilizada = contaUtilizada;
  conta.fluxoId = fluxoId;

  upsert('fluxo', {
    id: fluxoId,
    descricao: `Pagamento - ${conta.fornecedor}`,
    tipo: 'Saida',
    categoria: conta.categoria || 'Contas a pagar',
    valor: valorPago,
    data: dataPagamento,
    status: 'Pago',
    formaPagamento,
    contaUtilizada,
    origem: 'conta_pagar',
    origemId: conta.id,
    contaPagarId: conta.id,
    vendaId: conta.vendaId || null
  });

  persist();
  closeModal();
  renderAll();
  toast('Pagamento lancado no fluxo de caixa');
}

function openCreateCardPurchase() {
  openCardPurchaseModal();
}

function openEditCardPurchase(id) {
  const purchase = DB.cartaoCompras.find(item => item.id === id);
  if (purchase) openCardPurchaseModal(purchase);
}

function openCardPurchaseModal(purchase = null) {
  if (!DB.cartoes.length) {
    toast('Cadastre um cartao antes de lançar compras');
    return;
  }

  openModal({
    title: purchase ? 'Editar compra do cartao' : 'Nova compra do cartao',
    fields: [
      { name: 'dataCompra', label: 'Data da compra', type: 'date', required: true },
      { name: 'descricao', label: 'Descricao', type: 'text', required: true },
      { name: 'categoria', label: 'Categoria', type: 'text', required: true },
      { name: 'valor', label: 'Valor', type: 'number', required: true },
      { name: 'parcelas', label: 'Parcelas', type: 'number' },
      { name: 'parcelaAtual', label: 'Parcela atual', type: 'number' },
      { name: 'cartaoId', label: 'Cartao vinculado', type: 'select', options: DB.cartoes.map(card => ({ value: String(card.id), label: card.nome })), required: true },
      { name: 'obs', label: 'Observacao', type: 'textarea', full: true }
    ],
    values: purchase || {
      dataCompra: todayISO(),
      parcelas: 1,
      parcelaAtual: 1,
      cartaoId: DB.cartoes[0].id
    },
    onSubmit: payload => {
      const item = {
        id: purchase?.id || generateId(),
        ...payload,
        cartaoId: Number(payload.cartaoId),
        valor: Number(payload.valor || 0),
        parcelas: Math.max(1, Number(payload.parcelas || 1)),
        parcelaAtual: Math.max(1, Number(payload.parcelaAtual || 1))
      };
      upsert('cartaoCompras', item);
      syncPaidCardInvoices(getCardInvoices());
      closeModal();
      renderAll();
      toast(purchase ? 'Compra atualizada' : 'Compra cadastrada');
    }
  });
}

function deleteCardPurchase(id) {
  if (!window.confirm('Deseja excluir esta compra?')) return;
  removeRecord('cartaoCompras', id);
  syncPaidCardInvoices(getCardInvoices());
  renderAll();
  toast('Compra removida');
}

function getCardInvoices() {
  const invoiceMap = new Map();

  (DB.cartaoCompras || []).forEach(purchase => {
    const card = DB.cartoes.find(item => item.id === Number(purchase.cartaoId));
    if (!card) return;
    const parcelas = Math.max(1, Number(purchase.parcelas || 1));
    const parcelaAtual = Math.max(1, Number(purchase.parcelaAtual || 1));
    const valorParcela = Number(purchase.valor || 0) / parcelas;
    const baseDate = getInvoiceBaseDate(purchase.dataCompra, card.diaFechamento);

    for (let parcel = parcelaAtual; parcel <= parcelas; parcel += 1) {
      const monthDate = addMonths(baseDate, parcel - parcelaAtual);
      const key = `${card.id}-${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      const stored = DB.cartaoFaturas.find(item => item.id === key) || {};
      const fechamento = buildDate(monthDate.getFullYear(), monthDate.getMonth(), card.diaFechamento);
      const vencimento = buildDate(monthDate.getFullYear(), monthDate.getMonth(), card.diaVencimento);

      if (!invoiceMap.has(key)) {
        invoiceMap.set(key, {
          id: key,
          cartaoId: card.id,
          cartaoNome: card.nome,
          label: monthDate.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }),
          fechamento,
          vencimento,
          total: 0,
          items: [],
          dataPagamento: stored.dataPagamento || '',
          fluxoId: stored.fluxoId || null,
          storedStatus: stored.status || ''
        });
      }

      const invoice = invoiceMap.get(key);
      invoice.total += valorParcela;
      invoice.items.push({
        ...purchase,
        valorParcela,
        parcelaFatura: parcel
      });
    }
  });

  return [...invoiceMap.values()]
    .map(invoice => ({
      ...invoice,
      total: roundMoney(invoice.total),
      status: resolveInvoiceStatus(invoice)
    }))
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}

function resolveInvoiceStatus(invoice) {
  if (invoice.storedStatus === 'Paga') return 'Paga';
  if (invoice.vencimento < todayISO()) return 'Atrasada';
  if (invoice.fechamento <= todayISO()) return 'Fechada';
  return 'Aberta';
}

function filterCardInvoices(invoices) {
  return invoices.filter(invoice => {
    const query = `${invoice.cartaoNome} ${invoice.label} ${invoice.items.map(item => `${item.descricao} ${item.categoria}`).join(' ')}`.toLowerCase();
    const queryOk = !cartoesState.query || query.includes(cartoesState.query.toLowerCase());
    const statusOk = !cartoesState.status || invoice.status === cartoesState.status;
    const cardOk = !cartoesState.cartaoId || String(invoice.cartaoId) === String(cartoesState.cartaoId);
    const fromOk = !cartoesState.from || invoice.vencimento >= cartoesState.from;
    const toOk = !cartoesState.to || invoice.vencimento <= cartoesState.to;
    const categoryOk = !cartoesState.category || invoice.items.some(item => item.categoria === cartoesState.category);
    return queryOk && statusOk && cardOk && fromOk && toOk && categoryOk;
  });
}

function filterCardPurchases(purchases) {
  return purchases.filter(purchase => {
    const query = `${purchase.descricao} ${purchase.categoria} ${getCardName(purchase.cartaoId)}`.toLowerCase();
    const queryOk = !cartoesState.query || query.includes(cartoesState.query.toLowerCase());
    const cardOk = !cartoesState.cartaoId || String(purchase.cartaoId) === String(cartoesState.cartaoId);
    const fromOk = !cartoesState.from || purchase.dataCompra >= cartoesState.from;
    const toOk = !cartoesState.to || purchase.dataCompra <= cartoesState.to;
    const categoryOk = !cartoesState.category || purchase.categoria === cartoesState.category;
    return queryOk && cardOk && fromOk && toOk && categoryOk;
  }).sort((a, b) => String(a.dataCompra || '').localeCompare(String(b.dataCompra || '')));
}

function openPayCardInvoice(invoiceId) {
  const invoice = getCardInvoices().find(item => item.id === invoiceId);
  if (!invoice) return;

  openModal({
    title: 'Pagar fatura',
    fields: [
      { name: 'dataPagamento', label: 'Data do pagamento', type: 'date', required: true },
      { name: 'valorPago', label: 'Valor pago', type: 'number', required: true },
      { name: 'formaPagamento', label: 'Forma de pagamento', type: 'select', options: ['Pix', 'Transferencia', 'Dinheiro', 'Cartao', 'Boleto', 'Debito automatico', 'Outro'], required: true },
      { name: 'contaUtilizada', label: 'Conta utilizada', type: 'text', required: true }
    ],
    values: {
      dataPagamento: todayISO(),
      valorPago: invoice.total,
      formaPagamento: '',
      contaUtilizada: ''
    },
    onSubmit: payload => payCardInvoice(invoice, payload)
  });
}

function payCardInvoice(invoice, payload) {
  const stored = DB.cartaoFaturas.find(item => item.id === invoice.id) || {};
  const fluxoId = stored.fluxoId || generateId();
  const dataPagamento = payload.dataPagamento || todayISO();
  const total = Number(payload.valorPago || invoice.total || 0);
  const formaPagamento = payload.formaPagamento || '';
  const contaUtilizada = payload.contaUtilizada || '';

  upsert('cartaoFaturas', {
    id: invoice.id,
    cartaoId: invoice.cartaoId,
    mes: invoice.label,
    total,
    status: 'Paga',
    dataPagamento,
    formaPagamento,
    contaUtilizada,
    fechamento: invoice.fechamento,
    vencimento: invoice.vencimento,
    fluxoId
  });

  upsert('fluxo', {
    id: fluxoId,
    descricao: `Pagamento fatura ${invoice.cartaoNome} ${invoice.label}`,
    tipo: 'Saida',
    categoria: 'Cartoes',
    valor: total,
    data: dataPagamento,
    status: 'Pago',
    formaPagamento,
    contaUtilizada,
    origem: 'cartao',
    origemId: invoice.id,
    cartaoId: invoice.cartaoId
  });

  closeModal();
  renderAll();
  toast('Fatura paga e lançada no fluxo');
}

function reopenCardInvoice(invoiceId) {
  const invoice = DB.cartaoFaturas.find(item => item.id === invoiceId);
  if (!invoice) return;
  removeAutoFlow('cartao', invoiceId);
  removeRecord('cartaoFaturas', invoiceId);
  renderAll();
  toast('Fatura reaberta e saída removida do fluxo');
}

function syncPaidCardInvoices(invoices) {
  DB.cartaoFaturas
    .filter(stored => stored.status === 'Paga')
    .forEach(stored => {
      const invoice = invoices.find(item => item.id === stored.id);
      if (!invoice) {
        removeAutoFlow('cartao', stored.id);
        removeRecord('cartaoFaturas', stored.id);
        return;
      }
      const fluxoId = stored.fluxoId || generateId();
      stored.total = invoice.total;
      stored.fluxoId = fluxoId;
      upsert('fluxo', {
        id: fluxoId,
        descricao: `Pagamento fatura ${invoice.cartaoNome} ${invoice.label}`,
        tipo: 'Saida',
        categoria: 'Cartoes',
        valor: invoice.total,
        data: stored.dataPagamento || invoice.vencimento,
        status: 'Pago',
        formaPagamento: stored.formaPagamento || '',
        contaUtilizada: stored.contaUtilizada || '',
        origem: 'cartao',
        origemId: invoice.id,
        cartaoId: invoice.cartaoId
      });
    });
}

function syncCartaoAfterChange(cartao, action) {
  if (!cartao) return;

  if (action === 'delete') {
    (DB.cartaoCompras || [])
      .filter(compra => Number(compra.cartaoId) === Number(cartao.id))
      .forEach(compra => removeRecord('cartaoCompras', compra.id));

    (DB.cartaoFaturas || [])
      .filter(fatura => Number(fatura.cartaoId) === Number(cartao.id))
      .forEach(fatura => {
        removeAutoFlow('cartao', fatura.id);
        removeRecord('cartaoFaturas', fatura.id);
      });
    return;
  }

  syncPaidCardInvoices(getCardInvoices());
}

function deleteCardFromCard(id) {
  const card = DB.cartoes.find(item => item.id === id);
  if (!card) return;

  const invoices = getCardInvoices().filter(invoice => invoice.cartaoId === id);
  const openInvoices = invoices.filter(invoice => invoice.status !== 'Paga');
  const pendingPayments = DB.cp.filter(conta => Number(conta.cartaoId) === id && conta.status !== 'Pago');

  if (openInvoices.length || pendingPayments.length) {
    toast('Nao e possivel excluir: ha fatura aberta ou pagamento pendente neste cartao');
    window.alert('Nao e possivel excluir este cartao enquanto houver fatura aberta, fechada, atrasada ou pagamento pendente vinculado.');
    return;
  }

  if (!window.confirm(`Deseja excluir o cartao ${card.nome}? Compras, faturas pagas e lancamentos automaticos vinculados tambem serao removidos.`)) return;

  DB.cartaoCompras
    .filter(compra => Number(compra.cartaoId) === id)
    .forEach(compra => removeRecord('cartaoCompras', compra.id));

  DB.cartaoFaturas
    .filter(fatura => Number(fatura.cartaoId) === id)
    .forEach(fatura => {
      removeAutoFlow('cartao', fatura.id);
      removeRecord('cartaoFaturas', fatura.id);
    });

  DB.fluxo
    .filter(item => item.origem === 'cartao' && Number(item.cartaoId) === id)
    .forEach(item => removeRecord('fluxo', item.id));

  removeRecord('cartoes', id);
  renderAll();
  toast('Cartao excluido com sucesso');
}

function getCardName(id) {
  return DB.cartoes.find(card => card.id === Number(id))?.nome || '-';
}

function getInvoiceBaseDate(dateValue, closingDay) {
  const date = new Date(`${dateValue || todayISO()}T00:00:00`);
  const base = new Date(date.getFullYear(), date.getMonth(), 1);
  if (date.getDate() > Number(closingDay || 25)) {
    base.setMonth(base.getMonth() + 1);
  }
  return base;
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function buildDate(year, month, day) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(Number(day || 1), lastDay)).padStart(2, '0')}`;
}

function daysBetween(from, to) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  return Math.ceil((end - start) / 86400000);
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
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
