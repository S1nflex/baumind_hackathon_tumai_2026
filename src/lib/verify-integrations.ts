import { getSupabaseAdmin } from './supabase'
import { integrationReadiness } from './integration-readiness'

/** Returns availability only. Never returns credentials or account details to callers. */
export async function verifyMarketSources(): Promise<{ready:boolean; sources:string[]; reason:string}> {
  const state = integrationReadiness()
  if (!state.marketReady) return {ready:false,sources:[],reason:'Kein Marktpreis-Dienst konfiguriert.'}
  const tasks: Promise<string | null>[] = []
  if (state.marketSources.includes('supabase')) {
    tasks.push((async()=>{
      try {
        const result=await Promise.race([
          getSupabaseAdmin().from('material_prices').select('id').limit(1),
          new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('timeout')),5500)),
        ])
        return result.error ? null : 'supabase'
      }catch{return null}
    })())
  }
  if (state.marketSources.includes('serpapi')) {
    tasks.push((async()=>{
      try {
        // SerpApi account endpoint validates credentials without spending a Shopping search.
        const url=new URL('https://serpapi.com/account.json')
        url.searchParams.set('api_key',process.env.SERPAPI_API_KEY!)
        const response=await fetch(url,{signal:AbortSignal.timeout(5500),cache:'no-store'})
        if (!response.ok) return null
        const data=await response.json() as {account_id?:string;api_key?:string;total_searches_left?:number;error?:string}
        if(data.error || (!data.account_id && !data.api_key)) return null
        if(typeof data.total_searches_left==='number' && data.total_searches_left<=0) return null
        return 'serpapi'
      }catch{return null}
    })())
  }
  const results=(await Promise.all(tasks)).filter((source):source is string=>Boolean(source))
  return {ready:results.length>0,sources:results,
    reason:results.length ? '' : 'Kein erreichbarer Marktpreis-Dienst. SerpAPI-Schlüssel, Kontingent und Supabase-Tabelle material_prices prüfen.'}
}
