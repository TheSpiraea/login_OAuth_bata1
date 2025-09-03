#!/bin/bash

# Git 저장소 초기화 및 설정 스크립트

echo "🚀 Git 저장소 설정 시작..."

# Git 초기화
git init

# 원격 저장소 추가 (사용자가 수정해야 함)
echo "📝 원격 저장소 URL을 설정하세요:"
echo "git remote add origin https://github.com/YOUR_USERNAME/web-login-oauth-detector.git"

# 첫 번째 커밋
git add .
git commit -m "Initial commit: Web Login & OAuth Detector v1.0.0

Features:
- 로그인 팝업 감지
- OAuth 제공자 감지 (Google, Facebook, GitHub 등)
- 쿠키 팝업 자동 처리
- 배치 처리 지원
- CLI 도구 제공
- 상세 리포팅"

echo "✅ Git 저장소 설정 완료!"
echo ""
echo "📋 다음 단계:"
echo "1. GitHub에서 새 저장소 생성"
echo "2. git remote add origin <저장소_URL>"
echo "3. git push -u origin main"
echo ""
echo "🔧 CLI 도구 사용법:"
echo "npm install -g ."
echo "login-detector analyze"