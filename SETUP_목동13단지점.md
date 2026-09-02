# 봉주르후르츠 목동 13단지점 — 신규 배포 가이드

본점(`bonjour1`)과는 **완전히 독립된 사본**이에요. 데이터(주문·회원·캠페인)는 전혀 공유되지 않아요.

## 1. Supabase — 새 프로젝트 만들기
1. [supabase.com](https://supabase.com) → **New Project** (본점과 다른, 새 프로젝트여야 해요)
2. 프로젝트가 만들어지면, 왼쪽 메뉴 **SQL Editor** → 이 프로젝트에 들어있는 `supabase_setup.sql` 내용을 그대로 붙여넣고 **Run**
3. 왼쪽 메뉴 **Project Settings → API**에서 아래 두 값을 복사해두세요
   - `Project URL` → 이게 `SUPABASE_URL`
   - `service_role` 키 (anon 키 아님!) → 이게 `SUPABASE_SERVICE_KEY`

## 2. Render — 새 서비스 만들기
본점과 **같은 GitHub 저장소를 쓰지 말고**, 이 폴더로 **새 저장소**를 만들어서 배포하세요.

1. 이 폴더를 새 GitHub 저장소에 올리기
2. Render 대시보드 → **New Web Service** → 방금 만든 저장소 연결
3. Environment 탭에서 아래 값 등록:

| 변수명 | 값 |
|---|---|
| `SUPABASE_URL` | 위에서 복사한 Project URL |
| `SUPABASE_SERVICE_KEY` | 위에서 복사한 service_role 키 |
| `STAFF_PASSWORD` | 목동 13단지점 직원용 비밀번호 (본점과 다르게 설정 추천) |
| `AUTH_SECRET` | 아무 랜덤 문자열 (예: 터미널에서 `openssl rand -hex 32`) |

4. 배포되면 `https://[서비스이름].onrender.com` 같은 주소가 생겨요

## 3. 배포 후 꼭 고쳐야 하는 것 (2곳)

### ① 카카오톡 오픈채팅 링크
`public/board.html` 파일에서 이 줄을 찾아서, **목동 13단지점 전용 오픈채팅방 링크**로 바꿔주세요.
```js
const KAKAO_OPENCHAT_URL = 'https://open.kakao.com/o/REPLACE_WITH_MOKDONG13_OPENCHAT';
```
(본점 링크를 그대로 두면 손님이 본점 채팅방으로 가게 돼요 — 꼭 바꿔주세요)

### ② 카카오톡 공유 미리보기 주소
`public/board.html`에서 아래 두 줄을 실제 배포 주소로 바꿔주세요 (2번에서 받은 Render 주소).
```html
<meta property="og:url" content="https://REPLACE-WITH-YOUR-RENDER-URL.onrender.com/board" />
<meta property="og:image" content="https://REPLACE-WITH-YOUR-RENDER-URL.onrender.com/assets/og-board.png" />
```

## 4. 확인
- `/` → 직원용 픽업 관리 (로그인 필요)
- `/board` → 매장 게시판 (로그인 불필요)
- `/my-order` → 고객용 내 주문 확인 (로그인 불필요)

전부 헤더에 **"봉주르후르츠 목동 13단지점"**으로 나오는지 확인해주세요.

## 참고
- 앱 아이콘(빨간 "B" 로고)은 본점과 동일하게 유지했어요 — 같은 브랜드니까요. 목동점만의 아이콘이 필요하면 말씀해주세요.
- 본점 시스템에 있었던 동시성 버그 수정 사항(연기 처리, 자동 새로고침 관련)은 이 사본에도 전부 포함되어 있어요.
