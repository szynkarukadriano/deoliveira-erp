export const resources = {
  vendas: {
    title: 'Venda',
    plural: 'Vendas',
    searchFields: ['cliente', 'empreend', 'corretor', 'status', 'dataVenda', 'dataRecebimento'],
    dateField: 'dataVenda',
    dateLabel: 'Data da Venda',
    moneyField: 'valor',
    fields: [
      { name: 'dataVenda', label: 'Data da Venda', type: 'date', required: true },
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
      { name: 'dtPrev', label: 'Data prevista da comissão', type: 'date' },
      { name: 'dataRecebimento', label: 'Data de recebimento da comissão', type: 'date', readonly: true },
      { name: 'obs', label: 'Observacoes', type: 'textarea', full: true }
    ],
    columns: [
      { key: 'dataVenda', label: 'Data da Venda', format: 'date' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'empreend', label: 'Empreendimento' },
      { key: 'corretor', label: 'Corretor' },
      { key: 'valor', label: 'Valor imovel', format: 'currency' },
      { key: 'comissaoImobiliariaValor', label: 'Comissao recebida', format: 'currency' },
      { key: 'comissaoCorretorValor', label: 'Corretor', format: 'currency' },
      { key: 'caixaEmpresa', label: 'Caixa empresa', format: 'currency' },
      { key: 'recebimentoStatus', label: 'Recebimento', format: 'badge' },
      { key: 'dataRecebimento', label: 'Data de recebimento da comissão', format: 'date' },
      { key: 'status', label: 'Status', format: 'badge' },
      { key: 'dtPrev', label: 'Data prevista da comissão', format: 'date' }
    ]
  },
  fluxo: {
    title: 'Lancamento',
    plural: 'Fluxo',
    searchFields: ['descricao', 'tipo', 'categoria', 'formaPagamento', 'contaUtilizada', 'status'],
    dateField: 'data',
    moneyField: 'valor',
    fields: [
      { name: 'descricao', label: 'Descricao', type: 'text', required: true },
      { name: 'tipo', label: 'Tipo', type: 'select', options: ['Entrada', 'Saida'], required: true },
      { name: 'categoria', label: 'Categoria', type: 'text' },
      { name: 'valor', label: 'Valor', type: 'number', required: true },
      { name: 'data', label: 'Data', type: 'date' },
      { name: 'formaPagamento', label: 'Forma de pagamento', type: 'select', options: ['Pix', 'Transferencia', 'Dinheiro', 'Cartao', 'Boleto', 'Debito automatico', 'Outro'] },
      { name: 'contaUtilizada', label: 'Conta utilizada', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: ['Pendente', 'Pago'], required: true }
    ],
    columns: [
      { key: 'descricao', label: 'Descricao' },
      { key: 'tipo', label: 'Tipo', format: 'badge' },
      { key: 'categoria', label: 'Categoria' },
      { key: 'valor', label: 'Valor', format: 'currency' },
      { key: 'data', label: 'Data', format: 'date' },
      { key: 'formaPagamento', label: 'Forma pagamento' },
      { key: 'contaUtilizada', label: 'Conta utilizada' },
      { key: 'status', label: 'Status', format: 'badge' }
    ]
  },
  cartoes: {
    title: 'Cartao',
    plural: 'Cartoes',
    searchFields: ['nome', 'bandeira', 'banco', 'responsavel', 'status'],
    dateField: 'vencimento',
    moneyField: 'limiteTotal',
    fields: [
      { name: 'nome', label: 'Nome do cartao', type: 'text', required: true },
      { name: 'bandeira', label: 'Bandeira', type: 'text' },
      { name: 'banco', label: 'Banco', type: 'text' },
      { name: 'responsavel', label: 'Responsavel', type: 'text' },
      { name: 'limiteTotal', label: 'Limite total', type: 'number' },
      { name: 'melhorDiaCompra', label: 'Melhor dia de compra', type: 'number' },
      { name: 'diaFechamento', label: 'Dia de fechamento da fatura', type: 'number' },
      { name: 'diaVencimento', label: 'Dia de vencimento da fatura', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['Ativo', 'Inativo'], required: true },
      { name: 'obs', label: 'Observacoes', type: 'textarea', full: true }
    ],
    columns: [
      { key: 'nome', label: 'Nome' },
      { key: 'bandeira', label: 'Bandeira' },
      { key: 'banco', label: 'Banco' },
      { key: 'responsavel', label: 'Responsavel' },
      { key: 'limiteTotal', label: 'Limite', format: 'currency' },
      { key: 'diaFechamento', label: 'Fechamento' },
      { key: 'diaVencimento', label: 'Vencimento' },
      { key: 'status', label: 'Status', format: 'badge' }
    ]
  },
  aportes: {
    title: 'Aporte',
    plural: 'Aportes e Emprestimos',
    searchFields: ['investidor', 'tipoAporte', 'origem', 'status'],
    dateField: 'data',
    moneyField: 'valor',
    fields: [
      { name: 'investidor', label: 'Investidor', type: 'text', required: true },
      { name: 'tipoAporte', label: 'Tipo', type: 'select', options: ['Aporte', 'Emprestimo recebido', 'Adiantamento pago para corretor'], required: true },
      { name: 'origem', label: 'Origem', type: 'text' },
      { name: 'valor', label: 'Valor', type: 'number', required: true },
      { name: 'data', label: 'Data', type: 'date' },
      { name: 'formaPagamento', label: 'Forma de pagamento', type: 'select', options: ['Pix', 'Transferencia', 'Dinheiro', 'Cartao', 'Boleto', 'Debito automatico', 'Outro'] },
      { name: 'contaUtilizada', label: 'Conta utilizada', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: ['Pendente', 'Realizado', 'Cancelado'], required: true },
      { name: 'obs', label: 'Observacoes', type: 'textarea', full: true }
    ],
    columns: [
      { key: 'investidor', label: 'Investidor' },
      { key: 'tipoAporte', label: 'Tipo' },
      { key: 'origem', label: 'Origem' },
      { key: 'valor', label: 'Valor', format: 'currency' },
      { key: 'data', label: 'Data', format: 'date' },
      { key: 'status', label: 'Status', format: 'badge' }
    ]
  },
  cp: {
    title: 'Conta a pagar',
    plural: 'Contas a Pagar',
    searchFields: ['fornecedor', 'categoria', 'formaPagamento', 'contaUtilizada', 'status'],
    dateField: 'vencimento',
    moneyField: 'valor',
    fields: [
      { name: 'fornecedor', label: 'Fornecedor', type: 'text', required: true },
      { name: 'categoria', label: 'Categoria', type: 'text' },
      { name: 'valor', label: 'Valor', type: 'number', required: true },
      { name: 'vencimento', label: 'Vencimento', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: ['Pendente', 'Pago', 'Atrasado'], required: true },
      { name: 'formaPagamento', label: 'Forma de pagamento', type: 'select', options: ['Pix', 'Transferencia', 'Dinheiro', 'Cartao', 'Boleto', 'Debito automatico', 'Outro'] },
      { name: 'dataPagamento', label: 'Data de pagamento', type: 'date' },
      { name: 'contaUtilizada', label: 'Conta utilizada', type: 'text' },
      { name: 'obs', label: 'Observacoes', type: 'textarea', full: true }
    ],
    columns: [
      { key: 'fornecedor', label: 'Fornecedor' },
      { key: 'categoria', label: 'Categoria' },
      { key: 'valor', label: 'Valor', format: 'currency' },
      { key: 'vencimento', label: 'Vencimento', format: 'date' },
      { key: 'dataPagamento', label: 'Pago em', format: 'date' },
      { key: 'formaPagamento', label: 'Forma pagamento' },
      { key: 'contaUtilizada', label: 'Conta utilizada' },
      { key: 'status', label: 'Status', format: 'badge' }
    ]
  }
};
