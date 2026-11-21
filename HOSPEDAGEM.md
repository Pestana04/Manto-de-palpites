# Hospedar o Manto de Palpites na Discloud

O GitHub guarda o código-fonte. O site Java é executado na Discloud. Um GitHub Pages estático não executa o servidor nem o banco deste projeto.

## Requisitos

- Conta Discloud com plano Platinum ou superior e pelo menos 512 MB destinados ao site.
- Subdomínio registrado na conta, a informar em `ID` no `discloud.config`. `manto-de-palpites` é apenas a sugestão inicial; não foi reservado por este projeto.
- Runtime Java compatível com Java 21. O pacote solicita `VERSION=latest` e `APT=java`; confira a versão efetivamente instalada no painel/logs. Se a hospedagem usar Java anterior ao 21, peça a seleção de Java 21 ao suporte antes de publicar.
- Chave API-Football configurada também no ambiente do servidor: a variável definida no IntelliJ não é enviada automaticamente para a hospedagem.

## Publicação pelo painel

1. Compile com Java 21: `./mvnw.cmd package` (Windows) ou `sh mvnw package` (Linux).
2. Copie `target/manto-de-palpites-1.0.0.jar` para uma pasta de implantação e renomeie para `app.jar`.
3. Coloque uma cópia de `discloud.config` junto do `app.jar`, ajustando `ID` ao subdomínio registrado na conta.
4. Compacte os dois arquivos na raiz do ZIP, sem uma pasta externa. Não inclua `.idea`, `.git`, `.env`, seu banco local ou credenciais.
5. No painel da Discloud, envie esse ZIP como nova aplicação de site. Configure `FOOTBALL_API_KEY` no ambiente privado da aplicação. A forma de inserir variáveis deve ser a oferecida pelo painel; nunca publique a chave no GitHub.
6. Confira os logs: a aplicação deve ouvir em `0.0.0.0:8080`. O comando `START` do pacote já define isso e limita o heap Java a 256 MB.
7. Abra a URL HTTPS atribuída pela Discloud. A URL real só existe depois da reserva do subdomínio e da conclusão do deploy. Não há endereço publicado ainda.

## Banco e atualizações

O H2 salva os dados em `data/manto.mv.db` na pasta de trabalho do processo. Confirme com a hospedagem a persistência dessa pasta entre reinicializações, atualizações e troca de contêiner. Faça backup com a aplicação parada antes de atualizar. Não envie uma pasta `data/` vazia ou de teste por cima da produção.

Execute uma instância por banco H2. Se a hospedagem não preservar os arquivos, será necessário usar um banco persistente externo e adaptar a configuração/SQL antes de liberar o bolão para uso contínuo. Não foi comprovada a persistência do disco da sua conta Discloud.

O site sincroniza ao iniciar e às 05h de Brasília quando estiver executando. Após configurar a chave, confira `/api/status`: `configured` deve ser `true`, `lastSync` deve estar preenchido e `error` vazio. Isso não substitui conferir a cobertura da temporada no plano da API-Football.

Perfis são separados por navegador e domínio. O perfil criado no localhost não é transferido automaticamente para o domínio público nem para o celular.

## Referências oficiais

- [Java na Discloud](https://docs.discloud.com/development-environment/supported-languages/java)
- [Sites e APIs, porta e plano](https://docs.discloud.com/getting-started/websites-and-apis)
- [Configuração da aplicação](https://docs.discloud.com/configurations/discloud.config)
