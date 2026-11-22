import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const base='http://127.0.0.1:8787';
mkdirSync('.sites-runtime',{recursive:true});
function sql(value){writeFileSync('.sites-runtime/test-data.sql',value);execFileSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--file','.sites-runtime/test-data.sql'],{stdio:'pipe'});}
async function call(path,method='GET',body,token){
  const r=await fetch(base+'/api'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const text=await r.text();return {status:r.status,data:text?JSON.parse(text):null};
}
const now=new Date(),future=new Date(+now+86400000).toISOString(),past=new Date(+now-86400000).toISOString();
sql(`DELETE FROM predictions;DELETE FROM participants;DELETE FROM fixtures;INSERT INTO fixtures VALUES(1,'${future}','NS','Flamengo','Rival',NULL,NULL,71,'Competição de teste',${now.getFullYear()},'Rodada 1');INSERT INTO fixtures VALUES(2,'${past}','NS','Flamengo','Rival',NULL,NULL,71,'Competição de teste',${now.getFullYear()},'Rodada 2');`);
assert.equal((await fetch(base)).status,200);
assert.equal((await call('/me')).status,401);
assert.equal((await call('/participants','POST',{name:'Maria',photo:''})).status,400);
const a=(await call('/participants','POST',{name:'Maria Silva',photo:''})).data;
const b=(await call('/participants','POST',{name:'João Santos',photo:''})).data;
assert.ok(a.token&&b.token&&a.token!==b.token);
assert.equal((await call('/me','GET',null,a.token)).data.name,'Maria Silva');
assert.equal((await call('/fixtures/1/prediction','PUT',{home:2,away:1},a.token)).status,204);
assert.equal((await call('/fixtures/1/prediction','PUT',{home:1,away:0},b.token)).status,204);
assert.equal((await call('/fixtures/2/prediction','PUT',{home:1,away:0},a.token)).status,409);
assert.equal((await call('/fixtures/1/prediction','PUT',{home:2.5,away:0},a.token)).status,400);
assert.equal((await call('/ranking?fixtureId=1')).status,409);
assert.equal((await call('/me/predictions','GET',null,a.token)).data.length,1);
sql(`UPDATE fixtures SET kickoff='${past}',status='FT',home_goals=2,away_goals=1 WHERE id=1;`);
let rank=(await call('/ranking')).data;
assert.equal(rank[0].name,'Maria Silva');assert.equal(rank[0].points,5);assert.equal(rank[1].points,3);
assert.equal((await call('/ranking?fixtureId=1')).data[0].exact,1);
assert.ok(!JSON.stringify(rank).includes(a.token)&&!JSON.stringify(rank).includes('token_hash'));
assert.equal((await call('/fixtures/1/prediction','PUT',{home:1,away:0},a.token)).status,409);
sql('UPDATE fixtures SET home_goals=1,away_goals=0 WHERE id=1;');
assert.equal((await call('/ranking')).data[0].name,'João Santos');
assert.equal((await call('/me','PUT',{name:'Maria Oliveira',photo:''},a.token)).status,204);
assert.equal((await call('/me','GET',null,b.token)).data.name,'João Santos');
assert.equal((await call('/me','PUT',{name:'Maria Oliveira',photo:'data:image/svg+xml;base64,xxx'},a.token)).status,400);
assert.equal((await call('/competitions')).data[0].name,'Competição de teste');
assert.equal((await call('/status')).data.configured,true);
console.log('Integração local aprovada: identidade, isolamento, validação, palpites, bloqueio de horário, rankings, correção de placar e competições.');
