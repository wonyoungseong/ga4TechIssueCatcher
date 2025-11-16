#!/bin/bash

# GA4 Tech Issue Catcher - GitHub Labels Setup Script
# This script creates comprehensive labels for issue management

set -e

echo "🏷️  Creating GitHub labels for ga4TechIssueCatcher..."

# Development Area Labels (개발 영역)
echo "📦 Creating development area labels..."
gh label create "area:frontend" --description "프론트엔드 관련 작업 (Dashboard, UI)" --color "0052CC" --force
gh label create "area:backend" --description "백엔드 관련 작업 (Orchestrator, API)" --color "5319E7" --force
gh label create "area:infrastructure" --description "인프라 관련 작업 (DB, Supabase, Docker)" --color "0E8A16" --force
gh label create "area:automation" --description "자동화 관련 작업 (Crawler, Browser Pool)" --color "1D76DB" --force
gh label create "area:devops" --description "DevOps 관련 작업 (CI/CD, Deployment)" --color "F9D0C4" --force

# Complexity Labels (복잡도)
echo "📊 Creating complexity labels..."
gh label create "complexity:easy" --description "쉬움 - 간단한 작업 (<2시간)" --color "D4C5F9" --force
gh label create "complexity:medium" --description "보통 - 중간 난이도 작업 (2-8시간)" --color "FBCA04" --force
gh label create "complexity:hard" --description "복잡함 - 고난이도 작업 (>8시간)" --color "D93F0B" --force

# Work Type Labels (작업 유형)
echo "🔧 Creating work type labels..."
gh label create "type:feature" --description "새로운 기능 추가" --color "A2EEEF" --force
gh label create "type:bug" --description "버그 수정" --color "D73A4A" --force
gh label create "type:enhancement" --description "기존 기능 개선" --color "84B6EB" --force
gh label create "type:documentation" --description "문서화 작업" --color "0075CA" --force
gh label create "type:test" --description "테스트 관련 작업" --color "BFD4F2" --force
gh label create "type:refactor" --description "리팩토링 작업" --color "FBCA04" --force
gh label create "type:performance" --description "성능 최적화" --color "FF6B6B" --force

# Priority Labels (우선순위)
echo "⚡ Creating priority labels..."
gh label create "priority:critical" --description "긴급 - 즉시 처리 필요" --color "B60205" --force
gh label create "priority:high" --description "높음 - 우선 처리" --color "D93F0B" --force
gh label create "priority:medium" --description "보통 - 일반 처리" --color "FBCA04" --force
gh label create "priority:low" --description "낮음 - 여유 시 처리" --color "0E8A16" --force

# Status Labels (상태)
echo "📌 Creating status labels..."
gh label create "status:blocked" --description "블로킹됨 - 의존성 대기" --color "E99695" --force
gh label create "status:in-progress" --description "진행 중" --color "C2E0C6" --force
gh label create "status:review-needed" --description "리뷰 필요" --color "FFADD1" --force
gh label create "status:ready" --description "작업 준비 완료" --color "C5DEF5" --force

# Component Labels (컴포넌트)
echo "🧩 Creating component labels..."
gh label create "component:orchestrator" --description "Orchestrator 모듈" --color "006B75" --force
gh label create "component:browser-pool" --description "Browser Pool Manager" --color "0075CA" --force
gh label create "component:network-capturer" --description "Network Event Capturer" --color "1D76DB" --force
gh label create "component:dashboard" --description "Web Dashboard" --color "0052CC" --force
gh label create "component:database" --description "Supabase Integration" --color "0E8A16" --force

# Special Labels (특수)
echo "⭐ Creating special labels..."
gh label create "good-first-issue" --description "처음 기여하기 좋은 이슈" --color "7057FF" --force
gh label create "help-wanted" --description "도움이 필요한 이슈" --color "008672" --force
gh label create "question" --description "질문 또는 논의 필요" --color "D876E3" --force
gh label create "duplicate" --description "중복된 이슈" --color "CFD3D7" --force
gh label create "wontfix" --description "수정하지 않을 이슈" --color "FFFFFF" --force

echo "✅ All labels created successfully!"
echo ""
echo "📋 Label Summary:"
echo "   • Development Areas: 5 labels"
echo "   • Complexity: 3 labels"
echo "   • Work Types: 7 labels"
echo "   • Priorities: 4 labels"
echo "   • Status: 4 labels"
echo "   • Components: 5 labels"
echo "   • Special: 5 labels"
echo "   • Total: 33 labels"
echo ""
echo "🎯 Usage examples:"
echo "   gh issue create --label 'area:frontend,type:feature,complexity:medium'"
echo "   gh issue list --label 'priority:high,status:ready'"
