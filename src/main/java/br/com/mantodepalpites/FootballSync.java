package br.com.mantodepalpites;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;

@Service
public class FootballSync {
    private final JdbcTemplate db;
    private final ObjectMapper json;
    private final String key;
    private final int team;
    private final boolean enabled;
    private final HttpClient http;
    @org.springframework.beans.factory.annotation.Autowired
    public FootballSync(JdbcTemplate db, ObjectMapper json, @Value("${football.api-key}") String key,
                        @Value("${football.team-id}") int team, @Value("${football.sync-enabled}") boolean enabled) {
        this(db,json,key,team,enabled,HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build());
    }
    FootballSync(JdbcTemplate db,ObjectMapper json,String key,int team,boolean enabled,HttpClient http) {
        this.db=db; this.json=json; this.key=key; this.team=team; this.enabled=enabled; this.http=http;
    }
    @EventListener(ApplicationReadyEvent.class)
    public void startup() { sync(); }
    @Scheduled(cron="${football.sync-cron}", zone="America/Sao_Paulo")
    public synchronized void sync() {
        if (!enabled || key.isBlank()) return;
        try {
            int year=LocalDate.now(ZoneId.of("America/Sao_Paulo")).getYear();
            Map<String, int[]> leagues=new LinkedHashMap<>();
            // Both season identifiers cover competitions spanning two calendar years.
            List<JsonNode> all=new ArrayList<>();
            for (int season : new int[]{year-1,year}) {
                for(JsonNode f : fetch("fixtures?team="+team+"&season="+season)) {
                    if(OffsetDateTime.parse(f.path("fixture").path("date").asText()).atZoneSameInstant(ZoneId.of("America/Sao_Paulo")).getYear()==year) all.add(f);
                }
            }
            for(JsonNode f:all) {
                JsonNode fx=f.path("fixture"), l=f.path("league"), score=f.path("score");
                String status=fx.path("status").path("short").asText();
                JsonNode goals=(status.equals("AET") || status.equals("PEN")) && score.path("extratime").path("home").isNumber()
                        ? score.path("extratime") : f.path("goals");
                // On shootouts without extra time, API goals may include shootout goals: use fulltime.
                if(status.equals("PEN") && !score.path("extratime").path("home").isNumber()) goals=score.path("fulltime");
                db.update("MERGE INTO fixtures KEY(id) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                    fx.path("id").asLong(), OffsetDateTime.parse(fx.path("date").asText()),status,
                    f.path("teams").path("home").path("name").asText(),f.path("teams").path("away").path("name").asText(),
                    number(goals.path("home")),number(goals.path("away")),l.path("id").asLong(),l.path("name").asText(),l.path("season").asInt(),l.path("round").asText());
                leagues.put(l.path("id").asText()+":"+l.path("season").asText(),new int[]{l.path("id").asInt(),l.path("season").asInt()});
            }
            for(var entry:leagues.entrySet()) {
                try {
                    JsonNode standings=fetch("standings?league="+entry.getValue()[0]+"&season="+entry.getValue()[1]);
                    put("standings:"+entry.getKey(),standings.toString());
                } catch(Exception ex) { LoggerFactory.getLogger(getClass()).warn("Tabela indisponível para competição {}",entry.getKey()); }
            }
            put("lastSync",Instant.now().toString()); put("syncError","");
        } catch(Exception ex) {
            put("syncError","Não foi possível atualizar. Os dados anteriores foram preservados. Confira a chave, a cobertura do plano e a conexão no servidor.");
            LoggerFactory.getLogger(getClass()).warn("Sincronização não concluída ({})",ex.getClass().getSimpleName());
        }
    }
    private Integer number(JsonNode node) { return node.isNumber()?node.asInt():null; }
    private JsonNode fetch(String path) throws Exception {
        HttpRequest request=HttpRequest.newBuilder(URI.create("https://v3.football.api-sports.io/"+path))
            .timeout(Duration.ofSeconds(30)).header("x-apisports-key",key).GET().build();
        var response=http.send(request,HttpResponse.BodyHandlers.ofString());
        if(response.statusCode()!=200) throw new IllegalStateException("HTTP "+response.statusCode());
        JsonNode body=json.readTree(response.body());
        if(body.path("errors").size()>0 || !body.path("response").isArray()) throw new IllegalStateException("API recusou a consulta");
        if(body.path("paging").path("total").asInt(1)>1) throw new IllegalStateException("Resposta paginada inesperada");
        return body.path("response");
    }
    private void put(String k,String v) { db.update("MERGE INTO cache KEY(cache_key) VALUES(?,?)",k,v); }
    public String cached(String k) { return db.query("SELECT payload FROM cache WHERE cache_key=?",(r,n)->r.getString(1),k).stream().findFirst().orElse(""); }
    public Map<String,Object> status() { return Map.of("configured",!key.isBlank(),"lastSync",cached("lastSync"),"error",cached("syncError")); }
}
