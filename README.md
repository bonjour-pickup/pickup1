# 봉주르후르츠 픽업 체크 (Supabase 저장 버전)

데이터가 절대 초기화되지 않도록 Supabase(무료 클라우드 DB)에 저장하는 버전입니다.
화면과 기능은 기존과 100% 동일하고, 저장 위치만 서버 파일 → Supabase DB로 바뀌었습니다.

---

## 전체 순서 요약
1. Supabase 가입 → 프로젝트 생성
2. 테이블 만들기 (SQL 한 번 실행)
3. 연결 정보 2개 복사 (URL, service_role 키)
4. 이 프로젝트를 GitHub에 올리기
5. Render에서 배포 + 환경변수 2개 등록
6. 완료 → 링크를 직원에게 공유

---

## 1단계 — Supabase 프로젝트 생성
1. https://supabase.com 접속 → **Start your project** → GitHub나 이메일로 가입 (무료)
2. **New project** 클릭
3. 입력값:
   - Name: `bonjour-pickup` (아무거나)
   - Database Password: 임의의 강한 비밀번호 (자동 생성 버튼 사용 후 어딘가 메모)
   - Region: `Northeast Asia (Seoul)` 선택 (한국에서 가장 빠름)
4. **Create new project** → 1~2분 기다리면 준비 완료

## 2단계 — 테이블 만들기
1. 왼쪽 메뉴 **SQL Editor** 클릭 → **New query**
2. 이 폴더의 `supabase_setup.sql` 파일 내용을 전부 복사해 붙여넣기
3. 오른쪽 아래 **Run** 클릭 → "Success" 뜨면 완료

## 3단계 — 연결 정보 2개 복사
1. 왼쪽 메뉴 맨 아래 **Project Settings**(톱니바퀴) → **API** (또는 Data API)
2. 아래 두 값을 복사해 둡니다:
   - **Project URL** — `https://xxxxxxxx.supabase.co` 형태
   - **service_role** 키 — `Project API keys` 아래에 있는 `service_role`의 값
     (⚠️ `anon` 키가 아니라 **service_role** 키입니다. 이 키는 비밀번호처럼 다뤄야 하며 절대 외부에 노출·공유하면 안 됩니다.)

## 4단계 — GitHub에 올리기
- 이 폴더 전체를 새 GitHub 저장소로 push 합니다. (예: `bonjour-pickup`)
- `.gitignore`가 `node_modules`, `data`, `.env`를 제외하므로 키가 실수로 올라갈 걱정은 없습니다.

## 5단계 — Render 배포 + 환경변수 등록
1. https://dashboard.render.com → **New** → **Web Service**
2. GitHub 저장소 연결 후 설정:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (테스트) 또는 Starter(상시 구동)
3. 아래로 스크롤 → **Environment Variables** (또는 Advanced → Add Environment Variable) 에서 **4개 등록**:
   - Key: `SUPABASE_URL`         / Value: (3단계에서 복사한 Project URL)
   - Key: `SUPABASE_SERVICE_KEY` / Value: (3단계에서 복사한 service_role 키)
   - Key: `STAFF_PASSWORD`       / Value: 직원들과 공유할 로그인 비밀번호 (원하는 대로 설정, 예: `bonjour2026`)
   - Key: `AUTH_SECRET`          / Value: 아무 임의의 긴 문자열 (예: `qwer1234asdf5678zxcv`) — 로그인 토큰 서명용, 아무도 몰라도 됨
4. **Create Web Service** → 배포 완료되면 `https://xxxx.onrender.com` 주소 생성

## 6단계 — 완료
- 생성된 주소를 직원 단톡방에 공유하면 끝입니다.
- 처음 접속하면 **로그인 화면**이 뜨고, `STAFF_PASSWORD`로 설정한 비밀번호를 입력하면 됩니다.
- 한 번 로그인하면 **로그아웃 버튼을 누르기 전까지** 폰을 껐다 켜도 로그인 상태가 유지돼요.
- 이제 Render 서버가 몇 번을 재시작해도 데이터는 Supabase에 안전하게 남습니다.

## 7단계 — 매장 칠판 화면 (선택)
`https://주소.onrender.com/board` — **로그인 없이** 바로 열리는 매장용 디스플레이 화면입니다.
- 매장 태블릿/모니터에 이 주소를 띄워두시면 돼요.
- 왼쪽: 지금 주문 가능(마감 카운트다운) · 오늘의 픽업 · 주간 픽업 일정
- 오른쪽: 지각(연기) 명단 · 결석(노쇼) 명단
- 데이터는 "📅 일정" 탭에서 등록한 캠페인, 그리고 픽업 리스트에서 발생하는 노쇼·연기 기록을 그대로 가져와요 (따로 입력할 필요 없음)
- 30초마다 자동으로 최신 데이터로 갱신돼요
- ⚠️ 로그인 없이 열리는 주소라 **URL 자체를 아무 데나 공개하지 않도록** 주의해주세요 (매장 안내문 등 필요한 곳에만 공유)

---

## 데이터 안전 3중 장치 (이미 내장)
1. **Supabase 영구 저장** — 서버 재시작·재배포와 무관하게 데이터 보존
2. **브라우저 자동 백업** — 접속한 기기에도 자동 저장, 네트워크가 끊겨도 복구
3. **수동 백업/복원 버튼** — 앱 상단 `💾 백업`으로 JSON 파일 저장, `📂 복원`으로 불러오기

## 로컬에서 테스트하기 (선택)
```bash
npm install
# 환경변수 없이 실행하면 화면은 뜨지만 저장은 안 됩니다.
# 저장까지 테스트하려면:
SUPABASE_URL="https://xxxx.supabase.co" SUPABASE_SERVICE_KEY="service_role키" npm start
```
http://localhost:3000 접속

## Supabase 무료 한도
- 무료 플랜: DB 500MB (픽업 관리용으로는 수년치도 차고 넘침)
- 데이터는 Supabase 대시보드 → Table Editor → `kv_store` 에서 직접 확인·내보내기 가능

## 구조
```
bonjour-pickup/
  server.js            # Express + Supabase 연결
  package.json
  supabase_setup.sql   # 테이블 생성 SQL (2단계에서 사용)
  .node-version        # Node 22 고정
  public/
    index.html         # 픽업 체크 앱 (기존과 동일)
```
