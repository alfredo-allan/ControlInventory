// Módulo de Estoque / Pesquisa Semanal / Sugestão de Pedido.
//
// v2 (2026-10-07): catálogo de produtos DESACOPLADO de mercado. Antes, cada
// produto nascia "dentro" de um mercado (no frutap.json e no estoque vivo),
// o que significava que um produto só aparecia pra contagem/lançamento nos
// mercados onde alguém tinha digitado ele manualmente — mesmo vendendo em
// vários pontos de venda. Agora: `produtos` é um catálogo global único
// (por EAN); `mercados` é só nome/endereço, sem produtos embutidos;
// `estoquePorMercado` é o único lugar onde produto e mercado se encontram,
// e é esparso — um mercado só ganha uma entrada ali quando alguém de fato
// contou ou lançou aquele produto nele. Isso faz TODO produto do catálogo
// ficar disponível pra QUALQUER mercado na hora de contar/lançar.
//
// Decisão de arquitetura (doc do projeto "arquitetura-modulo-estoque.md"):
// sem backend disponível, a persistência "viva" é localStorage — o
// `frutap.json` estático continua sendo só o seed inicial do catálogo e dos
// mercados. O botão de exportar gera um .json de verdade pra backup.

import dataFrutap from '../data/frutap.json'

const STORAGE_KEY = 'estoque-data'
const CONFIG_KEY = 'estoque-config'
export const EMPRESA_PADRAO = 'frutap'
const SCHEMA_VERSION = 2 as const

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface EnderecoEstoque {
  rua: string
  bairro: string
  cidade: string
  estado: string
}

// Catálogo global — um produto só tem um registro, nunca duplicado por mercado.
export interface CatalogoProduto {
  descricao: string
  marca: string
  categoria: string
  unidade: 'unidade' | 'caixa'
  validadeMediaDias: number
}

export interface MercadoCadastro {
  nome: string
  endereco: EnderecoEstoque
}

export interface SaldoEstoque {
  quantidadeAtual: number
  quantidadeMinima: number
  atualizadoEm: string
}

// View "achatada" (catálogo + saldo do mercado) que as telas consomem — é
// calculada na hora por `listarProdutos`, nunca guardada assim.
export interface EstoqueProduto extends CatalogoProduto {
  estoque: SaldoEstoque
}

export type TipoMovimentacao = 'entrada' | 'saida'
export type MotivoMovimentacao = 'venda' | 'avaria' | 'vencimento' | 'ajuste'

export interface Movimentacao {
  id: string
  mercadoId: string
  codigoEAN: string
  tipo: TipoMovimentacao
  motivo: MotivoMovimentacao
  quantidade: number
  operador: string
  data: string // ISO datetime
  cicloId: string // ISO week, ex: "2026-W41"
}

export interface PesquisaSemanalItem {
  codigoEAN: string
  quantidadeEsperada: number
  quantidadeContada: number
  divergencia: number
}

export interface PesquisaSemanal {
  id: string
  cicloId: string
  mercadoId: string
  operador: string
  fechadaEm: string
  itens: PesquisaSemanalItem[]
}

export interface EmpresaEstoque {
  nome: string
  produtos: Record<string, CatalogoProduto> // chave = codigoEAN — catálogo global
  mercados: Record<string, MercadoCadastro> // chave = mercadoId (slug)
  estoquePorMercado: Record<string, Record<string, SaldoEstoque>> // [mercadoId][codigoEAN]
  movimentacoes: Movimentacao[]
  pesquisasSemanais: PesquisaSemanal[]
}

export interface EstoqueData {
  schemaVersion: typeof SCHEMA_VERSION
  empresas: Record<string, EmpresaEstoque>
}

export interface ConfiguracaoEstoque {
  leadTimeDiasPadrao: number
  validadeMediaDiasPadrao: number
  diasAtePesquisaPadrao: number
}

export const CONFIGURACAO_PADRAO: ConfiguracaoEstoque = {
  leadTimeDiasPadrao: 2,
  validadeMediaDiasPadrao: 15,
  diasAtePesquisaPadrao: 7
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// Semana ISO-8601 (segunda a domingo) — determinística e ordenável como string.
export function getCicloIdAtual(data: Date = new Date()): string {
  const d = new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()))
  const diaDaSemana = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - diaDaSemana)
  const inicioDoAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const numeroDaSemana = Math.ceil(((d.getTime() - inicioDoAno.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(numeroDaSemana).padStart(2, '0')}`
}

// Formato do frutap.json a partir da v2: produtos e mercados já desacoplados.
interface FrutapJsonV2 {
  produtos: Record<string, { descricao: string; marca?: string; categoria?: string; unidade?: string; validadeMediaDias?: number }>
  mercados: Record<string, { nome: string; endereco: EnderecoEstoque }>
}

const frutapCatalogo = dataFrutap as unknown as FrutapJsonV2

// ---------------------------------------------------------------------------
// Seed / merge do catálogo estático -> estoque "vivo" (aditivo + sincroniza
// campos vindos do arquivo, nunca mexe em saldo/quantidade)
// ---------------------------------------------------------------------------

function criarEmpresaVazia(nome: string): EmpresaEstoque {
  return { nome, produtos: {}, mercados: {}, estoquePorMercado: {}, movimentacoes: [], pesquisasSemanais: [] }
}

function seedEmpresaFrutap(data: EstoqueData): boolean {
  let alterou = false
  const empresa = data.empresas[EMPRESA_PADRAO] ?? criarEmpresaVazia('Frutap')
  if (!data.empresas[EMPRESA_PADRAO]) alterou = true

  // Catálogo: produtos que já vêm do arquivo são a fonte de verdade pra
  // descrição/marca/categoria/unidade (sincroniza se o .json mudar); produtos
  // cadastrados só dentro do app (não existem no arquivo) ficam intocados.
  for (const [ean, produtoCatalogo] of Object.entries(frutapCatalogo.produtos)) {
    const existente = empresa.produtos[ean]
    const novo: CatalogoProduto = {
      descricao: produtoCatalogo.descricao,
      marca: produtoCatalogo.marca ?? 'Frutap',
      categoria: produtoCatalogo.categoria ?? '',
      unidade: (produtoCatalogo.unidade as CatalogoProduto['unidade']) ?? 'unidade',
      // validadeMediaDias: preserva valor já ajustado no app, se existir
      validadeMediaDias: existente?.validadeMediaDias ?? produtoCatalogo.validadeMediaDias ?? CONFIGURACAO_PADRAO.validadeMediaDiasPadrao
    }
    if (!existente || JSON.stringify(existente) !== JSON.stringify(novo)) {
      empresa.produtos[ean] = novo
      alterou = true
    }
  }

  // Mercados: idem, nome/endereço sincronizam com o arquivo; mercados criados
  // ad-hoc no app (Setup Rápido/Pesquisa Semanal) não estão no arquivo e ficam como estão.
  for (const [mercadoId, mercadoCatalogo] of Object.entries(frutapCatalogo.mercados)) {
    const existente = empresa.mercados[mercadoId]
    if (!existente || existente.nome !== mercadoCatalogo.nome || JSON.stringify(existente.endereco) !== JSON.stringify(mercadoCatalogo.endereco)) {
      empresa.mercados[mercadoId] = { nome: mercadoCatalogo.nome, endereco: mercadoCatalogo.endereco }
      alterou = true
    }
  }

  data.empresas[EMPRESA_PADRAO] = empresa
  return alterou
}

// ---------------------------------------------------------------------------
// Migração do schema v1 (produtos aninhados dentro de cada mercado) -> v2
// ---------------------------------------------------------------------------

interface MercadoEstoqueV1 {
  nome: string
  endereco: EnderecoEstoque
  produtos: Record<string, { descricao: string; unidade: string; validadeMediaDias: number; estoque: SaldoEstoque }>
}

interface EmpresaEstoqueV1 {
  nome: string
  mercados: Record<string, MercadoEstoqueV1>
  movimentacoes: Movimentacao[]
  pesquisasSemanais: PesquisaSemanal[]
}

function pareceV1(empresa: unknown): empresa is EmpresaEstoqueV1 {
  if (!empresa || typeof empresa !== 'object') return false
  const mercados = (empresa as EmpresaEstoqueV1).mercados
  if (!mercados) return false
  return Object.values(mercados).some((m) => m && typeof m === 'object' && 'produtos' in m)
}

// Migra sem perder nada: movimentações e pesquisas semanais já referenciavam
// só {mercadoId, codigoEAN}, então passam direto. Só o "estado atual" (saldo,
// que morava dentro do mercado) muda de lugar.
function migrarEmpresaV1ParaV2(empresaV1: EmpresaEstoqueV1): EmpresaEstoque {
  const empresaV2 = criarEmpresaVazia(empresaV1.nome)
  empresaV2.movimentacoes = empresaV1.movimentacoes
  empresaV2.pesquisasSemanais = empresaV1.pesquisasSemanais

  for (const [mercadoId, mercadoV1] of Object.entries(empresaV1.mercados)) {
    empresaV2.mercados[mercadoId] = { nome: mercadoV1.nome, endereco: mercadoV1.endereco }
    empresaV2.estoquePorMercado[mercadoId] = {}

    for (const [ean, produtoV1] of Object.entries(mercadoV1.produtos ?? {})) {
      if (!empresaV2.produtos[ean]) {
        empresaV2.produtos[ean] = {
          descricao: produtoV1.descricao,
          marca: 'Frutap',
          categoria: '',
          unidade: (produtoV1.unidade as CatalogoProduto['unidade']) ?? 'unidade',
          validadeMediaDias: produtoV1.validadeMediaDias ?? CONFIGURACAO_PADRAO.validadeMediaDiasPadrao
        }
      }
      empresaV2.estoquePorMercado[mercadoId][ean] = produtoV1.estoque
    }
  }

  return empresaV2
}

function migrarSeNecessario(data: EstoqueData): boolean {
  let alterou = false
  for (const [empresaId, empresa] of Object.entries(data.empresas)) {
    if (pareceV1(empresa)) {
      data.empresas[empresaId] = migrarEmpresaV1ParaV2(empresa as unknown as EmpresaEstoqueV1)
      alterou = true
    }
  }
  if (data.schemaVersion !== SCHEMA_VERSION) {
    data.schemaVersion = SCHEMA_VERSION
    alterou = true
  }
  return alterou
}

// ---------------------------------------------------------------------------
// Leitura / escrita
// ---------------------------------------------------------------------------

function lerDataBruta(): EstoqueData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { schemaVersion: SCHEMA_VERSION, empresas: {} }
    const parsed = JSON.parse(raw) as EstoqueData
    if (!parsed.empresas) return { schemaVersion: SCHEMA_VERSION, empresas: {} }
    return parsed
  } catch (error) {
    console.warn('Erro ao ler estoque-data, reiniciando:', error)
    return { schemaVersion: SCHEMA_VERSION, empresas: {} }
  }
}

function salvarDataBruta(data: EstoqueData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function getEstoqueData(): EstoqueData {
  const data = lerDataBruta()
  const migrou = migrarSeNecessario(data)
  const seedAlterou = seedEmpresaFrutap(data)
  if (migrou || seedAlterou) salvarDataBruta(data)
  return data
}

export function getConfiguracao(): ConfiguracaoEstoque {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return CONFIGURACAO_PADRAO
    return { ...CONFIGURACAO_PADRAO, ...JSON.parse(raw) }
  } catch {
    return CONFIGURACAO_PADRAO
  }
}

export function salvarConfiguracao(config: ConfiguracaoEstoque): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export function listarMercados(empresaId = EMPRESA_PADRAO): { id: string; nome: string }[] {
  const empresa = getEstoqueData().empresas[empresaId]
  if (!empresa) return []
  return Object.entries(empresa.mercados)
    .map(([id, mercado]) => ({ id, nome: mercado.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}

export function getMercado(mercadoId: string, empresaId = EMPRESA_PADRAO): MercadoCadastro | null {
  return getEstoqueData().empresas[empresaId]?.mercados[mercadoId] ?? null
}

// Catálogo completo (sem saldo) — usado na busca de "adicionar produto".
export function listarCatalogo(empresaId = EMPRESA_PADRAO): { codigoEAN: string; produto: CatalogoProduto }[] {
  const empresa = getEstoqueData().empresas[empresaId]
  if (!empresa) return []
  return Object.entries(empresa.produtos)
    .map(([codigoEAN, produto]) => ({ codigoEAN, produto }))
    .sort((a, b) => a.produto.descricao.localeCompare(b.produto.descricao))
}

// TODO o catálogo global, com o saldo daquele mercado específico (0 se nunca
// foi contado/lançado ali) — é isso que faz qualquer produto aparecer pra
// qualquer mercado, resolvendo o travamento que a v1 tinha.
export function listarProdutos(mercadoId: string, empresaId = EMPRESA_PADRAO): { codigoEAN: string; produto: EstoqueProduto }[] {
  const empresa = getEstoqueData().empresas[empresaId]
  if (!empresa) return []
  const saldos = empresa.estoquePorMercado[mercadoId] ?? {}

  return Object.entries(empresa.produtos)
    .map(([codigoEAN, catalogo]) => ({
      codigoEAN,
      produto: {
        ...catalogo,
        estoque: saldos[codigoEAN] ?? { quantidadeAtual: 0, quantidadeMinima: 0, atualizadoEm: '' }
      }
    }))
    .sort((a, b) => a.produto.descricao.localeCompare(b.produto.descricao))
}

export function getMovimentacoes(empresaId = EMPRESA_PADRAO): Movimentacao[] {
  return getEstoqueData().empresas[empresaId]?.movimentacoes ?? []
}

export function getPesquisasSemanais(empresaId = EMPRESA_PADRAO): PesquisaSemanal[] {
  return getEstoqueData().empresas[empresaId]?.pesquisasSemanais ?? []
}

// Acha (ou não) a pesquisa já fechada para o ciclo atual naquele mercado —
// usado pra avisar "você já contou essa semana" sem bloquear recontagem.
export function getPesquisaDoCicloAtual(mercadoId: string, empresaId = EMPRESA_PADRAO): PesquisaSemanal | null {
  const cicloAtual = getCicloIdAtual()
  const pesquisas = getPesquisasSemanais(empresaId)
  const doCiclo = pesquisas.filter((p) => p.mercadoId === mercadoId && p.cicloId === cicloAtual)
  if (doCiclo.length === 0) return null
  return doCiclo[doCiclo.length - 1]
}

// Tenta casar o mercado do Setup Rápido (nomeCliente) com um mercadoId já
// existente no estoque. Se não achar, devolve null — quem chama decide se
// cria um novo mercado (ver garantirMercado).
export function encontrarMercadoPorNome(nome: string, empresaId = EMPRESA_PADRAO): string | null {
  const empresa = getEstoqueData().empresas[empresaId]
  if (!empresa) return null
  const nomeNormalizado = nome.trim().toLowerCase()
  const encontrado = Object.entries(empresa.mercados).find(([, m]) => m.nome.trim().toLowerCase() === nomeNormalizado)
  return encontrado ? encontrado[0] : null
}

// ---------------------------------------------------------------------------
// Mutações
// ---------------------------------------------------------------------------

// Cria o mercado se ele ainda não existir no estoque (ex.: mercado usado no
// Setup Rápido/Registrar mas que não está no catálogo estático do Frutap).
// Assim que criado, TODO o catálogo global já fica disponível pra ele.
export function garantirMercado(nome: string, endereco: EnderecoEstoque, empresaId = EMPRESA_PADRAO): string {
  const data = getEstoqueData()
  const empresa = data.empresas[empresaId] ?? criarEmpresaVazia(empresaId)

  const existenteId = encontrarMercadoPorNome(nome, empresaId)
  if (existenteId) return existenteId

  const mercadoId = slugify(nome) || `mercado-${Date.now()}`
  empresa.mercados[mercadoId] = { nome, endereco }
  empresa.estoquePorMercado[mercadoId] = {}
  data.empresas[empresaId] = empresa
  salvarDataBruta(data)
  return mercadoId
}

// Cadastra um produto novo no CATÁLOGO GLOBAL — fica disponível pra todos os
// mercados a partir daqui, não só pro mercado em que foi cadastrado.
export function cadastrarProdutoNoCatalogo(
  codigoEAN: string,
  descricao: string,
  opcoes?: Partial<Pick<CatalogoProduto, 'marca' | 'categoria' | 'unidade' | 'validadeMediaDias'>>,
  empresaId = EMPRESA_PADRAO
): void {
  const data = getEstoqueData()
  const empresa = data.empresas[empresaId]
  if (!empresa) return

  empresa.produtos[codigoEAN] = {
    descricao,
    marca: opcoes?.marca ?? 'Frutap',
    categoria: opcoes?.categoria ?? '',
    unidade: opcoes?.unidade ?? 'unidade',
    validadeMediaDias: opcoes?.validadeMediaDias ?? CONFIGURACAO_PADRAO.validadeMediaDiasPadrao
  }
  salvarDataBruta(data)
}

// Define/ajusta o saldo inicial de um produto (já existente no catálogo) num
// mercado específico — registra como movimentação de ajuste se quantidade > 0.
export function definirEstoqueInicial(
  mercadoId: string,
  codigoEAN: string,
  quantidadeInicial: number,
  operador: string,
  empresaId = EMPRESA_PADRAO
): void {
  const data = getEstoqueData()
  const empresa = data.empresas[empresaId]
  if (!empresa || !empresa.produtos[codigoEAN] || !empresa.mercados[mercadoId]) return

  if (!empresa.estoquePorMercado[mercadoId]) empresa.estoquePorMercado[mercadoId] = {}

  empresa.estoquePorMercado[mercadoId][codigoEAN] = {
    quantidadeAtual: quantidadeInicial,
    quantidadeMinima: empresa.estoquePorMercado[mercadoId][codigoEAN]?.quantidadeMinima ?? 0,
    atualizadoEm: new Date().toISOString()
  }

  if (quantidadeInicial > 0) {
    empresa.movimentacoes.push({
      id: crypto.randomUUID(),
      mercadoId,
      codigoEAN,
      tipo: 'entrada',
      motivo: 'ajuste',
      quantidade: quantidadeInicial,
      operador,
      data: new Date().toISOString(),
      cicloId: getCicloIdAtual()
    })
  }

  salvarDataBruta(data)
}

// Registra uma movimentação (entrada/saída) e já recalcula o saldo do
// produto naquele mercado — lançamento atômico usado por pesquisa semanal,
// avaria, venda, etc.
export function registrarMovimentacao(params: {
  mercadoId: string
  codigoEAN: string
  tipo: TipoMovimentacao
  motivo: MotivoMovimentacao
  quantidade: number
  operador: string
  empresaId?: string
}): void {
  const empresaId = params.empresaId ?? EMPRESA_PADRAO
  const data = getEstoqueData()
  const empresa = data.empresas[empresaId]
  if (!empresa || !empresa.produtos[params.codigoEAN] || !empresa.mercados[params.mercadoId]) return

  empresa.movimentacoes.push({
    id: crypto.randomUUID(),
    mercadoId: params.mercadoId,
    codigoEAN: params.codigoEAN,
    tipo: params.tipo,
    motivo: params.motivo,
    quantidade: params.quantidade,
    operador: params.operador,
    data: new Date().toISOString(),
    cicloId: getCicloIdAtual()
  })

  if (!empresa.estoquePorMercado[params.mercadoId]) empresa.estoquePorMercado[params.mercadoId] = {}
  const saldoAtual = empresa.estoquePorMercado[params.mercadoId][params.codigoEAN] ?? {
    quantidadeAtual: 0,
    quantidadeMinima: 0,
    atualizadoEm: new Date().toISOString()
  }
  const delta = params.tipo === 'entrada' ? params.quantidade : -params.quantidade
  empresa.estoquePorMercado[params.mercadoId][params.codigoEAN] = {
    quantidadeAtual: Math.max(0, saldoAtual.quantidadeAtual + delta),
    quantidadeMinima: saldoAtual.quantidadeMinima,
    atualizadoEm: new Date().toISOString()
  }

  salvarDataBruta(data)
}

// Fecha a pesquisa semanal: ajusta o saldo de cada item pela contagem real
// (gerando uma movimentação de ajuste quando houver divergência) e grava o
// registro da pesquisa. NÃO apaga nada do histórico — "novo ciclo" é só um
// cicloId novo pra frente, o extrato continua inteiro.
export function salvarPesquisaSemanal(params: {
  mercadoId: string
  operador: string
  itens: { codigoEAN: string; quantidadeContada: number }[]
  empresaId?: string
}): PesquisaSemanal | null {
  const empresaId = params.empresaId ?? EMPRESA_PADRAO
  const data = getEstoqueData()
  const empresa = data.empresas[empresaId]
  if (!empresa || !empresa.mercados[params.mercadoId]) return null

  if (!empresa.estoquePorMercado[params.mercadoId]) empresa.estoquePorMercado[params.mercadoId] = {}
  const saldos = empresa.estoquePorMercado[params.mercadoId]

  const agora = new Date().toISOString()
  const cicloId = getCicloIdAtual()

  const itensRegistrados: PesquisaSemanalItem[] = params.itens.map(({ codigoEAN, quantidadeContada }) => {
    const saldoAnterior = saldos[codigoEAN]
    const quantidadeEsperada = saldoAnterior?.quantidadeAtual ?? 0
    const divergencia = quantidadeContada - quantidadeEsperada

    if (divergencia !== 0) {
      empresa.movimentacoes.push({
        id: crypto.randomUUID(),
        mercadoId: params.mercadoId,
        codigoEAN,
        tipo: divergencia > 0 ? 'entrada' : 'saida',
        motivo: 'ajuste',
        quantidade: Math.abs(divergencia),
        operador: params.operador,
        data: agora,
        cicloId
      })
    }

    saldos[codigoEAN] = {
      quantidadeAtual: quantidadeContada,
      quantidadeMinima: saldoAnterior?.quantidadeMinima ?? 0,
      atualizadoEm: agora
    }

    return { codigoEAN, quantidadeEsperada, quantidadeContada, divergencia }
  })

  const pesquisa: PesquisaSemanal = {
    id: crypto.randomUUID(),
    cicloId,
    mercadoId: params.mercadoId,
    operador: params.operador,
    fechadaEm: agora,
    itens: itensRegistrados
  }

  empresa.pesquisasSemanais.push(pesquisa)
  salvarDataBruta(data)
  return pesquisa
}

// ---------------------------------------------------------------------------
// Exportação — gera um .json real pra backup/transferência, mesmo padrão
// Blob + <a download> que list.tsx já usa pro "Baixar Lista".
// ---------------------------------------------------------------------------

export function exportarEstoqueJson(empresaId = EMPRESA_PADRAO): void {
  const data = getEstoqueData()
  const conteudo = JSON.stringify(data.empresas[empresaId] ?? {}, null, 2)

  const blob = new Blob([conteudo], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${empresaId}-estoque-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
