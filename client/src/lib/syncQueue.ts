// Fila de sincronização offline-first.
//
// Contexto de negócio: o operador trabalha em ambientes sem sinal (câmaras
// frias/frigoríficos). Hoje o app já salva tudo localmente de qualquer jeito
// (localStorage, como sempre fez) — mas assim que existir um backend de
// verdade, cada ação relevante (registrar produto, fechar pesquisa semanal,
// lançar movimentação, etc.) também vai precisar ser EMPURRADA pra lá. Essa
// fila é a peça que falta pra isso acontecer sem fricção: toda ação entra
// aqui como um "item pendente de envio", fica guardada em IndexedDB (sobrevive
// a reload/fechar o app) e é processada automaticamente assim que a conexão
// volta — sem o operador precisar fazer nada.
//
// A partir de 2026-10-13, `enviarParaServidor` chama a API de verdade
// (backend/, ver client/src/lib/apiClient.ts) em vez de simular sucesso —
// o resto da arquitetura (fila, retry, pub-sub pros componentes React) não
// precisou mudar nada, por desenho: o backend foi feito pra aceitar
// exatamente o formato {id, tipo, payload} que já existia aqui.

import { apiFetch } from './apiClient'

export type TipoAcaoSync =
  | 'produto.registrar'
  | 'produto.atualizar'
  | 'produto.deletar'
  | 'estoque.cadastrarProduto'
  | 'estoque.garantirMercado'
  | 'estoque.definirEstoqueInicial'
  | 'estoque.registrarMovimentacao'
  | 'estoque.fecharPesquisaSemanal'
  | 'estoque.definirPreco'
  | 'avaria.registrar'
  | 'pedido.definir'
  | 'pedido.remover'

export type StatusItemSync = 'pendente' | 'sincronizado' | 'erro'

export interface ItemFilaSync {
  id: string
  tipo: TipoAcaoSync
  payload: unknown
  criadoEm: string
  status: StatusItemSync
  tentativas: number
  sincronizadoEm?: string
}

const DB_NAME = 'controle-perdas-sync'
const DB_VERSION = 1
const STORE_NAME = 'fila'

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB não disponível neste navegador.'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('status', 'status')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function withStore<T>(modo: IDBTransactionMode, executar: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return abrirBanco().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, modo)
        const store = tx.objectStore(STORE_NAME)
        const request = executar(store)
        request.onsuccess = () => resolve(request.result as T)
        request.onerror = () => reject(request.error)
      })
  )
}

// Pub-sub simples — os componentes React assinam isso (via useSyncStatus)
// pra reagir a mudanças na fila sem precisar reconsultar o IndexedDB a cada
// render, e sem precisar de nenhuma lib de estado global só pra isso.
type Ouvinte = () => void
const ouvintes = new Set<Ouvinte>()
function notificarOuvintes(): void {
  ouvintes.forEach((callback) => callback())
}
export function assinarMudancasDaFila(callback: Ouvinte): () => void {
  ouvintes.add(callback)
  return () => ouvintes.delete(callback)
}

// Adiciona uma ação à fila de sincronização. Chamado pelas funções de
// escrita (productStorage.save, estoqueStorage.*) logo depois de já terem
// salvo localmente — enfileirar NUNCA bloqueia nem substitui o salvamento
// local, só registra "isso também precisa ir pro servidor".
export async function enfileirar(tipo: TipoAcaoSync, payload: unknown): Promise<void> {
  const item: ItemFilaSync = {
    id: crypto.randomUUID(),
    tipo,
    payload,
    criadoEm: new Date().toISOString(),
    status: 'pendente',
    tentativas: 0
  }

  try {
    await withStore('readwrite', (store) => store.add(item))
  } catch (error) {
    // IndexedDB pode estar indisponível (modo privado restrito em alguns
    // navegadores, por exemplo) — nesse caso a ação já está salva localmente
    // de qualquer forma, então só avisamos no console e seguimos.
    console.warn('Não foi possível enfileirar ação de sincronização:', error)
    return
  }

  notificarOuvintes()
  if (typeof navigator !== 'undefined' && navigator.onLine) void processarFila()
}

export async function listarFila(): Promise<ItemFilaSync[]> {
  try {
    const todos = await withStore<ItemFilaSync[]>('readonly', (store) => store.getAll())
    return todos.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
  } catch {
    return []
  }
}

// Envio de verdade pro backend — POST /api/sync recebe exatamente
// {id, tipo, payload}, o mesmo formato que o item já tem aqui na fila, então
// não existe nenhuma camada de tradução no meio (ver app/sync/routes.py e
// app/sync/handlers.py no backend). A autenticação (login de serviço, token
// JWT, renovação) é toda resolvida por apiFetch — ver apiClient.ts.
async function enviarParaServidor(item: ItemFilaSync): Promise<void> {
  const resposta = await apiFetch('/api/sync', {
    method: 'POST',
    body: JSON.stringify({ id: item.id, tipo: item.tipo, payload: item.payload }),
  })

  if (!resposta.ok) {
    const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string; detalhe?: string }
    throw new Error(corpo.erro || corpo.detalhe || `Falha ao sincronizar (HTTP ${resposta.status})`)
  }
}

let processando = false

// Varre a fila e tenta sincronizar cada item pendente, um de cada vez (pra
// não disparar N "requisições" simultâneas quando a conexão volta com uma
// fila grande acumulada). Chamado automaticamente no evento `online` e
// depois de qualquer `enfileirar` enquanto já está online.
export async function processarFila(): Promise<void> {
  if (processando) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

  processando = true
  try {
    // Reprocessa 'pendente' sempre, e também 'erro' — com um teto de
    // tentativas (5) pra não ficar batendo pra sempre num payload
    // genuinamente inválido (ex: 400 por um bug real) toda vez que a conexão
    // piscar. Isso só passou a importar agora que existe backend de
    // verdade: antes, com o envio simulado, 'erro' nunca acontecia.
    const pendentes = (await listarFila()).filter(
      (item) => item.status === 'pendente' || (item.status === 'erro' && item.tentativas < 5)
    )

    for (const item of pendentes) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) break // conexão caiu no meio da sincronização

      try {
        await enviarParaServidor(item)
        const atualizado: ItemFilaSync = { ...item, status: 'sincronizado', sincronizadoEm: new Date().toISOString() }
        await withStore('readwrite', (store) => store.put(atualizado))
      } catch (error) {
        const atualizado: ItemFilaSync = { ...item, status: 'erro', tentativas: item.tentativas + 1 }
        await withStore('readwrite', (store) => store.put(atualizado))
      }
      notificarOuvintes()
    }
  } finally {
    processando = false
  }
}

// Remove da fila os itens já sincronizados há mais tempo — mantém o
// IndexedDB enxuto sem perder o histórico recente (útil pro painel mostrar
// "sincronizado às 14:32").
export async function limparSincronizados(): Promise<void> {
  const fila = await listarFila()
  const antigos = fila.filter((item) => item.status === 'sincronizado')
  for (const item of antigos) {
    await withStore('readwrite', (store) => store.delete(item.id))
  }
  notificarOuvintes()
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void processarFila())
}
