import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEvent,normalizeStandings} from '../lib/espn.mjs';
test('feed normaliza jogo final sem somar pênaltis ou agregado',()=>{
  const fixture=normalizeEvent({id:'1234',date:'2026-10-23T00:30Z',season:{year:2026},league:{id:'783',slug:'conmebol.libertadores',name:'Libertadores'},competitions:[{status:{type:{name:'STATUS_FINAL_PEN',state:'post',completed:true}},competitors:[{homeAway:'home',team:{displayName:'Flamengo'},score:{value:0,shootoutScore:2,aggregateScore:3}},{homeAway:'away',team:{displayName:'Rival'},score:{value:0,shootoutScore:3,aggregateScore:3}}]}]});
  assert.equal(fixture.fixture.id,1000001234);assert.equal(fixture.fixture.status.short,'PEN');assert.deepEqual(fixture.goals,{home:0,away:0});
});
test('tabela de grupos preserva pontos, posição e jogos',()=>{
  const body={children:[{name:'Grupo A',standings:{entries:[{team:{displayName:'Flamengo'},stats:[{name:'rank',value:1},{name:'points',value:12},{name:'gamesPlayed',value:5},{name:'wins',value:4}]}]}}]};
  const row=normalizeStandings(body)[0].league.standings[0][0];assert.equal(row.points,12);assert.equal(row.all.played,5);assert.equal(row.group,'Grupo A');
});
