import { env } from 'cloudflare:workers';
import { synchronize, type SiteEnv } from '../../lib/api';
export const dynamic='force-dynamic';
const tools=[
  {name:'update_flamengo_games',description:'Atualiza os jogos, resultados e tabelas do Flamengo pela fonte oficial configurada. Consulta no máximo uma vez por dia; preserva os dados anteriores se a fonte falhar. Não exige edição nem publicação do site.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'get_sync_status',description:'Consulta a última atualização dos jogos do Manto de Palpites, sem mostrar credenciais.',inputSchema:{type:'object',properties:{},additionalProperties:false}}
];
export async function POST(request:Request){
  const message:any=await request.json();const id=message.id??null;const runtime=env as unknown as SiteEnv;
  const result=(value:unknown)=>Response.json({jsonrpc:'2.0',id,result:value});
  if(message.method==='server/discover')return result({supportedVersions:['2026-07-28'],capabilities:{tools:{}},serverInfo:{name:'Manto de Palpites',version:'1.0.0'}});
  if(message.method==='initialize')return result({protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'Manto de Palpites',version:'1.0.0'}});
  if(message.method==='notifications/initialized')return new Response(null,{status:202});
  if(message.method==='tools/list')return result({tools});
  if(message.method==='tools/call'){
    try{
      let data:unknown;
      if(message.params?.name==='update_flamengo_games')data=await synchronize(runtime);
      else if(message.params?.name==='get_sync_status'){
        const rows=await runtime.DB.prepare("SELECT cache_key,payload FROM cache WHERE cache_key IN ('lastSync','syncError')").all<{cache_key:string;payload:string}>();
        data={configured:true,lastSync:rows.results.find(x=>x.cache_key==='lastSync')?.payload||'',error:rows.results.find(x=>x.cache_key==='syncError')?.payload||''};
      }else throw Error('Ferramenta não encontrada.');
      return result({content:[{type:'text',text:JSON.stringify(data)}]});
    }catch{return result({isError:true,content:[{type:'text',text:'Não foi possível concluir a atualização. Consulte o status do site.'}]});}
  }
  return Response.json({jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}});
}
