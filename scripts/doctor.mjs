#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
function loadLocalEnv() {
  const path=join(root,'.env.local')
  if (!existsSync(path)) return
  for(const line of readFileSync(path,'utf8').split(/\r?\n/)){
    const m=line.match(/^\s*([A-Z][A-Z0-9_]*)=(.*)\s*$/)
    if (m && !Object.prototype.hasOwnProperty.call(process.env,m[1])) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'').trim()
  }
}
loadLocalEnv()
const existsExecutable=(bin,args=[])=>spawnSync(bin,args,{encoding:'utf8',timeout:3000,stdio:'ignore'}).status===0
const yes=(name,ok,notes='')=>console.log(`${ok?'✓':'!'} ${name}${notes?' — '+notes:''}`)
console.log('\nBauMind diagnostics (secrets not displayed)\n')
const major=Number(process.versions.node.split('.')[0]);yes('Node.js >=22',major>=22,'current '+process.version)
yes('Dependencies installed',existsSync(join(root,'node_modules','next','package.json')),'npm ci')
yes('Poppler / pdftotext',spawnSync('pdftotext',['-v'],{timeout:3000}).status===0,'npm run setup:pdf')
yes('OCR / tesseract',existsExecutable('tesseract',['--version']),'npm run setup:ocr (optional)')
yes('OpenAI',Boolean(process.env.OPENAI_API_KEY),'optional server key')
yes('Anthropic',Boolean(process.env.ANTHROPIC_API_KEY&&process.env.ANTHROPIC_MODEL),'optional server key + model')
yes('Supabase market catalog',Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)),'URL + secret key + migration')
yes('SerpAPI',Boolean(process.env.SERPAPI_API_KEY),'optional for live product search')
const ai=Boolean(process.env.OPENAI_API_KEY || (process.env.ANTHROPIC_API_KEY&&process.env.ANTHROPIC_MODEL))
const market=Boolean(process.env.SERPAPI_API_KEY || (process.env.SUPABASE_URL&&(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)))
yes('Full AI + market import credentials',ai&&market,ai&&market?'configured; connectivity checked on import':'add AI key and Supabase or SerpAPI')
console.log('\nNo external APIs were contacted by doctor. The actual import checks provider connectivity.\n')
process.exitCode=major>=22?0:1
