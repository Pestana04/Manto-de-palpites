import { points, finished, calendarYear, cleanName, validatePrediction } from './rules.mjs';
import {espnFixtures,espnStandings} from './espn.mjs';

export interface SiteEnv {DB:D1Database;FOOTBALL_API_KEY?:string;FLAMENGO_TEAM_ID?:string;}
type Game={id:number;kickoff:string;status:string;home:string;away:string;homeGoals:number|null;awayGoals:number|null;leagueId:number;league:string;season:number;round:string};
type Person={id:string;name:string;photo:string;created:string};
type Pick={participantId:string;fixtureId:number;home:number;away:number};
class ApiError extends Error{constructor(public status:number,message:string){super(message);}}
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const run=async(db:D1Database,sql:string,args:any[]=[])=>db.prepare(sql).bind(...args).run();
async function rows<T>(db:D1Database,sql:string,args:any[]=[]):Promise<T[]>{return (await db.prepare(sql).bind(...args).all<T>()).results;}
const sha=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const getCache=async(db:D1Database,key:string)=>(await db.prepare('SELECT payload FROM cache WHERE cache_key=?').bind(key).first<{payload:string}>())?.payload||'';
const putCache=async(db:D1Database,key:string,value:string)=>run(db,'INSERT INTO cache(cache_key,payload) VALUES(?,?) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload',[key,value]);
async function identity(request:Request,db:D1Database){
  const auth=request.headers.get('Authorization')||'';
  if(!/^Bearer [A-Za-z0-9_-]{43}$/.test(auth))throw new ApiError(401,'Identificação do dispositivo ausente.');
  const p=await db.prepare('SELECT id FROM participants WHERE token_hash=?').bind(await sha(auth.slice(7))).first<{id:string}>();
  if(!p)throw new ApiError(401,'Dispositivo não reconhecido.');return p.id;
}
async function input(request:Request){
  if(Number(request.headers.get('content-length')||0)>710000)throw new ApiError(413,'O arquivo enviado é muito grande.');
  let text='';const reader=request.body?.getReader();if(!reader)throw new ApiError(400,'Solicitação vazia.');
  const decoder=new TextDecoder();let bytes=0;while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>710000){await reader.cancel();throw new ApiError(413,'O arquivo enviado é muito grande.');}text+=decoder.decode(value,{stream:true});}
  try{return JSON.parse(text+decoder.decode());}catch{throw new ApiError(400,'Dados inválidos.');}
}
function photo(value:unknown){
  if(value==='')return '';
  if(typeof value!=='string'||value.length>700000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value))throw new ApiError(400,'Foto inválida. Escolha outra imagem.');
  const raw=atob(value.slice(23));
  if(raw.length>500000||raw.charCodeAt(0)!==255||raw.charCodeAt(1)!==216||raw.charCodeAt(raw.length-2)!==255||raw.charCodeAt(raw.length-1)!==217)throw new ApiError(400,'Foto JPEG inválida.');
  let offset=2,dimensions=false;
  while(offset+8<raw.length){if(raw.charCodeAt(offset)!==255)break;const marker=raw.charCodeAt(offset+1);if(marker===218)break;
    const length=raw.charCodeAt(offset+2)*256+raw.charCodeAt(offset+3);if(length<2)break;
    if([192,193,194].includes(marker)){const height=raw.charCodeAt(offset+5)*256+raw.charCodeAt(offset+6),width=raw.charCodeAt(offset+7)*256+raw.charCodeAt(offset+8);dimensions=width>0&&height>0&&width<=512&&height<=512;break;}offset+=2+length;}
  if(!dimensions)throw new ApiError(400,'Escolha uma foto com até 512 × 512 pixels.');return value;
}
async function games(db:D1Database){
  const year=calendarYear();return rows<Game>(db,`SELECT id,kickoff,status,home,away,home_goals AS homeGoals,away_goals AS awayGoals,league_id AS leagueId,league,season,round_name AS round FROM fixtures WHERE kickoff>=? AND kickoff<? ORDER BY kickoff`,[`${year}-01-01T03:00:00.000Z`,`${year+1}-01-01T03:00:00.000Z`]);
}
async function picks(db:D1Database,id?:string){return rows<Pick>(db,'SELECT participant_id AS participantId,fixture_id AS fixtureId,home,away FROM predictions'+(id?' WHERE participant_id=?':''),id?[id]:[]);}
async function ranking(db:D1Database,fixtureId:number|null){
  const [people,allGames,allPicks]=await Promise.all([rows<Person>(db,'SELECT id,name,photo,created_at AS created FROM participants ORDER BY created_at,id'),games(db),picks(db)]);
  if(fixtureId!==null&&!allGames.some(g=>g.id===fixtureId&&finished(g.status)))throw new ApiError(409,'Ranking disponível após o encerramento.');
  const gameMap=new Map(allGames.filter(g=>fixtureId===null||g.id===fixtureId).map(g=>[g.id,g]));
  const scores=new Map<string,{points:number;exact:number;predictions:number}>();
  for(const pick of allPicks){const game=gameMap.get(pick.fixtureId);if(!game)continue;const row=scores.get(pick.participantId)||{points:0,exact:0,predictions:0};const score=points(pick.home,pick.away,game.homeGoals,game.awayGoals,game.status);row.points+=score;row.exact+=score===5?1:0;row.predictions++;scores.set(pick.participantId,row);}
  return people.map(p=>({id:p.id,name:p.name,photo:p.photo,...(scores.get(p.id)||{points:0,exact:0,predictions:0})})).sort((a,b)=>b.points-a.points||b.exact-a.exact);
}
async function competitions(db:D1Database){
  const list=await games(db);const unique=new Map(list.map(f=>[`${f.leagueId}:${f.season}`,{id:f.leagueId,name:f.league,season:f.season}]));
  return Promise.all([...unique].map(async([key,c])=>({...c,standings:JSON.parse(await getCache(db,'standings:'+key)||'[]')})));
}
async function apiFetch(env:SiteEnv,path:string){
  const response=await fetch('https://v3.football.api-sports.io/'+path,{headers:{'x-apisports-key':env.FOOTBALL_API_KEY!},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('A fonte de jogos recusou a consulta.');
  const body:any=await response.json();if(Object.keys(body.errors||{}).length||!Array.isArray(body.response)){
    const errors=JSON.stringify(body.errors||{}).toLowerCase();
    if(/season|plan|subscription/.test(errors))throw new Error('O plano da API-Football não permite consultar esta temporada. Confira a cobertura no painel do fornecedor.');
    if(/key|token|auth/.test(errors))throw new Error('A chave da API-Football não foi aceita. Confira a configuração secreta do site.');
    throw new Error('A fonte de jogos não disponibilizou os dados. Confira a chave, a cota e a cobertura do plano.');
  }
  if((body.paging?.total||1)>1)throw new Error('A fonte retornou uma resposta incompleta.');return body.response as any[];
}
export async function synchronize(env:SiteEnv){
  const db=env.DB;
  const year=calendarYear(),now=Date.now(),last=await getCache(db,'lastSync');
  if(last&&new Date(last).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'})===new Date(now).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}))return {updated:false,reason:'already-current'};
  const lock=await run(db,`INSERT INTO cache(cache_key,payload) VALUES('syncLock:v2',?) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload WHERE CAST(cache.payload AS INTEGER)<?`,[String(now+30*60*1000),now]);
  if(!lock.meta.changes)return {updated:false,reason:'in-progress-or-retry-later'};
  try{
    const team=/^\d+$/.test(env.FLAMENGO_TEAM_ID||'')?env.FLAMENGO_TEAM_ID:'127';
    // No live API call per visitor: one bounded synchronization per calendar day.
    let all:any[]=[],source='API-Football';
    try{if(!env.FOOTBALL_API_KEY?.trim())throw Error('Chave ausente.');for(const season of [year-1,year])all.push(...await apiFetch(env,`fixtures?team=${team}&season=${season}`));}
    catch{all=await espnFixtures(year);source='ESPN';}
    const filtered=all.filter(f=>calendarYear(f.fixture.date)===year);const statements=[];const leagues=new Map<string,{id:number;season:number;espnSlug?:string}>();
    for(const f of filtered){const status=f.fixture.status.short;let goals=f.goals;
      if(['AET','PEN'].includes(status)&&Number.isInteger(f.score?.extratime?.home))goals=f.score.extratime;
      else if(status==='PEN')goals=f.score.fulltime;
      statements.push(db.prepare(`INSERT INTO fixtures(id,kickoff,status,home,away,home_goals,away_goals,league_id,league,season,round_name) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kickoff=excluded.kickoff,status=excluded.status,home=excluded.home,away=excluded.away,home_goals=excluded.home_goals,away_goals=excluded.away_goals,league_id=excluded.league_id,league=excluded.league,season=excluded.season,round_name=excluded.round_name`).bind(f.fixture.id,new Date(f.fixture.date).toISOString(),status,f.teams.home.name,f.teams.away.name,goals?.home??null,goals?.away??null,f.league.id,f.league.name,f.league.season,f.league.round||''));
      leagues.set(`${f.league.id}:${f.league.season}`,{id:f.league.id,season:f.league.season,espnSlug:f.league.espnSlug});
    }
    // A failed request never replaces the previous cache with fabricated data.
    for(let i=0;i<statements.length;i+=50)await db.batch(statements.slice(i,i+50));
    let tableErrors=0;
    for(const [key,league]of leagues){try{const tables=source==='ESPN'?await espnStandings(league.espnSlug,league.season):await apiFetch(env,`standings?league=${league.id}&season=${league.season}`);await putCache(db,'standings:'+key,JSON.stringify(tables));}catch{tableErrors++;}}
    await putCache(db,'source',source);await putCache(db,'lastSync',new Date().toISOString());await putCache(db,'syncError',tableErrors?'Algumas tabelas não puderam ser atualizadas. Os dados disponíveis foram preservados.':'');
    return {updated:true,fixtures:filtered.length,competitions:leagues.size,tableErrors,source};
  }catch(error){const message=error instanceof Error&&error.message.startsWith('O plano')||error instanceof Error&&error.message.startsWith('A chave')?error.message:'Não foi possível atualizar os jogos. Os dados anteriores foram preservados. Confira a chave, a cota e a cobertura do plano da API.';await putCache(db,'syncError',message);return {updated:false,error:message};}
}
export async function handleApi(request:Request,env:SiteEnv){
  try{
    if(!env.DB)throw new ApiError(503,'O banco do site está sendo preparado. Tente novamente em instantes.');
    const db=env.DB,url=new URL(request.url),path=url.pathname.replace(/\/$/,''),method=request.method;
    if(method==='POST'&&path==='/api/sync')return reply(await synchronize(env));
    if(method==='GET'&&path==='/api/status')return reply({configured:true,source:await getCache(db,'source'),lastSync:await getCache(db,'lastSync'),error:await getCache(db,'syncError')});
    if(method==='GET'&&path==='/api/fixtures')return reply(await games(db));
    if(method==='GET'&&path==='/api/competitions')return reply(await competitions(db));
    if(method==='GET'&&path==='/api/ranking'){
      const id=url.searchParams.get('fixtureId');if(id!==null&&!/^\d+$/.test(id))throw new ApiError(400,'Partida inválida.');return reply(await ranking(db,id===null?null:Number(id)));
    }
    if(method==='POST'&&path==='/api/participants'){
      const body=await input(request);let name;try{name=cleanName(body.name);}catch{throw new ApiError(400,'Informe nome e sobrenome, com até 100 caracteres.');}
      const avatar=photo(body.photo);const id=crypto.randomUUID();const token=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      await run(db,'INSERT INTO participants(id,token_hash,name,photo,created_at) VALUES(?,?,?,?,?)',[id,await sha(token),name,avatar,new Date().toISOString()]);return reply({id,token});
    }
    if(path==='/api/me'||path==='/api/me/predictions'){
      const id=await identity(request,db);
      if(method==='GET'&&path.endsWith('/predictions'))return reply(await picks(db,id));
      if(method==='GET')return reply(await db.prepare('SELECT id,name,photo,created_at AS created FROM participants WHERE id=?').bind(id).first());
      if(method==='PUT'&&path==='/api/me'){const body=await input(request);let name;try{name=cleanName(body.name);}catch{throw new ApiError(400,'Informe nome e sobrenome.');}await run(db,'UPDATE participants SET name=?,photo=? WHERE id=?',[name,photo(body.photo),id]);return new Response(null,{status:204});}
    }
    const match=path.match(/^\/api\/fixtures\/(\d+)\/prediction$/);
    if(method==='PUT'&&match){
      const id=await identity(request,db),fixtureId=Number(match[1]),body=await input(request);try{validatePrediction(body);}catch{throw new ApiError(400,'Confira o placar: números inteiros entre 0 e 30.');}
      // The eligibility check and write are one atomic SQLite statement.
      const now=new Date().toISOString();const change=await run(db,`INSERT INTO predictions(participant_id,fixture_id,home,away,updated_at) SELECT ?,id,?,?,? FROM fixtures WHERE id=? AND status='NS' AND kickoff>? ON CONFLICT(participant_id,fixture_id) DO UPDATE SET home=excluded.home,away=excluded.away,updated_at=excluded.updated_at`,[id,body.home,body.away,now,fixtureId,now]);
      if(!change.meta.changes)throw new ApiError(409,'Palpites encerrados para esta partida.');return new Response(null,{status:204});
    }
    throw new ApiError(404,'Página não encontrada.');
  }catch(error){if(error instanceof ApiError)return reply({message:error.message},error.status);console.error('API request failed',error instanceof Error?error.name:'Unknown');return reply({message:'Não foi possível concluir. Tente novamente em instantes.'},500);}
}
