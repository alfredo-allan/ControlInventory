// Pull-sync — busca o estado de verdade do servidor e funde no localStorage
// deste aparelho.
//
// Até 2026-10-13 o app só EMPURRAVA mudanças pro servidor (ver syncQueue.ts)
// — nenhuma tela lia de lá. Na prática isso significava que dois operadores
// em aparelhos diferentes nunca viam o trabalho um do outro: cada um só
// enxergava o que ele mesmo tinha digitado naquele navegador. Esse módulo
// fecha essa lacuna: busca produtos registrados (Farejar/Listar), catálogo +
// mercados, o saldo de cada mercado (Pesquisa Semanal/Sugestão de Pedido) e
// as avarias/quebras registradas (página Avarias) — e funde no estado local,
// sempre de forma aditiva, nunca apagando algo
// que só existe neste aparelho e ainda não foi confirmado pelo servidor
// (ver os comentários em mergeFromServer/mergeCatalogoEMercadosFromServer).
//
// Filosofia "local primeiro": nenhuma tela espera isso terminar pra mostrar
// alguma coisa — o localStorage já tem o que foi salvo offline, sempre.
// Isso só busca o que mudou em OUTRO lugar e atualiza por cima.

import { apiFetch, ErroNaoAutenticado } from './apiClient'
import { productStorage } from './localStorage'
import { mergeCatalogoEMercadosFromServer, mergeSaldosFromServer, mergeAvariasFromServer, mergePedidosFromServer } from './estoqueStorage'
import type { RegistroAvaria, PedidoItem } from './estoqueStorage'
import type { Product } from '@shared/schema'

type Ouvinte = () => void
const ouvintes = new Set<Ouvinte>()
function notificarOuvintes(): void {
  ouvintes.forEach((callback) => callback())
}
export function assinarMudancasDoPull(callback: Ouvinte): () => void {
  ouvintes.add(callback)
  return () => ouvintes.delete(callback)
}

let puxando = false

// Busca produtos registrados + catálogo + mercados + saldo de cada mercado,
// e funde tudo no localStorage. Silenciosa em falhas "normais" (offline, 404
// pontual) — quem chama já está mostrando o estado local, então um pull que
// falhou não é uma tela quebrada, é só "não deu pra atualizar agora".
// Propaga ErroNaoAutenticado pra quem chama decidir o que fazer (hoje:
// ninguém trata isso de forma especial, mas documenta a intenção).
export async function puxarDoServidor(): Promise<void> {
  if (puxando) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

  puxando = true
  try {
    const [produtosRegistradosResp, produtosResp, mercadosResp, avariasResp, pedidosResp] = await Promise.all([
      apiFetch('/api/produtos-registrados'),
      apiFetch('/api/produtos'),
      apiFetch('/api/mercados'),
      apiFetch('/api/avarias'),
      apiFetch('/api/pedidos')
    ])

    if (produtosRegistradosResp.ok) {
      const produtosRegistrados = (await produtosRegistradosResp.json()) as Product[]
      productStorage.mergeFromServer(produtosRegistrados)
    }

    if (avariasResp.ok) {
      const avarias = (await avariasResp.json()) as RegistroAvaria[]
      mergeAvariasFromServer(avarias)
    }

    if (pedidosResp.ok) {
      const pedidos = (await pedidosResp.json()) as PedidoItem[]
      mergePedidosFromServer(pedidos)
    }

    let mercados: { id: string; nome: string; endereco: { rua: string; bairro: string; cidade: string; estado: string } }[] = []
    if (produtosResp.ok && mercadosResp.ok) {
      const produtos = await produtosResp.json()
      mercados = await mercadosResp.json()
      mergeCatalogoEMercadosFromServer(produtos, mercados)
    }

    // Saldo é por mercado — não existe uma rota "todos os saldos de uma vez"
    // no backend (ver app/estoque/routes.py), então busca um de cada vez.
    // Em sequência (não Promise.all) pra não disparar N requisições
    // simultâneas quando a empresa já tem vários mercados cadastrados.
    for (const mercado of mercados) {
      try {
        const resp = await apiFetch(`/api/estoque/${mercado.id}`)
        if (resp.ok) {
          const saldos = await resp.json()
          mergeSaldosFromServer(mercado.id, saldos)
        }
      } catch {
        // Um mercado falhar não deve impedir os outros de atualizar.
      }
    }
  } catch (error) {
    if (error instanceof ErroNaoAutenticado) throw error
    console.warn('Falha ao puxar dados do servidor:', error)
  } finally {
    puxando = false
    notificarOuvintes()
  }
}
