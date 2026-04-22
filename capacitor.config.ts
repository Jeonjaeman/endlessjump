import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'kr.tengtengsoft.bunnyhop',
  appName: '무한의당근',
  webDir: 'dist',
  plugins: {
    AdMob: {
      // AdMob App ID (플레이스홀더 — AdMob 콘솔에서 발급받은 실제 ID로 교체)
      appId: 'ca-app-pub-xxxxx~xxxxx',
      // 테스트 기기 등록 (에뮬레이터 + 실제 테스트 기기 해시)
      // testDeviceIds: ['YOUR_TEST_DEVICE_ID'],
    },
  },
};

export default config;
