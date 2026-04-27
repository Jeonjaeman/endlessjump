import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'kr.tengtengsoft.endlessjump',
  appName: '무한의당근',
  webDir: 'dist',
  plugins: {
    AdMob: {
      androidApplicationId: 'ca-app-pub-7981513411030364~1063972710',
    },
  },
};

export default config;
