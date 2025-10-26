import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { Header } from "@/components/Header";
import RegisterPage from "@/pages/register";
import ListPage from "@/pages/list";
import UpdatePage from "@/pages/update";
import DeletePage from "@/pages/delete";
import FarejarPage from "@/pages/farejar";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={RegisterPage} />
      <Route path="/listar" component={ListPage} />
      <Route path="/atualizar" component={UpdatePage} />
      <Route path="/deletar" component={DeletePage} />
      <Route path="/farejar" component={FarejarPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <div className="min-h-screen bg-background">
            <Header />
            <main>
              <Router />
            </main>
          </div>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
