// 테스트 케이스 및 사용 예시
const fs = require('fs');

// 테스트용 URL 목록 생성
const testUrls = [
  'github.com',
  'stackoverflow.com', 
  'medium.com',
  'dev.to',
  'notion.so',
  'figma.com',
  'discord.com',
  'slack.com',
  'trello.com',
  'asana.com'
];

// test.txt 파일 생성
fs.writeFileSync('test-sample.txt', testUrls.join('\n'));

console.log('📝 테스트 케이스 생성 완료!');
console.log('');
console.log('🚀 사용 방법:');
console.log('1. npm install');
console.log('2. test.txt 파일에 분석할 URL 목록 작성');
console.log('3. npm start');
console.log('');
console.log('📁 결과 파일:');
console.log('- OAuth.txt: OAuth 사용 사이트');
console.log('- NOOAuth.txt: OAuth 미사용 사이트'); 
console.log('- error.log: 분석 실패 사이트');
console.log('- detailed-results.json: 상세 분석 결과');
console.log('');
console.log('🔧 고급 설정:');
console.log('- CONFIG 객체에서 타임아웃, 재시도 횟수 등 조정 가능');
console.log('- OAUTH_PROVIDERS에서 새로운 OAuth 제공자 추가 가능');
console.log('- LOGIN_PATTERNS에서 로그인 패턴 커스터마이징 가능');