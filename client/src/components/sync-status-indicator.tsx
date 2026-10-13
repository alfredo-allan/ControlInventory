// Indicador didático de sincronização — mostra pro operador, o tempo todo,
// se o app está offline, com ações pendentes de envio, ou tudo sincronizado.
// Clicar abre um painel explicando o que está acontecendo (pensado pra quem
// não é técnico: "suas ações estão salvas, vão ser enviadas sozinhas").
//
// Convenção de cor já usada no resto do app (ver Badge em list.tsx):
// destructive = bloqueado/crítico, default = atenção/em andamento,
// secondary = tudo certo.

import { CloudOff, UploadCloud, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useSyncStatus, type StatusConexao } from '@/hooks/use-sync-status'

const CONFIG_STATUS: Record<StatusConexao, { label: string; variant: 'destructive' | 'default' | 'secondary'; Icon: typeof CloudOff }> = {
  offline: { label: 'Offline', variant: 'destructive', Icon: CloudOff },
  sincronizando: { label: 'Sincronizando...', variant: 'default', Icon: Loader2 },
  pendente: { label: 'Fila pendente', variant: 'default', Icon: UploadCloud },
  sincronizado: { label: 'Sincronizado', variant: 'secondary', Icon: CheckCircle2 }
}

const EXPLICACAO_POR_STATUS: Record<StatusConexao, string> = {
  offline:
    'Sem conexão agora — normal se você estiver numa câmara fria ou área sem sinal. Suas ações continuam sendo salvas neste aparelho normalmente, e assim que a conexão voltar, tudo é enviado sozinho. Você não precisa fazer nada.',
  sincronizando: 'Conexão de volta! Enviando as ações que ficaram pendentes enquanto você estava offline.',
  pendente:
    'Há ações aguardando envio. Isso pode acontecer logo depois de ficar offline, antes do envio automático começar — tente novamente ou aguarde alguns segundos.',
  sincronizado: 'Tudo certo: todas as ações já foram sincronizadas.'
}

const LABEL_TIPO_ACAO: Record<string, string> = {
  'produto.registrar': 'Produto registrado',
  'estoque.cadastrarProduto': 'Produto cadastrado no catálogo',
  'estoque.definirEstoqueInicial': 'Estoque inicial definido',
  'estoque.registrarMovimentacao': 'Movimentação de estoque',
  'estoque.fecharPesquisaSemanal': 'Pesquisa semanal fechada',
  'estoque.definirPreco': 'Preço atualizado'
}

export function SyncStatusIndicator() {
  const { status, fila, pendentes, sincronizarAgora } = useSyncStatus()
  const [aberto, setAberto] = useState(false)
  const { toast } = useToast()
  const statusAnterior = useRef<StatusConexao | null>(null)
  const config = CONFIG_STATUS[status]
  const Icon = config.Icon

  // Avisa o operador só nas transições que importam — ficar offline, e
  // terminar de sincronizar depois de ter ficado pendente. Não avisa em
  // toda renderização, só quando o status de fato muda.
  useEffect(() => {
    const anterior = statusAnterior.current
    if (anterior !== null && anterior !== status) {
      if (status === 'offline') {
        toast({
          title: 'Você está offline',
          description: 'Suas ações continuam sendo salvas normalmente e serão enviadas assim que a conexão voltar.'
        })
      } else if (anterior === 'offline' && (status === 'sincronizando' || status === 'pendente')) {
        toast({ title: 'Conexão restabelecida', description: 'Sincronizando as ações que ficaram pendentes...' })
      } else if (anterior === 'sincronizando' && status === 'sincronizado') {
        toast({ title: 'Tudo sincronizado!', description: 'Nenhuma ação pendente de envio.' })
      }
    }
    statusAnterior.current = status
  }, [status, toast])

  // Mostra só os 10 mais recentes no painel — é um indicador de status, não
  // um histórico completo (isso existe pra isso: `exportarEstoqueJson`).
  const itensRecentes = [...fila].reverse().slice(0, 10)

  return (
    <>
      <Badge
        variant={config.variant}
        className="gap-1.5 cursor-pointer select-none"
        onClick={() => setAberto(true)}
        data-testid="badge-status-sync">
        <Icon className={`h-3.5 w-3.5 ${status === 'sincronizando' ? 'animate-spin' : ''}`} />
        {config.label}
        {pendentes.length > 0 && status !== 'sincronizando' && ` (${pendentes.length})`}
      </Badge>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${status === 'sincronizando' ? 'animate-spin' : ''}`} />
              {config.label}
            </DialogTitle>
            <DialogDescription>{EXPLICACAO_POR_STATUS[status]}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {itensRecentes.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma ação registrada ainda nesta fila.</p>
            )}
            {itensRecentes.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-sm border-b pb-2 last:border-0">
                <span className="text-foreground truncate">{LABEL_TIPO_ACAO[item.tipo] ?? item.tipo}</span>
                <Badge
                  variant={item.status === 'sincronizado' ? 'secondary' : item.status === 'erro' ? 'destructive' : 'default'}
                  className="shrink-0">
                  {item.status === 'sincronizado'
                    ? formatDistanceToNow(new Date(item.sincronizadoEm ?? item.criadoEm), { addSuffix: true, locale: ptBR })
                    : item.status === 'erro'
                      ? 'Erro, tentando de novo'
                      : 'Pendente'}
                </Badge>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => sincronizarAgora()}
            disabled={status === 'sincronizando' || status === 'offline'}
            data-testid="button-sincronizar-agora">
            <RefreshCw className={`h-4 w-4 ${status === 'sincronizando' ? 'animate-spin' : ''}`} />
            Sincronizar agora
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
