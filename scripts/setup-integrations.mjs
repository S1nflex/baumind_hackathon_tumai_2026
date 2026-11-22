#!/usr/bin/env node
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, chmodSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const file=join(process.cwd(),'.env.local')
let data=existsSync(file)?readFileSync(file,'utf8'):''
let token=data.match(/^BAUMIND_SETTINGS_TOKEN=(\S+)/m)?.[1]
if(!token){
  token=randomBytes(32).toString('hex')
  data+= (data.endsWith('\n')||!data?'':'\n')+'BAUMIND_SETTINGS_TOKEN='+token+'\n'
  writeFileSync(file,data,{mode:0o600})
}
chmodSync(file,0o600)
console.log('Local settings token (keep private): '+token)
console.log('Enter this token on Integrations > Save to server. Restart npm run dev after first setup and after saving keys.')
