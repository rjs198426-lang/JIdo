import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.jido.travel.next',
  appName: 'J★Do',
  webDir: 'dist',
  backgroundColor: '#ffffff',
  android: { backgroundColor: '#ffffff' },
  ios: { backgroundColor: '#ffffff', contentInset: 'never' },
}

export default config
