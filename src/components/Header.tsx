import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Sun, Moon, FileText, List, RefreshCw, Trash2, Dog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme-provider";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();

  const navItems = [
    { path: "/", label: "Registrar", icon: FileText },
    { path: "/listar", label: "Listar", icon: List },
    { path: "/atualizar", label: "Atualizar", icon: RefreshCw },
    { path: "/deletar", label: "Deletar", icon: Trash2 },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img
              src="/image/instagran.png"
              alt="Logo Controle de Perecíveis"
              className="w-[45px] h-[45px] object-contain"
            />
            <h1 className="text-xl font-semibold text-foreground">
              Controle de Perdas
            </h1>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              return (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-2"
                    data-testid={`link-${item.label.toLowerCase()}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Button>
                </Link>
              );
            })}
            <Link href="/farejar">
              <Button
                variant={location === "/farejar" ? "default" : "ghost"}
                size="sm"
                className="gap-2"
                data-testid="link-farejar"
              >
                <Dog className="h-4 w-4" />
                <span>Farejar</span>
              </Button>
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              data-testid="button-theme-toggle"
            >
              {theme === "light" ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-menu-toggle"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav className="md:hidden border-t py-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              return (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className="w-full justify-start gap-2"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid={`link-mobile-${item.label.toLowerCase()}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Button>
                </Link>
              );
            })}
            <Link href="/farejar">
              <Button
                variant={location === "/farejar" ? "default" : "ghost"}
                className="w-full justify-start gap-2"
                onClick={() => setMobileMenuOpen(false)}
                data-testid="link-mobile-farejar"
              >
                <Dog className="h-4 w-4" />
                <span>Farejar</span>
              </Button>
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
