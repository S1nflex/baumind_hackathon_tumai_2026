'use client'

import { useState, type PointerEvent } from 'react'
import { ArrowRight, ArrowUpRight, Cloud, FileUp, Sparkles, Sun } from 'lucide-react'

type Props = { create: () => void; demo: () => void; busy: boolean }

export function NatureHero({ create, demo, busy }: Props) {
  const [wind, setWind] = useState(false)
  const [warm, setWarm] = useState(true)

  function track(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === 'touch') return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - .5
    const y = (event.clientY - rect.top) / rect.height - .5
    event.currentTarget.style.setProperty('--mx', String(x))
    event.currentTarget.style.setProperty('--my', String(y))
  }

  return <section className={'bm-scene ' + (wind ? 'bm-scene-wind ' : '') + (warm ? 'bm-scene-warm' : 'bm-scene-morning')}
    onPointerMove={track} onPointerLeave={event => { event.currentTarget.style.setProperty('--mx','0'); event.currentTarget.style.setProperty('--my','0') }}
    aria-label="BauMind — Kalkulation, Dateien und Projekte">
    <div className="bm-scene-texture" aria-hidden="true"/>
    <div className="bm-scene-left">
      <span className="bm-overline"><span className="bm-overline-dot"/> BAUMIND / DEIN ARBEITSBEREICH <span className="bm-number">Nº 01</span></span>
      <h1 className="bm-scene-title">Bauen beginnt<br/>mit <em>Klarheit.</em></h1>
      <p className="bm-scene-copy">Leistungsverzeichnisse importieren, Positionen prüfen, Kosten kalkulieren. Alles an einem Ort — mit einem klaren Blick fürs Wesentliche.</p>
      <div className="bm-scene-actions">
        <button type="button" className="bm-action-main" onClick={create} disabled={busy}><FileUp size={18}/> LV importieren <ArrowRight size={17}/></button>
        <button type="button" className="bm-action-secondary" onClick={demo} disabled={busy}><Sparkles size={17}/> Beispiel öffnen <ArrowUpRight size={16}/></button>
      </div>
      <div className="bm-scene-formats"><span>DATEIFORMATE</span><b>PDF</b><i/> <b>GAEB</b><i/> <b>XLSX</b><span className="bm-scene-formats-end">bis 24 MB</span></div>
    </div>
    <div className="bm-scene-art" aria-label="Interaktive Wolkenlandschaft">
      <img className="bm-sky-mist" src="/brand/elements/cloud-mist.webp" alt=""/>
      <button type="button" className="bm-cloud-click bm-cloud-main" onClick={()=>setWind(v=>!v)} aria-label={wind ? 'Wolkenbewegung beruhigen' : 'Wolken in Bewegung setzen'} title="Wolken anklicken"><img src="/brand/elements/cloud-tower.webp" alt=""/></button>
      <img className="bm-cloud-bank" src="/brand/elements/cloud-bank.webp" alt=""/>
      <img className="bm-cloud-small" src="/brand/elements/cloud-small.webp" alt=""/>
      <img className="bm-scene-hills" src="/brand/elements/valley.webp" alt=""/>
      <img className="bm-scene-ivy" src="/brand/elements/ivy-right.webp" alt=""/>
      <img className="bm-scene-grass" src="/brand/elements/grass-tuft.webp" alt=""/>
      <img className="bm-scene-daisy" src="/brand/elements/daisy-single.webp" alt=""/>
      <div className="bm-scene-art-label"><span>ATELIER FÜR BAUKALKULATION</span><span>EST. 2026</span></div>
      <div className="bm-scene-art-controls">
        <button type="button" aria-pressed={wind} onClick={()=>setWind(v=>!v)} title="Wolken schweben lassen"><Cloud size={15}/> {wind ? 'Wolken ruhen' : 'Wolken bewegen'}</button>
        <button type="button" aria-pressed={warm} onClick={()=>setWarm(v=>!v)} title="Licht wechseln"><Sun size={15}/> {warm ? 'Abendlicht' : 'Morgenlicht'}</button>
      </div>
    </div>
  </section>
}
