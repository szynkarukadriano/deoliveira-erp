import { resources } from './dataConfig.js';
import { getById, remove, upsert } from './storage.js';
import { generateId } from './utils.js';
import { closeModal, confirmAction, openModal, toast } from './ui.js';

export let editing = {
  type: null,
  id: null
};

export function openCreate(resourceKey, onDone) {
  resetEditing();
  const config = resources[resourceKey];
  openModal({
    title: `Novo registro: ${config.title}`,
    fields: config.fields,
    onSubmit: payload => saveEntity(resourceKey, payload, onDone)
  });
}

export function openEdit(resourceKey, id, onDone) {
  const config = resources[resourceKey];
  const item = getById(resourceKey, id);
  if (!item) return;

  editing = {
    type: resourceKey,
    id
  };

  openModal({
    title: `Editar ${config.title}`,
    fields: config.fields,
    values: item,
    onSubmit: payload => saveEntity(resourceKey, payload, onDone)
  });
}

export function deleteEntity(resourceKey, id, onDone) {
  const config = resources[resourceKey];
  const item = getById(resourceKey, id);
  if (!confirmAction(`Deseja realmente excluir este registro de ${config.plural}?`)) return;
  remove(resourceKey, id);
  toast(`${config.title} removido com sucesso`);
  onDone(resourceKey, item, 'delete');
}

function saveEntity(resourceKey, payload, onDone) {
  const config = resources[resourceKey];
  const isEditing = editing.type === resourceKey && editing.id;
  const normalized = normalizePayload(resourceKey, payload);
  if (!normalized) return;

  const item = {
    id: isEditing ? editing.id : generateId(),
    ...normalized
  };

  upsert(resourceKey, item);
  toast(isEditing ? `${config.title} atualizado com sucesso` : `${config.title} criado com sucesso`);
  closeModal();
  resetEditing();
  onDone(resourceKey, item, isEditing ? 'update' : 'create');
}

function normalizePayload(resourceKey, payload) {
  if (resourceKey === 'cp') {
    if (payload.status === 'Pago' && (!payload.formaPagamento || !payload.dataPagamento || !payload.contaUtilizada)) {
      toast('Preencha forma de pagamento, data de pagamento e conta utilizada para marcar como pago');
      return null;
    }

    return {
      ...payload,
      pago: payload.status === 'Pago',
      valorPago: payload.status === 'Pago' ? Number(payload.valor || 0) : 0,
      valor: Number(payload.valor || 0)
    };
  }

  if (resourceKey === 'fluxo') {
    if ((payload.tipo === 'Saida' || payload.tipo === 'Saída') && (!payload.formaPagamento || !payload.contaUtilizada)) {
      toast('Preencha forma de pagamento e conta utilizada para lancamentos de saida');
      return null;
    }

    return {
      ...payload,
      valor: Number(payload.valor || 0)
    };
  }

  if (resourceKey === 'aportes') {
    if (payload.tipoAporte === 'Adiantamento pago para corretor' && payload.status === 'Realizado' && (!payload.formaPagamento || !payload.contaUtilizada)) {
      toast('Preencha forma de pagamento e conta utilizada para adiantamentos pagos');
      return null;
    }

    return {
      ...payload,
      valor: Number(payload.valor || 0)
    };
  }

  if (resourceKey !== 'vendas') return payload;

  const valor = Number(payload.valor || 0);
  const comissaoImobiliariaPct = Number(payload.comissaoImobiliariaPct || 0);
  const comissaoCorretorPct = Number(payload.comissaoCorretorPct || 0);
  const custosEncaminhados = Number(payload.custosEncaminhados || 0);
  const impostosGuias = Number(payload.impostosGuias || 0);
  const comissaoImobiliariaValor = roundMoney(valor * (comissaoImobiliariaPct / 100));
  const comissaoCorretorValor = roundMoney(valor * (comissaoCorretorPct / 100));
  const caixaEmpresa = roundMoney(comissaoImobiliariaValor - comissaoCorretorValor - custosEncaminhados - impostosGuias);

  return {
    ...payload,
    dataVenda: payload.dataVenda || payload.dtPrev || '',
    valor,
    comissaoImobiliariaPct,
    comissaoImobiliariaValor,
    comissaoCorretorPct,
    comissaoCorretorValor,
    custosEncaminhados,
    impostosGuias,
    caixaEmpresa
  };
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

export function resetEditing() {
  editing = {
    type: null,
    id: null
  };
}
