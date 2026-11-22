import { z } from 'zod'
import { workspaceId } from '@/lib/workspace'
import { requireProject, updateProject, ProjectError } from '@/lib/store'
import { configuredAiModel } from '@/lib/ai-provider'
import { enrichMarket } from '@/lib/market-enrichment'

export const runtime='nodejs'
export const dynamic='force-dynamic'
type Ctx={params:Promise<{id:string}>}
/** Refreshes already-imported positions; old projects do not need re-upload. */
export async function POST(request:Request,{params}:Ctx){
  const encoder=new TextEncoder()
  const stream=new ReadableStream<Uint8Array>({
    async start(controller){
      const send=(data:unknown)=>controller.enqueue(encoder.encode(JSON.stringify(data)+'\n'))
      try{
        const workspace=await workspaceId()
        const id=(await params).id
        const {revision}=z.object({revision:z.number().int().positive()}).parse(await request.json())
        const project=requireProject(workspace,id)
        if(project.revision!==revision)throw new ProjectError('Das Projekt hat sich geändert. Bitte neu laden.',409)
        if(project.archivedAt||project.shelvedAt)throw new ProjectError('Archivierte Projekte sind schreibgeschützt.',409)
        if(!configuredAiModel('review'))throw new ProjectError('Für eine KI-Markt-Schätzung fehlt ein AI-Key / gültiges Modell.',503)
        send({type:'progress',stage:'market',percent:5,detail:'Vorhandene LV-Positionen werden erneut geprüft'})
        const copy=structuredClone(project.positions)
        const market=await enrichMarket(copy,project.postcode,true,u=>send({type:'progress',stage:'market',percent:5+Math.round(.9*u.percent),detail:u.detail}))
        const byId=new Map(copy.map(row=>[row.id,row]))
        const updated=updateProject(workspace,id,revision,current=>{
          for(const row of current.positions){
            const next=byId.get(row.id)
            if(next){row.offers=next.offers;row.provisionalPrice=next.provisionalPrice}
          }
          current.analysis.market={...market,refreshedAt:new Date().toISOString()}
          if(market.estimates.length===0 && market.checkedOffers===0 && !current.warnings.includes('Marktpreis-Ergebnisse fehlen weiterhin.'))
            current.warnings.push('Marktpreis-Ergebnisse fehlen weiterhin.')
        })
        send({type:'complete',project:updated})
      }catch(e){send({type:'error',message:e instanceof ProjectError?e.message:'Preisrecherche nicht abgeschlossen. Bitte Server-Log / AI-Kontingent prüfen.'})}
      finally{controller.close()}
    },
  })
  return new Response(stream,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-cache, no-transform','X-Content-Type-Options':'nosniff'}})
}
