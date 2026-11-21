package br.com.mantodepalpites;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import java.time.*;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:test;DB_CLOSE_DELAY=-1","football.sync-enabled=false"})
@AutoConfigureMockMvc
class MantoIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate db;
    @Autowired ObjectMapper json;
    @BeforeEach void setup() {
        db.update("DELETE FROM cache");
        db.update("DELETE FROM predictions");db.update("DELETE FROM participants");db.update("DELETE FROM fixtures");
        fixture(1,OffsetDateTime.now().plusDays(2),"NS",null,null);
        fixture(2,OffsetDateTime.now().minusHours(1),"NS",null,null);
        fixture(3,OffsetDateTime.now().plusDays(1),"PST",null,null);
    }
    void fixture(long id,OffsetDateTime time,String status,Integer home,Integer away) {
        db.update("MERGE INTO fixtures KEY(id) VALUES(?,?,?,?,?,?,?,?,?,?,?)",id,time,status,"Flamengo","Visitante",home,away,71,"Brasileirão",time.getYear(),"Rodada 1");
    }
    String create(String name) throws Exception {
        var result=mvc.perform(post("/api/participants").contentType("application/json").content(json.writeValueAsString(Map.of("name",name,"photo",""))))
            .andExpect(status().isOk()).andReturn();
        return json.readTree(result.getResponse().getContentAsString()).path("token").asText();
    }
    void pick(String token,long id,int home,int away) throws Exception {
        mvc.perform(put("/api/fixtures/"+id+"/prediction").header("Authorization","Bearer "+token).contentType("application/json").content("{\"home\":"+home+",\"away\":"+away+"}")).andExpect(status().isOk());
    }
    @Test void identityAndProfileIsolation() throws Exception {
        String first=create("Maria da Silva"), second=create("João Santos");
        mvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me").header("Authorization","Bearer "+first)).andExpect(jsonPath("$.name").value("Maria da Silva"));
        mvc.perform(put("/api/me").header("Authorization","Bearer "+second).contentType("application/json").content("{\"name\":\"João Oliveira\",\"photo\":\"\"}")).andExpect(status().isOk());
        mvc.perform(get("/api/me").header("Authorization","Bearer "+first)).andExpect(jsonPath("$.name").value("Maria da Silva"));
        mvc.perform(get("/api/ranking")).andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("token"))));
    }
    @Test void scoresRecalculateAfterCorrectionAndPredictionsUpsert() throws Exception {
        String a=create("Maria Silva"),b=create("João Santos");
        pick(a,1,2,1);pick(a,1,3,1);pick(b,1,1,0);
        assertEquals(2,db.queryForObject("SELECT COUNT(*) FROM predictions",Integer.class));
        fixture(1,OffsetDateTime.now().minusHours(3),"FT",3,1);
        mvc.perform(get("/api/ranking")).andExpect(jsonPath("$[0].name").value("Maria Silva")).andExpect(jsonPath("$[0].points").value(5)).andExpect(jsonPath("$[1].points").value(3));
        mvc.perform(get("/api/ranking?fixtureId=1")).andExpect(jsonPath("$[0].exact").value(1));
        fixture(1,OffsetDateTime.now().minusHours(3),"FT",1,0);
        mvc.perform(get("/api/ranking")).andExpect(jsonPath("$[0].name").value("João Santos"));
    }
    @Test void blocksLatePostponedAndInvalidPredictions() throws Exception {
        String token=create("Maria Silva");
        for(int id:new int[]{2,3}) mvc.perform(put("/api/fixtures/"+id+"/prediction").header("Authorization","Bearer "+token).contentType("application/json").content("{\"home\":1,\"away\":0}")).andExpect(status().isConflict());
        mvc.perform(put("/api/fixtures/1/prediction").header("Authorization","Bearer "+token).contentType("application/json").content("{\"home\":-1,\"away\":0}")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/ranking?fixtureId=1")).andExpect(status().isConflict());
    }
    @Test void rejectsUnsafePhotosAndIncompleteNames() throws Exception {
        mvc.perform(post("/api/participants").contentType("application/json").content("{\"name\":\"Maria\",\"photo\":\"\"}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/participants").contentType("application/json").content("{\"name\":\"Maria Silva\",\"photo\":\"data:image/svg+xml;base64,xxx\"}")).andExpect(status().isBadRequest());
    }
    @Test void scoringRules() {
        assertEquals(5,Scoring.points(2,1,2,1,"FT"));assertEquals(3,Scoring.points(3,1,2,1,"FT"));
        assertEquals(3,Scoring.points(0,0,2,2,"PEN"));assertEquals(0,Scoring.points(1,0,0,1,"FT"));
        assertEquals(0,Scoring.points(2,1,2,1,"1H"));assertEquals(0,Scoring.points(2,1,null,null,"FT"));
        assertEquals(0,Scoring.points(2,1,2,1,"AWD"));
    }
    @Test void syncImportsCalendarAndExcludesPenaltyShootoutGoals() throws Exception {
        var http=org.mockito.Mockito.mock(java.net.http.HttpClient.class);
        @SuppressWarnings("unchecked")
        java.net.http.HttpResponse<String> response=org.mockito.Mockito.mock(java.net.http.HttpResponse.class);
        org.mockito.Mockito.when(response.statusCode()).thenReturn(200);
        int year=LocalDate.now(ZoneId.of("America/Sao_Paulo")).getYear();
        String fixture="""
          {"fixture":{"id":90,"date":"%d-03-01T20:00:00-03:00","status":{"short":"PEN"}},
           "league":{"id":71,"name":"Copa","season":%d,"round":"Final"},
           "teams":{"home":{"name":"Flamengo"},"away":{"name":"Rival"}},
           "goals":{"home":6,"away":5},"score":{"extratime":{"home":null,"away":null},"fulltime":{"home":1,"away":1}}}
          """.formatted(year,year);
        org.mockito.Mockito.when(response.body()).thenReturn("{\"errors\":[],\"response\":[]}","{\"errors\":[],\"response\":["+fixture+"]}","{\"errors\":[],\"response\":[]}");
        org.mockito.Mockito.doReturn(response).when(http).send(org.mockito.ArgumentMatchers.any(java.net.http.HttpRequest.class),org.mockito.ArgumentMatchers.any(java.net.http.HttpResponse.BodyHandler.class));
        var service=new FootballSync(db,json,"test-key",127,true,http);service.sync();
        assertEquals(1,db.queryForObject("SELECT home_goals FROM fixtures WHERE id=90",Integer.class));
        assertFalse(service.cached("lastSync").isBlank());
        org.mockito.Mockito.when(response.statusCode()).thenReturn(429);
        service.sync();
        assertEquals(1,db.queryForObject("SELECT away_goals FROM fixtures WHERE id=90",Integer.class));
        assertFalse(service.cached("syncError").isBlank());
    }
    @Test void servesResponsiveFrontendWithSecurityHeaders() throws Exception {
        mvc.perform(get("/index.html")).andExpect(status().isOk()).andExpect(header().exists("Content-Security-Policy")).andExpect(content().string(org.hamcrest.Matchers.containsString("Manto de Palpites")));
        mvc.perform(get("/api/status")).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"));
        mvc.perform(get("/api/competitions")).andExpect(status().isOk()).andExpect(jsonPath("$[0].name").value("Brasileirão"));
    }
}
