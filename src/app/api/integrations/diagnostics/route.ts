import { generateText } from 'ai'
import { workspaceId } from '@/lib/workspace'
import { integrationReadiness } from '@/lib/integration-readiness'
import { verifyMarketSources } from '@/lib/verify-integrations'
import { configuredAiModel } from '@/lib/ai-provider'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime='nodejs'
export const dynamic='force-dynamic'

/** An explicit short AI probe may incur a small provider charge. No secrets are returned. */
export async function POST(request:Request){
  try {
    await workspaceId()
    const body=await request.json().catch(()=>({})) as {testAi?:boolean}
    const readiness=integrationReadiness()
    const results:{ai:{configured:boolean;ok:boolean|null;message:string};market:{ready:boolean;sources:string[];message:string};catalog:{count:number|null;message:string}}={
      ai:{configured:readiness.aiReady,ok:null,message:readiness.aiReady?'Noch nicht geprüft':'API-Schlüssel fehlt'},
      market:{ready:false,sources:[],message:''},catalog:{count:null,message:''},
    }
    const checks=await Promise.allSettled([
      verifyMarketSources(),
      readiness.marketSources.includes('supabase') ? Promise.race([
        getSupabaseAdmin().from('material_prices').select('id',{head:true,count:'exact'}),
        new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('timeout')),7000)),
      ]) : Promise.resolve(null),
      body.testAi && readiness.aiReady ? (async()=>{
        const configured=configuredAiModel('review')!
        const {provider:_provider,...settings}=configured
        const response=await generateText({...settings, maxOutputTokens:120, maxRetries:0,
          abortSignal:AbortSignal.timeout(16000),prompt:'Antworte ausschließlich mit OK.'})
        return response.text
      })() : Promise.resolve(null),
    ])
    const market=checks[0]
    if(market.status==='fulfilled')results.market={ready:market.value.ready,sources:market.value.sources,message:market.value.reason||'Marktdienst erreichbar.'}
    else results.market.message='Marktdienst reagiert nicht.'
    const catalog=checks[1]
    if(catalog.status==='fulfilled' && catalog.value){
      results.catalog={count:catalog.value.count??null,message:catalog.value.error ?
        'material_prices nicht lesbar. SQL-Migrationen und Rechte prüfen.' :
        (catalog.value.count ? 'Gespeicherte Händlerpreise verfügbar.' : 'Tabelle verbunden, aber leer: kein Händlerangebot gespeichert.')}
    } else if(readiness.marketSources.includes('supabase'))results.catalog.message='Katalogabfrage nicht möglich.'
    const ai=checks[2]
    if(body.testAi && readiness.aiReady){
      results.ai.ok=ai.status==='fulfilled' && typeof ai.value==='string' && ai.value.trim().length>0
      if(results.ai.ok)results.ai.message='Live-AI-Anfrage erfolgreich.'
      else {const err=ai.status==='rejected'?ai.reason:undefined
        const status=(err as {statusCode?:number})?.statusCode
        results.ai.message=status===401?'API-Schlüssel abgelehnt.':status===403?'Keine Modellberechtigung.':status===404?'AI-Modell nicht gefunden.':
          status===429?'API-Kontingent/Guthaben erschöpft.':'AI-Anfrage fehlgeschlagen. Modell, Billing und Logs prüfen.'}
    }
    return Response.json(results,{headers:{'Cache-Control':'no-store'}})
  } catch{return Response.json({error:'Diagnose nicht verfügbar.'},{status:500})}
}
