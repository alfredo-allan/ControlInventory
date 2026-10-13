import { useEffect, useState } from 'react'
import { Link } from 'wouter'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ShieldAlert,
  FileDown,
  Loader2,
  LogIn,
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertTriangle,
  UserPlus,
  Users,
  Eye,
  EyeOff,
  Activity,
  Barcode,
  ArrowRightLeft,
  ClipboardList,
  PackageX,
  KeyRound,
  UserX,
  UserCheck
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { apiFetch, baixarArquivo, obterUsuarioAtual, ErroNaoAutenticado } from '@/lib/apiClient'
import { limparLogsLocais } from '@/lib/estoqueStorage'

interface LoginLogItem {
  id: number
  nome: string
  perfil: 'admin' | 'operador'
  ip: string | null
  logadoEm: string | null
}

interface UsuarioItem {
  id: number
  nome: string
  perfil: 'admin' | 'operador'
  ativo: boolean
  criadoEm: string | null
}

// Evento unificado da timeline de "Atividade por operador" (v2.9,
// 2026-10-13, pedido do usuário: "o admin consegue monitorar os registros
// de cada operador?"). Espelha o que GET /api/admin/atividade-operador
// devolve — ver backend/app/admin/routes.py. Os campos variam por `tipo`,
// por isso quase tudo é opcional aqui; `descreverEvento` abaixo sabe o que
// cada tipo realmente usa.
interface EventoAtividade {
  tipo: 'produto_registrado' | 'movimentacao' | 'pesquisa_semanal' | 'avaria'
  data: string | null
  descricao?: string
  codigoEAN?: string
  quantidade?: number
  mercado?: string
  movimentoTipo?: 'entrada' | 'saida'
  motivo?: string
  cicloId?: string
  quantidadeItens?: number
}

// Ícone + texto de cada tipo de evento — fora do componente porque é pura
// apresentação, não depende de estado nenhum.
function descreverEvento(evento: EventoAtividade): { Icon: typeof Barcode; rotulo: string; detalhe: string } {
  switch (evento.tipo) {
    case 'produto_registrado':
      return {
        Icon: Barcode,
        rotulo: 'Registrou um produto',
        detalhe: `${evento.descricao || evento.codigoEAN || 'Produto'} · qtd ${evento.quantidade ?? '—'}${evento.mercado ? ` · ${evento.mercado}` : ''}`
      }
    case 'movimentacao':
      return {
        Icon: ArrowRightLeft,
        rotulo: evento.movimentoTipo === 'entrada' ? 'Lançou uma entrada' : 'Lançou uma saída',
        detalhe: `EAN ${evento.codigoEAN || '—'} · qtd ${evento.quantidade ?? '—'} · motivo: ${evento.motivo || '—'}${evento.mercado ? ` · ${evento.mercado}` : ''}`
      }
    case 'pesquisa_semanal':
      return {
        Icon: ClipboardList,
        rotulo: 'Fechou uma Pesquisa Semanal',
        detalhe: `Ciclo ${evento.cicloId || '—'} · ${evento.quantidadeItens ?? 0} item(ns) contado(s)${evento.mercado ? ` · ${evento.mercado}` : ''}`
      }
    case 'avaria':
      return {
        Icon: PackageX,
        rotulo: 'Registrou uma avaria',
        detalhe: `${evento.descricao || evento.codigoEAN || 'Produto'} · qtd ${evento.quantidade ?? '—'}${evento.motivo ? ` · ${evento.motivo}` : ''}`
      }
    default:
      return { Icon: Activity, rotulo: 'Evento', detalhe: '' }
  }
}

// Pedido do usuário (2026-10-13): o admin precisa conseguir criar usuário
// e senha pela própria interface, sem precisar chamar a API na mão — o
// endpoint POST /api/auth/usuarios já existia (admin-only) desde a v2.3,
// só não tinha tela nenhuma. Senha mínima de 6 caracteres espelha a
// validação que o backend passou a exigir junto com essa UI.
const criarUsuarioSchema = z.object({
  nome: z.string().min(1, 'Informe um nome de usuário'),
  senha: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres'),
  perfil: z.enum(['operador', 'admin'])
})
type CriarUsuarioValues = z.infer<typeof criarUsuarioSchema>

// Frase que o backend exige literalmente no corpo de POST
// /api/admin/logs/limpar ({"confirmar": "LIMPAR"}) — pedir a mesma frase
// aqui, digitada à mão, evita um clique acidental apagar avarias,
// movimentações e pesquisas semanais pra sempre (é exclusão definitiva).
const FRASE_CONFIRMACAO = 'LIMPAR'

export default function AdminPage() {
  const { toast } = useToast()
  const usuario = obterUsuarioAtual()
  const ehAdmin = usuario?.perfil === 'admin'

  const [logins, setLogins] = useState<LoginLogItem[]>([])
  const [carregandoLogins, setCarregandoLogins] = useState(false)
  const [erroLogins, setErroLogins] = useState<string | null>(null)
  // Recolhida por padrão (2026-10-13, feedback do usuário: a lista de 200
  // logins estava poluindo a tela do Admin com entradas repetidas) — quem
  // quiser ver clica pra expandir.
  const [historicoLoginAberto, setHistoricoLoginAberto] = useState(false)

  const [baixandoRelatorio, setBaixandoRelatorio] = useState(false)

  const [mostrarConfirmacaoLimpar, setMostrarConfirmacaoLimpar] = useState(false)
  const [fraseDigitada, setFraseDigitada] = useState('')
  const [limpando, setLimpando] = useState(false)

  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([])
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(false)
  const [erroUsuarios, setErroUsuarios] = useState<string | null>(null)
  const [mostrarSenha, setMostrarSenha] = useState(false)

  // Trocar senha / desativar usuário (2026-10-13, pedido do usuário:
  // "colocar o potencial do admin de trocar a senha e excluir usuários").
  // "Excluir" é soft delete (ativo=false) — ver comentário em
  // backend/app/models.py (Usuario.ativo) pro porquê.
  const [usuarioTrocandoSenha, setUsuarioTrocandoSenha] = useState<UsuarioItem | null>(null)
  const [novaSenha, setNovaSenha] = useState('')
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false)
  const [salvandoSenha, setSalvandoSenha] = useState(false)
  const [usuarioAlternandoAtivo, setUsuarioAlternandoAtivo] = useState<number | null>(null)
  const [usuarioDesativando, setUsuarioDesativando] = useState<UsuarioItem | null>(null)

  const [operadores, setOperadores] = useState<string[]>([])
  const [carregandoOperadores, setCarregandoOperadores] = useState(false)
  const [erroOperadores, setErroOperadores] = useState<string | null>(null)
  const [operadorSelecionado, setOperadorSelecionado] = useState('')
  const [eventosOperador, setEventosOperador] = useState<EventoAtividade[]>([])
  const [carregandoEventos, setCarregandoEventos] = useState(false)
  const [erroEventos, setErroEventos] = useState<string | null>(null)

  const formUsuario = useForm<CriarUsuarioValues>({
    resolver: zodResolver(criarUsuarioSchema),
    defaultValues: { nome: '', senha: '', perfil: 'operador' }
  })

  const carregarUsuarios = async () => {
    setCarregandoUsuarios(true)
    setErroUsuarios(null)
    try {
      const resposta = await apiFetch('/api/auth/usuarios')
      if (resposta.status === 403) {
        setErroUsuarios('Acesso negado — apenas administradores veem os usuários cadastrados.')
        return
      }
      if (!resposta.ok) {
        setErroUsuarios(`Falha ao carregar (HTTP ${resposta.status}).`)
        return
      }
      setUsuarios((await resposta.json()) as UsuarioItem[])
    } catch (error) {
      setErroUsuarios(error instanceof ErroNaoAutenticado ? 'Sessão expirada. Faça login novamente.' : 'Não foi possível conectar ao servidor.')
    } finally {
      setCarregandoUsuarios(false)
    }
  }

  const onCriarUsuario = async (dados: CriarUsuarioValues) => {
    try {
      const resposta = await apiFetch('/api/auth/usuarios', {
        method: 'POST',
        body: JSON.stringify(dados)
      })
      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
        throw new Error(corpo.erro || `Falha ao criar usuário (HTTP ${resposta.status}).`)
      }
      toast({ title: 'Usuário criado!', description: `"${dados.nome}" já pode entrar como ${dados.perfil === 'admin' ? 'administrador' : 'operador'}.` })
      formUsuario.reset({ nome: '', senha: '', perfil: 'operador' })
      void carregarUsuarios()
    } catch (error) {
      toast({
        title: 'Erro ao criar usuário',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive'
      })
    }
  }

  const onTrocarSenha = async () => {
    if (!usuarioTrocandoSenha) return
    if (novaSenha.length < 6) {
      toast({ title: 'Senha muito curta', description: 'Use pelo menos 6 caracteres.', variant: 'destructive' })
      return
    }
    setSalvandoSenha(true)
    try {
      const resposta = await apiFetch(`/api/auth/usuarios/${usuarioTrocandoSenha.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ senha: novaSenha })
      })
      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
        throw new Error(corpo.erro || `Falha ao trocar senha (HTTP ${resposta.status}).`)
      }
      toast({ title: 'Senha atualizada!', description: `Nova senha definida para "${usuarioTrocandoSenha.nome}".` })
      setUsuarioTrocandoSenha(null)
      setNovaSenha('')
      setMostrarNovaSenha(false)
    } catch (error) {
      toast({
        title: 'Erro ao trocar senha',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive'
      })
    } finally {
      setSalvandoSenha(false)
    }
  }

  // Reativar não precisa de confirmação (reversível, de baixo risco);
  // desativar passa pelo AlertDialog abaixo porque trava o login do
  // operador na hora.
  const onAlternarAtivo = async (u: UsuarioItem, novoAtivo: boolean) => {
    setUsuarioAlternandoAtivo(u.id)
    try {
      const resposta = await apiFetch(`/api/auth/usuarios/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ativo: novoAtivo })
      })
      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
        throw new Error(corpo.erro || `Falha ao atualizar usuário (HTTP ${resposta.status}).`)
      }
      setUsuarios((atual) => atual.map((item) => (item.id === u.id ? { ...item, ativo: novoAtivo } : item)))
      toast({
        title: novoAtivo ? 'Usuário reativado' : 'Usuário desativado',
        description: novoAtivo ? `"${u.nome}" já pode entrar novamente.` : `"${u.nome}" não consegue mais entrar no sistema.`
      })
    } catch (error) {
      toast({
        title: 'Erro ao atualizar usuário',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive'
      })
    } finally {
      setUsuarioAlternandoAtivo(null)
      setUsuarioDesativando(null)
    }
  }

  // "Atividade por operador" (v2.9) — pedido do usuário: *"o admin
  // consegue monitorar os registros de cada operador?"*. Antes não tinha
  // nada disso; só histórico de login (quem entrou, quando) e relatório
  // geral de perdas (agregado por mercado). Aqui dá pra escolher um
  // operador e ver, em ordem, tudo que ele registrou — produtos,
  // movimentações, pesquisas semanais fechadas e avarias.
  const carregarOperadores = async () => {
    setCarregandoOperadores(true)
    setErroOperadores(null)
    try {
      const resposta = await apiFetch('/api/admin/operadores')
      if (resposta.status === 403) {
        setErroOperadores('Acesso negado — apenas administradores veem essa lista.')
        return
      }
      if (!resposta.ok) {
        setErroOperadores(`Falha ao carregar (HTTP ${resposta.status}).`)
        return
      }
      setOperadores((await resposta.json()) as string[])
    } catch (error) {
      setErroOperadores(error instanceof ErroNaoAutenticado ? 'Sessão expirada. Faça login novamente.' : 'Não foi possível conectar ao servidor.')
    } finally {
      setCarregandoOperadores(false)
    }
  }

  const carregarAtividadeOperador = async (operador: string) => {
    setCarregandoEventos(true)
    setErroEventos(null)
    try {
      const resposta = await apiFetch(`/api/admin/atividade-operador?operador=${encodeURIComponent(operador)}`)
      if (resposta.status === 403) {
        setErroEventos('Acesso negado — apenas administradores veem essa atividade.')
        return
      }
      if (!resposta.ok) {
        setErroEventos(`Falha ao carregar (HTTP ${resposta.status}).`)
        return
      }
      const corpo = (await resposta.json()) as { eventos: EventoAtividade[] }
      setEventosOperador(corpo.eventos)
    } catch (error) {
      setErroEventos(error instanceof ErroNaoAutenticado ? 'Sessão expirada. Faça login novamente.' : 'Não foi possível conectar ao servidor.')
    } finally {
      setCarregandoEventos(false)
    }
  }

  const onSelecionarOperador = (operador: string) => {
    setOperadorSelecionado(operador)
    void carregarAtividadeOperador(operador)
  }

  const carregarLogins = async () => {
    setCarregandoLogins(true)
    setErroLogins(null)
    try {
      const resposta = await apiFetch('/api/admin/logins')
      if (resposta.status === 403) {
        setErroLogins('Acesso negado — apenas administradores veem o histórico de login.')
        return
      }
      if (!resposta.ok) {
        setErroLogins(`Falha ao carregar (HTTP ${resposta.status}).`)
        return
      }
      setLogins((await resposta.json()) as LoginLogItem[])
    } catch (error) {
      setErroLogins(error instanceof ErroNaoAutenticado ? 'Sessão expirada. Faça login novamente.' : 'Não foi possível conectar ao servidor.')
    } finally {
      setCarregandoLogins(false)
    }
  }

  useEffect(() => {
    if (ehAdmin) {
      void carregarLogins()
      void carregarUsuarios()
      void carregarOperadores()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleBaixarRelatorioPerdas = async () => {
    setBaixandoRelatorio(true)
    try {
      await baixarArquivo('/api/relatorios/perdas.docx', 'relatorio-perdas.docx')
    } catch (error) {
      toast({
        title: 'Erro ao baixar relatório',
        description: error instanceof ErroNaoAutenticado ? 'Sessão expirada. Faça login novamente.' : 'Verifique sua conexão e tente novamente.',
        variant: 'destructive'
      })
    } finally {
      setBaixandoRelatorio(false)
    }
  }

  const handleLimparLogs = async () => {
    setLimpando(true)
    try {
      const resposta = await apiFetch('/api/admin/logs/limpar', {
        method: 'POST',
        body: JSON.stringify({ confirmar: FRASE_CONFIRMACAO })
      })
      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
        throw new Error(corpo.erro || `Falha ao limpar logs (HTTP ${resposta.status}).`)
      }
      const corpo = (await resposta.json()) as { removidos: Record<string, number> }

      // Espelha localmente o que o servidor acabou de apagar — senão este
      // aparelho continuaria mostrando avarias/movimentações/pesquisas
      // antigas até o próximo pull-sync.
      limparLogsLocais()

      const total = Object.values(corpo.removidos).reduce((soma, n) => soma + n, 0)
      toast({ title: 'Logs limpos!', description: `${total} registro(s) removido(s) definitivamente.` })
      setMostrarConfirmacaoLimpar(false)
      setFraseDigitada('')
    } catch (error) {
      toast({
        title: 'Erro ao limpar logs',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive'
      })
    } finally {
      setLimpando(false)
    }
  }

  // Guarda do lado do cliente — só esconde a tela pra quem não é admin.
  // A proteção de verdade é no servidor (login_obrigatorio(perfis=["admin"])
  // em cada rota aqui usada), então mesmo que alguém force a URL, as
  // chamadas de API acima devolvem 403 e nada sensível aparece.
  if (!ehAdmin) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardContent className="pt-6 flex flex-col items-center text-center gap-4">
            <ShieldAlert className="h-10 w-10 text-destructive" />
            <div>
              <p className="font-medium text-foreground">Acesso restrito</p>
              <p className="text-sm text-muted-foreground mt-1">Esta página é exclusiva para administradores.</p>
            </div>
            <Link href="/">
              <Button variant="outline">Voltar ao início</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-foreground mb-2 flex items-center gap-2">
          <ShieldAlert className="h-7 w-7 text-primary" />
          Administração
        </h1>
        <p className="text-muted-foreground">Histórico de login, atividade por operador, relatório geral de perdas e limpeza de logs.</p>
      </div>

      <Card>
        <button
          type="button"
          className="w-full text-left"
          onClick={() => setHistoricoLoginAberto((v) => !v)}
          data-testid="button-toggle-historico-login">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <LogIn className="h-5 w-5" />
                Histórico de login
              </CardTitle>
              <CardDescription>
                Quem entrou na aplicação e quando — últimos 200 registros.
                {!historicoLoginAberto && !carregandoLogins && logins.length > 0 && ` ${logins.length} carregados.`}
              </CardDescription>
            </div>
            {historicoLoginAberto ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
            )}
          </CardHeader>
        </button>
        {historicoLoginAberto && (
          <CardContent>
            {carregandoLogins ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando...
              </div>
            ) : erroLogins ? (
              <p className="text-sm text-destructive py-4 text-center">{erroLogins}</p>
            ) : logins.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum login registrado ainda.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {logins.map((log) => (
                  <div key={log.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0" data-testid={`row-login-${log.id}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-foreground truncate">{log.nome}</span>
                      <Badge variant={log.perfil === 'admin' ? 'default' : 'secondary'} className="shrink-0">
                        {log.perfil}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-muted-foreground text-xs">
                      {log.ip && <span className="font-mono">{log.ip}</span>}
                      <span>{log.logadoEm ? format(parseISO(log.logadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Atividade por operador
          </CardTitle>
          <CardDescription>
            Tudo que um operador registrou, em ordem — produtos, movimentações, pesquisas semanais fechadas e
            avarias. O nome vem do Setup Rápido de cada aparelho, não necessariamente do usuário de login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {carregandoOperadores ? (
            <div className="flex items-center justify-center py-4 text-muted-foreground gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando operadores...
            </div>
          ) : erroOperadores ? (
            <p className="text-sm text-destructive py-2">{erroOperadores}</p>
          ) : operadores.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nenhum operador com registros ainda.</p>
          ) : (
            <Select value={operadorSelecionado} onValueChange={onSelecionarOperador}>
              <SelectTrigger className="w-full sm:w-[280px]" data-testid="select-operador-atividade">
                <SelectValue placeholder="Escolha um operador..." />
              </SelectTrigger>
              <SelectContent>
                {operadores.map((nome) => (
                  <SelectItem key={nome} value={nome}>
                    {nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {operadorSelecionado &&
            (carregandoEventos ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando atividade...
              </div>
            ) : erroEventos ? (
              <p className="text-sm text-destructive py-4 text-center">{erroEventos}</p>
            ) : eventosOperador.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum registro encontrado para "{operadorSelecionado}".
              </p>
            ) : (
              <div className="space-y-2 max-h-[28rem] overflow-y-auto" data-testid="lista-atividade-operador">
                {eventosOperador.map((evento, indice) => {
                  const { Icon, rotulo, detalhe } = descreverEvento(evento)
                  return (
                    <div
                      key={indice}
                      className="flex items-start gap-3 text-sm border-b pb-2 last:border-0"
                      data-testid={`row-atividade-${indice}`}>
                      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">{rotulo}</span>
                          <span className="text-muted-foreground text-xs shrink-0">
                            {evento.data ? format(parseISO(evento.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-xs mt-0.5 truncate">{detalhe}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Relatório geral de perdas
          </CardTitle>
          <CardDescription>Avaria + vencimento + venda, agregados por mercado (últimos 30 dias).</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="gap-2" onClick={handleBaixarRelatorioPerdas} disabled={baixandoRelatorio} data-testid="button-baixar-relatorio-perdas">
            {baixandoRelatorio ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Baixar relatório (.docx)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Criar usuário
          </CardTitle>
          <CardDescription>
            Cadastre o acesso de um novo operador ou administrador — a pessoa entra com esse usuário e senha na tela
            inicial.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...formUsuario}>
            <form onSubmit={formUsuario.handleSubmit(onCriarUsuario)} className="grid sm:grid-cols-[1fr_1fr_auto_auto] gap-3 items-start">
              <FormField
                control={formUsuario.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuário</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="ex: joao.silva" data-testid="input-novo-usuario-nome" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={formUsuario.control}
                name="senha"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={mostrarSenha ? 'text' : 'password'}
                          placeholder="mínimo 6 caracteres"
                          className="pr-9"
                          data-testid="input-novo-usuario-senha"
                        />
                        <button
                          type="button"
                          onClick={() => setMostrarSenha((v) => !v)}
                          className="absolute inset-y-0 right-0 px-2.5 flex items-center text-muted-foreground hover:text-foreground"
                          aria-label={mostrarSenha ? 'Esconder senha' : 'Mostrar senha'}
                          data-testid="button-alternar-senha-visivel">
                          {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={formUsuario.control}
                name="perfil"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Perfil</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-[140px]" data-testid="select-novo-usuario-perfil">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="operador">Operador</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="gap-2 sm:mt-[1.625rem]"
                disabled={formUsuario.formState.isSubmitting}
                data-testid="button-criar-usuario">
                {formUsuario.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Criar
              </Button>
            </form>
          </Form>

          <div className="border-t pt-5">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2 mb-3">
              <Users className="h-4 w-4" />
              Quem já tem acesso
            </h3>
            {carregandoUsuarios ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando...
              </div>
            ) : erroUsuarios ? (
              <p className="text-sm text-destructive py-2">{erroUsuarios}</p>
            ) : usuarios.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nenhum usuário encontrado.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {usuarios.map((u) => {
                  const vocêMesmo = u.id === usuario?.id
                  return (
                    <div
                      key={u.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm border-b pb-2 last:border-0"
                      data-testid={`row-usuario-${u.id}`}>
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className={`font-medium truncate ${u.ativo ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                          {u.nome}
                        </span>
                        <Badge variant={u.perfil === 'admin' ? 'default' : 'secondary'} className="shrink-0">
                          {u.perfil}
                        </Badge>
                        {!u.ativo && (
                          <Badge variant="outline" className="shrink-0 text-muted-foreground">
                            Desativado
                          </Badge>
                        )}
                        {vocêMesmo && (
                          <Badge variant="outline" className="shrink-0">
                            Você
                          </Badge>
                        )}
                        <span className="text-muted-foreground text-xs shrink-0">
                          {u.criadoEm ? `desde ${format(parseISO(u.criadoEm), 'dd/MM/yyyy', { locale: ptBR })}` : '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-muted-foreground"
                          onClick={() => {
                            setUsuarioTrocandoSenha(u)
                            setNovaSenha('')
                            setMostrarNovaSenha(false)
                          }}
                          data-testid={`button-trocar-senha-${u.id}`}>
                          <KeyRound className="h-3.5 w-3.5" />
                          Senha
                        </Button>
                        {u.ativo ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-destructive hover:text-destructive"
                            disabled={vocêMesmo || usuarioAlternandoAtivo === u.id}
                            title={vocêMesmo ? 'Você não pode desativar seu próprio usuário' : undefined}
                            onClick={() => setUsuarioDesativando(u)}
                            data-testid={`button-desativar-${u.id}`}>
                            {usuarioAlternandoAtivo === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}
                            Desativar
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-emerald-600 hover:text-emerald-600"
                            disabled={usuarioAlternandoAtivo === u.id}
                            onClick={() => void onAlternarAtivo(u, true)}
                            data-testid={`button-reativar-${u.id}`}>
                            {usuarioAlternandoAtivo === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                            Reativar
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Limpar todos os logs
          </CardTitle>
          <CardDescription>
            Apaga definitivamente avarias, movimentações e pesquisas semanais — use só depois de ter um backup. O
            catálogo, os mercados e o saldo atual de estoque NÃO são afetados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" className="gap-2" onClick={() => setMostrarConfirmacaoLimpar(true)} data-testid="button-abrir-limpar-logs">
            <Trash2 className="h-4 w-4" />
            Limpar todos os logs
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={mostrarConfirmacaoLimpar} onOpenChange={(open) => {
        setMostrarConfirmacaoLimpar(open)
        if (!open) setFraseDigitada('')
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza? Essa ação não pode ser desfeita.</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as avarias, movimentações e pesquisas semanais registradas serão apagadas DEFINITIVAMENTE do
              servidor e deste aparelho. Pra confirmar, digite <span className="font-mono font-bold">{FRASE_CONFIRMACAO}</span> abaixo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={fraseDigitada}
            onChange={(e) => setFraseDigitada(e.target.value)}
            placeholder={FRASE_CONFIRMACAO}
            autoFocus
            data-testid="input-confirmar-limpar-logs"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={limpando}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={fraseDigitada !== FRASE_CONFIRMACAO || limpando}
              onClick={handleLimparLogs}
              className="gap-2"
              data-testid="button-confirmar-limpar-logs">
              {limpando && <Loader2 className="h-4 w-4 animate-spin" />}
              Limpar definitivamente
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Trocar senha de um usuário (2026-10-13) */}
      <Dialog
        open={!!usuarioTrocandoSenha}
        onOpenChange={(open) => {
          if (!open) {
            setUsuarioTrocandoSenha(null)
            setNovaSenha('')
            setMostrarNovaSenha(false)
          }
        }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Trocar senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para <span className="font-medium text-foreground">{usuarioTrocandoSenha?.nome}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Input
              type={mostrarNovaSenha ? 'text' : 'password'}
              placeholder="Nova senha (mín. 6 caracteres)"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              className="pr-10"
              data-testid="input-nova-senha"
            />
            <button
              type="button"
              onClick={() => setMostrarNovaSenha((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label={mostrarNovaSenha ? 'Esconder senha' : 'Mostrar senha'}>
              {mostrarNovaSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUsuarioTrocandoSenha(null)} disabled={salvandoSenha}>
              Cancelar
            </Button>
            <Button onClick={() => void onTrocarSenha()} disabled={salvandoSenha} className="gap-2" data-testid="button-confirmar-nova-senha">
              {salvandoSenha && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar nova senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar desativação de usuário (2026-10-13) — reversível (dá pra
          reativar depois), mas trava o login na hora, por isso pede
          confirmação em vez de ser um clique só como o reativar. */}
      <AlertDialog open={!!usuarioDesativando} onOpenChange={(open) => !open && setUsuarioDesativando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar "{usuarioDesativando?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esse usuário não vai mais conseguir entrar no sistema até alguém reativá-lo. O histórico de login e de
              atividade dele continua intacto — isso não apaga nada, só bloqueia o acesso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              className="gap-2"
              disabled={usuarioAlternandoAtivo === usuarioDesativando?.id}
              onClick={() => usuarioDesativando && void onAlternarAtivo(usuarioDesativando, false)}
              data-testid="button-confirmar-desativar">
              {usuarioAlternandoAtivo === usuarioDesativando?.id && <Loader2 className="h-4 w-4 animate-spin" />}
              Desativar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
