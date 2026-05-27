import { deleteRemoteRecord, loadRemoteDB, syncLocalToRemote, upsertRemoteRecord } from './supabase.js';

export const STORAGE_KEY = 'deoliveira_erp_v2';
export const BACKUP_KEY = 'backup_deoliveira';
export const PENDING_SUPABASE_SYNC_KEY = 'pending_supabase_sync';

const fallbackDB = {
  vendas: [],
  fluxo: [],
  cartoes: [],
  cartaoCompras: [],
  cartaoFaturas: [],
  aportes: [],
  cp: [],
  configuracoes: []
};

export let DB = loadDB();

function loadDB() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return migrateDB({ ...fallbackDB, ...(stored || {}) });
  } catch {
    return migrateDB({ ...fallbackDB });
  }
}

function migrateDB(db) {
  db.vendas = db.vendas.map(venda => {
    const hasCommissionBase = venda.comissaoImobiliariaPct != null || venda.comissaoImobiliariaValor != null;
    const valor = Number(venda.valor || 0);
    const comissaoImobiliariaPct = Number(venda.comissaoImobiliariaPct ?? 6);
    const comissaoImobiliariaValor = Number(venda.comissaoImobiliariaValor ?? roundMoney(valor * (comissaoImobiliariaPct / 100)));
    const oldCorretorValor = Number(venda.comissaoCorretorValor || 0);
    const comissaoCorretorPct = hasCommissionBase
      ? Number(venda.comissaoCorretorPct || 0)
      : roundMoney(valor ? (oldCorretorValor / valor) * 100 : Number(venda.comissaoCorretorPct || 0));
    const comissaoCorretorValor = Number(venda.comissaoCorretorValor ?? roundMoney(valor * (comissaoCorretorPct / 100)));
    const custosEncaminhados = Number(venda.custosEncaminhados || 0);
    const impostosGuias = Number(venda.impostosGuias || 0);
    const caixaEmpresa = hasCommissionBase && venda.caixaEmpresa != null
      ? Number(venda.caixaEmpresa)
      : roundMoney(comissaoImobiliariaValor - comissaoCorretorValor - custosEncaminhados - impostosGuias);
    const recebimentoStatus = venda.recebimentoStatus || (venda.recebido ? 'Recebido' : 'Para receber');
    const recebido = recebimentoStatus === 'Recebido';
    const status = migrateVendaStatus(venda.status);

    return {
      ...venda,
      status,
      comissaoImobiliariaPct,
      comissaoImobiliariaValor,
      comissaoCorretorPct,
      comissaoCorretorValor,
      custosEncaminhados,
      impostosGuias,
      caixaEmpresa,
      recebimentoStatus,
      recebido,
      dataRecebimento: venda.dataRecebimento || '',
      valorRecebido: Number(venda.valorRecebido || (recebido ? comissaoImobiliariaValor : 0)),
      fluxoId: venda.fluxoId || null
    };
  });

  db.cartoes = db.cartoes.map(cartao => ({
    ...cartao,
    banco: cartao.banco || '',
    responsavel: cartao.responsavel || '',
    limiteTotal: Number(cartao.limiteTotal || cartao.limite || 0),
    melhorDiaCompra: Number(cartao.melhorDiaCompra || 1),
    diaFechamento: Number(cartao.diaFechamento || 25),
    diaVencimento: Number(cartao.diaVencimento || extractDay(cartao.vencimento) || 8),
    status: cartao.status === 'Bloqueado' ? 'Inativo' : cartao.status || 'Ativo'
  }));

  db.cartaoCompras = (db.cartaoCompras || []).map(compra => ({
    ...compra,
    valor: Number(compra.valor || 0),
    parcelas: Number(compra.parcelas || 1),
    parcelaAtual: Number(compra.parcelaAtual || 1),
    cartaoId: Number(compra.cartaoId || 0)
  }));

  db.cartaoFaturas = (db.cartaoFaturas || []).map(fatura => ({
    ...fatura,
    cartaoId: Number(fatura.cartaoId || 0),
    total: Number(fatura.total || 0),
    status: fatura.status || 'Aberta',
    formaPagamento: fatura.formaPagamento || '',
    contaUtilizada: fatura.contaUtilizada || '',
    fluxoId: fatura.fluxoId || null
  }));

  db.cp = db.cp.map(conta => ({
    ...conta,
    pago: conta.pago ?? conta.status === 'Pago',
    dataPagamento: conta.dataPagamento || '',
    valorPago: Number(conta.valorPago || 0),
    formaPagamento: conta.formaPagamento || '',
    contaUtilizada: conta.contaUtilizada || '',
    fluxoId: conta.fluxoId || null
  }));

  db.aportes = db.aportes.map(aporte => ({
    ...aporte,
    tipoAporte: aporte.tipoAporte || normalizeAporteType(aporte.origem),
    status: aporte.status === 'Confirmado' ? 'Realizado' : aporte.status,
    formaPagamento: aporte.formaPagamento || '',
    contaUtilizada: aporte.contaUtilizada || '',
    fluxoId: aporte.fluxoId || null
  }));

  db.fluxo = db.fluxo.map(item => ({
    ...item,
    formaPagamento: item.formaPagamento || '',
    contaUtilizada: item.contaUtilizada || ''
  }));

  return db;
}

export function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
}

export async function initRemoteStorage() {
  const shouldPushLocal = localStorage.getItem(PENDING_SUPABASE_SYNC_KEY) === 'true';

  if (shouldPushLocal) {
    await syncLocalToRemote(DB);
    localStorage.removeItem(PENDING_SUPABASE_SYNC_KEY);
  }

  const remoteDB = await loadRemoteDB();
  Object.keys(fallbackDB).forEach(collection => {
    DB[collection] = remoteDB[collection] || [];
  });
  DB = migrateDB({ ...fallbackDB, ...DB });
  persist();
}

export function markPendingSupabaseSync() {
  localStorage.setItem(PENDING_SUPABASE_SYNC_KEY, 'true');
}

export function backupERP() {
  localStorage.setItem(BACKUP_KEY, JSON.stringify({
    createdAt: new Date().toISOString(),
    data: DB
  }));
}

export function upsert(collection, item) {
  const index = DB[collection].findIndex(record => record.id === item.id);
  if (index >= 0) {
    DB[collection][index] = item;
  } else {
    DB[collection].push(item);
  }
  persist();
  upsertRemoteRecord(collection, item).catch(error => console.warn('Supabase upsert failed', error));
}

export function remove(collection, id) {
  DB[collection] = DB[collection].filter(record => record.id !== id);
  persist();
  deleteRemoteRecord(collection, id).catch(error => console.warn('Supabase delete failed', error));
}

export function getById(collection, id) {
  return DB[collection].find(record => record.id === id);
}

export function seedIfEmpty() {
  const hasData = Object.values(DB).some(items => items.length);
  if (hasData) return;

  DB.vendas = [
    {
      id: 101,
      cliente: 'Marina Costa',
      empreend: 'Residencial Aurora',
      corretor: 'Ana Souza',
      valor: 540000,
      comissaoImobiliariaPct: 6,
      comissaoImobiliariaValor: 32400,
      comissaoCorretorPct: 2,
      comissaoCorretorValor: 10800,
      custosEncaminhados: 6500,
      impostosGuias: 2100,
      caixaEmpresa: 13000,
      recebimentoStatus: 'Para receber',
      recebido: false,
      dataRecebimento: '',
      fluxoId: null,
      status: 'Em negociacao',
      dtPrev: '2026-06-15',
      obs: 'Aguardando assinatura'
    },
    {
      id: 102,
      cliente: 'Rafael Lima',
      empreend: 'Jardins Office',
      corretor: 'Carlos Mendes',
      valor: 780000,
      comissaoImobiliariaPct: 5,
      comissaoImobiliariaValor: 39000,
      comissaoCorretorPct: 2.5,
      comissaoCorretorValor: 19500,
      custosEncaminhados: 9000,
      impostosGuias: 2600,
      caixaEmpresa: 7900,
      recebimentoStatus: 'Recebido',
      recebido: true,
      dataRecebimento: '2026-05-30',
      valorRecebido: 39000,
      fluxoId: 203,
      status: 'Concluido',
      dtPrev: '2026-05-30',
      obs: 'Contrato finalizado'
    }
  ];

  DB.fluxo = [
    { id: 201, descricao: 'Comissão recebida', tipo: 'Entrada', categoria: 'Comissões', valor: 32000, data: '2026-05-10', status: 'Pago' },
    { id: 202, descricao: 'Trafego pago', tipo: 'Saida', categoria: 'Marketing', valor: 4200, data: '2026-05-18', status: 'Pago', formaPagamento: 'Cartao', contaUtilizada: 'Cartao Operacional' },
    { id: 203, descricao: 'Comissao imobiliaria recebida - Rafael Lima / Jardins Office', tipo: 'Entrada', categoria: 'Vendas', valor: 39000, data: '2026-05-30', status: 'Pago', vendaId: 102 },
    { id: 204, descricao: 'Aporte - Socios', tipo: 'Entrada', categoria: 'Aportes', valor: 60000, data: '2026-05-05', status: 'Realizado', origem: 'aporte', origemId: 401, aporteId: 401 }
  ];

  DB.cartoes = [
    {
      id: 301,
      nome: 'Cartao Operacional',
      bandeira: 'Visa',
      banco: 'Banco Principal',
      responsavel: 'Administrativo',
      limiteTotal: 25000,
      melhorDiaCompra: 9,
      diaFechamento: 25,
      diaVencimento: 8,
      status: 'Ativo',
      obs: 'Uso administrativo'
    }
  ];

  DB.cartaoCompras = [
    {
      id: 601,
      cartaoId: 301,
      dataCompra: '2026-05-18',
      descricao: 'Campanhas de trafego pago',
      categoria: 'Marketing',
      valor: 4200,
      parcelas: 1,
      parcelaAtual: 1,
      obs: 'Captacao de leads'
    }
  ];

  DB.cartaoFaturas = [];

  DB.aportes = [
    {
      id: 401,
      investidor: 'Socios',
      tipoAporte: 'Aporte',
      origem: 'Capital proprio',
      valor: 60000,
      data: '2026-05-05',
      status: 'Realizado',
      formaPagamento: 'Transferencia',
      contaUtilizada: 'Conta empresarial',
      fluxoId: 204,
      obs: 'Reserva de caixa'
    }
  ];

  DB.cp = [
    {
      id: 501,
      fornecedor: 'Software e ferramentas',
      categoria: 'Operacional',
      valor: 1200,
      vencimento: '2026-06-02',
      status: 'Pendente',
      pago: false,
      dataPagamento: '',
      valorPago: 0,
      formaPagamento: '',
      contaUtilizada: '',
      fluxoId: null,
      obs: 'Renovacao mensal'
    }
  ];

  persist();
}

setInterval(backupERP, 30000);

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function extractDay(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.getDate();
}

function migrateVendaStatus(status) {
  const map = {
    Novo: 'Em negociacao',
    'Em analise': 'Aprovacao de credito',
    'Em análise': 'Aprovacao de credito',
    'Em andamento': 'Conformidade',
    Ganho: 'Concluido',
    Perdido: 'Em negociacao'
  };

  return map[status] || status || 'Em negociacao';
}

function normalizeAporteType(origem = '') {
  const text = String(origem).toLowerCase();
  if (text.includes('emprest')) return 'Emprestimo recebido';
  if (text.includes('adiant')) return 'Adiantamento pago para corretor';
  return 'Aporte';
}
