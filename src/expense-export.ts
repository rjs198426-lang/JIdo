import { Capacitor, registerPlugin } from '@capacitor/core'
import { downloadBlob } from './full-backup'
const native = registerPlugin<{
  saveDocument(options: {
    text: string
    format: 'csv'
  }): Promise<{ cancelled: boolean }>
}>('TravelBackup')
export async function saveExpenseCsv(csv: string) {
  if (Capacitor.getPlatform() === 'android')
    return native.saveDocument({ text: csv, format: 'csv' })
  downloadBlob(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    'jido-expenses.csv',
  )
  return { cancelled: false }
}
