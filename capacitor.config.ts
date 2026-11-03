import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.myspace.app',
  appName: 'MySpace',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_myspace',
      iconColor: '#0F6E6B',
    },
  },
}

export default config
