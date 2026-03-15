# Sistema Cilia - Contexto da Aplicação

## 1. O que é o sistema?
O **Sistema Cilia** é uma aplicação web focada na automação e integração de orçamentos (gerados em XML, como orçamentos de oficinas, reparos ou seguradoras) com o sistema de gestão **VHSYS**.

O principal objetivo é eliminar a digitação manual de orçamentos aprovados. O usuário faz o upload de um arquivo XML gerado por um sistema externo de orçamentação, a aplicação converte esses dados, permite edição/revisão na tela e, ao confirmar, injeta esses dados automaticamente como uma **Ordem de Serviço (OS)** no VHSYS, incluindo cadastramento de itens (peças) e serviços (horas de pintura, reparação, etc.).

## 2. Arquitetura do Projeto

O projeto é dividido em duas partes principais (monorepo simples):

### Frontend (`/FE`)
- **Framework:** Angular (versões recentes, >16, usando `standalone components`).
- **Estilização:** Tailwind CSS (com utilitários de cores customizados `primary`, `secondary`, etc.).
- **Ícones:** Lucide Angular.
- **Estrutura Principal:**
  - `LoginComponent`: Tela de autenticação baseada no design corporativo da Kllix.
  - `MainLayoutComponent`: O "shell" da aplicação logada, contém o painel lateral/superior.
  - `DashboardComponent`: O coração do sistema. É onde o usuário visualiza o status da integração com o VHSYS, clica em "Importar XML" e passa por um Modal de 3 passos para revisar a OS, Peças e Mão de Obra antes do envio.
  - `AdminComponent`: Gestão de usuários do sistema. Apenas acessível por contas com privilégio de administrador.
  - `ProfileComponent`: Tela "Minha Conta", onde administradores atualizam suas chaves do VHSYS e senha.
- **Serviços (`/services`):**
  - `AuthService`: Gerencia tokens locais e estado de login.
  - `ApiService`: Concentra todas as chamadas HTTP para o backend PHP.

### Backend (`/BE`)
- **Linguagem:** PHP Puro (sem frameworks visuais pesados), projetado como uma API RESTful simples e rápida.
- **Banco de Dados:** MySQL/MariaDB (Acesso via PDO).
- **Estrutura Principal:**
  - `api.php`: Ponto central (Controller/Router). Recebe o parâmetro `?action=X` e direciona para a lógica correta (ex: `login`, `admin_usuarios`, `importar_xml_vhsys`).
  - `database.php`: Classe de conexão com o banco de dados. Lê as credenciais dinamicamente.
  - `config.php` e `.env`: Gerenciamento de chaves e acessos sensíveis.
  - `setup_database.php`: Script utilitário em linha de comando desenhado para inicializar e migrar o banco de dados em ambientes de produção. (Substituiu antigas migrations manuais).
- **Integração Externa:** O backend atua como um *middleware*, disparando chamadas HTTP (`cUrl`) diretamente para a API v2 da VHSYS (ex: `/ordens-servico`, `/clientes`, `/produtos`).

## 3. Lógica de Negócio Principal (Integração VHSYS)

1. **Tokens por Usuário:** A credencial da API do VHSYS (Access Token e Secret Token) é vinculada a cada usuário do sistema Cilia. Antes de permitir uma importação, o Dashboard faz um ping na API do VHSYS (`verificar_vhsys` em `api.php`) para garantir que as credenciais daquele usuário que está logado são válidas. Se não forem, a importação é bloqueada.
2. **Parsing do XML (`api.php` > `$action === 'parse_xml'`):** 
   - A biblioteca `SimpleXMLElement` varre tags específicas do orçamento padrão do mercado (ex: placa, chassi, dados do cliente, tipo_item, preco_liquido, horas de pintura/reparo).
   - Horas de reparação são multiplicadas por valores fixos pré-configurados pela oficina para gerar o "Custo de Mão de Obra".
3. **Criação da OS (`api.php` > `$action === 'importar_xml_vhsys'`):**
   - Cria o Cliente no VHSYS (se não existir).
   - Cria a Ordem de Serviço base.
   - Itera sobre as peças e serviços enviados pelo Frontend. Adiciona serviços na rota de `/ordens-servico/{id}/servicos` e peças na rota de produtos associados à OS.

## 4. Ambiente e Deploy

- O projeto não utiliza Docker para simplificar a hospedagem em painéis compartilhados (como Hostinger/cPanel).
- O código de Produção é enviado por meio da extensão SFTP do VS Code.
- Existe uma configuração `.vscode/sftp.json` que envia:
  - O Backend (`/BE`) para `ftp.kllixerp.com.br/cilia/api/`
  - A *build* de produção do Frontend (`/FE/dist/cilia/browser`) para `ftp.kllixerp.com.br/cilia/` (acessível via `/apps/cilia/`).
- O servidor de banco de dados e a base do site estão numa hospedagem que restringe acessos externos diretos a certos arquivos, exigindo cuidado para migrações (uso do `setup_database.php` via SSH).

## 5. Próximos Passos / Manutenção
Se precisar de alterações futuras:
- **Novos campos do XML:** Acesse o `api.php` no arquivo Backend (`parse_xml`).
- **Layout ou Modais:** O modal de 3 etapas vive no `dashboard.component.html`.
- **Credenciais do DB da produção:** Atualize via arquivo `.env` de servidor, e assegure que o `setup_database.php` seja rodado via SSH (`php setup_database.php`) caso qualquer nova coluna seja adicionada (ex: `cilia_schema.sql`).
