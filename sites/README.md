# Manto de Palpites — Sites

Versão hospedada no Sites, adaptada do projeto Java. O Java original permanece no GitHub e não é substituído por este checkout.

- Interface responsiva com as correções dos campos de nome e foto.
- API TypeScript executada em Cloudflare Workers e banco D1 persistente.
- Perfis por dispositivo com chave aleatória e hash no servidor; sem senha do bolão.
- Palpites bloqueados atomicamente no início da partida, ranking anual e pontuação por jogo.
- API-Football configurada exclusivamente como segredo de produção `FOOTBALL_API_KEY`.
- Se a API-Football recusar a temporada/plano, usa o feed público ESPN, consultando resultados e agenda futura separadamente. O adaptador está isolado em `lib/espn.mjs`: esse feed não oferece contrato público de estabilidade, e a cobertura depende do fornecedor. IDs têm namespaces separados para evitar colisão de fornecedores.
- Atualização diária idempotente, com bloqueio de concorrência, preservação de cache em falhas e ferramenta de manutenção para execução agendada.

## Desenvolvimento

`npm run dev` abre a prévia. `npm run db:generate` gera migrações do schema em `db/schema.ts`. `node --test tests/*.test.mjs` verifica as regras. Use os helpers do Sites para compilar e publicar.

O banco local de desenvolvimento não é compartilhado com o banco de produção. Nunca carregue participantes ou palpites de teste em produção. A identidade de um navegador no localhost/Discloud não é automaticamente transferida ao domínio do Sites.

A chave da API-Football é configurada pelo armazenamento secreto do Sites. Não inclua credenciais em arquivos, commits ou prompts de tarefas agendadas. O endpoint de manutenção não aceita placares nem conteúdo arbitrário: somente consulta a fonte configurada, no máximo uma vez por dia e com retentativas espaçadas após falhas.

Regras: placar exato 5 pontos; resultado correto 3; demais casos 0. Inclui prorrogação e exclui disputa de pênaltis. Desempate por placares exatos e inscrição mais antiga.
