import { useEffect, useMemo, useState } from 'react'
import { useLocation, Link } from 'wouter'
import { ClipboardList, Minus, Plus, AlertTriangle, Info, PackagePlus, Zap, Search } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { quickSetupStorage } from '@/lib/quickSetup'
import {
  listarMercados,
  listarProdutos,
  encontrarMercadoPorNome,
  garantirMercado,
  cadastrarProdutoNoCatalogo,
  definirEstoqueInicial,
  salvarPesquisaSemanal,
  getPesquisaDoCicloAtual,
  getCicloIdAtual
} from '@/lib/estoqueStorage'

export default function PesquisaSemanalPage() {
  const { toast } = useToast()
  const [, setLocation] = useLocation()
  const quickSetup = quickSetupStorage.get()

  const [mercados, setMercados] = useState(() => listarMercados())
  const [mercadoId, setMercadoId] = useState<string>('')
  const [contagens, setContagens] = useState<Record<string, number>>({})
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false)
  const [mostrarAdicionarProduto, setMostrarAdicionarProduto] = useState(false)
  const [novoProduto, setNovoProduto] = useState({ codigoEAN: '', descricao: '', quantidadeInicial: 0 })
  const [busca, setBusca] = useState('')
  // Incrementado sempre que a lista de produtos do mercado precisa ser
  // relida do storage (ex.: depois de cadastrar um produto novo).
  const [refreshKey, setRefreshKey] = useState(0)

  // Ao montar: se o Setup Rápido tem um mercado configurado, já usa ele —
  // criando o mercado no estoque na hora, se ainda não existir por lá.
  useEffect(() => {
    if (quickSetup?.nomeCliente) {
      const existenteId = encontrarMercadoPorNome(quickSetup.nomeCliente)
      const id =
        existenteId ??
        garantirMercado(quickSetup.nomeCliente, {
          rua: quickSetup.enderecoCliente || '',
          bairro: '',
          cidade: '',
          estado: ''
        })
      setMercados(listarMercados())
      setMercadoId(id)
    } else {
      const lista = listarMercados()
      setMercados(lista)
      if (lista.length > 0) setMercadoId(lista[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const produtos = useMemo(() => (mercadoId ? listarProdutos(mercadoId) : []), [mercadoId, refreshKey])

  // Sempre que troca de mercado (ou os produtos mudam), reinicia a contagem
  // com o valor esperado (estoque atual) como ponto de partida.
  useEffect(() => {
    const base: Record<string, number> = {}
    produtos.forEach(({ codigoEAN, produto }) => {
      base[codigoEAN] = produto.estoque.quantidadeAtual
    })
    setContagens(base)
  }, [mercadoId, produtos])

  const pesquisaDoCiclo = mercadoId ? getPesquisaDoCicloAtual(mercadoId) : null
  const cicloAtual = getCicloIdAtual()

  const operador = quickSetup?.operatorName ?? ''

  // Lista completa — usada na confirmação final (TODOS os itens, mesmo sem
  // ter sido tocados, pra não perder nenhuma divergência da revisão).
  const itensComDivergencia = useMemo(() => {
    return produtos.map(({ codigoEAN, produto }) => {
      const quantidadeContada = contagens[codigoEAN] ?? produto.estoque.quantidadeAtual
      const quantidadeEsperada = produto.estoque.quantidadeAtual
      const divergencia = quantidadeContada - quantidadeEsperada
      const divergenciaGrande =
        quantidadeEsperada === 0 ? quantidadeContada > 0 : Math.abs(divergencia) / Math.max(quantidadeEsperada, 1) > 0.2
      return { codigoEAN, descricao: produto.descricao, quantidadeEsperada, quantidadeContada, divergencia, divergenciaGrande }
    })
  }, [produtos, contagens])

  // Catálogo inteiro aparece pra qualquer mercado agora (fix do travamento
  // antigo) — com a busca o operador acha o item rápido mesmo com o catálogo
  // grande, sem precisar rolar tudo.
  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return itensComDivergencia
    return itensComDivergencia.filter(
      (item) => item.descricao.toLowerCase().includes(termo) || item.codigoEAN.toLowerCase().includes(termo)
    )
  }, [itensComDivergencia, busca])

  // Com o catálogo global agora tendo dezenas de itens por mercado, listar
  // TODOS na revisão final ficaria enorme pra conferir — só o que realmente
  // mudou importa aqui; o resto é resumido num contador.
  const itensAlterados = useMemo(() => itensComDivergencia.filter((item) => item.divergencia !== 0), [itensComDivergencia])
  const quantidadeInalterados = itensComDivergencia.length - itensAlterados.length

  const ajustarContagem = (codigoEAN: string, delta: number) => {
    setContagens((atual) => ({ ...atual, [codigoEAN]: Math.max(0, (atual[codigoEAN] ?? 0) + delta) }))
  }

  const handleCadastrarProduto = () => {
    if (!mercadoId || !novoProduto.codigoEAN || !novoProduto.descricao) {
      toast({ title: 'Preencha EAN e descrição', variant: 'destructive' })
      return
    }

    const codigoEAN = novoProduto.codigoEAN.trim()

    // Cadastra no catálogo GLOBAL — a partir de agora o item aparece pra
    // qualquer mercado, não só pra esse.
    cadastrarProdutoNoCatalogo(codigoEAN, novoProduto.descricao.trim())
    definirEstoqueInicial(mercadoId, codigoEAN, novoProduto.quantidadeInicial, operador || 'Operador')

    toast({ title: 'Produto cadastrado no catálogo!', description: 'Já disponível pra todos os mercados.' })
    setNovoProduto({ codigoEAN: '', descricao: '', quantidadeInicial: 0 })
    setMostrarAdicionarProduto(false)
    setMercados(listarMercados())
    setRefreshKey((k) => k + 1)
  }

  const handleFecharPesquisa = () => {
    if (!mercadoId) return

    salvarPesquisaSemanal({
      mercadoId,
      operador: operador || 'Operador',
      itens: itensComDivergencia.map((item) => ({ codigoEAN: item.codigoEAN, quantidadeContada: item.quantidadeContada }))
    })

    toast({
      title: 'Pesquisa semanal fechada!',
      description: `Ciclo ${cicloAtual} registrado. Confira a sugestão de pedido agora.`
    })

    setMostrarConfirmacao(false)
    setLocation('/painel-sugestao')
  }

  if (!quickSetup) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardContent className="pt-6 flex flex-col items-center text-center gap-4">
            <Zap className="h-10 w-10 text-primary" />
            <div>
              <p className="font-medium text-foreground">Configure o Setup Rápido primeiro</p>
              <p className="text-sm text-muted-foreground mt-1">
                A Pesquisa Semanal usa o operador e o mercado do Setup Rápido pra já abrir direto na contagem, sem
                pedir isso de novo.
              </p>
            </div>
            <Link href="/setup-rapido">
              <Button className="gap-2">
                <Zap className="h-4 w-4" />
                Ir para o Setup Rápido
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground mb-2 flex items-center gap-2">
          <ClipboardList className="h-7 w-7 text-primary" />
          Pesquisa Semanal
        </h1>
        <p className="text-muted-foreground">
          Conte o que está na prateleira. Ciclo atual: <span className="font-medium text-foreground">{cicloAtual}</span>
        </p>
      </div>

      {pesquisaDoCiclo && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span className="text-foreground">
            Você já fechou a pesquisa deste ciclo em{' '}
            <span className="font-medium">{format(new Date(pesquisaDoCiclo.fechadaEm), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>.
            Pode recontar e fechar de novo se precisar corrigir algo.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>Contagem por produto</CardTitle>
              <CardDescription>Ajuste a quantidade real encontrada em cada item.</CardDescription>
            </div>
            <Select value={mercadoId} onValueChange={setMercadoId}>
              <SelectTrigger className="w-full sm:w-[260px]" data-testid="select-mercado-pesquisa">
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
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {produtos.length > 8 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto por nome ou EAN..."
                className="pl-10"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                data-testid="input-busca-produto"
              />
            </div>
          )}

          {itensFiltrados.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {busca ? 'Nenhum produto encontrado com esse termo.' : 'Nenhum produto no catálogo ainda. Cadastre um abaixo.'}
            </p>
          )}

          {itensFiltrados.map((item) => (
            <div
              key={item.codigoEAN}
              className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{item.descricao}</p>
                <p className="text-xs text-muted-foreground font-mono">{item.codigoEAN}</p>
              </div>
              <div className="text-xs text-muted-foreground shrink-0">Esperado: {item.quantidadeEsperada}</div>
              <div className="flex items-center gap-2 shrink-0">
                <Button type="button" variant="outline" size="icon" onClick={() => ajustarContagem(item.codigoEAN, -1)}>
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min="0"
                  className="w-20 text-center"
                  value={contagens[item.codigoEAN] ?? 0}
                  onChange={(e) =>
                    setContagens((atual) => ({ ...atual, [item.codigoEAN]: Math.max(0, parseInt(e.target.value, 10) || 0) }))
                  }
                  data-testid={`input-contagem-${item.codigoEAN}`}
                />
                <Button type="button" variant="outline" size="icon" onClick={() => ajustarContagem(item.codigoEAN, 1)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {item.divergenciaGrande && (
                <Badge variant="destructive" className="shrink-0 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {item.divergencia > 0 ? '+' : ''}
                  {item.divergencia}
                </Badge>
              )}
            </div>
          ))}

          <Button type="button" variant="outline" className="gap-2" onClick={() => setMostrarAdicionarProduto(true)}>
            <PackagePlus className="h-4 w-4" />
            Cadastrar produto novo no catálogo
          </Button>
        </CardContent>
      </Card>

      <Button
        className="w-full mt-6 gap-2"
        size="lg"
        disabled={produtos.length === 0}
        onClick={() => setMostrarConfirmacao(true)}
        data-testid="button-revisar-pesquisa">
        Revisar e Fechar Pesquisa
      </Button>

      {/* Confirmação com as divergências antes de fechar de verdade */}
      <Dialog open={mostrarConfirmacao} onOpenChange={setMostrarConfirmacao}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar pesquisa</DialogTitle>
            <DialogDescription>Revise as divergências antes de fechar o ciclo {cicloAtual}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {itensAlterados.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma contagem foi alterada do valor esperado.</p>
            )}
            {itensAlterados.map((item) => (
              <div key={item.codigoEAN} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                <span className="text-foreground truncate pr-2">{item.descricao}</span>
                <span className={item.divergenciaGrande ? 'text-destructive font-medium shrink-0' : 'text-muted-foreground shrink-0'}>
                  {item.quantidadeEsperada} → {item.quantidadeContada} ({item.divergencia > 0 ? '+' : ''}
                  {item.divergencia})
                </span>
              </div>
            ))}
          </div>
          {quantidadeInalterados > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              {quantidadeInalterados} produto{quantidadeInalterados > 1 ? 's' : ''} sem alteração não {quantidadeInalterados > 1 ? 'aparecem' : 'aparece'} aqui, mas{' '}
              {quantidadeInalterados > 1 ? 'serão' : 'será'} salvo{quantidadeInalterados > 1 ? 's' : ''} normalmente.
            </p>
          )}
          <Button onClick={handleFecharPesquisa} className="w-full" data-testid="button-confirmar-pesquisa">
            Confirmar e Fechar Pesquisa
          </Button>
        </DialogContent>
      </Dialog>

      {/* Cadastrar produto novo no catálogo global — fica disponível pra todos os mercados */}
      <Dialog open={mostrarAdicionarProduto} onOpenChange={setMostrarAdicionarProduto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastrar produto novo</DialogTitle>
            <DialogDescription>
              Só use isso pra um item que ainda não existe em nenhum mercado. Produtos já cadastrados aparecem
              automaticamente na busca acima, em qualquer mercado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Código EAN"
              value={novoProduto.codigoEAN}
              onChange={(e) => setNovoProduto((n) => ({ ...n, codigoEAN: e.target.value }))}
            />
            <Input
              placeholder="Descrição do produto"
              value={novoProduto.descricao}
              onChange={(e) => setNovoProduto((n) => ({ ...n, descricao: e.target.value }))}
            />
            <Input
              type="number"
              min="0"
              placeholder="Quantidade atual neste mercado"
              value={novoProduto.quantidadeInicial}
              onChange={(e) => setNovoProduto((n) => ({ ...n, quantidadeInicial: parseInt(e.target.value, 10) || 0 }))}
            />
            <Button onClick={handleCadastrarProduto} className="w-full">
              Cadastrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
