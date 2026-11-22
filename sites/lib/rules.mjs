export const finished=status=>['FT','AET','PEN'].includes(status);
export function points(home,away,actualHome,actualAway,status){
  if(!finished(status)||actualHome===null||actualAway===null)return 0;
  if(home===actualHome&&away===actualAway)return 5;
  return Math.sign(home-away)===Math.sign(actualHome-actualAway)?3:0;
}
export function calendarYear(value=new Date()){
  return Number(new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',year:'numeric'}).format(new Date(value)));
}
export function cleanName(value){
  if(typeof value!=='string')throw Error('Invalid name');
  const clean=value.trim().replace(/\s+/g,' ');
  if(clean.length<5||clean.length>100||!clean.includes(' ')||/[\u0000-\u001f\u007f]/.test(clean))throw Error('Invalid name');
  return clean;
}
export function validatePrediction(value){
  if(!value||![value.home,value.away].every(x=>Number.isInteger(x)&&x>=0&&x<=30))throw Error('Invalid prediction');
}
