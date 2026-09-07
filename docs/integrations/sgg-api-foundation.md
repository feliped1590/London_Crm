# Integração SGG API V3 — fundação

## Escopo inicial

A primeira etapa é estritamente somente leitura. Nenhuma rota `POST`, `PUT` ou
`DELETE` da SGG deve ser chamada até a conclusão do piloto e autorização
explícita para escrita.

## Secrets

Configurar no Supabase Edge Functions:

- `SGG_API_KEY`: chave alfanumérica de 32 caracteres criada no painel SGG.
- `SGG_API_BASE_URL`: opcional; padrão `https://app.sgg.net.br/api/v3/`.

A chave nunca deve usar prefixo `VITE_`, ser enviada ao frontend, persistida em
tabelas, incluída em logs ou versionada no Git.

## Primeiro teste

A função `sgg-connection-test` aceita apenas `POST` autenticado por uma sessão
Supabase e exige papel `admin` ou `desenvolvedor`. Ela realiza somente uma
consulta `GET /empresa/` e retorna um diagnóstico sanitizado.

## Particularidade da API

A documentação SGG define parâmetros JSON no corpo de requisições `GET`. A Fetch
API padrão não permite corpo em `GET`. O teste inicial sem filtros é suficiente
para validar rede e credencial, mas a sincronização paginada só deve ser
implementada depois de confirmar com a SGG um transporte compatível para esse
JSON (por exemplo, query string oficial ou método alternativo suportado).

## Próximas etapas

1. Validar a credencial com `sgg-connection-test`.
2. Confirmar com o suporte SGG como enviar o JSON de filtros usando runtimes Fetch.
3. Criar espelho mínimo de funcionários e cursor de sincronização por tenant.
4. Fazer piloto somente leitura para uma empresa.
5. Detectar admissão, demissão, transferência e mudança de função.
6. Vincular eventos às regras de solicitação documental no CRM.

