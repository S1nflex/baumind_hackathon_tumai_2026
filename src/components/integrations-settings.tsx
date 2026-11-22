'use client'
import { useEffect, useState } from 'react'
import { CheckCircle2, CircleHelp, Clipboard, Database, KeyRound, RefreshCw, ShieldCheck, ShoppingBag } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

type Status = { ai:{configured:boolean;provider:string|null};supabase:{configured:boolean;ready?:boolean|null};shopping:{configured:boolean;cron?:boolean};fullImport?:{configured:boolean;missing:string[];marketSources:string[]};projectStorage:string }

export function IntegrationsSettings() {
  const { language } = useI18n()
  const text = {
    de:{title:'Integrationen',subtitle:'AI, Marktpreise und Datenbank verbinden',note:'API-Schlüssel werden ausschließlich bei explizitem Speichern an deinen lokalen Entwicklungsserver gesendet und dort in .env.local abgelegt. Niemals in Git committen.',
      ai:'AI-API',market:'Marktquellen',db:'Supabase · Marktpreis-Datenbank',openai:'OpenAI API-Schlüssel',anthropic:'Anthropic API-Schlüssel',serp:'SerpAPI-Schlüssel',secret:'Supabase Secret Key (Server)',url:'Supabase Project URL',model:'OpenAI-Modell',cron:'Cron-Sicherheitscode',copy:'Konfiguration kopieren',copied:'In Zwischenablage kopiert',configure:'Server konfigurieren',active:'Konfiguriert',missing:'Nicht konfiguriert',refresh:'Status aktualisieren',token:'Admin-Token (aus npm run setup:integrations)',save:'Sicher auf diesem Dev-Server speichern',restart:'Gespeichert. Starte npm run dev neu, damit die Schlüssel aktiv werden.',how:'Nach dem Kopieren die Felder in .env.local im Projektroot eintragen. Niemals auf GitHub committen. Anschließend npm run dev neu starten.',sqlite:'Projektdateien und Kalkulationen bleiben in lokaler SQLite. Supabase speichert externe Marktpreise.',privacy:'Daten werden nur bei aktivierter KI-Option beim Import an externe AI-Provider übertragen.'},
    en:{title:'Integrations',subtitle:'Connect AI, market data and database',note:'Keys are sent only when you explicitly save them to your local development server, where they are written to .env.local. Never commit keys.',
      ai:'AI API',market:'Market sources',db:'Supabase · market-price database',openai:'OpenAI API key',anthropic:'Anthropic API key',serp:'SerpAPI key',secret:'Supabase secret key (server)',url:'Supabase project URL',model:'OpenAI model',cron:'Cron secret',copy:'Copy configuration',copied:'Copied to clipboard',configure:'Configure your server',active:'Configured',missing:'Not configured',refresh:'Refresh status',token:'Admin token (from npm run setup:integrations)',save:'Save to this development server',restart:'Saved. Restart npm run dev to activate credentials.',how:'After copying, paste the settings into the project root .env.local. Never commit it to GitHub. Restart npm run dev.',sqlite:'Projects remain in local SQLite. Supabase stores external market prices.',privacy:'Documents go to external AI providers only if AI is enabled during import.'},
    ru:{title:'Настройки интеграций',subtitle:'Подключение AI, рыночных цен и базы данных',note:'Ключи отправляются только при явном сохранении на твой локальный сервер разработки, где записываются в .env.local. Никогда не публикуй их в Git.',
      ai:'AI API',market:'Рыночные источники',db:'Supabase · база рыночных цен',openai:'OpenAI API-ключ',anthropic:'Anthropic API-ключ',serp:'SerpAPI-ключ',secret:'Supabase Secret Key (сервер)',url:'URL проекта Supabase',model:'Модель OpenAI',cron:'Ключ для расписания (Cron)',copy:'Скопировать конфигурацию',copied:'Скопировано',configure:'Настроить сервер',active:'Ключ настроен',missing:'Не настроено',refresh:'Обновить статус',token:'Админ-токен (из npm run setup:integrations)',save:'Сохранить на сервере разработки',restart:'Сохранено. Перезапусти npm run dev для активации.',how:'Вставь параметры в .env.local в корне проекта. Не отправляй файл в GitHub. Затем перезапусти npm run dev.',sqlite:'Сами проекты и сметы остаются в локальной SQLite, Supabase хранит внешние рыночные цены.',privacy:'Текст документа передаётся внешнему AI только при включённом AI-анализе во время импорта.'},
  }[language]
  const [status,setStatus]=useState<Status|null>(null)
  const [values,setValues]=useState({openai:'',anthropic:'',model:'gpt-5-mini',anthropicModel:'',url:'',secret:'',serp:'',cron:''})
  const [adminToken,setAdminToken]=useState('')
  const [message,setMessage]=useState('')
  const [diagnostics,setDiagnostics]=useState<{ai:{configured:boolean;ok:boolean|null;message:string};market:{ready:boolean;sources:string[];message:string};catalog:{count:number|null;message:string}}|null>(null)
  const [testing,setTesting]=useState(false)
  async function refresh() {
    try {const response=await fetch('/api/integrations/status?check=1',{cache:'no-store'});if(response.ok)setStatus(await response.json())}
    catch {setStatus(null)}
  }
  useEffect(()=>{void refresh()},[])
  const input = (field:keyof typeof values,label:string,secret=false,placeholder='') => <label className="bm-settings-field" key={field}>
    <span>{label}</span><input type={secret?'password':'text'} autoComplete="off" spellCheck={false} value={values[field]}
      placeholder={placeholder} onChange={e=>setValues(old=>({...old,[field]:e.target.value}))}/></label>
  const state = (configured:boolean|undefined) => <span className={'bm-settings-state '+(configured?'is-ready':'is-off')}>{configured?<CheckCircle2 size={15}/>:<CircleHelp size={15}/>}{configured?text.active:text.missing}</span>
  async function testIntegrations(){
    setTesting(true);setMessage('')
    try{
      const response=await fetch('/api/integrations/diagnostics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({testAi:true})})
      if(!response.ok)throw new Error('Cannot run diagnostics')
      setDiagnostics(await response.json())
      await refresh()
    }catch{setMessage(({de:'Live-Test fehlgeschlagen. Server und API-Logs prüfen.',en:'Connection test failed. Inspect server and API logs.',ru:'Не удалось проверить подключения. Посмотри логи сервера.'})[language])}
    finally{setTesting(false)}
  }
  async function saveToServer() {
    if(!adminToken.trim()){setMessage(text.token);return}
    const body=Object.fromEntries(Object.entries({
      OPENAI_API_KEY:values.openai,OPENAI_MODEL:values.model,
      ANTHROPIC_API_KEY:values.anthropic,ANTHROPIC_MODEL:values.anthropicModel,
      SUPABASE_URL:values.url,SUPABASE_SECRET_KEY:values.secret,SERPAPI_API_KEY:values.serp,CRON_SECRET:values.cron,
    }).filter(([,value])=>value.trim()))
    if(!Object.keys(body).length){setMessage('No values entered.');return}
    try{
      const response=await fetch('/api/integrations/config',{method:'POST',
        headers:{'Content-Type':'application/json','x-baumind-settings-token':adminToken},body:JSON.stringify(body)})
      const data=await response.json()
      if(!response.ok)throw new Error(data.error||'Save failed')
      setValues({openai:'',anthropic:'',model:'',anthropicModel:'',url:'',secret:'',serp:'',cron:''})
      setMessage(text.restart)
    }catch(error){setMessage(error instanceof Error?error.message:'Save failed')}
  }
  async function copy() {
    const lines = [
      '# BauMind server-only integrations; do not commit this file',
      'OPENAI_API_KEY='+values.openai.trim(), 'OPENAI_MODEL='+values.model.trim(),
      'ANTHROPIC_API_KEY='+values.anthropic.trim(), 'ANTHROPIC_MODEL='+values.anthropicModel.trim(),
      'SUPABASE_URL='+values.url.trim(), 'SUPABASE_SECRET_KEY='+values.secret.trim(),
      'SERPAPI_API_KEY='+values.serp.trim(), 'CRON_SECRET='+values.cron.trim(),
    ]
    try {await navigator.clipboard.writeText(lines.join('\n')+'\n');setMessage(text.copied)}
    catch {setMessage('Clipboard unavailable: use your editor to create .env.local.')}
  }
  return <main className="bm-settings-page">
    <header className="bm-settings-heading"><div><span className="bm-settings-kicker"><KeyRound size={16}/> BAUMIND · API</span><h1>{text.title}</h1><p>{text.subtitle}</p></div>
      <button type="button" className="button" onClick={()=>void refresh()}><RefreshCw size={15}/>{text.refresh}</button></header>
    <p className="bm-settings-note"><ShieldCheck size={19}/>{text.note}</p>
    <div className={'bm-import-readiness-badge '+(status?.fullImport?.configured?'is-ready':'is-blocked')} role="status">
      {status?.fullImport?.configured?<CheckCircle2 size={19}/>:<CircleHelp size={19}/>}
      <span>{status?.fullImport?.configured ? ({de:'Vollständiger KI-Import kann gestartet werden · Live-Verbindungen werden beim Import geprüft.',en:'Full AI import can start · live connections checked during processing.',ru:'Полный AI-импорт доступен · реальное соединение проверяется при обработке.'})[language] :
        ({de:'Für den vollständigen Import werden AI und mindestens eine Marktquelle benötigt.',en:'Full import requires AI and at least one market source.',ru:'Для полного импорта нужны AI и хотя бы один источник рыночных цен.'})[language]}</span>
    </div>
    <div className="bm-settings-grid">
      <section className="bm-settings-card"><header><KeyRound size={23}/><h2>{text.ai}</h2>{state(status?.ai.configured)}</header>
        <p>{text.privacy}</p>{input('openai',text.openai,true,'sk-…')}{input('model',text.model,false,'gpt-5-mini')}{input('anthropic',text.anthropic,true,'sk-ant-…')}{input('anthropicModel','Anthropic model',false,'e.g. claude-…')}</section>
      <section className="bm-settings-card"><header><Database size={23}/><h2>{text.db}</h2>{state(status?.supabase.configured)}</header>
        <p>{text.sqlite}</p>
        {status?.supabase.configured && <p className="bm-db-readiness">{status.supabase.ready ?
          ({de:'✓ Tabelle material_prices erreichbar',en:'✓ material_prices table reachable',ru:'✓ Таблица material_prices доступна'})[language] :
          ({de:'! Tabelle material_prices nicht erreichbar. SQL-Migrationen prüfen.',en:'! material_prices unavailable. Apply SQL migrations.',ru:'! Таблица material_prices недоступна. Проверь SQL-миграции.'})[language]}</p>}
        {status?.supabase.configured && status.supabase.ready && <p className="bm-db-readiness">{({de:'Gespeicherte Marktpreise (material_prices)',en:'Stored market prices (material_prices)',ru:'Сохранённых цен в material_prices'})[language]}: {(status.supabase as {marketCatalogCount?:number|null}).marketCatalogCount ?? '—'}</p>}
        {input('url',text.url,false,'https://xxxxx.supabase.co')}{input('secret',text.secret,true,'sb_secret_…')}</section>
      <section className="bm-settings-card"><header><ShoppingBag size={23}/><h2>{text.market}</h2>{state(status?.shopping.configured)}</header>
        <p>SerpAPI / Google Shopping</p>{input('serp',text.serp,true,'API key')}{input('cron',text.cron,true,'random secret')}</section>
    </div>
    <section className="bm-settings-apply"><h2>{text.configure}</h2><p>{text.how}</p>
      <label className="bm-settings-field bm-settings-admin"><span>{text.token}</span><input type="password" autoComplete="off" value={adminToken} onChange={e=>setAdminToken(e.target.value)}/></label>
      <div className="bm-settings-buttons">
        <button type="button" className="button button-primary" onClick={()=>void saveToServer()}><ShieldCheck size={17}/>{text.save}</button>
        <button type="button" className="button" onClick={()=>void copy()}><Clipboard size={17}/>{text.copy}</button>
      </div>
      <button type="button" className="button bm-integration-test" onClick={()=>void testIntegrations()} disabled={testing}><RefreshCw size={16}/>{testing?(({de:'Verbindungen werden geprüft…',en:'Testing connections…',ru:'Проверяем сервисы…'})[language]):({de:'AI und Marktverbindungen live testen',en:'Test live AI and market connections',ru:'Проверить AI и источники цен'})[language]}</button>
      {diagnostics && <div className="bm-integration-diagnostics" role="status">
        <p><strong>AI:</strong> {diagnostics.ai.ok===true?'✓ ':diagnostics.ai.ok===false?'✕ ':'— '}{diagnostics.ai.message}</p>
        <p><strong>SerpAPI / Supabase:</strong> {diagnostics.market.ready?'✓ ':'✕ '}{diagnostics.market.sources.length?diagnostics.market.sources.join(' + ')+' · ':''}{diagnostics.market.message}</p>
        <p><strong>Supabase:</strong> {diagnostics.catalog.count??0} {({de:'gespeicherte Preisdatensätze',en:'stored price records',ru:'записей с ценами'})[language]}. {diagnostics.catalog.message}</p>
      </div>}
      {message && <p role="status">{message}</p>}
    </section>
  </main>
}
