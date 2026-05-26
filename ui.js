import { escapeHTML } from './utils.js';

let toastTimer;

export function toast(message) {
  const toastEl = document.getElementById('toast');
  toastEl.innerText = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000);
}

export function setLoading(isLoading) {
  document.getElementById('loading')?.classList.toggle('hidden', !isLoading);
}

export function openModal({ title, fields, values = {}, onSubmit }) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <section class="modal" role="dialog" aria-modal="true" aria-label="${escapeHTML(title)}">
      <div class="modal-head">
        <h2>${escapeHTML(title)}</h2>
        <button class="icon-button" type="button" data-modal-close aria-label="Fechar">×</button>
      </div>
      <form id="entity-form">
        <div class="modal-form">
          ${fields.map(fieldTemplate(values)).join('')}
        </div>
        <div class="modal-actions">
          <button class="ghost-button" type="button" data-modal-close>Cancelar</button>
          <button class="primary-button" type="submit">Salvar</button>
        </div>
      </form>
    </section>
  `;

  root.classList.add('open');
  root.setAttribute('aria-hidden', 'false');
  root.querySelector('[name]')?.focus();

  root.querySelectorAll('[data-modal-close]').forEach(button => {
    button.addEventListener('click', closeModal);
  });

  root.onclick = event => {
    if (event.target === root) closeModal();
  };

  root.querySelector('#entity-form').addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {};
    fields.forEach(field => {
      const value = formData.get(field.name);
      payload[field.name] = field.type === 'number' ? Number(value || 0) : value;
    });
    onSubmit(payload);
  });

  setupVendaFinancialPreview(root);
}

export function closeModal() {
  const root = document.getElementById('modal-root');
  root.classList.remove('open');
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = '';
}

function fieldTemplate(values) {
  return field => {
    const value = values[field.name] ?? '';
    const required = field.required ? 'required' : '';
    const className = field.full ? 'form-field full' : 'form-field';

    if (field.type === 'textarea') {
      return `
        <label class="${className}">
          <span>${escapeHTML(field.label)}</span>
          <textarea name="${field.name}" ${required}>${escapeHTML(value)}</textarea>
        </label>
      `;
    }

    if (field.type === 'select') {
      return `
        <label class="${className}">
          <span>${escapeHTML(field.label)}</span>
          <select name="${field.name}" ${required}>
            <option value="">Selecione</option>
            ${field.options.map(option => `
              <option value="${escapeHTML(option)}" ${option === value ? 'selected' : ''}>${escapeHTML(option)}</option>
            `).join('')}
          </select>
        </label>
      `;
    }

    return `
      <label class="${className}">
        <span>${escapeHTML(field.label)}</span>
        <input name="${field.name}" type="${field.type}" value="${escapeHTML(value)}" ${required} ${field.readonly ? 'readonly' : ''} ${field.type === 'number' ? 'min="0" step="0.01"' : ''}>
      </label>
    `;
  };
}

function setupVendaFinancialPreview(root) {
  const form = root.querySelector('#entity-form');
  const valor = form?.elements.valor;
  const pctImobiliaria = form?.elements.comissaoImobiliariaPct;
  const comissaoImobiliaria = form?.elements.comissaoImobiliariaValor;
  const pctCorretor = form?.elements.comissaoCorretorPct;
  const comissaoCorretor = form?.elements.comissaoCorretorValor;
  const custos = form?.elements.custosEncaminhados;
  const impostos = form?.elements.impostosGuias;
  const caixa = form?.elements.caixaEmpresa;

  if (!valor || !pctImobiliaria || !comissaoImobiliaria || !pctCorretor || !comissaoCorretor || !custos || !impostos || !caixa) return;

  const update = () => {
    const venda = Number(valor.value || 0);
    const percentualImobiliaria = Number(pctImobiliaria.value || 0);
    const percentualCorretor = Number(pctCorretor.value || 0);
    const comissaoRecebidaValor = roundMoney(venda * (percentualImobiliaria / 100));
    const comissaoCorretorValor = roundMoney(venda * (percentualCorretor / 100));
    const caixaValor = roundMoney(comissaoRecebidaValor - comissaoCorretorValor - Number(custos.value || 0) - Number(impostos.value || 0));

    comissaoImobiliaria.value = comissaoRecebidaValor.toFixed(2);
    comissaoCorretor.value = comissaoCorretorValor.toFixed(2);
    caixa.value = caixaValor.toFixed(2);
  };

  [valor, pctImobiliaria, pctCorretor, custos, impostos].forEach(input => {
    input.addEventListener('input', update);
  });
  update();
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

export function confirmAction(message) {
  return window.confirm(message);
}
