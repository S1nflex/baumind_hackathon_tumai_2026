#!/usr/bin/env node
// Safe API smoke test: create and then delete an isolated demo project.
const base=(process.env.BAUMIND_BASE_URL||'http://127.0.0.1:3000').replace(/\/$/,'')
let created=null
const req=async(path,options)=>{
  const response=await fetch(base+path,options)
  const data=response.status===204?null:await response.json()
  if(!response.ok)throw new Error(`${path} HTTP ${response.status}: ${data?.error||'unknown error'}`)
  return data
}
try{
  const integrations=await req('/api/integrations/status');console.log('✓ Integration status endpoint:', integrations.projectStorage)
  const form=new FormData();form.set('demo','1');form.set('name','BauMind API smoke test — disposable')
  const result=await req('/api/projects',{method:'POST',body:form})
  created=result.project?.id
  if(!created||!result.project.positions?.length)throw new Error('Demo import returned no positions')
  console.log('✓ Demo import:',result.project.positions.length,'positions')
  const project=await req('/api/projects/'+encodeURIComponent(created))
  if(project.project.id!==created)throw new Error('Read-back ID mismatch')
  console.log('✓ SQLite read-back')
  console.log('AI and external providers were not called. Test a real import in the UI with consent enabled.')
}catch(error){console.error('✗ Smoke test failed:',error.message);process.exitCode=1}
finally{if(created){try{await req('/api/projects/'+encodeURIComponent(created),{method:'DELETE'});console.log('✓ Test project deleted')}catch(error){console.error('✗ Cleanup failed, delete project ID:',created,error.message);process.exitCode=1}}}
