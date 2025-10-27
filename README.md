# 🧾 Controle de Perdas (ControlInventory)

> Sistema de controle de produtos perecíveis com rastreamento de validade, busca automática por código EAN e interface moderna e responsiva.

---

## 🧠 Descrição do Projeto

O **ControlInventory** é uma aplicação **React + TypeScript** desenvolvida para auxiliar no controle de estoque de produtos perecíveis.  
Permite **registrar, buscar, atualizar e remover produtos** com informações completas, como:

- Código **EAN**
- Nome do **operador**
- **Descrição**
- **Quantidade** e **tipo de unidade**
- **Data de validade**

O sistema é **100% local**, utilizando `localStorage` para persistência de dados — ideal para uso offline ou pequenos estabelecimentos.

---

## ⚙️ Tecnologias Utilizadas

| Stack                     | Descrição                                             |
| ------------------------- | ----------------------------------------------------- |
| **React + Vite**          | Framework e bundler moderno para alta performance     |
| **TypeScript**            | Tipagem estática para maior segurança e produtividade |
| **TailwindCSS**           | Estilização rápida, responsiva e moderna              |
| **shadcn/ui**             | Componentes acessíveis e elegantes                    |
| **lucide-react**          | Ícones leves e escaláveis                             |
| **Zod + React Hook Form** | Validação de formulários robusta e tipada             |
| **date-fns**              | Manipulação de datas com suporte a `pt-BR`            |

---

## 🧩 Principais Funcionalidades

✅ **Cadastro de Produto**

> Formulário validado com feedback visual e persistência local

✅ **Busca Dinâmica**

> Pesquisa em tempo real por **descrição**, **EAN** ou **operador**

✅ **Atualização e Edição**

> Interface de diálogo (modal) para atualizar qualquer campo

✅ **Exclusão Segura**

> Remoção rápida com feedback visual e confirmação

✅ **Validação e Formatação de Datas**

> Utiliza `date-fns` com localização brasileira

✅ **Interface Responsiva e Moderna**

> Layout fluido com Tailwind, totalmente adaptável para desktop e mobile

---

## 📁 Estrutura do Projeto

---

## ControlInventory/

## ├── client/

## │ ├── public/

## │ │ ├── favicon.png

## │ │ ├── apple-icon.png

## │ │ ├── icon1.png

## │ │ ├── icon2.png

## │ │ └── manifest.json

## │ ├── src/

## │ │ ├── components/ui/ # Componentes do shadcn

## │ │ ├── hooks/ # Hooks customizados (ex: useToast)

## │ │ ├── lib/ # Funções utilitárias (ex: localStorage)

## │ │ ├── pages/ # Páginas (Cadastrar, Atualizar, Deletar, NotFound)

## │ │ ├── shared/ # Schemas Zod e tipos

## │ │ └── main.tsx

## │ ├── index.html

## │ └── vite.config.ts

## └── README.md

---

## 🚀 Como Executar o Projeto

### 1️⃣ Clonar o repositório

```bash
git clone https://github.com/alfredo-allan/ControlInventory.git
cd ControlInventory


## 2️⃣ Instalar dependências

npm install
# ou
yarn install

## 3️⃣ Executar o ambiente de desenvolvimento
 npm run dev
# ou
yarn dev

## 4️⃣ Gerar a build de produção
npm run build
# ou
yarn build

/client/dist

5️⃣ Visualizar a build localmente
```
