import { useEffect, useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { Header } from "@/components/Header";
import RegisterPage from "@/pages/register";
import QuickSetupPage from "@/pages/quick-setup";
import PesquisaSemanalPage from "@/pages/pesquisa-semanal";
import PainelSugestaoPage from "@/pages/painel-sugestao";
import ListPage from "@/pages/list";
import UpdatePage from "@/pages/update";
import DeletePage from "@/pages/delete";
import FarejarPage from "@/pages/farejar";
import AvariasPage from "@/pages/avarias";
import AdminPage from "@/pages/admin";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import { assinarMudancasDeAuth, estaAutenticado } from "@/lib/apiClient";
import { puxarDoServidor } from "@/lib/pullSync";

function Router() {
  return (
    <Switch>
      <Route path="/" component={RegisterPage} />
      <Route path="/setup-rapido" component={QuickSetupPage} />
      <Route path="/pesquisa-semanal" component={PesquisaSemanalPage} />
      <Route path="/painel-sugestao" component={PainelSugestaoPage} />
      <Route path="/listar" component={ListPage} />
      <Route path="/atualizar" component={UpdatePage} />
      <Route path="/deletar" component={DeletePage} />
      <Route path="/farejar" component={FarejarPage} />
      <Route path="/avarias" component={AvariasPage} />
      <Route path="/admin" component={AdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Enquanto não autenticado, SÓ a tela de login renderiza — nada de dado
// (nem o Header, nem nenhuma rota) aparece antes de um login real. Assina
// assinarMudancasDeAuth pra reagir tanto ao login (login.tsx chama isso)
// quanto a um logout em qualquer lugar (botão "Sair" no Header, ou um 401
// vindo do servidor que apiFetch trata derrubando a sessão sozinho).
//
// Decisão: confia no `exp` do token já decodificado localmente (estaAutenticado),
// sem bater um GET /api/auth/me extra no boot — mais simples, e revogação
// do lado do servidor já é coberta na prática pelo tratamento de 401 em
// qualquer chamada real feita depois (apiFetch desloga e lança ErroNaoAutenticado).
function AuthGate({ children }: { children: React.ReactNode }) {
  const [autenticado, setAutenticado] = useState(estaAutenticado());

  useEffect(() => {
    return assinarMudancasDeAuth(() => setAutenticado(estaAutenticado()));
  }, []);

  // Assim que uma sessão existe (login nesta aba, ou já vinha autenticado de
  // uma visita anterior), puxa o estado do servidor uma vez em segundo
  // plano — pega o que outros operadores registraram em outros aparelhos.
  // Cada tela de leitura (Farejar, Listar, Pesquisa Semanal) também puxa a
  // sua própria fatia ao montar, então isso aqui é só a primeira chamada
  // "de boas-vindas"; silenciosa em erro (offline, por exemplo).
  useEffect(() => {
    if (autenticado) void puxarDoServidor().catch(() => {});
  }, [autenticado]);

  if (!autenticado) {
    // Desde a v2.5 (2026-10-13), quem não está autenticado vê a Home
    // animada (rolagem com GSAP mostrando o potencial da aplicação) em
    // vez da tela de login "nua" — o botão "Entrar" (fixo no topo e no
    // hero) rola suavemente até o mesmo LoginForm de sempre, ancorado no
    // fim da página. Nenhuma lógica de autenticação mudou, só o que está
    // ao redor do formulário.
    return <HomePage />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <AuthGate>
            <div className="min-h-screen bg-background">
              <Header />
              <main>
                <Router />
              </main>
            </div>
          </AuthGate>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
