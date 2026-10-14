import { Fragment, useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, CartesianGrid, XAxis } from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Download,
  Settings,
  PackageSearch
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { quickSetupStorage } from '@/lib/quickSetup'
import {
  listarMercados,
  listarProdutos,
  getMovimentacoes,
  getConfiguracao,
  salvarConfiguracao,
  encontrarMercadoPorNome,
  exportarEstoqueJson,
  listarPedidos,
  definirQuantidadePedido,
  removerQuantidadePedido,
  getCicloIdAtual,
  type EstoqueProduto,
  type PedidoItem
} from '@/lib/estoqueStorage'
import { assinarMudancasDoPull } from '@/lib/pullSync'
import { agruparPorCategoria } from '@/lib/categorias'
import { calcularSugestaoCompleta, calcularResumoPerdas, serieDiariaDeSaidas, type ResultadoSugestao } from '@/lib/estoqueAnalytics'

type Periodo = 'diario' | 'semanal' | 'mensal'

const DIAS_POR_PERIODO: Record<Periodo, number> = { diario: 1, semanal: 7, mensal: 30 }
// Giro é sempre calculado numa janela mínima de 7 dias — 1 dia isolado é
// estatisticamente pouco confiável pra sustentar uma sugestão de pedido.
const JANELA_MINIMA_GIRO = 7

const chartConfig: ChartConfig = {
  quantidade: { label: 'Saídas', color: 'hsl(var(--chart-1))' }
}

interface LinhaProduto {
  codigoEAN: string
  descricao: string
  produto: EstoqueProduto
  resultado: ResultadoSugestao
  pedido?: PedidoItem
}

const urgenciaBadge = (urgencia: ResultadoSugestao['urgencia']) => {
  if (urgencia === 'critico') return <Badge variant="destructive">Crítico</Badge>
  if (urgencia === 'atencao') return <Badge>Atenção</Badge>
  return <Badge variant="secondary">OK</Badge>
}

const tendenciaIcone = (tendencia: ResultadoSugestao['tendencia']) => {
  if (tendencia === 'subindo') return <TrendingUp className="h-4 w-4 text-destructive" />
  if (tendencia === 'caindo') return <TrendingDown className="h-4 w-4 text-muted-foreground" />
  return <Minus className="h-4 w-4 text-muted-foreground" />
}

// Tabela compartilhada pelas abas "Estoque e Sugestão" e "Giro Registrado" —
// a segunda é um espelho da primeira (mesmas colunas), só que filtrada pros
// itens já preenchidos neste ciclo (ver escopo "Listagem de Giro Registrado").
function TabelaProdutos({
  grupos,
  mensagemVazia,
  onAbrirProduto,
  onDefinirPedido,
  pedidosVersion
}: {
  grupos: { categoria: string; itens: LinhaProduto[] }[]
  mensagemVazia: string
  onAbrirProduto: (linha: LinhaProduto) => void
  onDefinirPedido: (codigoEAN: string, valor: string) => void
  pedidosVersion: number
}) {
  const totalItens = grupos.reduce((s, g) => s + g.itens.length, 0)
  const mostrarCabecalhoCategoria = grupos.length > 1

  if (totalItens === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">{mensagemVazia}</p>
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-muted-foreground border-b">
          <th className="py-2 pr-4">Produto</th>
          <th className="py-2 pr-4">Estoque</th>
          <th className="py-2 pr-4">Giro/dia</th>
          <th className="py-2 pr-4">Cobertura</th>
          <th className="py-2 pr-4">Sugestão</th>
          <th className="py-2 pr-4">Qtd. a pedir</th>
          <th className="py-2 pr-4">Tendência</th>
          <th className="py-2 pr-4">Status</th>
        </tr>
      </thead>
      <tbody>
        {grupos.map((grupo) => (
          <Fragment key={grupo.categoria}>
            {mostrarCabecalhoCategoria && (
              <tr>
                <td colSpan={8} className="pt-4 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {grupo.categoria}
                </td>
              </tr>
            )}
            {grupo.itens.map((linha) => (
              <tr
                key={linha.codigoEAN}
                className="border-b last:border-0 hover-elevate cursor-pointer"
                onClick={() => onAbrirProduto(linha)}
                data-testid={`row-produto-${linha.codigoEAN}`}>
                <td className="py-3 pr-4 max-w-[220px] truncate">{linha.produto.descricao}</td>
                <td className="py-3 pr-4">{linha.produto.estoque.quantidadeAtual}</td>
                <td className="py-3 pr-4">{linha.resultado.taxaDiaria.toFixed(1)}</td>
                <td className="py-3 pr-4">
                  {linha.resultado.diasDeCobertura === Infinity ? '—' : `${linha.resultado.diasDeCobertura.toFixed(1)}d`}
                </td>
                <td className="py-3 pr-4 font-medium">{linha.resultado.sugestaoPedido}</td>
                <td className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                  <Input
                    key={`${linha.codigoEAN}-${linha.pedido?.atualizadoEm ?? 'vazio'}-${pedidosVersion}`}
                    type="number"
                    min="0"
                    inputMode="numeric"
                    className="w-20 h-8"
                    defaultValue={linha.pedido ? linha.pedido.quantidade : ''}
                    placeholder="—"
                    onFocus={(e) => e.target.select()}
                    onBlur={(e) => onDefinirPedido(linha.codigoEAN, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    }}
                    data-testid={`input-quantidade-pedido-${linha.codigoEAN}`}
                  />
                </td>
                <td className="py-3 pr-4">{tendenciaIcone(linha.resultado.tendencia)}</td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-1 flex-wrap">
                    {urgenciaBadge(linha.resultado.urgencia)}
                    {linha.pedido?.quantidade === 0 && <Badge variant="destructive">Ruptura</Badge>}
                  </div>
                </td>
              </tr>
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  )
}

export default function PainelSugestaoPage() {
  const quickSetup = quickSetupStorage.get()
  const mercados = listarMercados()
  const operador = quickSetup?.operatorName ?? 'Operador'
  const cicloAtual = useMemo(() => getCicloIdAtual(), [])

  const mercadoInicial = quickSetup?.nomeCliente ? encontrarMercadoPorNome(quickSetup.nomeCliente) : null
  const [mercadoId, setMercadoId] = useState<string>(mercadoInicial ?? mercados[0]?.id ?? '')
  const [periodo, setPeriodo] = useState<Periodo>('semanal')
  const [produtoSelecionado, setProdutoSelecionado] = useState<LinhaProduto | null>(null)
  const [config, setConfig] = useState(() => getConfiguracao())
  // Bump manual sempre que um pedido é salvo/removido aqui, ou quando o
  // pull-sync (outro aparelho) traz pedidos novos — força o memo de
  // `pedidosPorEAN` (e por tabela, a reordenação "preenchido primeiro") a
  // reler o storage.
  const [pedidosVersion, setPedidosVersion] = useState(0)

  useEffect(() => assinarMudancasDoPull(() => setPedidosVersion((v) => v + 1)), [])

  const movimentacoes = useMemo(() => getMovimentacoes(), [mercadoId])
  const produtos = useMemo(() => (mercadoId ? listarProdutos(mercadoId) : []), [mercadoId])
  const diasJanelaGiro = Math.max(DIAS_POR_PERIODO[periodo], JANELA_MINIMA_GIRO)

  const pedidosPorEAN = useMemo(() => {
    const mapa = new Map<string, PedidoItem>()
    if (mercadoId) {
      for (const p of listarPedidos(mercadoId, cicloAtual)) mapa.set(p.codigoEAN, p)
    }
    return mapa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mercadoId, cicloAtual, pedidosVersion])

  const linhas: LinhaProduto[] = useMemo(() => {
    return produtos
      .map(({ codigoEAN, produto }) => {
        const resultado = calcularSugestaoCompleta(movimentacoes, {
          mercadoId,
          codigoEAN,
          quantidadeAtual: produto.estoque.quantidadeAtual,
          validadeMediaDias: produto.validadeMediaDias,
          diasJanela: diasJanelaGiro,
          leadTimeDias: config.leadTimeDiasPadrao,
          diasAteProximaPesquisa: config.diasAtePesquisaPadrao
        })
        return { codigoEAN, descricao: produto.descricao, produto, resultado, pedido: pedidosPorEAN.get(codigoEAN) }
      })
      .sort((a, b) => {
        // Itens já preenchidos nesta sessão/ciclo (inclusive ruptura, qtd=0)
        // sobem pro topo — dentro de cada grupo de categoria, é isso que o
        // agrupamento abaixo preserva.
        const preenchidoA = a.pedido ? 0 : 1
        const preenchidoB = b.pedido ? 0 : 1
        if (preenchidoA !== preenchidoB) return preenchidoA - preenchidoB
        const ordemUrgencia = { critico: 0, atencao: 1, ok: 2 }
        return ordemUrgencia[a.resultado.urgencia] - ordemUrgencia[b.resultado.urgencia]
      })
  }, [produtos, movimentacoes, mercadoId, diasJanelaGiro, config, pedidosPorEAN])

  const gruposSugestao = useMemo(() => agruparPorCategoria(linhas), [linhas])
  const gruposGiroRegistrado = useMemo(
    () => agruparPorCategoria(linhas.filter((l) => l.pedido !== undefined)),
    [linhas]
  )

  const handleDefinirPedido = (codigoEAN: string, valorBruto: string) => {
    if (!mercadoId) return
    const valor = valorBruto.trim()
    if (valor === '') {
      removerQuantidadePedido(mercadoId, codigoEAN, cicloAtual)
    } else {
      const quantidade = parseInt(valor, 10)
      if (Number.isNaN(quantidade) || quantidade < 0) {
        // Entrada inválida — força o input a voltar pro último valor salvo
        // (o `key` do Input inclui `pedidosVersion`, então o bump abaixo já
        // basta pra remontar com o defaultValue correto).
        setPedidosVersion((v) => v + 1)
        return
      }
      definirQuantidadePedido({ mercadoId, codigoEAN, quantidade, operador, cicloId: cicloAtual })
    }
    setPedidosVersion((v) => v + 1)
  }

  const resumoPerdas = useMemo(
    () => calcularResumoPerdas(movimentacoes, { mercadoId, diasJanela: DIAS_POR_PERIODO[periodo] }),
    [movimentacoes, mercadoId, periodo]
  )

  const itensCriticos = linhas.filter((l) => l.resultado.urgencia === 'critico').length
  const totalSugerido = linhas.reduce((s, l) => s + l.resultado.sugestaoPedido, 0)

  const serieDoProdutoSelecionado = produtoSelecionado
    ? serieDiariaDeSaidas(movimentacoes, { mercadoId, codigoEAN: produtoSelecionado.codigoEAN, dias: 14 })
    : []

  const handleSalvarConfig = (novaConfig: typeof config) => {
    setConfig(novaConfig)
    salvarConfiguracao(novaConfig)
  }

  const handleExportarPerdasCsv = () => {
    const linhasCsv = [
      ['Produto', 'EAN', 'Avaria', 'Vencimento'].join(','),
      ...linhas.map((l) => {
        const perdasProduto = calcularResumoPerdas(
          movimentacoes.filter((m) => m.codigoEAN === l.codigoEAN),
          { mercadoId, diasJanela: DIAS_POR_PERIODO[periodo] }
        )
        return [`"${l.produto.descricao}"`, l.codigoEAN, perdasProduto.avaria, perdasProduto.vencimento].join(',')
      })
    ].join('\n')

    const blob = new Blob([linhasCsv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `perdas-${mercadoId}-${periodo}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2 flex items-center gap-2">
            <PackageSearch className="h-7 w-7 text-primary" />
            Painel de Sugestão de Pedidos
          </h1>
          <p className="text-muted-foreground">Giro, cobertura e reposição por produto.</p>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" data-testid="button-config-painel">
              <Settings className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-3">
            <div>
              <Label htmlFor="lead-time">Lead time de entrega (dias)</Label>
              <Input
                id="lead-time"
                type="number"
                min="0"
                value={config.leadTimeDiasPadrao}
                onChange={(e) => handleSalvarConfig({ ...config, leadTimeDiasPadrao: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
            <div>
              <Label htmlFor="validade-media">Validade média padrão (dias)</Label>
              <Input
                id="validade-media"
                type="number"
                min="1"
                value={config.validadeMediaDiasPadrao}
                onChange={(e) => handleSalvarConfig({ ...config, validadeMediaDiasPadrao: parseInt(e.target.value, 10) || 1 })}
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <Select value={mercadoId} onValueChange={setMercadoId}>
          <SelectTrigger className="w-full sm:w-[260px]" data-testid="select-mercado-painel">
            <SelectValue placeholder="Selecione o mercado" />
          </SelectTrigger>
          <SelectContent>
            {mercados.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
          <TabsList>
            <TabsTrigger value="diario">Diário</TabsTrigger>
            <TabsTrigger value="semanal">Semanal</TabsTrigger>
            <TabsTrigger value="mensal">Mensal</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Itens críticos</p>
            <p className="text-3xl font-semibold text-destructive">{itensCriticos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total sugerido no período</p>
            <p className="text-3xl font-semibold text-foreground">{totalSugerido}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">% de perdas no período</p>
            <p className="text-3xl font-semibold text-foreground">{resumoPerdas.percentual.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="estoque">
        <TabsList>
          <TabsTrigger value="estoque">Estoque e Sugestão</TabsTrigger>
          <TabsTrigger value="giro">Giro Registrado</TabsTrigger>
          <TabsTrigger value="perdas">Perdas</TabsTrigger>
        </TabsList>

        <TabsContent value="estoque">
          <Card>
            <CardHeader>
              <CardTitle>Produtos por urgência</CardTitle>
              <CardDescription>
                Clique num produto pra ver o histórico de saídas. Preencha "Qtd. a pedir" pra ele subir pro topo e
                aparecer na aba Giro Registrado — digite 0 pra marcar ruptura (sem estoque).
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <TabelaProdutos
                grupos={gruposSugestao}
                mensagemVazia="Nenhum produto monitorado neste mercado ainda — use a Pesquisa Semanal pra começar."
                onAbrirProduto={setProdutoSelecionado}
                onDefinirPedido={handleDefinirPedido}
                pedidosVersion={pedidosVersion}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="giro">
          <Card>
            <CardHeader>
              <CardTitle>Giro registrado neste ciclo</CardTitle>
              <CardDescription>
                Só os produtos com "Qtd. a pedir" já preenchida neste ciclo ({cicloAtual}) — inclusive ruptura
                (quantidade 0). Cresce automaticamente conforme novos itens vão sendo preenchidos.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <TabelaProdutos
                grupos={gruposGiroRegistrado}
                mensagemVazia="Nenhum item registrado neste ciclo ainda — preencha a Qtd. a pedir na aba Estoque e Sugestão pra ele aparecer aqui."
                onAbrirProduto={setProdutoSelecionado}
                onDefinirPedido={handleDefinirPedido}
                pedidosVersion={pedidosVersion}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="perdas">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Perdas no período
                  </CardTitle>
                  <CardDescription>Avaria × vencimento, no mercado e período selecionados.</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={handleExportarPerdasCsv}>
                  <Download className="h-4 w-4" />
                  Exportar CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Avaria</p>
                  <p className="text-2xl font-semibold text-foreground">{resumoPerdas.avaria}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vencimento</p>
                  <p className="text-2xl font-semibold text-foreground">{resumoPerdas.vencimento}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de perdas</p>
                  <p className="text-2xl font-semibold text-destructive">{resumoPerdas.totalPerdas}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Download do "frutap.json" atualizado — backup/portabilidade real */}
      <div className="mt-6">
        <Button variant="outline" className="gap-2" onClick={() => exportarEstoqueJson()} data-testid="button-exportar-json">
          <Download className="h-4 w-4" />
          Baixar JSON do estoque (Frutap)
        </Button>
      </div>

      {/* Drill-down: histórico de saídas do produto clicado */}
      <Dialog open={produtoSelecionado !== null} onOpenChange={(open) => !open && setProdutoSelecionado(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{produtoSelecionado?.produto.descricao}</DialogTitle>
            <DialogDescription>Saídas por dia nos últimos 14 dias.</DialogDescription>
          </DialogHeader>
          <ChartContainer config={chartConfig} className="aspect-[2/1]">
            <BarChart data={serieDoProdutoSelecionado}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="data" tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="quantidade" fill="var(--color-quantidade)" radius={4} />
            </BarChart>
          </ChartContainer>
        </DialogContent>
      </Dialog>
    </div>
  )
}
