# Controle de Perecíveis

Sistema web para controle de produtos perecíveis de supermercado com rastreamento de validade e busca automática de produtos por código EAN.

## Visão Geral

Aplicação desenvolvida com Vite + React + TypeScript + Tailwind CSS para gerenciar produtos perecíveis, permitindo registro, listagem, atualização e exclusão de produtos, além de um sistema de alerta para produtos próximos ao vencimento.

## Funcionalidades

### ✅ Implementadas

- **Registro de Produtos**: Formulário completo com busca automática via API Open Food Facts ao digitar código EAN
- **Listagem de Produtos**: Visualização em cards com status de vencimento colorido
- **Atualização de Produtos**: Busca e edição de produtos cadastrados
- **Exclusão de Produtos**: Remoção de produtos com confirmação
- **Farejar (Scan de Vencimentos)**: Detecção automática de produtos vencendo em até 3 dias
- **Tema Claro/Escuro**: Toggle de tema com persistência em LocalStorage
- **Responsividade**: Design adaptativo para mobile, tablet e desktop
- **Impressão**: View otimizada para impressão de relatórios
- **Calendário em Português**: Seleção de datas com react-day-picker em pt-BR

## Stack Tecnológica

### Frontend
- **Vite** - Build tool e dev server
- **React 18** - Framework UI
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling com design system customizado
- **Wouter** - Client-side routing
- **React Hook Form** - Gerenciamento de formulários
- **Zod** - Validação de schemas
- **date-fns** - Manipulação de datas
- **Lucide React** - Ícones
- **Shadcn/ui** - Componentes UI (Card, Button, Dialog, etc.)

### Backend/Persistência
- **LocalStorage** - Armazenamento client-side (preparado para migração para API Python)
- **Open Food Facts API** - Busca automática de produtos por EAN

### Tipografia
- **Sora** (Google Fonts) - Fonte principal do aplicativo

## Estrutura do Projeto

```
client/
├── src/
│   ├── components/
│   │   ├── ui/           # Componentes Shadcn
│   │   └── Header.tsx    # Header com navegação e theme toggle
│   ├── pages/
│   │   ├── register.tsx  # Página de registro
│   │   ├── list.tsx      # Listagem de produtos
│   │   ├── update.tsx    # Atualização de produtos
│   │   ├── delete.tsx    # Exclusão de produtos
│   │   └── farejar.tsx   # Scan de vencimentos
│   ├── lib/
│   │   ├── theme-provider.tsx  # Gerenciamento de tema
│   │   └── queryClient.ts      # TanStack Query config
│   └── App.tsx           # Roteamento principal
shared/
└── schema.ts             # Schemas Zod e tipos TypeScript
```

## Modelo de Dados

### Product
```typescript
{
  id: string;                    // UUID gerado automaticamente
  operatorName: string;          // Nome do operador
  eanCode: string;               // Código de barras EAN
  description: string;           // Descrição do produto
  quantity: number;              // Quantidade
  quantityType: "unidade" | "caixa";  // Tipo de quantidade
  expirationDate: string;        // Data de vencimento (ISO)
  registrationDate: string;      // Data de registro (ISO, timezone São Paulo)
}
```

## Integração com Open Food Facts

A API é chamada automaticamente quando o usuário preenche o campo EAN:
- **Endpoint**: `https://world.openfoodfacts.org/api/v0/product/{ean}.json`
- **Campos retornados**: `product_name`, `brands`
- **Tratamento**: Concatenação de marca + nome para preencher descrição

## Sistema de Cores e Tema

### Status de Vencimento
- **Verde (OK)**: > 7 dias até vencimento
- **Amarelo (Atenção)**: 4-7 dias até vencimento  
- **Vermelho (Urgente)**: ≤ 3 dias ou vencido

### Tema Claro/Escuro
- Persistência em LocalStorage
- Toggle no header
- Transições suaves entre temas
- Cores adaptadas automaticamente via CSS variables

## Como Executar

1. **Instalação**: `npm install` (já feito automaticamente)
2. **Desenvolvimento**: `npm run dev` (workflow já configurado)
3. **Acesso**: Aplicação será servida em `http://localhost:5000`

## Status do Projeto

✅ **Concluído - MVP Completo**

Todas as funcionalidades principais foram implementadas:
- ✅ Persistência com LocalStorage
- ✅ Operações CRUD completas (Create, Read, Update, Delete)
- ✅ Gerenciamento de timezone São Paulo (America/Sao_Paulo)
- ✅ Interface responsiva com tema claro/escuro
- ✅ Integração com API Open Food Facts
- ✅ Sistema de alerta de vencimentos (Farejar)
- ✅ View de impressão otimizada

## Detalhes Técnicos

### Gerenciamento de Timezone
O sistema garante consistência de datas usando o timezone de São Paulo (America/Sao_Paulo):
- **Registro**: Timestamps salvos com `formatInTimeZone()` normalizados para São Paulo
- **Comparações**: Cálculos de vencimento usam `toZonedTime()` para normalizar datas antes de comparar
- **UI**: Badges de status e alertas derivados de datas convertidas para zona de São Paulo

Isso garante que operadores em qualquer timezone vejam alertas consistentes com as regras de negócio.

## Próximos Passos (Melhorias Futuras)

- [ ] Testes unitários para helpers de data/timezone
- [ ] Migração para backend Python com API REST
- [ ] Export de relatórios em CSV/Excel
- [ ] Dashboard de analytics
- [ ] Notificações push para vencimentos próximos

## Arquitetura Futura

O sistema foi projetado para fácil migração para backend Python:
- Schemas Zod prontos para validação em ambos os lados
- Separação clara entre UI e lógica de dados
- API routes preparadas para substituir LocalStorage por HTTP calls

## Notas de Desenvolvimento

- **Data/Hora**: Usar timezone de São Paulo (America/Sao_Paulo) para registrationDate
- **Validação**: Todos os formulários validados com Zod + React Hook Form
- **Acessibilidade**: data-testid em todos os elementos interativos
- **Print**: CSS customizado para impressão limpa de relatórios
