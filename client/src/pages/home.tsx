import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  Barcode,
  ClipboardList,
  Dog,
  PackageX,
  PackageSearch,
  ShieldAlert,
  ChevronDown,
  LogIn,
  WifiOff,
  Users,
  FileDown,
  Check,
  Sun,
  Moon
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoginForm } from '@/components/LoginForm'
import { useTheme } from '@/lib/theme-provider'
import instaLogo from '@assets/instagran.png'

gsap.registerPlugin(ScrollTrigger)

// Home animada (v2.5, 2026-10-13; redesenhada em 2026-10-13 após feedback
// de que estava "simples demais" e o login "quebrando o layout") —
// substitui a tela de login "nua" como ponto de entrada de quem não está
// autenticado (ver AuthGate em App.tsx). O formulário de login em si é o
// mesmo de sempre (LoginForm, extraído de login.tsx) — só o que está AO
// REDOR dele mudou; nenhuma lógica de autenticação foi duplicada ou
// reescrita aqui.
//
// O que mudou nessa revisão: (1) hero mais compacto, sem buraco vazio
// entre o CTA e a seta de rolar; (2) nova seção "Como funciona" com 3
// passos, pra dar uma narrativa clara antes da grade de funcionalidades
// (que sozinha parecia genérica demais); (3) seção de login reconstruída
// como um cartão dividido (painel de benefícios + formulário), em vez de
// um Card solto flutuando numa área cinza vazia — isso também dá espaço
// pra responder, dentro do próprio produto, a dúvida mais comum de quem
// chega aqui pela primeira vez: "não tem como eu me cadastrar?" (resposta:
// de propósito não tem cadastro público — quem dá acesso é o admin do
// mercado, então avisamos isso embaixo do formulário em vez de deixar a
// pessoa se perguntando).
const FUNCIONALIDADES = [
  {
    icon: Barcode,
    titulo: 'Registrar',
    descricao: 'Leia o código de barras e o produto já vem com descrição, categoria e validade preenchidos — cadastro em segundos, sem digitar nada à mão.'
  },
  {
    icon: ClipboardList,
    titulo: 'Pesquisa Semanal',
    descricao: 'Conte o estoque com a câmera, registre o preço com máscara automática de centavos e feche o ciclo revisando só o que realmente mudou.'
  },
  {
    icon: Dog,
    titulo: 'Farejar Vencimentos',
    descricao: 'Veja em um toque tudo que vence nos próximos 3 dias — ou já venceu — antes que vire perda de verdade.'
  },
  {
    icon: PackageX,
    titulo: 'Avarias e Quebras',
    descricao: 'Registre avarias direto da prateleira: o estoque é abatido na hora, sem planilha paralela pra conciliar depois.'
  },
  {
    icon: PackageSearch,
    titulo: 'Sugestão de Pedido',
    descricao: 'Acompanhe perdas por mercado (avaria, vencimento, venda) e saiba o que repor antes de faltar na prateleira.'
  },
  {
    icon: ShieldAlert,
    titulo: 'Administração',
    descricao: 'Histórico de login, relatórios em .docx prontos pra imprimir, e limpeza de logs protegida por confirmação explícita.'
  }
]

const COMO_FUNCIONA = [
  {
    numero: '1',
    titulo: 'Registre',
    descricao: 'O código de barras já traz descrição e categoria — você só confirma a validade e a quantidade.'
  },
  {
    numero: '2',
    titulo: 'Acompanhe',
    descricao: 'Vencimentos próximos, avarias e a contagem semanal ficam visíveis pra toda a equipe, em tempo real.'
  },
  {
    numero: '3',
    titulo: 'Reponha',
    descricao: 'A Sugestão de Pedido cruza perdas e saldo por mercado e mostra exatamente o que repor.'
  }
]

const DESTAQUES = [
  { icon: WifiOff, texto: 'Offline-first — funciona sem sinal e sincroniza sozinho quando a conexão volta' },
  { icon: Users, texto: 'Multi-operador com permissões — cada pessoa com seu próprio login' },
  { icon: FileDown, texto: 'Relatórios em .docx, prontos pra imprimir, enviar ou arquivar' }
]

const BENEFICIOS_LOGIN = [
  'Sem planilha paralela pra conciliar depois',
  'Funciona offline e sincroniza sozinho',
  'Cada operador com seu próprio login'
]

export default function HomePage() {
  const containerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Quem pediu menos movimento no sistema operacional não deveria ver
      // nada animando aqui — o conteúdo já nasce no estado final (visível,
      // no lugar), só sem a transição de entrada.
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (prefersReducedMotion) return

      const heroTimeline = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.8 } })
      heroTimeline
        .from('.hero-logo', { opacity: 0, y: -16 })
        .from('.hero-headline', { opacity: 0, y: 24 }, '-=0.5')
        .from('.hero-sub', { opacity: 0, y: 16 }, '-=0.5')
        .from('.hero-cta', { opacity: 0, y: 16 }, '-=0.5')
        .from('.hero-scroll-cue', { opacity: 0 }, '-=0.3')

      gsap.utils.toArray<HTMLElement>('.reveal-section').forEach((section) => {
        gsap.from(section, {
          opacity: 0,
          y: 48,
          duration: 0.7,
          ease: 'power2.out',
          scrollTrigger: { trigger: section, start: 'top 85%' }
        })
      })

      gsap.utils.toArray<HTMLElement>('.reveal-stagger').forEach((grupo) => {
        const itens = grupo.querySelectorAll('.reveal-item')
        gsap.from(itens, {
          opacity: 0,
          y: 28,
          duration: 0.6,
          stagger: 0.1,
          ease: 'power2.out',
          scrollTrigger: { trigger: grupo, start: 'top 85%' }
        })
      })
    }, containerRef)

    return () => ctx.revert()
  }, [])

  const irParaLogin = () => {
    document.getElementById('entrar')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const { theme, toggleTheme } = useTheme()

  return (
    <div ref={containerRef} className="min-h-screen bg-background">
      {/* Barra fixa — logo + seletor de tema + botão "Entrar" sempre à mão,
          sem precisar rolar até o fim. Seletor de tema (2026-10-13): mesmo
          botão/ícone/comportamento do Header.tsx (que só aparece logado) —
          antes a Home era a única tela do app sem jeito de trocar de tema. */}
      <header className="fixed top-0 inset-x-0 z-50 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={instaLogo} className="w-8 h-8 object-contain" alt="Logo" />
            <span className="font-semibold text-foreground">Controle de Perdas</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} data-testid="button-theme-toggle">
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
            <Button onClick={irParaLogin} size="sm" className="gap-2" data-testid="button-header-entrar">
              <LogIn className="h-4 w-4" />
              Entrar
            </Button>
          </div>
        </div>
      </header>

      {/* Hero — mais compacto que antes (min-h-[88vh] em vez de min-h-screen),
          pra não deixar aquele vão vazio entre o CTA e a seta de rolar. */}
      <section className="relative flex flex-col items-center justify-center text-center min-h-[88vh] px-4 pt-16 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
        <img src={instaLogo} className="hero-logo w-16 h-16 object-contain mb-6" alt="Logo" />
        <h1 className="hero-headline text-4xl sm:text-5xl md:text-6xl font-semibold text-foreground max-w-3xl text-balance">
          Menos perda, mais controle sobre o que sai da prateleira
        </h1>
        <p className="hero-sub mt-6 text-lg text-muted-foreground max-w-xl text-balance">
          Registro por código de barras, contagem semanal assistida por câmera, avarias, vencimentos e relatórios —
          tudo sincronizado entre operadores, mesmo offline.
        </p>
        <div className="hero-cta mt-8">
          <Button size="lg" className="gap-2" onClick={irParaLogin} data-testid="button-hero-entrar">
            <LogIn className="h-5 w-5" />
            Entrar na aplicação
          </Button>
        </div>
        <button
          onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })}
          className="hero-scroll-cue absolute bottom-8 text-muted-foreground hover:text-foreground transition-colors animate-bounce"
          aria-label="Rolar para ver mais">
          <ChevronDown className="h-6 w-6" />
        </button>
      </section>

      {/* Como funciona — narrativa em 3 passos, pra quem chega entender o
          fluxo de ponta a ponta antes de ver a grade de funcionalidades. */}
      <section id="como-funciona" className="py-20 px-4 bg-muted/20 border-y">
        <div className="container mx-auto max-w-4xl">
          <div className="reveal-section text-center mb-14">
            <h2 className="text-3xl font-semibold text-foreground mb-3">Como funciona, na prática</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Três passos entre o produto chegar na prateleira e virar decisão de reposição.
            </p>
          </div>

          <div className="reveal-stagger grid grid-cols-1 sm:grid-cols-3 gap-10">
            {COMO_FUNCIONA.map((passo) => (
              <div key={passo.numero} className="reveal-item flex flex-col items-center text-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-semibold shrink-0">
                  {passo.numero}
                </div>
                <h3 className="font-semibold text-foreground">{passo.titulo}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{passo.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="funcionalidades" className="py-24 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="reveal-section text-center mb-14">
            <h2 className="text-3xl font-semibold text-foreground mb-3">Tudo que o dia a dia na câmara fria precisa</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Cada tela resolve um problema real de quem opera perecíveis — do cadastro rápido até o relatório que
              vai pro backup.
            </p>
          </div>

          <div className="reveal-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FUNCIONALIDADES.map((f) => (
              <Card key={f.titulo} className="reveal-item h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{f.titulo}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">{f.descricao}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Destaques / trust strip */}
      <section className="py-16 px-4 bg-muted/20 border-y">
        <div className="container mx-auto max-w-4xl">
          <div className="reveal-stagger grid grid-cols-1 sm:grid-cols-3 gap-5">
            {DESTAQUES.map((d) => (
              <Card key={d.texto} className="reveal-item border-primary/15 bg-primary/5 shadow-none">
                <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-primary/15 flex items-center justify-center">
                    <d.icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">{d.texto}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Login — cartão dividido (benefícios + formulário) em vez de um Card
          solto flutuando sozinho numa área vazia. O aviso abaixo do botão
          responde, dentro do produto, a dúvida mais comum de quem chega
          aqui: não existe cadastro público de propósito, o acesso é criado
          pelo admin do mercado. */}
      <section id="entrar" className="reveal-section py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="grid md:grid-cols-2 rounded-2xl overflow-hidden border shadow-sm">
            <div className="bg-primary text-primary-foreground p-8 sm:p-10 flex flex-col justify-center gap-7">
              <div>
                <div className="h-11 w-11 rounded-full bg-white/15 flex items-center justify-center mb-5">
                  <img src={instaLogo} className="w-7 h-7 object-contain" alt="Logo" />
                </div>
                <h2 className="text-2xl font-semibold mb-2 text-balance">Pronto pra organizar o estoque do seu mercado?</h2>
                <p className="text-primary-foreground/85 text-sm leading-relaxed">
                  Entre com o usuário e a senha que o administrador cadastrou pra você.
                </p>
              </div>
              <ul className="space-y-3">
                {BENEFICIOS_LOGIN.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-primary-foreground/90">
                    <Check className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-card p-8 sm:p-10 flex flex-col justify-center">
              <h3 className="text-xl font-semibold text-foreground mb-1">Entrar</h3>
              <p className="text-sm text-muted-foreground mb-6">Use seu usuário e senha de operador ou administrador</p>
              <LoginForm />
              <p className="text-xs text-muted-foreground mt-5 text-center leading-relaxed">
                Ainda não tem uma conta? O acesso é criado pelo administrador do seu mercado — fale com ele pra
                receber seu usuário e senha.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-8 px-4 text-center text-sm text-muted-foreground border-t">
        Controle de Perdas — feito pra reduzir desperdício de produtos perecíveis.
      </footer>
    </div>
  )
}
