# Manto de Palpites

Bolão informal do Flamengo, com servidor Java 21 / Spring Boot 3.5, interface responsiva em português e banco H2 persistente. Projeto independente de torcedores.

## Abrir no IntelliJ

1. Abra esta pasta como projeto Maven, ou clique com o botão direito em `pom.xml` e escolha **Add as Maven Project**.
2. Configure o **Project SDK para Java 21**. O projeto não usa o Java 8 do PATH nem recursos experimentais do Java 26.
3. Execute `br.com.mantodepalpites.MantoApplication` em `src/main/java`.
4. Abra [http://localhost:8080](http://localhost:8080).

Também pode executar `./mvnw.cmd spring-boot:run` no Windows ou `./mvnw spring-boot:run` no Linux/macOS. O Maven Wrapper baixa o Maven na primeira execução. Testes: `./mvnw.cmd test`. Pacote executável: `./mvnw.cmd package` e `java -jar target/manto-de-palpites-1.0.0.jar`.

## Resultados, agenda e competições

Crie uma chave no painel da [API-Football / API-Sports](https://dashboard.api-football.com/). Na configuração de execução do IntelliJ, em **Environment variables**, configure:

```text
FOOTBALL_API_KEY=sua_chave
```

A chave fica apenas no servidor. Não a coloque no JavaScript, no Git ou no README. O arquivo `.env` não é lido automaticamente pelo Spring; use variáveis de ambiente ou a configuração de execução do IntelliJ.

Integração baseada na [documentação oficial v3](https://www.api-football.com/documentation-v3): `fixtures?team=127&season=...` e `standings?league=...&season=...`, com o header `x-apisports-key`. Confirme a disponibilidade do ano e das competições no plano da sua conta. A disponibilidade de tabelas e o atraso dos resultados dependem do fornecedor. Chave ausente ou falha de conexão não gera jogos, resultados nem competidores fictícios.

O servidor sincroniza ao iniciar e diariamente às **05h de Brasília**, desde que continue ligado. Usa as temporadas atual e anterior, filtrando os jogos pelo ano civil atual em Brasília; as competições são descobertas a partir desses jogos, sem uma lista fixa de torneios. Tabelas são consultadas por competição e temporada; em torneios sem classificação disponível, são mostrados os confrontos. O cache anterior é preservado em falhas. O ranking é recalculado a cada consulta para refletir correções de resultados. A interface atualiza dados a cada cinco minutos quando o visitante está na tela inicial e não está editando um campo.

Variáveis opcionais: `PORT` (8080), `DB_PASSWORD`, `FLAMENGO_TEAM_ID` (127), `FOOTBALL_SYNC_ENABLED` (true), `FOOTBALL_SYNC_CRON` (`0 0 5 * * *`, cron Spring com seis campos). Esta versão faz consultas diárias, não oferece placar ao vivo.

## Regras iniciais

- Placar exato: **5 pontos**; resultado correto (vitória/empate/derrota): **3 pontos**; demais casos: **0**. Pontuação não cumulativa.
- Prorrogação incluída; disputa de pênaltis excluída. Apenas estados finais `FT`, `AET` e `PEN` pontuam.
- Palpites podem ser atualizados apenas antes do início e enquanto a API indicar `NS`. O bloqueio é conferido no servidor com transação e bloqueio da partida.
- Ranking anual: pontos, placares exatos e ordem de inscrição. A página inicial mostra cinco participantes, com ouro, prata e bronze para as primeiras posições. “Ver mais” abre o ranking completo. Jogos encerrados abrem a classificação da partida.

## Perfis e persistência

Na primeira visita, é pedido nome completo. Um identificador aleatório de 256 bits fica no `localStorage` e seu hash SHA-256 no banco. Os endpoints privados validam esse identificador; os públicos não retornam a chave. Sem login e sem recuperação de acesso: limpar o navegador, trocar de navegador ou de dispositivo cria uma identidade diferente. Nome e foto são públicos. A foto é recortada localmente para 256 × 256 e validada/recodificada no servidor como JPEG. Sem uso de serviço externo para armazenar fotos.

Os dados de participantes, palpites, jogos e tabelas ficam em `data/manto.mv.db`. Faça backup com a aplicação parada. A pasta `data/` não entra no Git. Use uma única instância da aplicação por banco H2; para implantação com várias instâncias, migre o banco para PostgreSQL. É um bolão informal: não há verificação de identidade real nem prevenção de múltiplos perfis criados pelo mesmo visitante.

O site se adapta por largura de tela: menu superior no computador e botão no canto superior esquerdo no celular. Não depende de detecção do agente do navegador. A imagem histórica foi fornecida pelo solicitante como referência; confirme a autorização de uso antes de publicar externamente.

## Publicar depois

O projeto está preparado para rodar localmente, sem publicação automática ou envio de commits ao GitHub. Para uso compartilhado, hospede o JAR em um serviço com Java 21, disco persistente para `data/`, HTTPS e a chave da API nas variáveis do servidor. Apenas abrir no IntelliJ não mantém o site disponível quando o computador está desligado. Para testar no celular na mesma rede, abra `http://IP-DO-COMPUTADOR:8080` e permita a porta apenas na rede privada conforme a configuração do Windows.
