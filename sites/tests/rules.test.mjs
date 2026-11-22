import {test} from 'node:test';
import assert from 'node:assert/strict';
import {points,calendarYear,cleanName,validatePrediction} from '../lib/rules.mjs';
test('placar exato e resultado correto não acumulam pontos',()=>{
  assert.equal(points(2,1,2,1,'FT'),5);assert.equal(points(3,1,2,1,'FT'),3);assert.equal(points(1,2,2,1,'FT'),0);
  assert.equal(points(0,0,2,2,'PEN'),3);assert.equal(points(2,1,2,1,'AET'),5);
});
test('partidas não concluídas e decisões administrativas não pontuam',()=>{
  for(const status of ['NS','PST','CANC','AWD','WO','1H'])assert.equal(points(2,1,2,1,status),0);
  assert.equal(points(2,1,null,null,'FT'),0);
});
test('ano da temporada respeita Brasília na virada',()=>{
  assert.equal(calendarYear('2027-01-01T01:00:00Z'),2026);assert.equal(calendarYear('2027-01-01T03:01:00Z'),2027);
});
test('nome completo e placares são validados no servidor',()=>{
  assert.equal(cleanName(' Maria   Silva '),'Maria Silva');assert.throws(()=>cleanName('Maria'));assert.throws(()=>cleanName(null));
  for(const body of [{home:1.5,away:1},{home:-1,away:0},{home:31,away:0},{away:0}])assert.throws(()=>validatePrediction(body));
  assert.doesNotThrow(()=>validatePrediction({home:0,away:30}));
});
