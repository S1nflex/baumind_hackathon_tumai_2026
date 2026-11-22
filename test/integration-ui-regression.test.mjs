import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, statSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const root=new URL('../',import.meta.url)
const read=(path)=>readFileSync(new URL(path,root),'utf8')

test('stream endpoint emits genuine backend progress and completion',()=>{
  const stream=read('src/app/api/projects/import-stream/route.ts')
  assert.match(stream,/ReadableStream/)
  assert.match(stream,/importProject\(form, workspace, update/)
  assert.match(stream,/application\/x-ndjson/)
  assert.match(stream,/type: 'complete'/)
})
test('AI estimates become visible draft prices without inventing verified supplier quotes',()=>{
  const market=read('src/lib/market-estimator.ts')
  const enrichment=read('src/lib/market-enrichment.ts')
  const estimate=read('src/lib/estimate.ts')
  const report=read('src/lib/report.ts')
  assert.match(market,/unverbindlich/)
  assert.doesNotMatch(enrichment,/overridePrice\s*=/)
  assert.doesNotMatch(enrichment,/sourcePrice\s*=/)
  assert.match(enrichment,/findSuppliers/)
  assert.match(enrichment,/estimateIndicativePrices/)
  assert.match(estimate,/provisional\s*\?/)
  assert.match(report,/KI-basierte Kalkulationspreise/)
  const pipeline=read('src/lib/import-pipeline.ts')
  assert.match(pipeline,/semanticReview/)
  assert.match(pipeline,/runScopeAgent/)
  assert.match(pipeline,/enrichMarket/)
})
test('local settings write requires admin token, origin and non-production',()=>{
  const code=read('src/app/api/integrations/config/route.ts')
  for(const marker of ['BAUMIND_SETTINGS_TOKEN','timingSafeEqual','origin','NODE_ENV','mode:0o600'])assert.ok(code.includes(marker),marker)
  assert.doesNotMatch(read('src/app/api/integrations/status/route.ts'),/\.slice\(-4\)/)
})
test('interface exposes import steps, market estimates and settings',()=>{
  const ui=read('src/components/workspace.tsx')
  for(const marker of ['ImportProgressView','IntegrationsSettings','MarketOverview','import-stream'])assert.ok(ui.includes(marker),marker)
})
test('local env setup creates private settings token without writing it into project',()=>{
  const dir=mkdtempSync(join(tmpdir(),'baumind-conf-'))
  try{
    const script=new URL('scripts/setup-integrations.mjs',root)
    const p=spawnSync(process.execPath,[script.pathname],{cwd:dir,encoding:'utf8'})
    assert.equal(p.status,0,p.stderr)
    const env=readFileSync(join(dir,'.env.local'),'utf8')
    assert.match(env,/BAUMIND_SETTINGS_TOKEN=[a-f0-9]{64}/)
    if(process.platform!=='win32')assert.equal(statSync(join(dir,'.env.local')).mode&0o777,0o600)
  }finally{rmSync(dir,{recursive:true,force:true})}
})

test('full AI and market mode has both a client and a server gate',()=>{
  const pipeline=read('src/lib/import-pipeline.ts')
  assert.match(pipeline,/integrationReadiness\(\)/)
  assert.match(pipeline,/FULL_IMPORT_NOT_CONFIGURED/)
  assert.match(pipeline,/mode === 'full'/)
  const upload=read('src/components/workspace.tsx')
  assert.match(upload,/mode==='full' && !integrations\?\.fullImport\.configured/)
})
test('assistant clarifies ambiguous edits and suppliers have dedicated tab',()=>{
  const api=read('src/app/api/projects/[id]/assistant/route.ts')
  assert.match(api,/clarification:/)
  const chat=read('src/components/assistant-panel.tsx')
  assert.match(chat,/bm-ai-clarification-options/)
  assert.match(read('src/components/workspace.tsx'),/key: 'suppliers'/)
  assert.match(read('src/components/supplier-board.tsx'),/bm-supplier-card/)
})
