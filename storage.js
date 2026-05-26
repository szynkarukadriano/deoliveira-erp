export const STORAGE_KEY = 'deoliveira_erp_v2';
export const BACKUP_KEY = 'backup_deoliveira';

const fallbackDB = {
  vendas: [],
  fluxo: [],
  cartoes: [],
  aportes: [],
  cp: []
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
    valorGasto: Number(cartao.valorGasto || 0),
    categoriaGasto: cartao.categoriaGasto || '',
    descricaoGasto: cartao.descricaoGasto || ''
  }));

  db.cp = db.cp.map(conta => ({
    ...conta,
    pago: conta.pago ?? conta.status === 'Pago',
    dataPagamento: conta.dataPagamento || '',
    valorPago: Number(conta.valorPago || 0),
    fluxoId: conta.fluxoId || null
  }));

  return db;
}

export function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
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
}

export function remove(collection, id) {
  DB[collection] = DB[collection].filter(record => record.id !== id);
  persist();
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
    { id: 202, descricao: 'Tráfego pago', tipo: 'Saída', categoria: 'Marketing', valor: 4200, data: '2026-05-18', status: 'Pago' },
    { id: 203, descricao: 'Comissao imobiliaria recebida - Rafael Lima / Jardins Office', tipo: 'Entrada', categoria: 'Vendas', valor: 39000, data: '2026-05-30', status: 'Pago', vendaId: 102 }
  ];

  DB.cartoes = [
    {
      id: 301,
      nome: 'Cartao Operacional',
      bandeira: 'Visa',
      limite: 25000,
      valorGasto: 4200,
      categoriaGasto: 'Marketing',
      descricaoGasto: 'Campanhas de trafego pago para captacao de leads',
      vencimento: '2026-06-08',
      status: 'Ativo',
      obs: 'Uso administrativo'
    }
  ];

  DB.aportes = [
    { id: 401, investidor: 'Sócios', origem: 'Capital próprio', valor: 60000, data: '2026-05-05', status: 'Confirmado', obs: 'Reserva de caixa' }
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
