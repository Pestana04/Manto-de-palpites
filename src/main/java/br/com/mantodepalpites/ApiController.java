package br.com.mantodepalpites;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import javax.imageio.ImageIO;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;

@RestController
@RequestMapping("/api")
public class ApiController {
    private final JdbcTemplate db;
    private final FootballSync sync;
    private final ObjectMapper json;
    public ApiController(JdbcTemplate db, FootballSync sync, ObjectMapper json) { this.db=db; this.sync=sync; this.json=json; }
    public record ProfileInput(@NotBlank @Size(min=5,max=100) String name, @NotNull @Size(max=700000) String photo) {}
    public record PredictionInput(@NotNull @Min(0) @Max(30) Integer home,@NotNull @Min(0) @Max(30) Integer away) {}
    public record Fixture(long id, OffsetDateTime kickoff,String status,String home,String away,Integer homeGoals,Integer awayGoals,long leagueId,String league,int season,String round) {}
    public record Person(UUID id,String name,String photo,Instant created) {}
    public record Pick(UUID participantId,long fixtureId,int home,int away) {}
    public record Rank(UUID id,String name,String photo,int points,int exact,int predictions) {}
    private String hash(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch(NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    private UUID identity(String auth) {
        if(auth==null || !auth.startsWith("Bearer ") || auth.length()>200) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Identificação do dispositivo ausente.");
        return db.query("SELECT id FROM participants WHERE token_hash=?",(r,n)->r.getObject(1,UUID.class),hash(auth.substring(7))).stream().findFirst()
            .orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Dispositivo não reconhecido."));
    }
    private String name(String value) {
        String clean=value.strip().replaceAll("\\s+"," ");
        if(clean.length()<5 || clean.length()>100 || !clean.contains(" ") || clean.chars().anyMatch(Character::isISOControl)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Informe nome e sobrenome.");
        return clean;
    }
    private String photo(String value) {
        if(value.isEmpty()) return "";
        try {
            if(!value.startsWith("data:image/jpeg;base64,")) throw new IOException();
            byte[] bytes=Base64.getDecoder().decode(value.substring(23));
            if(bytes.length>500000) throw new IOException();
            try(var input=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                var readers=ImageIO.getImageReaders(input);
                if(!readers.hasNext()) throw new IOException();
                var reader=readers.next();
                try { reader.setInput(input); if(reader.getWidth(0)>512 || reader.getHeight(0)>512) throw new IOException(); }
                finally { reader.dispose(); }
            }
            var image=ImageIO.read(new ByteArrayInputStream(bytes));
            if(image==null) throw new IOException();
            var out=new ByteArrayOutputStream(); ImageIO.write(image,"jpg",out);
            return "data:image/jpeg;base64,"+Base64.getEncoder().encodeToString(out.toByteArray());
        } catch(Exception e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Foto inválida. Escolha outra imagem."); }
    }
    @PostMapping("/participants")
    public Map<String,Object> create(@Valid @RequestBody ProfileInput input) {
        String fullName=name(input.name()), avatar=photo(input.photo());
        UUID id=UUID.randomUUID(); byte[] secret=new byte[32]; new SecureRandom().nextBytes(secret);
        String token=Base64.getUrlEncoder().withoutPadding().encodeToString(secret);
        db.update("INSERT INTO participants VALUES(?,?,?,?,?)",id,hash(token),fullName,avatar,OffsetDateTime.now());
        return Map.of("token",token,"id",id);
    }
    @GetMapping("/me")
    public Person me(@RequestHeader(value="Authorization",required=false) String auth) {
        UUID id=identity(auth); return people().stream().filter(p->p.id().equals(id)).findFirst().orElseThrow();
    }
    @PutMapping("/me")
    public void update(@RequestHeader(value="Authorization",required=false) String auth,@Valid @RequestBody ProfileInput input) {
        db.update("UPDATE participants SET name=?,photo=? WHERE id=?",name(input.name()),photo(input.photo()),identity(auth));
    }
    private List<Person> people() { return db.query("SELECT * FROM participants ORDER BY created_at,id",(r,n)->new Person(r.getObject("id",UUID.class),r.getString("name"),r.getString("photo"),r.getObject("created_at",OffsetDateTime.class).toInstant())); }
    @GetMapping("/fixtures")
    public List<Fixture> fixtures() {
        int year=LocalDate.now(ZoneId.of("America/Sao_Paulo")).getYear();
        return db.query("SELECT * FROM fixtures WHERE kickoff>=? AND kickoff<? ORDER BY kickoff",(r,n)->new Fixture(r.getLong("id"),r.getObject("kickoff",OffsetDateTime.class),r.getString("status"),r.getString("home"),r.getString("away"),(Integer)r.getObject("home_goals"),(Integer)r.getObject("away_goals"),r.getLong("league_id"),r.getString("league"),r.getInt("season"),r.getString("round_name")),LocalDate.of(year,1,1).atStartOfDay(ZoneId.of("America/Sao_Paulo")).toOffsetDateTime(),LocalDate.of(year+1,1,1).atStartOfDay(ZoneId.of("America/Sao_Paulo")).toOffsetDateTime());
    }
    @GetMapping("/me/predictions")
    public List<Pick> myPredictions(@RequestHeader(value="Authorization",required=false) String auth) {
        UUID id=identity(auth); return picks().stream().filter(p->p.participantId().equals(id)).toList();
    }
    private List<Pick> picks() { return db.query("SELECT * FROM predictions",(r,n)->new Pick(r.getObject("participant_id",UUID.class),r.getLong("fixture_id"),r.getInt("home"),r.getInt("away"))); }
    @Transactional
    @PutMapping("/fixtures/{id}/prediction")
    public void predict(@PathVariable long id,@RequestHeader(value="Authorization",required=false) String auth,@Valid @RequestBody PredictionInput input) {
        UUID person=identity(auth);
        var times=db.query("SELECT kickoff,status FROM fixtures WHERE id=? FOR UPDATE",(r,n)->Map.entry(r.getObject(1,OffsetDateTime.class),r.getString(2)),id);
        if(times.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Jogo não encontrado.");
        var f=times.getFirst();
        if(!f.getValue().equals("NS") || !f.getKey().toInstant().isAfter(Instant.now())) throw new ResponseStatusException(HttpStatus.CONFLICT,"Palpites encerrados para esta partida.");
        db.update("MERGE INTO predictions KEY(participant_id,fixture_id) VALUES(?,?,?,?,?)",person,id,input.home(),input.away(),OffsetDateTime.now());
    }
    @GetMapping("/ranking")
    public List<Rank> ranking(@RequestParam(required=false) Long fixtureId) {
        var games=fixtures(); var picks=picks(); List<Rank> result=new ArrayList<>();
        if(fixtureId!=null && games.stream().noneMatch(f->f.id()==fixtureId && Scoring.finished(f.status()))) throw new ResponseStatusException(HttpStatus.CONFLICT,"Ranking disponível após o encerramento.");
        for(Person person:people()) {
            int points=0,exact=0,count=0;
            for(Fixture f:games) {
                if(fixtureId!=null && f.id()!=fixtureId) continue;
                for(Pick p:picks) if(p.participantId().equals(person.id()) && p.fixtureId()==f.id()) {
                    int score=Scoring.points(p.home(),p.away(),f.homeGoals(),f.awayGoals(),f.status()); points+=score; if(score==5) exact++; count++;
                }
            }
            result.add(new Rank(person.id(),person.name(),person.photo(),points,exact,count));
        }
        // Stable ties: exact scores, then earlier registration (the input list's order).
        result.sort(Comparator.comparingInt(Rank::points).reversed().thenComparing(Comparator.comparingInt(Rank::exact).reversed()));
        return result;
    }
    @GetMapping("/competitions")
    public List<Map<String,Object>> competitions() throws Exception {
        Map<String,Map<String,Object>> result=new LinkedHashMap<>();
        for(Fixture f:fixtures()) {
            String k=f.leagueId()+":"+f.season();
            if(result.containsKey(k)) continue;
            String cached=sync.cached("standings:"+k);
            result.put(k,Map.of("id",f.leagueId(),"name",f.league(),"season",f.season(),"standings",json.readTree(cached.isEmpty()?"[]":cached)));
        }
        return new ArrayList<>(result.values());
    }
    @GetMapping("/status") public Map<String,Object> status() { return sync.status(); }
}
