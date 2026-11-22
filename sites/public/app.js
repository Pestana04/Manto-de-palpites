'use strict';
const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let token='', me=null, games=[], ranks=[], picks=[], competitions=[], status={}, photoDraft='', busy=false;
try { token=localStorage.getItem('manto.device')||''; } catch { /* Registration explains storage requirement. */ }
const finished=f=>['FT','AET','PEN'].includes(f.status);
const open=f=>f.status==='NS' && new Date(f.kickoff)>new Date();
const initials=name=>name.split(' ').filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
const avatar=p=>p.photo?`<img class="avatar" src="${esc(p.photo)}" alt="Foto de ${esc(p.name)}" loading="lazy">`:`<span class="avatar" aria-hidden="true">${esc(initials(p.name))}</span>`;
const date=(v,full=false)=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'short',...(full?{hour:'2-digit',minute:'2-digit'}:{})}).format(new Date(v));
const label=f=>({FT:'Encerrado',AET:'Após prorrogação',PEN:'Após pênaltis',NS:'Agendado',PST:'Adiado',CANC:'Cancelado',TBD:'Data a confirmar',SUSP:'Suspenso',ABD:'Interrompido',AWD:'Decisão administrativa',WO:'W.O.'}[f.status]||'Em andamento');
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),4500);}
async function api(path,options={}){
  const res=await fetch('/api'+path,{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...options.headers}});
  if(!res.ok){let body={};try{body=await res.json();}catch{}if(res.status===401){token='';me=null;try{localStorage.removeItem('manto.device');}catch{}if(!$('#welcome').open)$('#welcome').showModal();}throw new Error(body.message||'Não foi possível concluir. Tente novamente.');}
  if(res.status===204)return null;const text=await res.text();return text?JSON.parse(text):null;
}
function empty(title,copy){return `<div class="empty"><h3>${esc(title)}</h3><p>${esc(copy)}</p></div>`;}
function rankList(list){return list.length?`<div class="ranking-list">${list.map((p,i)=>`<div class="rank-row ${['gold','silver','bronze'][i]||''}"><span class="position">${String(i+1).padStart(2,'0')}</span>${avatar(p)}<div><span class="name">${esc(p.name)}${me?.id===p.id?' · você':''}</span><span class="rank-meta">${p.exact} ${p.exact===1?'placar exato':'placares exatos'} · ${p.predictions} ${p.predictions===1?'palpite':'palpites'}</span></div><div class="rank-points">${p.points}<small>PONTOS</small></div></div>`).join('')}</div>`:empty('A primeira posição está livre.','Entre na torcida e faça seu primeiro palpite.');}
function matchCard(f){
  const pick=picks.find(p=>p.fixtureId===f.id);
  return `<article class="match-card"><div class="match-meta"><span>${esc(f.league)} · ${esc(f.round)}</span><span>${date(f.kickoff,open(f))}</span></div><div class="teams"><span>${esc(f.home)}</span><strong class="score">${finished(f)?`${f.homeGoals??'–'} : ${f.awayGoals??'–'}`:'×'}</strong><span>${esc(f.away)}</span></div>${open(f)?`<form class="prediction-form" data-game="${f.id}"><label class="sr-only" for="home-${f.id}">Gols de ${esc(f.home)}</label><input id="home-${f.id}" name="home" type="number" min="0" max="30" inputmode="numeric" required value="${pick?.home??''}" aria-label="Gols de ${esc(f.home)}"><span>×</span><label class="sr-only" for="away-${f.id}">Gols de ${esc(f.away)}</label><input id="away-${f.id}" name="away" type="number" min="0" max="30" inputmode="numeric" required value="${pick?.away??''}" aria-label="Gols de ${esc(f.away)}"><button class="button" type="submit">${pick?'Atualizar':'Palpitar'}</button></form><p class="saved-pick">${pick?`Seu palpite: ${pick.home} × ${pick.away}. Editável até o início.`:'Palpites abertos até o início do jogo.'}</p>`:finished(f)?`<button class="match-details" data-details="${f.id}">Ver pontuação da partida</button>`:`<p class="saved-pick">${esc(label(f))} · Palpites fechados</p>`}</article>`;
}
function statusNotice(){
  if(!status.configured)return '<div class="notice" role="status">A agenda da temporada ainda não está disponível. Aguardando a configuração da fonte de jogos pelo organizador.</div>';
  if(status.error)return `<div class="notice" role="status">${esc(status.error)}</div>`;
  return '';
}
function title(eyebrow,heading,copy){return `<div class="page-title"><span class="eyebrow">${eyebrow}</span><h1>${heading}</h1><p>${copy}</p></div>`;}
function render(){
  const tab=location.hash.slice(1)||'ranking';
  document.querySelectorAll('[data-tab]').forEach(a=>{const active=a.dataset.tab===(tab==='todos'?'ranking':tab);a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  $('#navigation').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');
  $('#header-person').innerHTML=me?avatar(me):'<span class="avatar">MP</span>';
  let content='';
  if(tab==='competicoes'){
    content=title('CADA TAÇA, UMA HISTÓRIA','Em todas as frentes.','As competições do Flamengo na temporada, com classificação e calendário por torneio.')+statusNotice();
    content+=competitions.length?competitions.map(c=>`<details class="competition"><summary>${esc(c.name)} <span class="year-badge">${c.season}</span></summary><div class="competition-body">${standings(c)}<h3 class="subhead">Jogos na competição</h3>${games.filter(f=>f.leagueId===c.id && f.season===c.season).map(matchCard).join('')}</div></details>`).join(''):empty('A temporada vai aparecer aqui.','Assim que a fonte de dados for conectada, os torneios serão identificados pelos jogos do Flamengo.');
  }else if(tab==='perfil'){
    const rank=ranks.find(p=>p.id===me?.id);const position=ranks.findIndex(p=>p.id===me?.id)+1;
    content=title('SEU NOME, SUAS CORES','Meu lugar na torcida.','Atualize seu perfil e acompanhe os pontos conquistados em cada rodada.');
    if(me)content+=`<div class="profile-grid"><form id="profile-form" class="profile-form"><div class="profile-photo"><div id="photo-preview">${avatar(me)}</div><div class="photo-controls"><p class="photo-heading">Sua foto no ranking</p><span class="photo-label">Escolha uma imagem de até 10 MB.</span><div class="photo-picker"><input class="sr-only" type="file" id="photo-input" aria-describedby="photo-filename" accept="image/jpeg,image/png,image/webp"><label class="button secondary" for="photo-input">Escolher foto</label><span id="photo-filename" class="photo-filename" aria-live="polite">Nenhum arquivo escolhido</span></div><button type="button" class="text-button" id="remove-photo">Remover foto</button></div></div><div class="field"><label for="profile-name">Nome completo</label><input type="text" id="profile-name" autocomplete="name" minlength="5" maxlength="100" required value="${esc(me.name)}"></div><p class="fine">Seu nome e sua foto aparecem publicamente no ranking.</p><button type="submit" class="button">Salvar perfil</button><p class="fine subhead">Este perfil pertence a este navegador. Não limpe os dados do site se quiser manter seu acesso. Não há recuperação por senha nem sincronização entre dispositivos.</p></form><section><h2>Seu campeonato</h2><div class="stats"><div class="stat"><strong>${rank?.points??0}</strong><span>pontos</span></div><div class="stat"><strong>${position||'–'}º</strong><span>no ranking</span></div><div class="stat"><strong>${rank?.exact??0}</strong><span>placares exatos</span></div></div><h3>Meus palpites</h3>${picks.length?games.filter(f=>picks.some(p=>p.fixtureId===f.id)).toReversed().map(f=>{const p=picks.find(p=>p.fixtureId===f.id);const score=scorePick(p,f);return `<article class="match-card"><small>${date(f.kickoff)} · ${esc(label(f))}</small><p class="serif">${esc(f.home)} × ${esc(f.away)}</p><strong>Seu palpite: ${p.home} × ${p.away}</strong><p class="saved-pick">${finished(f)?score+' pontos':'Aguardando resultado'}</p></article>`;}).join(''):empty('Sua história começa no próximo jogo.','Volte ao ranking para encontrar as partidas com palpites abertos.')}</section></div>`;
    else content+=empty('Entre na torcida.','Informe seu nome completo para acessar seu perfil.');
    photoDraft=me?.photo||'';
  }else if(tab==='todos'){
    content='<a class="back" href="#ranking">Voltar ao início</a>'+title('A ARQUIBANCADA COMPLETA','Cada palpite conta.','Classificação geral da temporada. Desempate por placares exatos e, depois, pela ordem de inscrição.')+`<div class="wide-ranking">${rankList(ranks)}</div>`;
  }else if(tab==='regras'){
    content=title('O REGULAMENTO','O jogo é simples.','Palpite no placar, acompanhe as partidas e suba na classificação.')+`<div class="rules"><h2>5 pontos pelo placar exato</h2><p>Palpitou 2 × 1 e o jogo terminou 2 × 1? São 5 pontos.</p><h2>3 pontos pelo resultado</h2><p>Acertou quem venceu ou se foi empate, mas errou o placar? São 3 pontos. Os pontos não se somam aos de placar exato. Os demais palpites valem 0.</p><h2>Até a bola rolar</h2><p>Você pode enviar ou alterar seu palpite enquanto a partida estiver agendada e antes do horário de início. O horário é conferido pelo servidor. Jogos adiados ficam bloqueados até receberem nova data e voltarem ao estado agendado.</p><h2>Prorrogação e pênaltis</h2><p>Vale o placar ao fim do jogo, incluindo prorrogação quando houver. Gols da disputa de pênaltis não entram no placar do palpite. W.O., partidas canceladas, interrompidas ou com decisão administrativa não pontuam.</p><h2>A temporada inteira</h2><p>O ranking soma os jogos do Flamengo disputados no ano atual, pelo horário de Brasília. Os dados ficam salvos no servidor. A atualização é diária às 5h, enquanto o servidor estiver ligado, e ao iniciar a aplicação. Não é uma atualização em tempo real.</p><h2>Desempate</h2><p>Mais pontos, depois mais placares exatos e, persistindo o empate, inscrição mais antiga. A ordem vale também para as cores ouro, prata e bronze.</p><h2>Um navegador, um perfil</h2><p>Sem login ou senha, sua identificação fica salva neste navegador. Outro navegador ou dispositivo cria um perfil diferente. Seu nome e foto aparecem publicamente. Esta versão é destinada a um bolão informal e não impede que alguém crie vários perfis.</p></div>`;
  }else{
    const recent=games.filter(finished).toReversed().slice(0,4),next=games.filter(open);
    content=`<div class="edition"><span>O palpite é seu. A paixão é de todos.</span><span class="edition-right">Temporada ${new Date().getFullYear()} · Rubro-negro desde sempre</span></div><section class="hero"><div class="hero-copy"><span class="eyebrow">DA ARQUIBANCADA PARA A HISTÓRIA</span><h1>Seu palpite<br>veste o <em>Manto.</em></h1><p>A emoção de cada jogo. A resenha entre amigos. E aquele placar que só você sabia que ia dar.</p><a class="button" href="#proximos">Dar meu palpite</a></div><div class="hero-photo"><img src="/images/manto-historico.png" alt="Formação histórica do Flamengo com o tradicional uniforme rubro-negro"><div class="photo-caption"><small>UMA PAIXÃO QUE ATRAVESSA GERAÇÕES</small>O passado inspira. A torcida continua.</div></div></section>${statusNotice()}<div class="content-grid"><section><div class="section-head"><div><span class="eyebrow">QUEM ENTENDE DO MANTO</span><h2>Ranking da torcida</h2></div><a class="text-link" href="#todos">Ver mais (${ranks.length})</a></div>${rankList(ranks.slice(0,5))}<div class="rule-strip"><span><strong>5</strong> placar exato</span><span><strong>3</strong> resultado certo</span><a href="#regras">Regras</a></div><section id="proximos" class="upcoming"><div class="section-head"><div><span class="eyebrow">ANTES DE A BOLA ROLAR</span><h2>Próximos jogos</h2></div></div>${next.length?next.map(matchCard).join(''):empty('Aguardando o próximo apito.','Ainda não há partidas futuras com palpites abertos na agenda sincronizada.')}</section></section><section><div class="section-head"><div><span class="eyebrow">O QUE FICOU NO PLACAR</span><h2>Últimos jogos</h2></div><span class="year-badge">${new Date().getFullYear()}</span></div>${recent.length?recent.map(matchCard).join(''):empty('O placar ainda está em branco.','Os resultados oficiais e a pontuação de cada partida aparecerão aqui.')}<p class="fine">${status.lastSync?'Atualizado em '+date(status.lastSync,true)+'.':'Aguardando a primeira sincronização.'} Horários de Brasília.</p></section></div>`;
  }
  $('#main').innerHTML=`<div class="container">${content}</div>`;bind();
  if(tab==='proximos')requestAnimationFrame(()=>$('#proximos')?.scrollIntoView({behavior:'smooth'}));
}
function scorePick(p,f){if(!finished(f)||f.homeGoals===null||f.awayGoals===null)return 0;if(p.home===f.homeGoals&&p.away===f.awayGoals)return 5;return Math.sign(p.home-p.away)===Math.sign(f.homeGoals-f.awayGoals)?3:0;}
function standings(c){
  const groups=c.standings.flatMap(x=>x.league?.standings||[]);
  if(!groups.length)return '<p class="fine">A fonte não disponibiliza classificação para esta competição ou fase. Em torneios eliminatórios, acompanhe os confrontos abaixo.</p>';
  return groups.map(group=>`<div class="table-scroll"><table><caption>${esc(group[0]?.group||'Classificação')}</caption><thead><tr><th scope="col">Pos.</th><th scope="col">Clube</th><th scope="col">P</th><th scope="col">J</th><th scope="col">V</th><th scope="col">E</th><th scope="col">D</th><th scope="col">SG</th></tr></thead><tbody>${group.map(r=>`<tr class="${/flamengo/i.test(r.team?.name)?'flamengo':''}"><td>${r.rank}</td><td>${esc(r.team?.name)}</td><td>${r.points}</td><td>${r.all?.played??'–'}</td><td>${r.all?.win??'–'}</td><td>${r.all?.draw??'–'}</td><td>${r.all?.lose??'–'}</td><td>${r.goalsDiff}</td></tr>`).join('')}</tbody></table></div>`).join('');
}
function bind(){
  document.querySelectorAll('.prediction-form').forEach(form=>form.addEventListener('submit',async e=>{
    e.preventDefault();if(!me){$('#welcome').showModal();return;}const button=form.querySelector('button');button.disabled=true;
    try{await api(`/fixtures/${form.dataset.game}/prediction`,{method:'PUT',body:JSON.stringify({home:Number(form.elements.home.value),away:Number(form.elements.away.value)})});picks=await api('/me/predictions');toast('Palpite salvo. Agora é com o Manto!');render();}catch(error){toast(error.message);button.disabled=false;}
  }));
  document.querySelectorAll('[data-details]').forEach(b=>b.addEventListener('click',()=>showGame(Number(b.dataset.details))));
  $('#photo-input')?.addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    try{if(file.size>10*1024*1024)throw new Error('Escolha uma imagem de até 10 MB.');if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Escolha uma foto JPG, PNG ou WebP.');
      const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='#f3ecdc';ctx.fillRect(0,0,256,256);const side=Math.min(bitmap.width,bitmap.height);ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,256,256);bitmap.close();photoDraft=canvas.toDataURL('image/jpeg',.86);$('#photo-filename').textContent=file.name;$('#photo-preview').innerHTML=avatar({...me,photo:photoDraft});
    }catch(error){toast(error.message||'Não foi possível abrir a foto.');}
  });
  $('#remove-photo')?.addEventListener('click',()=>{photoDraft='';$('#photo-preview').innerHTML=avatar({...me,photo:''});$('#photo-input').value='';$('#photo-filename').textContent='Nenhum arquivo escolhido';});
  $('#profile-form')?.addEventListener('submit',async e=>{e.preventDefault();const button=e.target.querySelector('[type=submit]');button.disabled=true;try{await api('/me',{method:'PUT',body:JSON.stringify({name:$('#profile-name').value.trim(),photo:photoDraft})});await refresh();toast('Perfil atualizado.');}catch(error){toast(error.message);button.disabled=false;}});
}
async function showGame(id){
  const f=games.find(f=>f.id===id);if(!f)return;
  $('#game-content').innerHTML='<p class="loading">Consultando a pontuação…</p>';$('#game-dialog').showModal();
  try{const list=await api('/ranking?fixtureId='+id);$('#game-content').innerHTML=`<h2 id="game-title">${esc(f.home)} ${f.homeGoals} × ${f.awayGoals} ${esc(f.away)}</h2><p class="fine">${esc(f.league)} · ${date(f.kickoff)} · ${esc(label(f))}</p>${rankList(list)}`;}catch(error){$('#game-content').textContent=error.message;}
}
async function refresh(){
  await api('/sync',{method:'POST'}).catch(()=>null);
  const data=await Promise.all([api('/fixtures'),api('/ranking'),api('/competitions'),api('/status')]);
  [games,ranks,competitions,status]=data;
  if(token){try{[me,picks]=await Promise.all([api('/me'),api('/me/predictions')]);}catch(error){if(token)throw error;}}
  render();
}
$('#menu-toggle').addEventListener('click',()=>{const active=$('#navigation').classList.toggle('open');$('#menu-toggle').setAttribute('aria-expanded',String(active));});
$('#close-game').addEventListener('click',()=>$('#game-dialog').close());
$('#welcome').addEventListener('cancel',e=>e.preventDefault());
$('#welcome-form').addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;busy=true;const button=e.target.querySelector('button');button.disabled=true;$('#welcome-error').textContent='';
  try{
    localStorage.setItem('manto.storage-test','ok');localStorage.removeItem('manto.storage-test');
    const result=await api('/participants',{method:'POST',body:JSON.stringify({name:$('#welcome-name').value.trim(),photo:''})});
    token=result.token;localStorage.setItem('manto.device',token);$('#welcome').close();await refresh();toast('Bem-vindo à torcida!');
  }catch(error){$('#welcome-error').textContent=error.name==='SecurityError'?'Permita o armazenamento deste site no navegador para salvar seu perfil.':error.message;}finally{busy=false;button.disabled=false;}
});
window.addEventListener('hashchange',()=>{render();if(location.hash!=='#proximos')window.scrollTo(0,0);});
refresh().then(()=>{if(!me&&!$('#welcome').open)$('#welcome').showModal();}).catch(error=>{$('#main').innerHTML=`<div class="container">${empty('A arquibancada está aguardando conexão.',error.message)}<button class="button" id="retry">Tentar novamente</button></div>`;$('#retry').onclick=()=>location.reload();});
// Refresh public data while idle without interrupting a form being edited.
setInterval(()=>{if(!document.hidden && !$('#welcome').open && !$('#game-dialog').open && !['INPUT','TEXTAREA','BUTTON'].includes(document.activeElement?.tagName) && !['#perfil','#competicoes'].includes(location.hash))refresh().catch(()=>{});},300000);

