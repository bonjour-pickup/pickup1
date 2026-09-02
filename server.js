const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Supabase 연결 ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('⚠️  환경변수 SUPABASE_URL / SUPABASE_SERVICE_KEY 가 설정되지 않았습니다.');
  console.error('    Render 대시보드 → Environment 에서 두 값을 등록해주세요.');
}

const supabase = createClient(SUPABASE_URL || 'http://localhost', SUPABASE_KEY || 'placeholder', {
  auth: { persistSession: false }
});

const TABLE = 'kv_store';

// --- 로그인 인증 ---
// Render 환경변수에 STAFF_PASSWORD(직원 공용 비밀번호), AUTH_SECRET(토큰 서명용 임의 문자열)을 등록하세요.
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || '';
const AUTH_SECRET = process.env.AUTH_SECRET || '';

if (!STAFF_PASSWORD) {
  console.error('⚠️  환경변수 STAFF_PASSWORD 가 설정되지 않았습니다. 로그인 기능이 막혀있어요.');
}
if (!AUTH_SECRET) {
  console.error('⚠️  환경변수 AUTH_SECRET 이 설정되지 않았습니다. 토큰 서명이 안전하지 않아요.');
}

// 토큰 = "만료시각.서명" 형태. 서버 재시작과 무관하게 검증 가능 (메모리에 세션 저장 안 함)
function signToken(expiry) {
  const h = crypto.createHmac('sha256', AUTH_SECRET || 'insecure-default');
  h.update(String(expiry));
  return expiry + '.' + h.digest('hex');
}
function makeToken() {
  const expiry = Date.now() + 5 * 365 * 24 * 60 * 60 * 1000; // 5년 (사실상 로그아웃 전까지 유지)
  return signToken(expiry);
}
function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const idx = token.indexOf('.');
  if (idx < 0) return false;
  const expiry = token.slice(0, idx);
  const expected = signToken(Number(expiry));
  if (expected !== token) return false;
  if (Number(expiry) < Date.now()) return false;
  return true;
}

function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!verifyToken(token)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

app.use(express.json({ limit: '5mb' }));

// 모든 API 응답은 항상 최신 데이터를 반영해야 하므로, 인증 통과 여부와 상관없이 캐시를 막음
// (이 위치가 중요: requireAuth 등 다른 미들웨어보다 먼저 실행돼서, 401로 막히는 요청에도 항상 적용됨)
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// POST /api/login  body: { password }
app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (!STAFF_PASSWORD) {
    return res.status(500).json({ error: '서버에 비밀번호가 설정되지 않았어요' });
  }
  if (password !== STAFF_PASSWORD) {
    return res.status(401).json({ error: '비밀번호가 틀렸어요' });
  }
  res.json({ token: makeToken() });
});

// GET /api/kv/:key -> { key, value }
app.get('/api/kv/:key', requireAuth, async (req, res) => {
  const key = req.params.key;
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'not found' });
    res.json({ key, value: data.value });
  } catch (e) {
    console.error('GET 실패:', e.message);
    res.status(500).json({ error: 'server error' });
  }
});

// PUT /api/kv/:key  body: { value: string }
app.put('/api/kv/:key', requireAuth, async (req, res) => {
  const key = req.params.key;
  const { value } = req.body || {};
  if (typeof value !== 'string') {
    return res.status(400).json({ error: 'value must be a string' });
  }
  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert({ key, value }, { onConflict: 'key' });
    if (error) throw error;
    res.json({ key, value });
  } catch (e) {
    console.error('PUT 실패:', e.message);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/health', (req, res) => res.send('ok'));

// --- 매장 화면(/board)용 공개 API — 로그인 불필요, 읽기 전용, 필요한 데이터만 노출 ---
app.get('/api/public/board', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('key, value')
      .in('key', ['campaigns', 'noshow-log', 'postponed-log', 'members']);
    if (error) throw error;
    const out = {};
    (data || []).forEach(row => { out[row.key] = row.value; });
    const campaigns = out['campaigns'] ? JSON.parse(out['campaigns']) : [];

    // 고객 검색이 닉네임 변경에도 잘 되도록, 회원명단에서 검색에 필요한 최소 정보만 추림 (메모 등은 제외)
    const membersRaw = out['members'] ? JSON.parse(out['members']) : [];
    const members = membersRaw.map(m => ({
      id: m.id, name: m.name, phone4: m.phone4 || null, aliases: m.aliases || []
    }));

    // 캠페인별 예약자 명단 + 오늘 픽업 대상자 표시를 위해, 관련 날짜의 실제 주문 데이터도 함께 조회
    const today = /^\d{4}-\d{2}-\d{2}$/.test(req.query.today || '') ? req.query.today : null;
    const dateSet = new Set(campaigns.map(c => c.pickupDate).filter(Boolean));
    if (today) dateSet.add(today);

    let ordersByDate = {};
    if (dateSet.size > 0) {
      const orderKeys = [...dateSet].map(d => 'orders:' + d);
      const { data: orderRows, error: orderErr } = await supabase
        .from(TABLE)
        .select('key, value')
        .in('key', orderKeys);
      if (orderErr) throw orderErr;
      (orderRows || []).forEach(row => {
        const date = row.key.replace('orders:', '');
        try { ordersByDate[date] = JSON.parse(row.value); } catch (e) { ordersByDate[date] = []; }
      });
    }

    res.json({
      campaigns,
      members,
      noshowLog: out['noshow-log'] ? JSON.parse(out['noshow-log']) : [],
      postponedLog: out['postponed-log'] ? JSON.parse(out['postponed-log']) : [],
      ordersByDate
    });
  } catch (e) {
    console.error('board 조회 실패:', e.message);
    res.status(500).json({ error: 'server error' });
  }
});

// --- "내 주문 확인" 전용 공개 API — 로그인 불필요, 서버가 검색해서 결과만 반환 (전체 목록은 안 내려줌) ---
const HG_CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const HG_JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const HG_JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

function toJamo(str) {
  let out = '';
  for (const ch of String(str || '')) {
    const code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const i = code - 0xAC00;
      out += HG_CHO[Math.floor(i / 588)];
      out += HG_JUNG[Math.floor((i % 588) / 28)];
      const j = HG_JONG[i % 28];
      if (j) out += j;
    } else out += ch.toLowerCase();
  }
  return out;
}
function toChosung(str) {
  let out = '';
  for (const ch of String(str || '')) {
    const c = ch.charCodeAt(0);
    if (c >= 0xAC00 && c <= 0xD7A3) out += HG_CHO[Math.floor((c - 0xAC00) / 588)];
    else out += ch.toLowerCase();
  }
  return out;
}
function isAllChosung(q) {
  return q.length > 0 && [...q].every(ch => HG_CHO.includes(ch));
}
function normName(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase();
}
function fuzzyMatchText(target, query) {
  const q = String(query || '').trim();
  if (!q || !target) return false;
  if (isAllChosung(q) && toChosung(target).includes(q)) return true;
  const qj = toJamo(q);
  return toJamo(target).includes(qj) || String(target).includes(q);
}

// "김철수 1234" 같은 주문자명을 이름/번호로 분해 (관리 앱과 동일한 규칙)
function parseNameLine(line) {
  let s = String(line || '').trim();
  if (!s) return null;
  let m = s.match(/^(.+?)\s*[\(\[]\s*(\d{4})\s*[\)\]]\s*$/);
  if (m) return { name: m[1].trim(), phone4: m[2] };
  m = s.match(/^(.+?)[\s\/\-_,·|]+(\d{4})\s*$/);
  if (m) return { name: m[1].trim(), phone4: m[2] };
  m = s.match(/^(.+?)(\d{4})\s*$/);
  if (m && m[1].trim().length > 0) return { name: m[1].trim(), phone4: m[2] };
  return { name: s, phone4: null };
}

app.get('/api/public/my-order', async (req, res) => {
  const q = (req.query.q || '').trim();
  const today = /^\d{4}-\d{2}-\d{2}$/.test(req.query.today || '') ? req.query.today : null;
  if (!q) return res.json({ results: [] });
  if (!today) return res.status(400).json({ error: 'today required (YYYY-MM-DD)' });

  try {
    // 회원명단으로 옛 닉네임/번호까지 매칭
    const { data: memberRows, error: memberErr } = await supabase
      .from(TABLE).select('value').eq('key', 'members').maybeSingle();
    if (memberErr) throw memberErr;
    const members = memberRows ? JSON.parse(memberRows.value) : [];
    const matchedMembers = members.filter(m => {
      const targets = [m.name].concat(m.aliases || []);
      if (m.phone4) targets.push(m.phone4);
      return targets.some(t => fuzzyMatchText(t, q));
    });

    // 검색 범위: 오늘 ~ +7일 (UTC 기준 계산으로 서버 시간대 영향 없이 안전하게)
    const dates = [];
    for (let i = 0; i <= 7; i++) {
      const d = new Date(today + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }
    const orderKeys = dates.map(d => 'orders:' + d);
    const { data: orderRows, error: orderErr } = await supabase
      .from(TABLE).select('key, value').in('key', orderKeys);
    if (orderErr) throw orderErr;

    const results = [];
    (orderRows || []).forEach(row => {
      const date = row.key.replace('orders:', '');
      let list = [];
      try { list = JSON.parse(row.value); } catch (e) { list = []; }
      list.forEach(o => {
        const parsed = parseNameLine(o.name) || { name: o.name, phone4: null };
        // 이름 부분(번호 제외)에 대한 매칭 + 검색어가 번호 4자리와 정확히 같을 때만 번호로도 인정
        // (원문 전체에 대해 "포함되는지"로 검사하면, 상관없는 사람의 번호가 우연히 같아서 섞여 나올 수 있음)
        const nameMatch = fuzzyMatchText(parsed.name, q);
        const exactPhoneMatch = !!(parsed.phone4 && parsed.phone4 === q);

        // 이름(또는 이전 이름)이 일치하는 회원만 인정 — 번호 뒷자리가 겹치는 건 흔해서
        // 이름이 다르면 절대 같은 사람으로 보지 않음 (동명이인은 번호가 다르면 제외)
        const matchedMember = matchedMembers.find(m => {
          const nameMatches = normName(m.name) === normName(parsed.name) ||
            (m.aliases || []).some(a => normName(a) === normName(parsed.name));
          if (!nameMatches) return false;
          if (m.phone4 && parsed.phone4 && m.phone4 !== parsed.phone4) return false;
          return true;
        });

        if (!nameMatch && !exactPhoneMatch && !matchedMember) return;

        const displayNm = matchedMember ? matchedMember.name : o.name;

        Object.entries(o.items || {}).forEach(([product, it]) => {
          const status = it.status || (it.picked ? 'picked' : (it.cancelled ? 'cancelled' : 'none'));
          if (status === 'cancelled') return;
          results.push({
            date, name: displayNm, phone4: parsed.phone4 || null, product, qty: it.qty, status,
            postponedTo: it.postponedTo || null,
            fromPostpone: it.fromPostpone || null,
            comments: o.comments || []
          });
        });
      });
    });

    results.sort((a, b) => a.date.localeCompare(b.date));
    res.json({ results });
  } catch (e) {
    console.error('my-order 검색 실패:', e.message);
    res.status(500).json({ error: 'server error' });
  }
});

// 고객용 "내 주문 확인" 전용 페이지 (로그인 없이 바로 접속)
app.get('/my-order', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'my-order.html'));
});

// 매장 태블릿/모니터용 화면 (로그인 없이 바로 접속)
app.get('/board', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'board.html'));
});

// 전체 백업 조회 (관리용, 로그인 필요)
app.get('/api/backup', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from(TABLE).select('key, value');
    if (error) throw error;
    const out = {};
    (data || []).forEach(row => { out[row.key] = row.value; });
    res.json(out);
  } catch (e) {
    console.error('backup 실패:', e.message);
    res.status(500).json({ error: 'server error' });
  }
});

// 전체 저장소 일괄 복원 (관리용, 로그인 필요)
app.put('/api/restore', requireAuth, async (req, res) => {
  const incoming = req.body || {};
  if (typeof incoming !== 'object' || Array.isArray(incoming)) {
    return res.status(400).json({ error: 'invalid backup format' });
  }
  try {
    const rows = Object.entries(incoming).map(([key, value]) => ({ key, value }));
    const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'key' });
    if (error) throw error;
    res.json({ ok: true, keys: rows.length });
  } catch (e) {
    console.error('restore 실패:', e.message);
    res.status(500).json({ error: 'server error' });
  }
});

app.listen(PORT, () => {
  console.log(`봉주르후르츠 픽업 서버 실행 중 (Supabase): http://localhost:${PORT}`);
});
