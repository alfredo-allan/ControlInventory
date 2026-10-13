// Cliente HTTP pra falar com a API real (backend/, rodando localmente em dev
// ou no PythonAnywhere em produção) — e autenticação de verdade.
//
// Até 2026-10-13 isso aqui fazia um "login de serviço" automático (um
// usuário fixo, senha embutida no bundle do frontend) pra destravar o teste
// da integração rápido. Trocado agora por login real: cada operador entra
// com usuário/senha próprio (ver client/src/pages/login.tsx), o token fica
// guardado neste navegador, e SÓ esse operador (e o perfil dele, vindo do
// backend) é quem a API enxerga — sem senha nenhuma no bundle, e com RBAC
// de verdade (admin x operador) valendo tanto na tela quanto no servidor.

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://127.0.0.1:5050'

const CHAVE_TOKEN = 'api-auth-token'
const CHAVE_EXPIRA_EM = 'api-auth-expira-em'
const CHAVE_USUARIO = 'api-auth-usuario'

export interface UsuarioAutenticado {
  id: number
  nome: string
  perfil: 'admin' | 'operador'
  empresaId: number
}

// Erro específico pra "não tem sessão válida" — quem chama (syncQueue, uma
// tela) sabe que não adianta tentar de novo sozinho; precisa de login.
export class ErroNaoAutenticado extends Error {
  constructor(mensagem = 'Sessão expirada ou inexistente. Faça login novamente.') {
    super(mensagem)
    this.name = 'ErroNaoAutenticado'
  }
}

function decodificarExpiracaoMs(token: string): number | null {
  try {
    const payloadBase64 = token.split('.')[1]
    const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(payloadJson) as { exp?: number }
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

// Pub-sub simples — a UI (Header, AuthGate) assina isso pra reagir a
// login/logout sem precisar de uma lib de estado global só pra isso (mesmo
// padrão já usado em syncQueue.ts).
type Ouvinte = () => void
const ouvintes = new Set<Ouvinte>()
function notificarOuvintes(): void {
  ouvintes.forEach((callback) => callback())
}
export function assinarMudancasDeAuth(callback: Ouvinte): () => void {
  ouvintes.add(callback)
  return () => ouvintes.delete(callback)
}

export function obterUsuarioAtual(): UsuarioAutenticado | null {
  try {
    const bruto = localStorage.getItem(CHAVE_USUARIO)
    return bruto ? (JSON.parse(bruto) as UsuarioAutenticado) : null
  } catch {
    return null
  }
}

export function estaAutenticado(): boolean {
  const token = localStorage.getItem(CHAVE_TOKEN)
  const expiraEm = Number(localStorage.getItem(CHAVE_EXPIRA_EM) || 0)
  return Boolean(token) && expiraEm > Date.now()
}

// Login de verdade — chamado pela tela de login (client/src/pages/login.tsx).
export async function login(nome: string, senha: string): Promise<UsuarioAutenticado> {
  const resposta = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, senha }),
  })

  if (!resposta.ok) {
    const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
    throw new Error(corpo.erro || (resposta.status === 401 ? 'Usuário ou senha incorretos.' : `Falha ao entrar (HTTP ${resposta.status}).`))
  }

  const corpo = (await resposta.json()) as { token: string; usuario: UsuarioAutenticado }
  const expiraEmMs = decodificarExpiracaoMs(corpo.token) ?? Date.now() + 6 * 24 * 60 * 60 * 1000

  localStorage.setItem(CHAVE_TOKEN, corpo.token)
  localStorage.setItem(CHAVE_EXPIRA_EM, String(expiraEmMs))
  localStorage.setItem(CHAVE_USUARIO, JSON.stringify(corpo.usuario))
  notificarOuvintes()

  return corpo.usuario
}

export function logout(): void {
  localStorage.removeItem(CHAVE_TOKEN)
  localStorage.removeItem(CHAVE_EXPIRA_EM)
  localStorage.removeItem(CHAVE_USUARIO)
  notificarOuvintes()
}

// Wrapper de fetch autenticado — usa em qualquer chamada à API. Não tenta
// logar sozinho (não existe mais usuário de serviço): se não tem sessão
// válida, lança ErroNaoAutenticado na hora, sem bater na rede à toa. Se o
// servidor responder 401 mesmo com um token que parecia válido localmente
// (ex.: revogado, ou relógio do aparelho desalinhado), derruba a sessão
// local e também lança ErroNaoAutenticado — quem chama decide o que fazer
// (a fila de sync só marca o item como erro e tenta de novo depois do
// próximo login; a UI redireciona pra tela de login).
export async function apiFetch(caminho: string, opcoes: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem(CHAVE_TOKEN)
  if (!token || !estaAutenticado()) {
    throw new ErroNaoAutenticado()
  }

  const resposta = await fetch(`${API_URL}${caminho}`, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opcoes.headers || {}),
    },
  })

  if (resposta.status === 401) {
    logout()
    throw new ErroNaoAutenticado('Sessão expirada. Faça login novamente.')
  }

  return resposta
}

// Baixa um arquivo autenticado (relatório .docx, por exemplo) e dispara o
// download no navegador — necessário porque a rota exige o header
// Authorization (apiFetch acima), então não dá pra só linkar a URL direto
// num <a href>. Usado pela página Avarias (relatório de avarias) e pela
// página Admin (relatório geral de perdas).
export async function baixarArquivo(caminho: string, nomeArquivoFallback: string): Promise<void> {
  const resposta = await apiFetch(caminho)
  if (!resposta.ok) throw new Error(`Falha ao gerar o arquivo (HTTP ${resposta.status}).`)

  const disposicao = resposta.headers.get('Content-Disposition') || ''
  const nomeMatch = disposicao.match(/filename="?([^"]+)"?/)
  const nomeArquivo = nomeMatch?.[1] || nomeArquivoFallback

  const blob = await resposta.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export { API_URL }
