import { badgeClass, currency, dateBR, escapeHTML, matchesSearch, normalize } from './utils.js';

export function buildFilters(resourceKey, config, items, state, onChange) {
  const host = document.getElementById(`${resourceKey}-filters`);
  const statusValues = unique(items.map(item => item.status).filter(Boolean));

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
  `;

  host.querySelectorAll('[data-filter]').forEach(input => {
    input.addEventListener('input', () => {
      state[input.dataset.filter] = input.value;
      onChange(resourceKey, input.dataset.filter);
    });
  });
}

export function applyFilters(items, config, state, globalTerm = '') {
  return items.filter(item => {
    const dateValue = config.dateField ? item[config.dateField] : null;
    const queryOk = matchesSearch(item, state.query || '') && matchesSearch(item, globalTerm || '');
    const statusOk = !state.status || item.status === state.status;
    const fromOk = !state.from || !dateValue || dateValue >= state.from;
    const toOk = !state.to || !dateValue || dateValue <= state.to;
    return queryOk && statusOk && fromOk && toOk;
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
