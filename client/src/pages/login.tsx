import { Sun, Moon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoginForm } from '@/components/LoginForm'
import { useTheme } from '@/lib/theme-provider'
import instaLogo from '@assets/instagran.png'

// Tela de login mínima (card centralizado) — usa o LoginForm compartilhado
// (client/src/components/LoginForm.tsx). Desde a v2.5 (home animada com
// GSAP), quem não está autenticado vê a Home (client/src/pages/home.tsx)
// em vez deste componente direto — este arquivo fica mantido por
// compatibilidade/reuso (ex.: se um dia quiser um link "entrar sem a
// landing"), mas não é mais o que o AuthGate renderiza por padrão.
// Seletor de tema (2026-10-13) adicionado aqui também, pelo mesmo motivo
// da Home — nenhuma tela deslogada deve ficar sem o toggle que todas as
// telas logadas já têm (Header.tsx).
export default function LoginPage() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className="absolute top-4 right-4"
        data-testid="button-theme-toggle">
        {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </Button>
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center space-y-3">
          <img src={instaLogo} className="w-14 h-14 object-contain" alt="Logo" />
          <div>
            <CardTitle className="text-2xl">Controle de Perdas</CardTitle>
            <CardDescription>Entre com seu usuário para continuar</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  )
}
