#!/usr/bin/env node

const { program } = require('commander');
const WebLoginDetector = require('../index.js');
const fs = require('fs');

program
  .name('login-detector')
  .description('웹사이트 로그인 및 OAuth 감지 도구')
  .version('1.0.0');

program
  .command('analyze')
  .description('URL 목록 분석')
  .option('-i, --input <file>', '입력 파일 경로', 'test.txt')
  .option('-o, --output <dir>', '출력 디렉토리', '.')
  .option('-m, --mode <mode>', '분석 모드 (popup|oauth|both)', 'both')
  .option('--no-headless', '브라우저 창 표시')
  .action(async (options) => {
    const detector = new WebLoginDetector({
      mode: options.mode,
      headless: options.headless,
      outputDir: options.output
    });
    
    await detector.processBatch(options.input);
  });

program
  .command('single <url>')
  .description('단일 URL 분석')
  .option('-m, --mode <mode>', '분석 모드 (popup|oauth|both)', 'both')
  .action(async (url, options) => {
    const detector = new WebLoginDetector({
      mode: options.mode,
      headless: true
    });
    
    await detector.init();
    const result = await detector.analyzeSite(url);
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command('init')
  .description('샘플 파일 생성')
  .action(() => {
    const sampleUrls = ['github.com', 'stackoverflow.com', 'medium.com'];
    fs.writeFileSync('test.txt', sampleUrls.join('\n'));
    console.log('✅ test.txt 생성됨');
  });

program.parse();