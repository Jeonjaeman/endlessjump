# Play Store 출시 체크리스트

**앱명**: 무한의당근 - Endless Jump
**패키지**: kr.tengtengsoft.bunnyhop
**작성일**: 2026-04-22

---

## 1단계: 서비스 키 등록

- [ ] **AdMob 설정**
  - [ ] AdMob 콘솔에서 앱 등록 (Android, `kr.tengtengsoft.bunnyhop`)
  - [ ] 배너 광고 단위 ID 발급 → 코드에 적용
  - [ ] 전면 광고 단위 ID 발급 → 코드에 적용
  - [ ] 리워드 광고 단위 ID 발급 → 코드에 적용
  - [ ] `capacitor.config.ts`의 AdMob appId를 실제 ID로 교체
  - [ ] 테스트 기기 ID 등록 (개발 중 실수 클릭 방지)

- [ ] **RevenueCat 설정**
  - [ ] RevenueCat 프로젝트 생성
  - [ ] Play Store 서비스 계정 연동 (JSON 키)
  - [ ] API Key 발급 → 코드에 적용
  - [ ] Play Console에서 인앱 상품 생성:
    - `remove_ads` — 광고 제거 (일회성)
    - `skin_*` — 캐릭터 스킨 (일회성, 각 스킨별)
  - [ ] RevenueCat에 상품 매핑

## 2단계: 개인정보처리방침 호스팅

- [ ] `docs/privacy-policy.md` 내용을 웹페이지로 변환
- [ ] 호스팅 위치 선택:
  - 옵션 A: GitHub Pages (`https://tengtengsoft.github.io/bunnyhop/privacy`)
  - 옵션 B: tengtengsoft.kr (`https://tengtengsoft.kr/bunnyhop/privacy`)
- [ ] URL 접근 확인 (HTTPS 필수)
- [ ] Play Console에 개인정보처리방침 URL 입력

## 3단계: 스토어 에셋 준비

- [ ] **앱 아이콘**
  - [ ] 512×512 고해상도 아이콘 (PNG, 32비트, 알파 포함)
  - [ ] 앱 아이콘 가이드라인 준수 확인 (그림자/윤곽선 없음)

- [ ] **그래픽 이미지**
  - [ ] 1024×500 피처 그래픽 배너 (PNG 또는 JPG)

- [ ] **스크린샷** (각 기기 유형별 최소 2장, 최대 8장)
  - [ ] 스마트폰 스크린샷 (16:9 또는 9:16, 최소 320px ~ 최대 3840px)
  - [ ] 7인치 태블릿 스크린샷
  - [ ] 10인치 태블릿 스크린샷
  - [ ] 권장: 게임플레이 + 랭킹 + 스킨 + 업적 화면 포함

## 4단계: 빌드 준비

- [ ] **서명 키 생성**
  ```bash
  keytool -genkey -v -keystore bunnyhop-release.keystore \
    -alias bunnyhop -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass [비밀번호] -keypass [비밀번호] \
    -dname "CN=TengtengSoft, O=TengtengSoft, L=Seoul, C=KR"
  ```
  - [ ] keystore 파일 안전한 곳에 백업 (분실 시 업데이트 불가!)
  - [ ] `android/app/build.gradle`에 signingConfig 추가

- [ ] **ProGuard/R8 난독화 설정**
  - [ ] `build.gradle`에서 `minifyEnabled true`로 변경
  - [ ] `proguard-rules.pro`에 Capacitor/AdMob/RevenueCat 예외 규칙 추가:
    ```
    -keep class com.getcapacitor.** { *; }
    -keep class com.google.android.gms.ads.** { *; }
    -keep class com.revenuecat.purchases.** { *; }
    ```

- [ ] **릴리스 빌드**
  ```bash
  npm run build
  npx cap sync
  # Android Studio에서:
  # Build > Generate Signed Bundle / APK > Android App Bundle (.aab)
  ```
  - [ ] AAB 파일 생성 확인 (`app/build/outputs/bundle/release/`)

## 5단계: Play Console 등록

- [ ] **내부 테스트 트랙**
  - [ ] AAB 업로드
  - [ ] 내부 테스터 이메일 추가
  - [ ] 테스트 링크로 설치 및 동작 확인
  - [ ] AdMob 광고 노출 확인
  - [ ] 인앱결제 테스트 (샌드박스)
  - [ ] 랭킹 시스템 동작 확인

- [ ] **콘텐츠 등급 설문**
  - [ ] IARC 설문 작성 (`docs/age-rating-guide.md` 참고)
  - [ ] 등급 배정 결과 확인

- [ ] **스토어 리스팅 입력**
  - [ ] 앱 이름, 짧은 설명, 긴 설명 입력 (`docs/play-store-listing.md` 참고)
  - [ ] 스크린샷 업로드
  - [ ] 그래픽 이미지 업로드
  - [ ] 카테고리: 게임 > 아케이드
  - [ ] 태그 입력
  - [ ] 연락처 정보 입력 (이메일)
  - [ ] 개인정보처리방침 URL 입력

- [ ] **앱 콘텐츠 설정**
  - [ ] 광고 포함 여부: 예
  - [ ] 대상 연령대: 전체이용가
  - [ ] 데이터 보안 섹션 작성
  - [ ] 뉴스 앱 여부: 아니오
  - [ ] 정부 앱 여부: 아니오

## 6단계: 배포

- [ ] **프로덕션 트랙 배포**
  - [ ] 내부 테스트 통과 확인
  - [ ] 프로덕션 트랙에 AAB 업로드 (또는 내부 테스트에서 프로모션)
  - [ ] 출시 국가 선택 (한국 우선 → 이후 글로벌)
  - [ ] 단계적 출시 권장 (20% → 50% → 100%)
  - [ ] 검토 제출

---

## 예상 소요 시간

| 단계 | 예상 시간 |
|------|-----------|
| 서비스 키 등록 | 1~2시간 |
| 개인정보처리방침 호스팅 | 30분 |
| 스토어 에셋 | 2~4시간 |
| 빌드 준비 | 1~2시간 |
| Play Console 등록 | 1~2시간 |
| Google 심사 | 1~7일 (보통 1~3일) |
