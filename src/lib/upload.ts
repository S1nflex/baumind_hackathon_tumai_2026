const extensions = ['.pdf', '.xlsx']

export const lvUploadAccept = extensions.join(',')
export const lvUploadFormatMessage = 'Bitte eine PDF- oder Excel-Datei (.xlsx) auswählen.'

export function canUploadLv(name: string) {
  const lowerName = name.toLowerCase()
  return extensions.some(extension => lowerName.endsWith(extension))
}
