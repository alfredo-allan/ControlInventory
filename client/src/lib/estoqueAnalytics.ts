// Funções puras de análise do módulo de Estoque: giro, sugestão de pedido,
// urgência e perdas. Tudo calculado na hora a partir de `movimentacoes` —
// nada de relatório pré-pronto guardado (evita número derivado ficando
// desatualizado quando entra uma movimentação nova).

import type { Movimentacao } from './estoqueStorage'
import { CONFIGURACAO_PADRAO } from './estoqueStorage'

function filtrarMovimentacoesJanela(
  movimentacoes: Movimentacao[],
  opts: { mercadoId?: string; codigoEAN?: string; diasJanela: number; diasOffset?: number }
): Movimentacao[] {
  const offsetMs = (opts.diasOffset ?? 0) * 86400000
  const fim = Date.now() - offsetMs
  const inicio = fim - opts.diasJanela * 86400000

  return movimentacoes.filter((m) => {
    if (opts.mercadoId && m.mercadoId !== opts.mercadoId) return false
    if (opts.codigoEAN && m.codigoEAN !== opts.codigoEAN) return false
    const t = new Date(m.data).getTime()
    return t >= inicio && t < fim
  })
}

// Taxa média de saída por dia, considerando só saídas motivo="venda" — avaria
// e vencimento não são demanda real, não devem inflar a sugestão de pedido.
export function calcularTaxaDiaria(
  movimentacoes: Movimentacao[],
  params: { mercadoId: string; codigoEAN: string; diasJanela?: number; diasOffset?: number }
): number {
  const diasJanela = params.diasJanela ?? 14
  const relevantes = filtrarMovimentacoesJanela(movimentacoes, {
    mercadoId: params.mercadoId,
    codigoEAN: params.codigoEAN,
    diasJanela,
    diasOffset: params.diasOffset
  }).filter((m) => m.tipo === 'saida' && m.motivo === 'venda')

  const total = relevantes.reduce((soma, m) => soma + m.quantidade, 0)
  return total / diasJanela
}

export type Urgencia = 'critico' | 'atencao' | 'ok'
export type Tendencia = 'subindo' | 'estavel' | 'caindo'

export interface ResultadoSugestao {
  taxaDiaria: number
  diasDeCobertura: number
  sugestaoPedido: number
  urgencia: Urgencia
  tendencia: Tendencia
}

// Modelo clássico de ponto de pedido (reorder point), com uma trava extra
// específica pra perecível: nunca sugerir mais do que o produto consegue
// vender antes de vencer (senão o algoritmo empurraria mais vencimento, que é
// exatamente o problema que o módulo existe pra reduzir).
export function calcularSugestao(params: {
  quantidadeAtual: number
  taxaDiaria: number
  taxaDiariaSemanaAnterior: number
  validadeMediaDias: number
  leadTimeDias?: number
  diasAteProximaPesquisa?: number
}): ResultadoSugestao {
  const leadTimeDias = params.leadTimeDias ?? CONFIGURACAO_PADRAO.leadTimeDiasPadrao
  const diasAteProximaPesquisa = params.diasAteProximaPesquisa ?? CONFIGURACAO_PADRAO.diasAtePesquisaPadrao
  const { taxaDiaria, quantidadeAtual, validadeMediaDias } = params

  if (taxaDiaria <= 0) {
    // sem saída registrada ainda — não há base estatística pra sugerir nada
    return { taxaDiaria: 0, diasDeCobertura: Infinity, sugestaoPedido: 0, urgencia: 'ok', tendencia: 'estavel' }
  }

  const estoqueSeguranca = taxaDiaria * leadTimeDias
  const pontoDePedido = estoqueSeguranca + taxaDiaria * diasAteProximaPesquisa
  let sugestaoPedido = Math.max(0, pontoDePedido - quantidadeAtual)

  const tetoPorValidade = Math.max(0, taxaDiaria * validadeMediaDias - quantidadeAtual)
  sugestaoPedido = Math.round(Math.min(sugestaoPedido, tetoPorValidade))

  const diasDeCobertura = quantidadeAtual / taxaDiaria

  const urgencia: Urgencia =
    diasDeCobertura < leadTimeDias ? 'critico' : diasDeCobertura < leadTimeDias + 3 ? 'atencao' : 'ok'

  const variacao =
    params.taxaDiariaSemanaAnterior > 0 ? (taxaDiaria - params.taxaDiariaSemanaAnterior) / params.taxaDiariaSemanaAnterior : 0
  const tendencia: Tendencia = variacao > 0.15 ? 'subindo' : variacao < -0.15 ? 'caindo' : 'estavel'

  return { taxaDiaria, diasDeCobertura, sugestaoPedido, urgencia, tendencia }
}

// Calcula taxa diária atual + a da janela anterior (pra tendência) numa
// chamada só — evitar repetir a lógica de offset em cada tela.
export function calcularSugestaoCompleta(
  movimentacoes: Movimentacao[],
  params: {
    mercadoId: string
    codigoEAN: string
    quantidadeAtual: number
    validadeMediaDias: number
    diasJanela?: number
    leadTimeDias?: number
    diasAteProximaPesquisa?: number
  }
): ResultadoSugestao {
  const diasJanela = params.diasJanela ?? 14

  const taxaDiaria = calcularTaxaDiaria(movimentacoes, {
    mercadoId: params.mercadoId,
    codigoEAN: params.codigoEAN,
    diasJanela
  })

  const taxaDiariaSemanaAnterior = calcularTaxaDiaria(movimentacoes, {
    mercadoId: params.mercadoId,
    codigoEAN: params.codigoEAN,
    diasJanela,
    diasOffset: diasJanela
  })

  return calcularSugestao({
    quantidadeAtual: params.quantidadeAtual,
    taxaDiaria,
    taxaDiariaSemanaAnterior,
    validadeMediaDias: params.validadeMediaDias,
    leadTimeDias: params.leadTimeDias,
    diasAteProximaPesquisa: params.diasAteProximaPesquisa
  })
}

export interface ResumoPerdas {
  avaria: number
  vencimento: number
  totalPerdas: number
  totalSaidas: number
  percentual: number
}

export function calcularResumoPerdas(
  movimentacoes: Movimentacao[],
  opts: { mercadoId?: string; diasJanela: number }
): ResumoPerdas {
  const todasSaidasNoPeriodo = filtrarMovimentacoesJanela(movimentacoes, {
    mercadoId: opts.mercadoId,
    diasJanela: opts.diasJanela
  }).filter((m) => m.tipo === 'saida')

  const avaria = todasSaidasNoPeriodo.filter((m) => m.motivo === 'avaria').reduce((s, m) => s + m.quantidade, 0)
  const vencimento = todasSaidasNoPeriodo.filter((m) => m.motivo === 'vencimento').reduce((s, m) => s + m.quantidade, 0)
  const totalSaidas = todasSaidasNoPeriodo.reduce((s, m) => s + m.quantidade, 0)
  const totalPerdas = avaria + vencimento
  const percentual = totalSaidas > 0 ? (totalPerdas / totalSaidas) * 100 : 0

  return { avaria, vencimento, totalPerdas, totalSaidas, percentual }
}

// Série diária de saídas de um produto, pro mini-gráfico de histórico
// (drill-down no painel de sugestão). Sempre retorna `dias` pontos, com 0
// nos dias sem movimentação — assim o gráfico não "pula".
export function serieDiariaDeSaidas(
  movimentacoes: Movimentacao[],
  params: { mercadoId: string; codigoEAN: string; dias: number }
): { data: string; quantidade: number }[] {
  const pontos: { data: string; quantidade: number }[] = []

  for (let i = params.dias - 1; i >= 0; i--) {
    const dia = new Date()
    dia.setHours(0, 0, 0, 0)
    dia.setDate(dia.getDate() - i)
    const proximoDia = new Date(dia)
    proximoDia.setDate(proximoDia.getDate() + 1)

    const quantidade = movimentacoes
      .filter((m) => m.mercadoId === params.mercadoId && m.codigoEAN === params.codigoEAN && m.tipo === 'saida' && m.motivo === 'venda')
      .filter((m) => {
        const t = new Date(m.data).getTime()
        return t >= dia.getTime() && t < proximoDia.getTime()
      })
      .reduce((s, m) => s + m.quantidade, 0)

    pontos.push({ data: dia.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), quantidade })
  }

  return pontos
}
