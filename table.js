import { badgeClass, currency, dateBR, escapeHTML, matchesSearch, normalize } from './utils.js';

export function buildFilters(resourceKey, config, items, state, onChange) {
  const host = document.getElementById(`${resourceKey}-filters`);
  const statusValues = unique(items.map(item => item.status).filter(Boolean));
  const categoryValues = unique(items.map(item => item.categoria).filter(Boolean));
  const paymentValues = unique(items.map(item => item.formaPagamento).filter(Boolean));

  host.innerHTML = `
    <label class="filter-field">
      <span>Pesquisa</span>
      <input type="search" data-filter="query" value="${escapeHTML(state.query || '')}" placeholder="Buscar em ${escapeHTML(config.plural)}">
    </label>
    <label class="filter-field">
      <span>Status</span>
      <select data-filter="status">
        <option value="">Todos</option>
        ${statusValues.map(status => `<option value="${escapeHTML(status)}" ${state.status === status ? 'selected' : ''}>${escapeHTML(status)}</option>`).join('')}
      </select>
    </label>
    <label class="filter-field">
      <span>Data inicial</span>
      <input type="date" data-filter="from" value="${escapeHTML(state.from || '')}">
    </label>
    <label class="filter-field">
      <span>Data final</span>
      <input type="date" data-filter="to" value="${escapeHTML(state.to || '')}">
    </label>
    ${['fluxo', 'cp'].includes(resourceKey) ? paymentFilter(state, paymentValues) : ''}
    ${resourceKey === 'fluxo' ? fluxoExtraFilters(state, categoryValues) : ''}
  `;

  host.querySelectorAll('[data-filter]').forEach(input => {
    input.addEventListener('input', () => {
      state[input.dataset.filter] = input.value;
      onChange(resourceKey, input.dataset.filter);
    });
  });
  host.querySelectorAll('[data-category-value]').forEach(button => {
    button.addEventListener('click', () => {
      state.category = button.dataset.categoryValue;
      onChange(resourceKey, 'category');
    });
  });
}

export function applyFilters(items, config, state, globalTerm = '') {
  return items.filter(item => {
    const dateValue = config.dateField ? item[config.dateField] : null;
    const queryOk = matchesSearch(item, state.query || '') && matchesSearch(item, globalTerm || '');
    const statusOk = !state.status || item.status === state.status;
    const categoryOk = !state.category || item.categoria === state.category;
    const paymentOk = !state.formaPagamento || item.formaPagamento === state.formaPagamento;
    const itemType = item.tipo === 'Saída' ? 'Saida' : item.tipo;
    const typeOk = !state.tipo || itemType === state.tipo;
    const fromOk = !state.from || !dateValue || dateValue >= state.from;
    const toOk = !state.to || !dateValue || dateValue <= state.to;
    return queryOk && statusOk && categoryOk && paymentOk && typeOk && fromOk && toOk;
  });
}

export function sortByDate(items, direction = 'asc') {
  const factor = direction === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => {
    const dateA = String(a.data || a.dtPrev || a.vencimento || '');
    const dateB = String(b.data || b.dtPrev || b.vencimento || '');
    const dateCompare = dateA.localeCompare(dateB) * factor;
    if (dateCompare !== 0) return dateCompare;
    return Number(a.id || 0) - Number(b.id || 0);
  });
}

export function renderTable(resourceKey, config, items, callbacks) {
  const host = document.getElementById(`${resourceKey}-table`);
  if (!items.length) {
    host.innerHTML = `<div class="empty">Nenhum registro encontrado.</div>`;
    return;
  }

  host.innerHTML = `
    <table>
      <thead>
        <tr>
          ${config.columns.map(column => `<th>${escapeHTML(column.label)}</th>`).join('')}
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => rowTemplate(config, item)).join('')}
      </tbody>
    </table>
  `;

  host.querySelectorAll('[data-edit]').forEach(button => {
    button.addEventListener('click', () => callbacks.onEdit(Number(button.dataset.edit)));
  });
  host.querySelectorAll('[data-delete]').forEach(button => {
    button.addEventListener('click', () => callbacks.onDelete(Number(button.dataset.delete)));
  });
  host.querySelectorAll('[data-receive]').forEach(button => {
    button.addEventListener('click', () => callbacks.onReceive?.(Number(button.dataset.receive)));
  });
  host.querySelectorAll('[data-pay]').forEach(button => {
    button.addEventListener('click', () => callbacks.onPay?.(Number(button.dataset.pay)));
  });
}

function rowTemplate(config, item) {
  return `
    <tr>
      ${config.columns.map(column => `<td>${formatCell(item[column.key], column.format)}</td>`).join('')}
      <td>
        <div class="row-actions">
          ${config.plural === 'Vendas' ? receiveButton(item) : ''}
          ${config.plural === 'Contas a Pagar' ? payButton(item) : ''}
          <button class="ghost-button" data-edit="${item.id}">Editar</button>
          <button class="danger-button" data-delete="${item.id}">Excluir</button>
        </div>
      </td>
    </tr>
  `;
}

function receiveButton(item) {
  if (item.recebimentoStatus === 'Recebido') {
    return '<span class="badge success">Recebido</span>';
  }

  return `<button class="primary-button" data-receive="${item.id}">Receber</button>`;
}

function payButton(item) {
  if (item.status === 'Pago' || item.pago) {
    return '<span class="badge success">Pago</span>';
  }

  return `<button class="primary-button" data-pay="${item.id}">Pagar</button>`;
}

function formatCell(value, format) {
  if (format === 'currency') return escapeHTML(currency(value));
  if (format === 'date') return escapeHTML(dateBR(value));
  if (format === 'badge') return `<span class="badge ${badgeClass(value)}">${escapeHTML(value || '-')}</span>`;
  return escapeHTML(value || '-');
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => normalize(a).localeCompare(normalize(b)));
}

function fluxoExtraFilters(state, categories) {
  return `
    <label class="filter-field">
      <span>Tipo</span>
      <select data-filter="tipo">
        <option value="">Todos</option>
        <option value="Entrada" ${state.tipo === 'Entrada' ? 'selected' : ''}>Entradas</option>
        <option value="Saida" ${state.tipo === 'Saida' ? 'selected' : ''}>Saidas</option>
      </select>
    </label>
    <label class="filter-field">
      <span>Ordem</span>
      <select data-filter="sort">
        <option value="asc" ${(state.sort || 'asc') === 'asc' ? 'selected' : ''}>Mais antigo primeiro</option>
        <option value="desc" ${state.sort === 'desc' ? 'selected' : ''}>Mais recente primeiro</option>
      </select>
    </label>
    <div class="filter-field full-filter">
      <span>Categoria</span>
      <div class="category-filter">
        <button type="button" class="${!state.category ? 'active' : ''}" data-category-value="">Todas</button>
        ${categories.map(category => `
          <button type="button" class="${state.category === category ? 'active' : ''}" data-category-value="${escapeHTML(category)}">${escapeHTML(category)}</button>
        `).join('')}
      </div>
    </div>
  `;
}

function paymentFilter(state, payments) {
  return `
    <label class="filter-field">
      <span>Forma pagamento</span>
      <select data-filter="formaPagamento">
        <option value="">Todas</option>
        ${payments.map(payment => `<option value="${escapeHTML(payment)}" ${state.formaPagamento === payment ? 'selected' : ''}>${escapeHTML(payment)}</option>`).join('')}
      </select>
    </label>
  `;
}
