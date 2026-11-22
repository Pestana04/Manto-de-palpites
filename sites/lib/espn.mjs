// Public ESPN feed. Keep this adapter isolated: the feed has no public stability contract.
const labels={'bra.1':'Campeonato Brasileiro','bra.camp.carioca':'Campeonato Carioca','bra.copa_do_brazil':'Copa do Brasil','bra.supercopa_do_brazil':'Supercopa do Brasil','conmebol.libertadores':'CONMEBOL Libertadores','conmebol.recopa':'Recopa Sul-Americana'};
export function normalizeEvent(event){
  const game=event.competitions?.[0],league=event.league;
  const home=game?.competitors?.find(c=>c.homeAway==='home'),away=game?.competitors?.find(c=>c.homeAway==='away');
  if(!home||!away||!league||!Number.isFinite(+event.id)||!Number.isFinite(+league.id))return null;
  const type=game.status?.type||{},name=type.name||'';
  let status='LIVE';
  if(/POSTPON/.test(name))status='PST';else if(/CANCEL/.test(name))status='CANC';else if(/ABANDON/.test(name))status='ABD';else if(/SUSPEND/.test(name))status='SUSP';
  else if(type.completed){if(/PEN/.test(name))status='PEN';else if(/EXTRA/.test(name))status='AET';else if(/FULL_TIME|FINAL/.test(name))status='FT';else status='AWD';}
  else if(type.state==='pre')status=event.timeValid===false?'TBD':'NS';
  const score=c=>{const value=typeof c.score==='object'?c.score.value:c.score;return value!==undefined&&value!==null&&Number.isFinite(+value)?+value:null;};
  // score.value is the match total; shootoutScore and aggregateScore are separate and excluded.
  const goals={home:score(home),away:score(away)};
  const fixtureId=1_000_000_000+Number(event.id),leagueId=1_000_000+Number(league.id);
  return {fixture:{id:fixtureId,date:event.date,status:{short:status}},teams:{home:{name:home.team.displayName},away:{name:away.team.displayName}},goals,score:{fulltime:goals,extratime:goals},league:{id:leagueId,name:labels[league.slug]||league.name,season:event.season.year,round:game.leg?`${game.leg.value}º jogo`:event.seasonType?.name||'',espnSlug:league.slug}};
}
export function normalizeStandings(body){
  const groups=[];
  function visit(node){
    if(node.standings?.entries?.length){groups.push(node.standings.entries.map((row,i)=>{
      const stats=Object.fromEntries(row.stats.map(s=>[s.name,s.value]));
      return {rank:stats.rank||i+1,team:{name:row.team.displayName},points:stats.points||0,goalsDiff:stats.pointDifferential||0,group:node.name||'Classificação',all:{played:stats.gamesPlayed||0,win:stats.wins||0,draw:stats.ties||0,lose:stats.losses||0}};
    }));}
    for(const child of node.children||[])visit(child);
  }
  visit(body);return groups.length?[{league:{standings:groups}}]:[];
}
async function getJson(url){const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Fonte ESPN indisponível.');return response.json();}
export async function espnFixtures(year){
  const base=`https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/819/schedule?season=${year}`;
  const events=new Map();
  for(const suffix of ['','&fixture=true']){
    const body=await getJson(base+suffix);if(body.team?.id!=='819'||!Array.isArray(body.events))throw Error('Agenda ESPN inválida.');
    for(const event of body.events)events.set(event.id,event);
  }
  const normalized=[...events.values()].map(normalizeEvent).filter(Boolean);
  if(!normalized.length)throw Error('A fonte não disponibilizou a agenda desta temporada.');return normalized;
}
export async function espnStandings(slug,year){
  if(!/^[a-z0-9._-]+$/.test(slug))throw Error('Competição inválida.');
  return normalizeStandings(await getJson(`https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings?season=${year}`));
}
