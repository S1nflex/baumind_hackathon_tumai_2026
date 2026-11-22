const extensions = ['.pdf', '.xlsx', '.x81', '.x83', '.x84', '.x85', '.x86', '.d81', '.d83', '.d84', '.d85', '.d86', '.xml']

export const lvUploadAccept = extensions.join(',')
export const lvUploadFormatMessage = 'Bitte ein PDF, eine Excel-Datei (.xlsx) oder eine GAEB-Datei auswählen.'

export function canUploadLv(name: string) {
  const lowerName = name.toLowerCase()
  return extensions.some(extension => lowerName.endsWith(extension))
}
