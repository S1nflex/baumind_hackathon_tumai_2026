'use client'

import { Check, Cloud, FileSearch, Landmark, LoaderCircle, Save, ShieldCheck } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { ImportProgress, ImportStage } from '@/lib/import-pipeline'

const steps: { id: ImportStage; label: { de: string; en: string; ru: string }; Icon: typeof FileSearch }[] = [
  { id:'parse', label:{de:'PDF / GAEB / Excel lesen',en:'Read PDF / GAEB / Excel',ru:'Чтение PDF / GAEB / Excel'}, Icon:FileSearch },
  { id:'rules', label:{de:'Positionen und Risiken prüfen',en:'Check line items and risks',ru:'Проверка позиций и рисков'}, Icon:ShieldCheck },
  { id:'ai', label:{de:'KI-Agent prüft das LV',en:'AI agent analyzes the BoQ',ru:'AI-агент анализирует смету'}, Icon:Cloud },
  { id:'market',label:{de:'Marktpreise und Angebote suchen',en:'Research market prices and quotes',ru:'Поиск рыночных цен и предложений'}, Icon:Landmark },
  { id:'save', label:{de:'Projekt und Ergebnisse sichern',en:'Save project and findings',ru:'Сохранение проекта и результатов'}, Icon:Save },
]
export function ImportProgressView({ progress }: { progress: ImportProgress }) {
  const { language } = useI18n()
  const title = {de:'Wir erstellen deine Kalkulation',en:'Building your estimate',ru:'Создаём вашу смету'}[language]
  const hint = {
    de:'Daten werden verarbeitet. Die Dauer hängt von Umfang, AI und angebundenen Preisdiensten ab.',
    en:'Processing your document. Duration depends on its size, AI and market sources.',
    ru:'Обрабатываем документ. Время зависит от объёма, AI и подключённых источников цен.',
  }[language]
  const currentIndex = steps.findIndex(step => step.id === progress.stage)
  return <div className="bm-processing-backdrop" role="dialog" aria-modal="true" aria-labelledby="bm-processing-title">
    <section className="bm-processing-card">
      <div className="bm-processing-header"><span className="bm-processing-emblem"><LoaderCircle size={25} className="bm-spin"/></span>
        <h2 id="bm-processing-title">{title}</h2><p>{hint}</p></div>
      <div className="bm-processing-progressbar" role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
        <div style={{width:progress.percent+'%'}} /></div>
      <p className="bm-processing-live" role="status" aria-live="polite">{language==='de'?progress.detail:steps.find(step=>step.id===progress.stage)?.label[language]} <strong>{progress.percent}%</strong></p>
      <ol className="bm-processing-steps">{steps.map((step,index)=><li key={step.id} className={index < currentIndex ? 'is-done' : index === currentIndex ? 'is-active' : ''}>
        <span className="bm-processing-step-icon">{index < currentIndex ? <Check size={16}/> : <step.Icon size={17}/>}</span>
        <span>{step.label[language]}</span>
      </li>)}</ol>
      <p className="bm-processing-disclaimer">{{de:'Marktwerte sind unverbindliche Richtwerte, keine garantierten Angebote.',en:'Market estimates are indicative, not confirmed quotes.',ru:'Рыночные оценки ориентировочные, не подтверждённые предложения.'}[language]}</p>
    </section>
  </div>
}
