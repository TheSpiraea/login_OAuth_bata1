const { chromium } = require("playwright");
const fs = require("fs");

async function analyzeLoginPopup(url, browser) {
  const page = await browser.newPage();
  let result = {
    url: url,
    status: "fail",
    login_url: null,
    method: null,
    reason: null
  };

  try {
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    await page.goto(fullUrl, { 
      timeout: 15000, 
      waitUntil: 'domcontentloaded',
      ignoreHTTPSErrors: true 
    });
    
    console.log(`🔍 분석 중: ${url}`);

    // 로그인 요소 찾기
    const loginElements = await findLoginElements(page);
    
    if (loginElements.length === 0) {
      result.reason = "no login button";
      return result;
    }

    console.log(`   로그인 요소 ${loginElements.length}개 발견`);

    // 각 로그인 요소 클릭해서 팝업 확인
    for (let i = 0; i < loginElements.length; i++) {
      try {
        const element = loginElements[i];
        const elementInfo = await element.evaluate(el => ({
          tagName: el.tagName,
          href: el.href,
          textContent: el.textContent?.trim()
        }));
        
        console.log(`   [${i+1}] 클릭 시도: ${elementInfo.tagName} - ${elementInfo.textContent}`);
        
        const hasPopup = await testForPopup(page, element);
        if (hasPopup) {
          result.status = "success";
          result.login_url = page.url();
          result.method = "popup";
          return result;
        }
      } catch (e) {
        console.log(`   [${i+1}] 클릭 에러: ${e.message}`);
        continue;
      }
    }

    result.reason = "login elements found but no popup detected";
    return result;

  } catch (error) {
    result.reason = `Error: ${error.message}`;
    return result;
  } finally {
    await page.close();
  }
}

async function findLoginElements(page) {
  const elements = [];
  
  // 로그인 관련 셀렉터들
  const selectors = [
    'a[href*="login"]', 'a[href*="signin"]', 'a[href*="sign-in"]', 'a[href*="auth"]',
    'button[class*="login"]', 'button[id*="login"]',
    '[class*="login"]', '[id*="login"]', '[class*="signin"]', '[id*="signin"]',
    'a:has-text("Login")', 'a:has-text("Sign in")', 'a:has-text("Sign In")',
    'a:has-text("Log in")', 'a:has-text("Log In")', 'a:has-text("로그인")',
    'button:has-text("Login")', 'button:has-text("Sign in")', 'button:has-text("Sign In")',
    'button:has-text("Log in")', 'button:has-text("Log In")', 'button:has-text("로그인")'
  ];

  for (const selector of selectors) {
    try {
      const selectorElements = await page.$$(selector);
      elements.push(...selectorElements);
    } catch (e) {}
  }

  // 텍스트 기반 검색
  try {
    const allLinks = await page.$$('a, button');
    for (const link of allLinks) {
      const text = await link.textContent();
      if (text && /\b(login|log\s*in|sign\s*in|signin|로그인)\b/i.test(text.trim())) {
        elements.push(link);
      }
    }
  } catch (e) {}

  // 중복 제거 및 클릭 가능한 요소만 필터링
  const uniqueElements = [];
  const seen = new Set();
  
  for (const element of elements) {
    try {
      const boundingBox = await element.boundingBox();
      if (boundingBox && !seen.has(element)) {
        uniqueElements.push(element);
        seen.add(element);
      }
    } catch (e) {}
  }
  
  return uniqueElements;
}

async function testForPopup(page, element) {
  try {
    // 팝업 감지 준비
    const popupPromise = page.waitForEvent('popup', { timeout: 5000 }).catch(() => null);
    
    // 요소 클릭
    await element.click();
    
    // 팝업 확인
    const popup = await popupPromise;
    if (popup) {
      console.log(`     ✅ 팝업 감지됨!`);
      await popup.close();
      return true;
    }

    console.log(`     ❌ 팝업 없음`);
    return false;
    
  } catch (error) {
    console.log(`     ❌ 클릭 에러: ${error.message}`);
    return false;
  }
}

async function processDomains() {
  let domains;
  try {
    domains = fs.readFileSync("test.txt", "utf8")
      .split("\n")
      .map(d => d.trim())
      .filter(Boolean);
  } catch (error) {
    console.error("❌ test.txt 파일을 읽을 수 없습니다:", error.message);
    return;
  }

  console.log(`📋 총 ${domains.length}개 도메인 분석 시작\n`);

  const browser = await chromium.launch({ 
    headless: true,
    ignoreHTTPSErrors: true,
    args: [
      '--no-sandbox', 
      '--disable-dev-shm-usage',
      '--ignore-certificate-errors',
      '--ignore-ssl-errors',
      '--disable-web-security'
    ]
  });

  const results = [];
  
  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i];
    console.log(`[${i + 1}/${domains.length}] ${domain}`);
    
    const result = await analyzeLoginPopup(domain, browser);
    results.push(result);
    
    console.log(`   → ${result.status} (${result.method || result.reason})\n`);
  }

  await browser.close();

  // 결과 저장
  fs.writeFileSync("popup_results.json", JSON.stringify(results, null, 2));
  
  // 통계 출력
  const successCount = results.filter(r => r.status === "success").length;
  const failCount = results.filter(r => r.status === "fail").length;
  
  console.log("📊 분석 완료!");
  console.log(`✅ 팝업 성공: ${successCount}개`);
  console.log(`❌ 팝업 실패: ${failCount}개`);
  console.log(`📄 결과 저장: popup_results.json`);
}

(async () => {
  try {
    await processDomains();
  } catch (error) {
    console.error("❌ 실행 중 오류 발생:", error.message);
  }
})();