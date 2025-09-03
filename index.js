#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 통합 웹 로그인 감지 및 OAuth 검증 시스템
class WebLoginDetector {
  constructor(options = {}) {
    this.options = {
      headless: options.headless !== false,
      timeout: options.timeout || 15000,
      retries: options.retries || 3,
      outputDir: options.outputDir || '.',
      mode: options.mode || 'both', // 'popup', 'oauth', 'both'
      ...options
    };
    
    this.browser = null;
    this.results = [];
  }

  // 브라우저 초기화
  async init() {
    this.browser = await chromium.launch({
      headless: this.options.headless,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--ignore-certificate-errors',
        '--ignore-ssl-errors',
        '--disable-web-security'
      ]
    });
  }

  // 쿠키 팝업 처리
  async handleCookiePopup(page) {
    const cookieSelectors = [
      'button:has-text("Accept")', 'button:has-text("Allow")', 'button:has-text("OK")',
      'button:has-text("동의")', 'button:has-text("허용")', 'button:has-text("수락")',
      '[id*="cookie"] button', '[class*="cookie"] button', '[class*="consent"] button'
    ];

    for (const selector of cookieSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          await button.click();
          console.log('   🍪 쿠키 팝업 처리됨');
          await page.waitForTimeout(1000);
          return true;
        }
      } catch (e) {}
    }
    return false;
  }

  // 로그인 요소 찾기
  async findLoginElements(page) {
    const elements = [];
    
    const selectors = [
      'a[href*="login"]', 'a[href*="signin"]', 'a[href*="sign-in"]', 'a[href*="auth"]',
      'button[class*="login"]', 'button[id*="login"]',
      'a:has-text("Login")', 'a:has-text("Sign in")', 'a:has-text("로그인")',
      'button:has-text("Login")', 'button:has-text("Sign in")', 'button:has-text("로그인")'
    ];

    for (const selector of selectors) {
      try {
        const found = await page.$$(selector);
        elements.push(...found);
      } catch (e) {}
    }

    // 텍스트 기반 검색
    try {
      const allElements = await page.$$('a, button');
      for (const element of allElements) {
        const text = await element.textContent();
        if (text && /\b(login|log\s*in|sign\s*in|signin|로그인)\b/i.test(text.trim())) {
          elements.push(element);
        }
      }
    } catch (e) {}

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

  // 팝업 테스트
  async testForPopup(page, element) {
    try {
      const popupPromise = page.waitForEvent('popup', { timeout: 5000 }).catch(() => null);
      await element.click();
      
      const popup = await popupPromise;
      if (popup) {
        await popup.close();
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  // OAuth 제공자 감지
  async detectOAuth(page) {
    const providers = {
      google: ['google', 'googleapis.com', 'accounts.google.com'],
      facebook: ['facebook', 'fb.com'],
      github: ['github'],
      kakao: ['kakao', '카카오'],
      naver: ['naver', '네이버'],
      apple: ['apple'],
      microsoft: ['microsoft', 'outlook', 'live'],
      twitter: ['twitter', 'x.com']
    };

    const detected = [];
    const content = await page.content();

    for (const [provider, keywords] of Object.entries(providers)) {
      for (const keyword of keywords) {
        if (content.toLowerCase().includes(keyword)) {
          // 버튼 확인
          try {
            const button = await page.$(`[class*="${keyword}"], [id*="${keyword}"], button:has-text("${keyword}")`);
            if (button) {
              detected.push(provider);
              break;
            }
          } catch (e) {}
        }
      }
    }

    return detected;
  }

  // 단일 사이트 분석
  async analyzeSite(url) {
    const page = await this.browser.newPage();
    const result = {
      url,
      timestamp: new Date().toISOString(),
      hasPopup: false,
      hasOAuth: false,
      oauthProviders: [],
      loginMethod: null,
      status: 'fail',
      error: null
    };

    try {
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      
      await page.goto(fullUrl, {
        timeout: this.options.timeout,
        waitUntil: 'domcontentloaded'
      });

      console.log(`🔍 분석 중: ${url}`);

      // 쿠키 팝업 처리
      await this.handleCookiePopup(page);

      // OAuth 감지 (mode가 oauth 또는 both인 경우)
      if (this.options.mode === 'oauth' || this.options.mode === 'both') {
        const oauthProviders = await this.detectOAuth(page);
        if (oauthProviders.length > 0) {
          result.hasOAuth = true;
          result.oauthProviders = oauthProviders;
          result.status = 'success';
          result.loginMethod = 'oauth';
        }
      }

      // 팝업 테스트 (mode가 popup 또는 both인 경우)
      if (this.options.mode === 'popup' || this.options.mode === 'both') {
        const loginElements = await this.findLoginElements(page);
        
        if (loginElements.length > 0) {
          console.log(`   로그인 요소 ${loginElements.length}개 발견`);
          
          for (const element of loginElements) {
            const hasPopup = await this.testForPopup(page, element);
            if (hasPopup) {
              result.hasPopup = true;
              result.status = 'success';
              result.loginMethod = result.loginMethod || 'popup';
              break;
            }
          }
        }
      }

      console.log(`   → ${result.status} (OAuth: ${result.hasOAuth}, Popup: ${result.hasPopup})`);

    } catch (error) {
      result.error = error.message;
      console.log(`   ❌ 에러: ${error.message}`);
    } finally {
      await page.close();
    }

    return result;
  }

  // 배치 처리
  async processBatch(inputFile = 'test.txt') {
    try {
      // URL 목록 읽기
      const urls = fs.readFileSync(inputFile, 'utf8')
        .split('\n')
        .map(url => url.trim())
        .filter(Boolean)
        .filter((url, index, arr) => arr.indexOf(url) === index);

      console.log(`📋 총 ${urls.length}개 사이트 분석 시작 (모드: ${this.options.mode})\n`);

      await this.init();

      // 각 사이트 분석
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`[${i + 1}/${urls.length}] ${url}`);
        
        const result = await this.analyzeSite(url);
        this.results.push(result);

        // 진행률 표시
        const progress = Math.round((i + 1) / urls.length * 100);
        console.log(`📊 진행률: ${progress}%\n`);
      }

      // 결과 저장
      await this.saveResults();
      this.printSummary();

    } catch (error) {
      console.error('❌ 배치 처리 실패:', error.message);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  // 결과 저장
  async saveResults() {
    const outputDir = this.options.outputDir;
    
    // 상세 결과 JSON
    const detailedPath = path.join(outputDir, 'detailed-results.json');
    fs.writeFileSync(detailedPath, JSON.stringify(this.results, null, 2));

    // OAuth 사용 사이트
    const oauthSites = this.results
      .filter(r => r.hasOAuth)
      .map(r => `${r.url}\t${r.oauthProviders.join(',')}\t${r.timestamp}`);
    
    if (oauthSites.length > 0) {
      const oauthPath = path.join(outputDir, 'OAuth.txt');
      fs.writeFileSync(oauthPath, oauthSites.join('\n') + '\n');
    }

    // 팝업 성공 사이트
    const popupSites = this.results
      .filter(r => r.hasPopup)
      .map(r => `${r.url}\tpopup\t${r.timestamp}`);
    
    if (popupSites.length > 0) {
      const popupPath = path.join(outputDir, 'Popup.txt');
      fs.writeFileSync(popupPath, popupSites.join('\n') + '\n');
    }

    // 실패 사이트
    const failedSites = this.results
      .filter(r => r.status === 'fail')
      .map(r => `${r.url}\t${r.error || 'no-login-detected'}\t${r.timestamp}`);
    
    if (failedSites.length > 0) {
      const errorPath = path.join(outputDir, 'Failed.txt');
      fs.writeFileSync(errorPath, failedSites.join('\n') + '\n');
    }

    console.log('📁 결과 파일 저장 완료');
  }

  // 요약 출력
  printSummary() {
    const total = this.results.length;
    const oauthCount = this.results.filter(r => r.hasOAuth).length;
    const popupCount = this.results.filter(r => r.hasPopup).length;
    const successCount = this.results.filter(r => r.status === 'success').length;
    const failCount = this.results.filter(r => r.status === 'fail').length;

    console.log('\n' + '='.repeat(50));
    console.log('📊 최종 분석 결과');
    console.log('='.repeat(50));
    console.log(`총 분석: ${total}개`);
    console.log(`성공: ${successCount}개 (${Math.round(successCount/total*100)}%)`);
    console.log(`실패: ${failCount}개 (${Math.round(failCount/total*100)}%)`);
    
    if (this.options.mode === 'oauth' || this.options.mode === 'both') {
      console.log(`OAuth 감지: ${oauthCount}개`);
    }
    
    if (this.options.mode === 'popup' || this.options.mode === 'both') {
      console.log(`팝업 감지: ${popupCount}개`);
    }

    // OAuth 제공자별 통계
    const providerStats = {};
    this.results.forEach(r => {
      r.oauthProviders.forEach(provider => {
        providerStats[provider] = (providerStats[provider] || 0) + 1;
      });
    });

    if (Object.keys(providerStats).length > 0) {
      console.log('\n🔑 OAuth 제공자별 통계:');
      Object.entries(providerStats)
        .sort(([,a], [,b]) => b - a)
        .forEach(([provider, count]) => {
          console.log(`  ${provider}: ${count}개`);
        });
    }

    console.log('='.repeat(50));
  }
}

// CLI 실행
if (require.main === module) {
  const detector = new WebLoginDetector({
    mode: process.argv.includes('--oauth-only') ? 'oauth' : 
          process.argv.includes('--popup-only') ? 'popup' : 'both',
    headless: !process.argv.includes('--no-headless')
  });
  
  detector.processBatch().catch(console.error);
}

module.exports = WebLoginDetector;