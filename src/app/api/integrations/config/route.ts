import { createHash, timingSafeEqual } from 'node:crypto'
import { readFile, writeFile, chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const config=z.object({
  OPENAI_API_KEY:z.string().max(300).optional(),
  OPENAI_MODEL:z.string().max(100).regex(/^[\w.-]*$/).optional(),
  ANTHROPIC_API_KEY:z.string().max(300).optional(),
  ANTHROPIC_MODEL:z.string().max(100).regex(/^[\w.-]*$/).optional(),
  SUPABASE_URL:z.string().max(300).refine(x=>!x || /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(x),'Invalid Supabase URL').optional(),
  SUPABASE_SECRET_KEY:z.string().max(500).optional(),
  SERPAPI_API_KEY:z.string().max(300).optional(),
  CRON_SECRET:z.string().max(300).optional(),
}).strict()

/** Editing env is allowed only in local development with an explicit server-side admin token. */
export async function POST(request:Request) {
  if(process.env.NODE_ENV!=='development')return Response.json({error:'Settings editing is disabled outside local development.'},{status:403})
  const origin=request.headers.get('origin')
  const host=request.headers.get('host')
  const forwardedHost=request.headers.get('x-forwarded-host')
  try { if (!origin || ![host,forwardedHost,new URL(request.url).host].includes(new URL(origin).host)) return Response.json({error:'Origin rejected.'},{status:403}) }
  catch { return Response.json({error:'Origin rejected.'},{status:403}) }
  const expected=process.env.BAUMIND_SETTINGS_TOKEN
  const supplied=request.headers.get('x-baumind-settings-token')
  if(!expected || expected.length<32 || !supplied || supplied.length!==expected.length ||
     !timingSafeEqual(createHash('sha256').update(supplied).digest(),createHash('sha256').update(expected).digest())) {
    return Response.json({error:'Invalid settings token. Run npm run setup:integrations and restart the server.'},{status:403})
  }
  let data: z.infer<typeof config>
  try{data=config.parse(await request.json())}
  catch{return Response.json({error:'Invalid integration settings.'},{status:400})}
  const changes=Object.entries(data).filter(([,value])=>typeof value==='string'&&value.length>0)
  if(!changes.length)return Response.json({error:'No non-empty fields to update.'},{status:400})
  if(changes.some(([,value])=>/[\r\n]/.test(value!)))return Response.json({error:'Newlines are not allowed.'},{status:400})
  const path=join(process.cwd(),'.env.local')
  try{
    let contents=''
    try{contents=await readFile(path,'utf8')}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}
    const lines=contents.split(/\r?\n/)
    for(const [key,value] of changes){
      const line=key+'='+value
      const index=lines.findIndex(entry=>new RegExp('^'+key+'=').test(entry))
      if(index>=0)lines[index]=line
      else lines.push(line)
    }
    await writeFile(path,lines.join('\n').replace(/\n*$/,'\n'),{mode:0o600})
    await chmod(path,0o600)
    return Response.json({saved:true,restartRequired:true},{headers:{'Cache-Control':'no-store'}})
  }catch{
    return Response.json({error:'Could not save .env.local on this server.'},{status:500})
  }
}
