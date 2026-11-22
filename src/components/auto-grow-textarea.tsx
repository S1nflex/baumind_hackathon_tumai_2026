'use client'

import { useEffect, useRef, type ChangeEvent } from 'react'

/** Content-sized textarea; grows on input and when switching review cards. */
export function AutoGrowTextarea({ value, onChange, placeholder, id, disabled = false, maxLength = 800 }: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  id?: string
  disabled?: boolean
  maxLength?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const field = ref.current
    if (!field) return
    field.style.height = 'auto'
    field.style.height = `${Math.max(92, field.scrollHeight)}px`
  }, [value])

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const field = event.currentTarget
    field.style.height = 'auto'
    field.style.height = `${Math.max(92, field.scrollHeight)}px`
    onChange(field.value)
  }

  return <textarea
    ref={ref}
    id={id}
    className="bm-autogrow-textarea"
    rows={3}
    value={value}
    onChange={handleChange}
    placeholder={placeholder}
    disabled={disabled}
    maxLength={maxLength}
    style={{ resize: 'none', overflowY: 'hidden' }}
  />
}
