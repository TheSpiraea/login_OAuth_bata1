const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 설정 상수
const CONFIG = {
  timeout: 15000,
  viewport: { width: 1920, height: 1080 },
  locale: 'ko-KR',
  timezone: 'Asia/Seoul',
  maxRetries: 3,
  cookieWaitTime: 3000,
  loginWaitTime: 2000
};

// OAuth 제공자 패턴
const OAUTH_PROVIDERS = {
  google: {
    domains: ['accounts.google.com', 'googleapis.com'],
    selectors: ['[class*="google"]', '[id*="google"]', 'button:has-text("Google")'],
    keywords: ['google', 'gmail']
  },
  facebook: {
    domains: ['facebook.com', 'fb.com'],
    selectors: ['[class*="facebook"]', '[id*="facebook"]', 'button:has-text("Facebook")'],
    keywords: ['facebook', 'fb']
  },
  github: {
    domains: ['github.com'],
    selectors: ['[class*="github"]', '[id*="github"]', 'button:has-text("GitHub")'],
    keywords: ['github']
  },
  kakao: {
    domains: ['kauth.kakao.com'],
    selectors: ['[class*="kakao"]', '[id*="kakao"]', 'button:has-text("카카오")'],
    keywords: ['kakao', '카카오']
  },
  naver: {
    domains: ['nid.naver.com'],
    selectors: ['[class*="naver"]', '[id*="naver"]', 'button:has-text("네이버")'],
    keywords: ['naver', '네이버']
  },
  apple: {
    domains: ['appleid.apple.com'],
    selectors: ['[class*="apple"]', '[id*="apple"]', 'button:has-text("Apple")'],
    keywords: ['apple']
  },
  microsoft: {
    domains: ['login.microsoftonline.com', 'login.live.com'],
    selectors: ['[class*="microsoft"]', '[id*="microsoft"]', 'button:has-text("Microsoft")'],
    keywords: ['microsoft', 'outlook', 'live']
  },
  twitter: {
    domains: ['api.twitter.com', 'twitter.com'],
    selectors: ['[class*="twitter"]', '[id*="twitter"]', 'button:has-text("Twitter")'],
    keywords: ['twitter', 'x.com']
  }
};

// 쿠키 팝업 패턴 (다국어 지원)
const COOKIE_PATTERNS = {
  accept: [
    'Accept', 'Accept All', 'Allow', 'OK', 'Agree', 'Continue',
    '수락', '동의', '허용', '확인', '모두 허용', '계속',
    '同意', '承諾', '接受', '允许', '确定',
    'Accepter', 'Akzeptieren', 'Aceptar', 'Accetta'
  ],
  selectors: [
    '[class*="cookie"] button', '[id*="cookie"] button',
    '[class*="consent"] button', '[id*="consent"] button',
    '[class*="gdpr"] button', '[id*="gdpr"] button',
    '.cookie-banner button', '.consent-banner button',
    '[aria-label*="close"]', '[aria-label*="accept"]'
  ]
};

// 로그인 패턴
const LOGIN_PATTERNS = {
  urls: ['/login', '/signin', '/sign-in', '/auth', '/authentication', '/account/login'],
  texts: ['로그인', 'Sign in', 'Login', 'Log in', 'ログイン', '登录', '登入'],
  selectors: [
    'a[href*="login"]', 'a[href*="signin"]', 'a[href*="sign-in"]', 'a[href*="auth"]',
    '.login-btn', '.signin-btn', '#login', '#signin',
    '[data-testid*="login"]', '[data-cy*="login"]',
    'nav a[href*="login"]', 'header a[href*="login"]'
  ],
  hiddenMenus: ['.hamburger', '.menu-toggle', '[class*="menu-icon"]', '.user-icon', '[class*="profile"]']
};

class WebLoginDetector {
  constructor() {
    this.browser = null;
    this.results = [];
    this.errors = [];
  }

  // 브라우저 초기화
  async initBrowser() {
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-images',
        '--disable-javascript-harmony-shipping',
        '--disable-extensions'
      ]
    });
  }

  // 쿠키 팝업 처리
  async handleCookiePopup(page) {
    console.log('   🍪 쿠키 팝업 확인 중...');
    
    // 팝업 로딩 대기
    await page.waitForTimeout(CONFIG.cookieWaitTime);
    
    // Accept 버튼 찾기
    for (const text of COOKIE_PATTERNS.accept) {
      try {
        const button = await page.$(`button:has-text("${text}")`);
        if (button) {
          await button.click();
          console.log(`   ✅ 쿠키 팝업 처리됨: "${text}"`);
          await page.waitForTimeout(1000);
          return { detected: true, handled: true, selector: `button:has-text("${text}")` };
        }
      } catch (e) {}
    }
    
    // CSS 선택자로 찾기
    for (const selector of COOKIE_PATTERNS.selectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          await button.click();
          console.log(`   ✅ 쿠키 팝업 처리됨: ${selector}`);
          await page.waitForTimeout(1000);
          return { detected: true, handled: true, selector };
        }
      } catch (e) {}
    }
    
    return { detected: false, handled: false, selector: null };
  }

  // 로그인 요소 찾기
  async findLoginElements(page) {
    const elements = [];
    
    // 기본 선택자로 찾기
    for (const selector of LOGIN_PATTERNS.selectors) {
      try {
        const found = await page.$$(selector);
        elements.push(...found);
      } catch (e) {}
    }
    
    // 텍스트 기반 검색
    for (const text of LOGIN_PATTERNS.texts) {
      try {
        const found = await page.$$(`text=${text}`);
        elements.push(...found);
      } catch (e) {}
    }
    
    // 숨겨진 메뉴 확인
    await this.checkHiddenMenus(page, elements);
    
    // 중복 제거 및 가시성 확인
    const uniqueElements = [];
    for (const element of elements) {
      try {
        const box = await element.boundingBox();
        if (box && box.width > 0 && box.height > 0) {
          uniqueElements.push(element);
        }
      } catch (e) {}
    }
    
    return [...new Set(uniqueElements)];
  }

  // 숨겨진 메뉴 확인
  async checkHiddenMenus(page, elements) {
    for (const menuSelector of LOGIN_PATTERNS.hiddenMenus) {
      try {
        const menu = await page.$(menuSelector);
        if (menu) {
          await menu.click();
          await page.waitForTimeout(1000);
          
          // 메뉴 열린 후 로그인 요소 재검색
          for (const selector of LOGIN_PATTERNS.selectors) {
            const found = await page.$$(selector);
            elements.push(...found);
          }
        }
      } catch (e) {}
    }
  }

  // OAuth 제공자 감지
  async detectOAuthProviders(page) {
    const detectedProviders = [];
    const detectionMethods = [];
    const endpoints = [];
    
    // 네트워크 요청 모니터링
    const requests = [];
    page.on('request', req => requests.push(req.url()));
    
    // 버튼/링크 기반 감지
    for (const [provider, config] of Object.entries(OAUTH_PROVIDERS)) {
      // 선택자 기반 검색
      for (const selector of config.selectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            detectedProviders.push(provider);
            detectionMethods.push('button');
            break;
          }
        } catch (e) {}
      }
      
      // 키워드 기반 검색
      const content = await page.content();
      for (const keyword of config.keywords) {
        if (content.toLowerCase().includes(keyword)) {
          if (!detectedProviders.includes(provider)) {
            detectedProviders.push(provider);
            detectionMethods.push('content');
          }
        }
      }
    }
    
    // 네트워크 요청에서 OAuth 엔드포인트 찾기
    for (const url of requests) {
      for (const [provider, config] of Object.entries(OAUTH_PROVIDERS)) {
        for (const domain of config.domains) {
          if (url.includes(domain)) {
            endpoints.push(url);
            if (!detectedProviders.includes(provider)) {
              detectedProviders.push(provider);
              detectionMethods.push('network');
            }
          }
        }
      }
      
      // OAuth 패턴 확인
      if (/\/oauth|\/authorize|\/auth/.test(url)) {
        endpoints.push(url);
      }
    }
    
    return {
      hasOAuth: detectedProviders.length > 0,
      providers: detectedProviders,
      detectionMethod: detectionMethods.join(','),
      endpoints: [...new Set(endpoints)]
    };
  }

  // 로그인 기능 테스트
  async testLoginFunction(page, loginElements) {
    if (loginElements.length === 0) {
      return { found: false, method: null, selector: null, loginUrl: null };
    }
    
    for (const element of loginElements) {
      try {
        const elementInfo = await element.evaluate(el => ({
          tagName: el.tagName,
          href: el.href,
          text: el.textContent?.trim()
        }));
        
        console.log(`   🔍 로그인 요소 테스트: ${elementInfo.tagName} - "${elementInfo.text}"`);
        
        const originalUrl = page.url();
        
        // 팝업 감지 준비
        const popupPromise = page.waitForEvent('popup', { timeout: 5000 }).catch(() => null);
        
        await element.click();
        
        // 팝업 확인
        const popup = await popupPromise;
        if (popup) {
          await popup.close();
          return {
            found: true,
            method: 'popup',
            selector: elementInfo.tagName,
            loginUrl: originalUrl
          };
        }
        
        // URL 변경 확인
        await page.waitForTimeout(CONFIG.loginWaitTime);
        const newUrl = page.url();
        
        if (newUrl !== originalUrl) {
          // 로그인 폼 확인
          const hasPasswordField = await page.$('input[type="password"]') !== null;
          if (hasPasswordField) {
            return {
              found: true,
              method: 'redirect',
              selector: elementInfo.tagName,
              loginUrl: newUrl
            };
          }
        }
        
        // 모달/동적 폼 확인
        const hasNewPasswordField = await page.$('input[type="password"]') !== null;
        if (hasNewPasswordField) {
          return {
            found: true,
            method: 'modal',
            selector: elementInfo.tagName,
            loginUrl: originalUrl
          };
        }
        
      } catch (e) {
        console.log(`   ❌ 요소 테스트 실패: ${e.message}`);
        continue;
      }
    }
    
    return { found: false, method: null, selector: null, loginUrl: null };
  }

  // 단일 사이트 분석
  async analyzeSite(url) {
    const startTime = Date.now();
    let page = null;
    
    const result = {
      url,
      timestamp: new Date().toISOString(),
      cookiePopup: { detected: false, handled: false, selector: null },
      loginDetection: { found: false, method: null, selector: null, loginUrl: null },
      oauthAnalysis: { hasOAuth: false, providers: [], detectionMethod: null, endpoints: [] },
      errors: [],
      executionTime: 0
    };
    
    try {
      // URL 정규화
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      
      page = await this.browser.newPage();
      await page.setViewportSize(CONFIG.viewport);
      
      console.log(`🔍 분석 시작: ${url}`);
      
      // 페이지 로드
      await page.goto(fullUrl, {
        timeout: CONFIG.timeout,
        waitUntil: 'domcontentloaded'
      });
      
      // 쿠키 팝업 처리
      result.cookiePopup = await this.handleCookiePopup(page);
      
      // 로그인 요소 찾기
      const loginElements = await this.findLoginElements(page);
      console.log(`   📋 로그인 요소 ${loginElements.length}개 발견`);
      
      // 로그인 기능 테스트
      result.loginDetection = await this.testLoginFunction(page, loginElements);
      
      // OAuth 분석
      result.oauthAnalysis = await this.detectOAuthProviders(page);
      
      result.executionTime = Date.now() - startTime;
      
      console.log(`   ✅ 분석 완료: OAuth=${result.oauthAnalysis.hasOAuth}, 로그인=${result.loginDetection.found}`);
      
    } catch (error) {
      result.errors.push(error.message);
      console.log(`   ❌ 분석 실패: ${error.message}`);
    } finally {
      if (page) await page.close();
    }
    
    return result;
  }

  // 결과 파일 저장
  async saveResults() {
    const oauthSites = [];
    const noOauthSites = [];
    const errorSites = [];
    
    for (const result of this.results) {
      const timestamp = result.timestamp;
      
      if (result.errors.length > 0) {
        errorSites.push(`${result.url}\t${result.errors[0]}\t${timestamp}`);
      } else if (result.oauthAnalysis.hasOAuth) {
        const providers = result.oauthAnalysis.providers.join(',') || 'none-detected';
        const method = result.oauthAnalysis.detectionMethod || 'unknown';
        oauthSites.push(`${result.url}\t${providers}\t${method}\t${timestamp}`);
      } else {
        const loginMethod = result.loginDetection.found ? result.loginDetection.method : 'no-login';
        noOauthSites.push(`${result.url}\t${loginMethod}\t${timestamp}`);
      }
    }
    
    // OAuth.txt 저장
    if (oauthSites.length > 0) {
      fs.writeFileSync('OAuth.txt', oauthSites.join('\n') + '\n');
      console.log(`📄 OAuth.txt 저장됨 (${oauthSites.length}개 사이트)`);
    }
    
    // NOOAuth.txt 저장
    if (noOauthSites.length > 0) {
      fs.writeFileSync('NOOAuth.txt', noOauthSites.join('\n') + '\n');
      console.log(`📄 NOOAuth.txt 저장됨 (${noOauthSites.length}개 사이트)`);
    }
    
    // error.log 저장
    if (errorSites.length > 0) {
      fs.writeFileSync('error.log', errorSites.join('\n') + '\n');
      console.log(`📄 error.log 저장됨 (${errorSites.length}개 사이트)`);
    }
    
    // 상세 결과 JSON 저장
    fs.writeFileSync('detailed-results.json', JSON.stringify(this.results, null, 2));
  }

  // 배치 처리 실행
  async processBatch() {
    try {
      // test.txt 파일 읽기
      const urls = fs.readFileSync('test.txt', 'utf8')
        .split('\n')
        .map(url => url.trim())
        .filter(Boolean)
        .filter((url, index, arr) => arr.indexOf(url) === index); // 중복 제거
      
      console.log(`📋 총 ${urls.length}개 사이트 분석 시작\n`);
      
      // 브라우저 초기화
      await this.initBrowser();
      
      // 각 사이트 순차 처리
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`\n[${i + 1}/${urls.length}] ${url}`);
        
        let retryCount = 0;
        let result = null;
        
        // 재시도 로직
        while (retryCount < CONFIG.maxRetries && !result) {
          try {
            result = await this.analyzeSite(url);
            this.results.push(result);
            
            // 실시간 저장
            await this.saveResults();
            
          } catch (error) {
            retryCount++;
            console.log(`   🔄 재시도 ${retryCount}/${CONFIG.maxRetries}: ${error.message}`);
            
            if (retryCount >= CONFIG.maxRetries) {
              this.results.push({
                url,
                timestamp: new Date().toISOString(),
                errors: [`Max retries exceeded: ${error.message}`],
                executionTime: 0
              });
            }
          }
        }
        
        // 진행률 표시
        const progress = Math.round((i + 1) / urls.length * 100);
        console.log(`📊 진행률: ${i + 1}/${urls.length} (${progress}%)`);
      }
      
      // 최종 결과 저장
      await this.saveResults();
      
      // 요약 리포트
      this.printSummary();
      
    } catch (error) {
      console.error('❌ 배치 처리 실패:', error.message);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  // 요약 리포트 출력
  printSummary() {
    const total = this.results.length;
    const oauthCount = this.results.filter(r => r.oauthAnalysis?.hasOAuth).length;
    const loginCount = this.results.filter(r => r.loginDetection?.found).length;
    const errorCount = this.results.filter(r => r.errors?.length > 0).length;
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 최종 분석 결과 요약');
    console.log('='.repeat(50));
    console.log(`총 분석 사이트: ${total}개`);
    console.log(`OAuth 사용: ${oauthCount}개 (${Math.round(oauthCount/total*100)}%)`);
    console.log(`로그인 기능: ${loginCount}개 (${Math.round(loginCount/total*100)}%)`);
    console.log(`분석 실패: ${errorCount}개 (${Math.round(errorCount/total*100)}%)`);
    
    // OAuth 제공자별 통계
    const providerStats = {};
    this.results.forEach(r => {
      if (r.oauthAnalysis?.providers) {
        r.oauthAnalysis.providers.forEach(provider => {
          providerStats[provider] = (providerStats[provider] || 0) + 1;
        });
      }
    });
    
    if (Object.keys(providerStats).length > 0) {
      console.log('\n🔑 OAuth 제공자별 통계:');
      Object.entries(providerStats)
        .sort(([,a], [,b]) => b - a)
        .forEach(([provider, count]) => {
          console.log(`  ${provider}: ${count}개`);
        });
    }
    
    console.log('\n📁 생성된 파일:');
    console.log('  - OAuth.txt: OAuth 사용 사이트');
    console.log('  - NOOAuth.txt: OAuth 미사용 사이트');
    console.log('  - error.log: 분석 실패 사이트');
    console.log('  - detailed-results.json: 상세 분석 결과');
    console.log('='.repeat(50));
  }
}

// 메인 실행
(async () => {
  const detector = new WebLoginDetector();
  await detector.processBatch();
})();