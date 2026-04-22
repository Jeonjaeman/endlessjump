import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'kr.tengtengsoft.bunnyhop',
  appName: '무한의당근',
  webDir: 'dist',
  plugins: {
    AdMob: {
      // Google 공식 테스트 App ID (프로덕션 전에 실제 ID로 교체)
      androidApplicationId: 'ca-app-pub-3940256099942544~3347511713',
    },
  },
};

export default config;
