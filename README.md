# Web Login & OAuth Detector

웹사이트의 로그인 기능과 OAuth 사용 여부를 자동으로 감지하는 도구입니다.

## 🚀 주요 기능

- **로그인 팝업 감지**: 로그인 버튼 클릭 시 팝업 창 생성 여부 확인
- **OAuth 제공자 감지**: Google, Facebook, GitHub 등 주요 OAuth 제공자 탐지
- **쿠키 팝업 자동 처리**: GDPR/CCPA 쿠키 동의 팝업 자동 처리
- **배치 처리**: 여러 URL을 한 번에 분석
- **상세 리포팅**: JSON 및 텍스트 형태의 결과 저장

## 📦 설치

```bash
# 저장소 클론
git clone https://github.com/your-username/web-login-oauth-detector.git
cd web-login-oauth-detector

# 의존성 설치
npm install

# Playwright 브라우저 설치
npm run install-browsers
```

## 🔧 사용법

### 1. 기본 사용법

```bash
# test.txt에 URL 목록 작성 후 실행
npm start
```

### 2. 모드별 실행

```bash
# OAuth만 감지
npm run oauth

# 팝업만 감지  
npm run popup

# 디버그 모드 (브라우저 창 표시)
node index.js --no-headless
```

### 3. 입력 파일 형식

`test.txt` 파일에 한 줄에 하나씩 URL을 작성:

```
github.com
stackoverflow.com
medium.com
notion.so
```

## 📊 결과 파일

실행 후 다음 파일들이 생성됩니다:

- `OAuth.txt`: OAuth를 사용하는 사이트 목록
- `Popup.txt`: 로그인 팝업이 감지된 사이트 목록  
- `Failed.txt`: 분석에 실패한 사이트 목록
- `detailed-results.json`: 상세 분석 결과 (JSON)

### 결과 파일 예시

**OAuth.txt**
```
github.com	github	2024-01-01T10:00:00Z
stackoverflow.com	google,facebook	2024-01-01T10:01:00Z
```

**Popup.txt**
```
medium.com	popup	2024-01-01T10:02:00Z
notion.so	popup	2024-01-01T10:03:00Z
```

## 🛠️ API 사용법

```javascript
const WebLoginDetector = require('./index.js');

const detector = new WebLoginDetector({
  headless: true,        // 브라우저 숨김 여부
  timeout: 15000,        // 페이지 로딩 타임아웃
  mode: 'both',          // 'popup', 'oauth', 'both'
  outputDir: './results' // 결과 파일 저장 경로
});

// 단일 사이트 분석
const result = await detector.analyzeSite('github.com');

// 배치 처리
await detector.processBatch('urls.txt');
```

## 🔍 감지 기능 상세

### OAuth 제공자 감지
- Google (accounts.google.com)
- Facebook (facebook.com)
- GitHub (github.com)
- Kakao (kauth.kakao.com)
- Naver (nid.naver.com)
- Apple (appleid.apple.com)
- Microsoft (login.microsoftonline.com)
- Twitter/X (api.twitter.com)

### 로그인 패턴 감지
- URL 패턴: `/login`, `/signin`, `/auth`
- 텍스트 패턴: "Login", "Sign in", "로그인"
- CSS 클래스: `.login-btn`, `.signin-btn`
- 데이터 속성: `[data-testid*="login"]`

### 쿠키 팝업 처리
- 다국어 지원: 한국어, 영어, 일본어, 중국어
- 자동 감지 및 수락/거부 처리
- GDPR/CCPA 규정 대응

## 📈 성능 및 최적화

- **병렬 처리**: 여러 사이트 동시 분석 지원
- **재시도 로직**: 네트워크 오류 시 자동 재시도
- **메모리 최적화**: 페이지별 리소스 정리
- **속도 향상**: 이미지 로딩 차단

## 🐛 문제 해결

### 일반적인 문제

1. **브라우저 설치 오류**
   ```bash
   npx playwright install chromium
   ```

2. **권한 오류 (Linux)**
   ```bash
   sudo apt-get install -y libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 libasound2
   ```

3. **메모리 부족**
   - `headless: true` 모드 사용
   - 배치 크기 줄이기

### 디버깅

```bash
# 디버그 모드로 실행
node index.js --no-headless

# 특정 사이트만 테스트
echo "github.com" > test-single.txt
node index.js
```

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🙏 감사의 말

- [Playwright](https://playwright.dev/) - 웹 자동화 프레임워크
- [Chromium](https://www.chromium.org/) - 오픈소스 브라우저

## 📞 지원

문제가 있거나 질문이 있으시면 [Issues](https://github.com/your-username/web-login-oauth-detector/issues)에 등록해주세요.