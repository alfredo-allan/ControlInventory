// Agrupamento de produtos por categoria, pra Pesquisa Semanal e Painel de
// Sugestão (2026-10-14, pedido do usuário via documento de escopo).
//
// O campo `categoria` do catálogo (CatalogoProduto.categoria) está vazio
// pra todos os 82 produtos — veio assim da migração do frutap.json antigo
// (ver claude/arquitetura-modulo-estoque.md, "Pendências") e nunca foi
// preenchido manualmente. Em vez de depender desse campo, a categorização
// aqui é feita por palavra-chave na DESCRIÇÃO do produto, no front-end —
// exatamente como o documento de escopo pediu ("Lógica em JavaScript no
// front-end para agrupar e ordenar os produtos").
//
// Se um dia o campo `categoria` for preenchido de verdade no catálogo, dá
// pra trocar `categorizarProduto` pra preferir ele e só cair pra palavra-
// chave como fallback — a assinatura da função não precisa mudar.

const CATEGORIAS_PRIORITARIAS: { nome: string; palavraChave: string }[] = [
  { nome: 'Iogurte', palavraChave: 'IOGURTE' },
  { nome: 'Leite Fermentado', palavraChave: 'LEITE FERMENTADO' },
  { nome: 'Bebida Láctea', palavraChave: 'BEBIDA LACTEA' }
]

export const CATEGORIA_OUTROS = 'Outros produtos'

export const ORDEM_CATEGORIAS: string[] = [...CATEGORIAS_PRIORITARIAS.map((c) => c.nome), CATEGORIA_OUTROS]

function normalizar(texto: string): string {
  return texto
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos pra comparar "Láctea" com "LACTEA"
}

export function categorizarProduto(descricao: string): string {
  const normalizado = normalizar(descricao)
  for (const categoria of CATEGORIAS_PRIORITARIAS) {
    if (normalizado.includes(categoria.palavraChave)) return categoria.nome
  }
  return CATEGORIA_OUTROS
}

export function indiceCategoria(categoria: string): number {
  const indice = ORDEM_CATEGORIAS.indexOf(categoria)
  return indice === -1 ? ORDEM_CATEGORIAS.length : indice
}

// Agrupa uma lista qualquer (que tenha `descricao`) nas categorias
// prioritárias, na ordem certa, descartando grupos vazios — usado tanto na
// Pesquisa Semanal quanto no Painel de Sugestão.
export function agruparPorCategoria<T extends { descricao: string }>(itens: T[]): { categoria: string; itens: T[] }[] {
  const mapa = new Map<string, T[]>()
  for (const item of itens) {
    const categoria = categorizarProduto(item.descricao)
    if (!mapa.has(categoria)) mapa.set(categoria, [])
    mapa.get(categoria)!.push(item)
  }
  return ORDEM_CATEGORIAS.map((categoria) => ({ categoria, itens: mapa.get(categoria) ?? [] })).filter(
    (grupo) => grupo.itens.length > 0
  )
}
