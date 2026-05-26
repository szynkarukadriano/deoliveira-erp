export const resources = {
  vendas: {
    title: 'Venda',
    plural: 'Vendas',
    searchFields: ['cliente', 'empreend', 'corretor', 'status'],
    dateField: 'dtPrev',
    moneyField: 'valor',
    fields: [
      { name: 'cliente', label: 'Cliente', type: 'text', required: true },
      { name: 'empreend', label: 'Empreendimento', type: 'text', required: true },
      { name: 'corretor', label: 'Corretor', type: 'text' },
      { name: 'valor', label: 'Valor do imovel', type: 'number', required: true },
      { name: 'comissaoImobiliariaPct', label: 'Comissao imobiliaria (%)', type: 'number' },
      { name: 'comissaoImobiliariaValor', label: 'Comissao recebida (R$)', type: 'number', readonly: true },
      { name: 'comissaoCorretorPct', label: 'Comissao corretor sobre imovel (%)', type: 'number' },
      { name: 'comissaoCorretorValor', label: 'Comissao corretor (R$)', type: 'number', readonly: true },
      { name: 'custosEncaminhados', label: 'Custos encaminhados', type: 'number' },
      { name: 'impostosGuias', label: 'Impostos e guias', type: 'number' },
      { name: 'caixaEmpresa', label: 'Valor para caixa da empresa', type: 'number', readonly: true },
      { name: 'status', label: 'Status', type: 'select', options: ['Em negociacao', 'Aprovacao de credito', 'Conformidade', 'Assinatura Caixa', 'Registro de imoveis', 'Concluido'], required: true },
      { name: 'dtPrev', label: 'Data prevista', type: 'date' },
      { name: 'obs', label: 'Observacoes', type: 'textarea', full: true }
    ],
    columns: [
      { key: 'cliente', label: 'Cliente' },
      { key: 'empreend', label: 'Empreendimento' },
      { key: 'corretor', label: 'Corretor' },
      { key: 'valor', label: 'Valor imovel', format: 'currency' },
      { key: 'comissaoImobiliariaValor', label: 'Comissao recebida', format: 'currency' },
      { key: 'comissaoCorretorValor', label: 'Corretor', format: 'currency' },
      { key: 'caixaEmpresa', label: 'Caixa empresa', format: 'currency' },
      { key: 'recebimentoStatus', label: 'Recebimento', format: 'badge' },
      { key: 'dataRecebimento', label: 'Recebido em', format: 'date' },
      { key: 'status', label: 'Status', format: 'badge' },
      { key: 'dtPrev', label: 'Previsto', format: 'date' }
    ]
  },
  fluxo: {
    title: 'Lancamento',
    plural: 'Fluxo',
    searchFields: ['descricao', 'tipo', 'categoria', 'status'],
    dateField: 'data',
    moneyField: 'valor',
    fields: [
      { name: 'descricao', label: 'Descricao', type: 'text', required: true },
      { name: 'tipo', label: 'Tipo', type: 'select', options: ['Entrada', 'Saida'], required: true },
      { name: 'categoria', label: 'Categoria', type: 'text' },
      { name: 'valor', label: 'Valor', type: 'number', required: true },
      { name: 'data', label: 'Data', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: ['Pendente', 'Pago'], required: true }
    ],
    columns: [
      { key: 'descricao', label: 'Descricao' },
      { key: 'tipo', label: 'Tipo', format: 'badge' },
      { key: 'categoria', label: 'Categoria' },
      { key: 'valor', label: 'Valor', format: 'currency' },
      { key: 'data', label: 'Data', format: 'date' },
      { key: 'status', label: 'Status', format: 'badge' }
    ]
  },
  cartoes: {
    title: 'Cartao',
    plural: 'Cartoes',
    searchFields: ['nome', 'bandeira', 'categoriaGasto', 'descricaoGasto', 'status'],
    dateField: 'vencimento',
    moneyField: 'limite',
    fields: [
      { name: 'nome', label: 'Nome', type: 'text', required: true },
      { name: 'bandeira', label: 'Bandeira', type: 'text' },
      { name: 'limite', label: 'Limite', type: 'number' },
      { name: 'valorGasto', label: 'Valor gasto', type: 'number' },
      { name: 'categoriaGasto', label: 'Categoria do gasto', type: 'text' },
      { name: 'descricaoGasto', label: 'No que foi gasto', type: 'textarea', full: true },
      { name: 'vencimento', label: 'Vencimento', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: ['Ativo', 'Inativo', 'Bloqueado'], required: true },
      { name: 'obs', label: 'Observacoes', type: 'textarea', full: true }
    ],
    columns: [
      { key: 'nome', label: 'Nome' },
      { key: 'bandeira', label: 'Bandeira' },
      { key: 'limite', label: 'Limite', format: 'currency' },
      { key: 'valorGasto', label: 'Gasto', format: 'currency' },
      { key: 'categoriaGasto', label: 'Categoria' },
      { key: 'descricaoGasto', label: 'No que foi gasto' },
      { key: 'vencimento', label: 'Vencimento', format: 'date' },
      { key: 'status', label: 'Status', format: 'badge' }
    ]
  },
  aportes: {
    title: 'Aporte',
    plural: 'Aportes',
    searchFields: ['investidor', 'origem', 'status'],
    dateField: 'data',
    moneyField: 'valor',
    fields: [
      { name: 'investidor', label: 'Investidor', type: 'text', required: true },
      { name: 'origem', label: 'Origem', type: 'text' },
      { name: 'valor', label: 'Valor', type: 'number', required: true },
      { name: 'data', label: 'Data', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: ['Pendente', 'Confirmado', 'Cancelado'], required: true },
      { name: 'obs', label: 'Observacoes', type: 'textarea', full: true }
    ],
    columns: [
      { key: 'investidor', label: 'Investidor' },
      { key: 'origem', label: 'Origem' },
      { key: 'valor', label: 'Valor', format: 'currency' },
      { key: 'data', label: 'Data', format: 'date' },
      { key: 'status', label: 'Status', format: 'badge' }
    ]
  },
  cp: {
    title: 'Conta a pagar',
    plural: 'Contas a Pagar',
    searchFields: ['fornecedor', 'categoria', 'status'],
    dateField: 'vencimento',
    moneyField: 'valor',
    fields: [
      { name: 'fornecedor', label: 'Fornecedor', type: 'text', required: true },
      { name: 'categoria', label: 'Categoria', type: 'text' },
      { name: 'valor', label: 'Valor', type: 'number', required: true },
      { name: 'vencimento', label: 'Vencimento', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: ['Pendente', 'Pago', 'Atrasado'], required: true },
      { name: 'obs', label: 'Observacoes', type: 'textarea', full: true }
    ],
    columns: [
      { key: 'fornecedor', label: 'Fornecedor' },
      { key: 'categoria', label: 'Categoria' },
      { key: 'valor', label: 'Valor', format: 'currency' },
      { key: 'vencimento', label: 'Vencimento', format: 'date' },
      { key: 'dataPagamento', label: 'Pago em', format: 'date' },
      { key: 'status', label: 'Status', format: 'badge' }
    ]
  }
};
