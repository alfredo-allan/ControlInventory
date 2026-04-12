# 📦 BRIEFING DO PROJETO — CONTROLE DE PRODUTOS PERECÍVEIS

---

## 🎯 OBJETIVO DO PROJETO

Desenvolver um sistema completo para controle de produtos perecíveis, com foco em:

* Redução de desperdício de alimentos
* Monitoramento de datas de validade
* Geração de alertas automáticos
* Apoio à doação para instituições (ONGs)

📌 Alinhado ao **ODS 12 — Consumo e Produção Responsáveis**

---

## 🧱 ARQUITETURA GERAL

### Backend

* API REST
* Autenticação via JWT
* Banco de dados relacional (PostgreSQL)

### Frontend

* Interface já existente (React/Next)
* Consumo da API própria
* Exibição de alertas e dashboards

---

## 📂 PADRÃO DE ESTRUTURA (BACKEND)

```
src/
 ├── controllers/
 ├── services/
 ├── repositories/
 ├── models/
 ├── middlewares/
 ├── routes/
 ├── config/
 └── utils/
```

---

## 📊 MODELAGEM DE DADOS

### 🧾 Produto

* id
* nome
* categoria
* data_validade
* quantidade
* status (válido | próximo | vencido)

### 👤 Usuário

* id
* nome
* email
* senha (hash)
* role (admin | operador | ONG)

---

## 🔐 REGRAS DE SEGURANÇA

* Autenticação com JWT
* Senhas com hash (bcrypt)
* Validação de entrada (inputs)
* Controle de acesso por função (RBAC)

### 🔑 Permissões

* Admin: acesso total
* Operador: gerenciar produtos
* ONG: visualizar itens para doação

---

## 🧠 REGRAS DE NEGÓCIO

* Produto vencido → status = "vencido"
* Produto com até 7 dias → status = "próximo"
* Produto válido → status = "válido"

### 🚨 ALERTAS

* Listagem automática de produtos próximos do vencimento
* Listagem de produtos vencidos

### 🤝 DOAÇÃO

* Endpoint para listar produtos disponíveis para doação
* Acesso restrito a ONG

---

## 🌐 ROTAS PRINCIPAIS

### 🔐 Auth

* POST /auth/register
* POST /auth/login

### 📦 Produtos

* GET /products
* POST /products
* PUT /products/:id
* DELETE /products/:id

### 🚨 Alertas

* GET /alerts/expiring
* GET /alerts/expired

### 🤝 Doações

* GET /donations

---

## 🧪 TESTES (MÍNIMO NECESSÁRIO)

* Teste de autenticação
* Teste de criação de produto
* Teste de regra de vencimento

---

## 🧩 JSON AUXILIAR

Uso de arquivo JSON para:

* Simulação de dados
* Fallback em caso de falha de API externa
* Base de consulta local

---

## 🎨 DIRETRIZES DO FRONTEND

* Consumir API própria
* Exibir status visual (cores):

  * Verde → válido
  * Amarelo → próximo
  * Vermelho → vencido

### 📊 Dashboard

* Total de produtos
* Produtos vencidos
* Produtos próximos do vencimento

---

## 🚀 BOAS PRÁTICAS

* Código limpo (Clean Code)
* Separação de responsabilidades
* Uso de variáveis com nomes claros
* Tratamento de erros
* Logs básicos

---

## 📄 ENTREGÁVEIS ACADÊMICOS

* Sistema funcional
* Relatório final
* Depoimento da instituição
* Termo de autorização assinado

---

## 💡 DIFERENCIAL DO PROJETO

Este projeto não é apenas um sistema técnico.

Ele resolve um problema real:
➡️ Redução de desperdício de alimentos
➡️ Apoio à comunidade
➡️ Integração com ONG

---

## 🔥 VISÃO FINAL

Transformar um simples controle de estoque em um sistema inteligente com impacto social e valor real.
