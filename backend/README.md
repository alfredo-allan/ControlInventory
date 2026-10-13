# Backend — API de persistência do ControlInventory

API Flask que recebe a fila de sincronização do app (`client/src/lib/syncQueue.ts`)
e persiste tudo em banco de dados real (MySQL em produção, SQLite em dev local).

Esse backend foi desenhado pra receber o payload que o cliente offline-first
**já produz hoje**, sem nenhuma camada de tradução: o endpoint central
`POST /api/sync` aceita exatamente o formato `{id, tipo, payload}` que o
`syncQueue.ts` já monta. Ir ao ar é, na prática, trocar a função simulada
`enviarParaServidor` desse arquivo por uma chamada `fetch` real — nada na
arquitetura do cliente precisa mudar.

## Stack

Flask 3 + Flask-SQLAlchemy + Flask-Migrate (Alembic) + Flask-CORS + PyJWT +
PyMySQL. Escolhida por ser o que o PythonAnywhere suporta nativamente via
WSGI sem configuração extra (ver seção de deploy abaixo).

## Estrutura

```
backend/
  app/
    __init__.py          # app factory (create_app)
    config.py             # lê tudo de variáveis de ambiente
    extensions.py          # db, migrate, cors
    models.py              # schema (espelha os tipos TS do frontend)
    auth/                  # login, JWT, RBAC (admin/operador)
    sync/                  # POST /api/sync — o endpoint central
    catalogo/               # GET /api/produtos, /api/mercados
    estoque/                 # GET /api/estoque/<mercado>, /movimentacoes, /pesquisas-semanais
    metricas/                 # GET /api/metricas/perdas (admin, base do painel da Fase 3)
  migrations/                 # histórico de migração (Alembic) — gerado por `flask db`
  seed_data/frutap.json        # mesmo catálogo que o frontend usa, copiado
  seed.py                       # popula empresa + catálogo + 1º usuário admin
  wsgi.py                        # ponto de entrada (local E PythonAnywhere)
  requirements.txt
  .env.example
```

## 1. Rodando local (SQLite, sem precisar de MySQL)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env               # os defaults já funcionam pra rodar local

export FLASK_APP=wsgi.py           # Windows (PowerShell): $env:FLASK_APP="wsgi.py"
flask db upgrade                   # cria as tabelas (SQLite: backend/dev.db)
python seed.py                     # popula o catálogo (82 produtos / 14 mercados) + usuário admin

flask run --port 5050
```

Testando rapidamente:

```bash
curl http://127.0.0.1:5050/api/health
curl -X POST http://127.0.0.1:5050/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"nome":"admin","senha":"troque-essa-senha"}'
```

O login devolve um `token` — use em todas as outras rotas com o header
`Authorization: Bearer <token>`.

## 2. Mudando o schema depois (sempre que mexer em `app/models.py`)

```bash
export FLASK_APP=wsgi.py
flask db migrate -m "descrição curta da mudança"
flask db upgrade
```

Nunca editar tabelas na mão — sempre pelo fluxo de migração acima, tanto
local quanto no PythonAnywhere (senão os dois ambientes ficam com schemas
diferentes e divergem).

## 3. Deploy no PythonAnywhere

### ⚠️ Antes de criar a conta — leitura obrigatória sobre o plano

Pesquisei a tabela de planos vigente do PythonAnywhere nesta sessão
(outubro/2026) e tem uma pegadinha importante:

- **Contas gratuitas ("Beginner") criadas a partir de janeiro de 2026 NÃO
  têm mais acesso a banco de dados MySQL nem a tarefas agendadas.** Esses
  dois recursos continuam só pra contas gratuitas criadas *antes* de
  15/jan/2026 (8/jan no sistema europeu). Toda conta nova de hoje em diante
  não tem MySQL no plano gratuito — ponto final.
- O plano gratuito também expira depois de 1 mês sem renovação manual do
  site, e só permite 1 web app.
- O plano **Developer (US$ 10/mês)** é o primeiro que garante: MySQL
  incluso, site sem expiração, 5000 segundos de CPU/dia, 5 GB de disco, 1
  tarefa "always-on" e domínio próprio com SSL grátis.

**Conclusão prática: pra essa API persistir de verdade em produção (banco
real, site que não expira), o plano Developer é o mínimo necessário** — não
dá pra rodar isso no plano gratuito hoje em dia, a não ser que a conta já
exista desde antes de janeiro/2026. Se for esse o caso, vale confirmar no
próprio painel (aba "Databases") se a opção MySQL aparece antes de assumir
que vai funcionar de graça.

Isso é uma decisão de custo que cabe ao dono do projeto — o código abaixo
funciona em qualquer um dos dois planos, a diferença é só se o MySQL vai
estar disponível ou não.

### Passo a passo

1. **Criar a conta e o banco MySQL** — painel PythonAnywhere → aba
   "Databases" → define uma senha pro MySQL → anota o host que aparece lá
   (algo como `seuusuario.mysql.pythonanywhere-services.com`) e o nome do
   banco (`seuusuario$default`, ou crie um específico tipo
   `seuusuario$controlinventory`).

2. **Subir o código** — pelo console Bash do PythonAnywhere:
   ```bash
   git clone <url-do-repositorio>        # ou: faça upload via "Files" e arraste a pasta backend/
   cd controlinventory/backend            # ajuste o caminho conforme o seu clone
   ```

3. **Criar o virtualenv** (console Bash do PythonAnywhere):
   ```bash
   mkvirtualenv --python=/usr/bin/python3.10 controlinventory-venv
   pip install -r requirements.txt
   ```
   (anote o nome do virtualenv — vai precisar dele no passo 5)

4. **Configurar as variáveis de ambiente** — o PythonAnywhere não tem um
   painel nativo de env vars como Vercel/Heroku, então o jeito padrão de lá
   é setar direto no arquivo WSGI, ANTES do `from wsgi import application`.
   Edite o arquivo que o painel "Web" vai gerar (próximo passo) e inclua no
   topo, antes de mais nada:
   ```python
   import os
   os.environ["SECRET_KEY"] = "uma-chave-forte-gerada-com-secrets.token_hex"
   os.environ["DB_HOST"] = "seuusuario.mysql.pythonanywhere-services.com"
   os.environ["DB_USER"] = "seuusuario"
   os.environ["DB_PASSWORD"] = "a-senha-que-voce-definiu-na-aba-databases"
   os.environ["DB_NAME"] = "seuusuario$controlinventory"
   os.environ["CORS_ORIGINS"] = "https://seu-dominio-do-frontend.com"
   os.environ["FLASK_ENV"] = "production"
   ```

5. **Criar o web app** — painel "Web" → "Add a new web app" → **escolha
   "Manual configuration"** (não "Flask" — o wizard do Flask monta a
   estrutura de outro jeito; manual dá controle total pra apontar pro
   `wsgi.py` já pronto) → escolha a mesma versão de Python do virtualenv →
   na seção "Virtualenv", aponte pro caminho do virtualenv criado no passo 3
   (normalmente `/home/seuusuario/.virtualenvs/controlinventory-venv`).

6. **Editar o arquivo WSGI** gerado pelo painel (link na seção "Code" da
   página do web app, algo como
   `/var/www/seuusuario_pythonanywhere_com_wsgi.py`). Apague o conteúdo de
   exemplo e troque por:
   ```python
   import sys
   import os

   # Ajuste pro caminho real onde o backend/ foi clonado/enviado
   caminho_projeto = "/home/seuusuario/controlinventory/backend"
   if caminho_projeto not in sys.path:
       sys.path.insert(0, caminho_projeto)

   # Variáveis de ambiente (ver passo 4 acima)
   os.environ["SECRET_KEY"] = "uma-chave-forte-gerada-com-secrets.token_hex"
   os.environ["DB_HOST"] = "seuusuario.mysql.pythonanywhere-services.com"
   os.environ["DB_USER"] = "seuusuario"
   os.environ["DB_PASSWORD"] = "a-senha-que-voce-definiu-na-aba-databases"
   os.environ["DB_NAME"] = "seuusuario$controlinventory"
   os.environ["CORS_ORIGINS"] = "https://seu-dominio-do-frontend.com"
   os.environ["FLASK_ENV"] = "production"

   from wsgi import application
   ```

7. **Rodar as migrations contra o MySQL de produção** — console Bash do
   PythonAnywhere, dentro do virtualenv (`workon controlinventory-venv`):
   ```bash
   cd ~/controlinventory/backend
   export FLASK_APP=wsgi.py
   export DB_HOST=... DB_USER=... DB_PASSWORD=... DB_NAME=...   # mesmos valores do WSGI
   flask db upgrade
   python seed.py --admin-senha "uma-senha-forte-de-verdade"
   ```

8. **Recarregar o web app** — botão verde "Reload" no topo da página do
   web app no painel. Isso é necessário depois de QUALQUER mudança de
   código ou do arquivo WSGI.

9. **Testar** — `https://seuusuario.pythonanywhere.com/api/health` deve
   responder `{"status": "ok"}`.

### Atualizando o código depois do primeiro deploy

```bash
cd ~/controlinventory
git pull
workon controlinventory-venv
pip install -r backend/requirements.txt     # só se requirements.txt mudou
cd backend && flask db upgrade                # só se o schema mudou
```
...e clicar em "Reload" no painel Web de novo. Sem o reload, o PythonAnywhere
continua servindo o código antigo.

## 4. Conectando o frontend (passo seguinte, fora do escopo deste backend)

Quando a API estiver no ar, a única mudança necessária no frontend é dentro
de `client/src/lib/syncQueue.ts`: trocar a função `enviarParaServidor`
(hoje simulada) por uma chamada real:

```ts
async function enviarParaServidor(item: ItemFilaSync): Promise<void> {
  const resposta = await fetch(`${URL_BASE_API}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(item),
  })
  if (!resposta.ok) throw new Error('Falha ao sincronizar')
}
```

Nada mais na fila, nos hooks (`use-sync-status.ts`) ou no indicador visual
(`sync-status-indicator.tsx`) precisa mudar — esse é exatamente o ponto de
ter desenhado o backend pra aceitar o payload do cliente sem tradução.
