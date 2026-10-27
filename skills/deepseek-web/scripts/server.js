#!/usr/bin/env node
'use strict';
/**
 * DeepSeek 网页版 → 本地 OpenAI 兼容代理
 * 纯 Node 实现，零第三方依赖（PoW 用官方 wasm 直接跑）。
 *
 *   node server.js            启动 127.0.0.1:8899
 *   node server.js login      只做登录并把 token 存下来
 *   node server.js status     看看当前 token 是否有效
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE = 'https://chat.deepseek.com';
const HOME = process.env.HOME || '$HOME';
const CONF_DIR = path.join(HOME, '.config', 'deepseek-web');
const CONF_PATH = path.join(CONF_DIR, 'config.json');
const STATE_PATH = path.join(CONF_DIR, 'state.json');
const PORT = Number(process.env.PORT || 8899);

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const DEFAULT_CONF = {
  account: '',          // 手机号或邮箱
  password: '',         // 密码
  area_code: '+86',
  os: 'android',        // web 会额外要求校验，android 免验证码
  api_key: 'sk-deepseek-web',
  thinking: false,      // 默认是否开思考
  search: false,
};

/* ────────────────────────── 配置 / 状态 ────────────────────────── */

function loadJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function saveJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  try { fs.chmodSync(tmp, 0o600); } catch {}
  fs.renameSync(tmp, p);
}
function conf() {
  const c = { ...DEFAULT_CONF, ...loadJson(CONF_PATH, {}) };
  if (process.env.DS_ACCOUNT) c.account = process.env.DS_ACCOUNT;
  if (process.env.DS_PASSWORD) c.password = process.env.DS_PASSWORD;
  return c;
}
function state() {
  return loadJson(STATE_PATH, {});
}
function genDeviceId() {
  return String(Math.floor(Math.random() * 9e18 + 1e18)).slice(0, 19);
}

/* ────────────────────────── HTTP 基础 ────────────────────────── */

let cookieJar = '';   // "a=1; b=2"

function absorbCookies(res) {
  const list = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  if (!list.length) return;
  const jar = new Map();
  for (const kv of cookieJar.split(';')) {
    const s = kv.trim();
    if (!s.includes('=')) continue;
    const i = s.indexOf('=');
    jar.set(s.slice(0, i), s.slice(i + 1));
  }
  for (const raw of list) {
    const first = raw.split(';')[0].trim();
    if (!first.includes('=')) continue;
    const i = first.indexOf('=');
    jar.set(first.slice(0, i), first.slice(i + 1));
  }
  cookieJar = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function baseHeaders(token, extra = {}) {
  const h = {
    'User-Agent': UA,
    Accept: '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'Content-Type': 'application/json',
    Origin: BASE,
    Referer: BASE + '/',
    'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'X-Client-Version': '2.3.0',
    'X-Client-Platform': 'web',
    'X-Client-Locale': 'zh_CN',
    'X-Client-Timezone-Offset': '28800',
    'x-client-bundle-id': 'com.deepseek.chat',
  };
  if (token) h.Authorization = 'Bearer ' + token;
  if (cookieJar) h.Cookie = cookieJar;
  return { ...h, ...extra };
}

async function dsPost(urlPath, body, { token, headers } = {}) {
  const res = await fetch(BASE + urlPath, {
    method: 'POST',
    headers: baseHeaders(token, headers),
    body: JSON.stringify(body),
  });
  absorbCookies(res);
  return res;
}
async function dsGet(urlPath, { token } = {}) {
  const res = await fetch(BASE + urlPath, { headers: baseHeaders(token) });
  absorbCookies(res);
  return res;
}

/* ────────────────────────── 登录 ────────────────────────── */

function findToken(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 6) return null;
  if (typeof obj.token === 'string' && obj.token.length > 20) return obj.token;
  for (const v of Object.values(obj)) {
    const t = findToken(v, depth + 1);
    if (t) return t;
  }
  return null;
}

async function login() {
  const c = conf();
  if (!c.account || !c.password) {
    throw new Error('还没配置账号密码：' + CONF_PATH);
  }
  const isEmail = c.account.includes('@');
  const deviceId = state().device_id || genDeviceId();
  // 与网页端一致的字段形态（空串也要给）
  const body = {
    email: isEmail ? c.account.trim() : '',
    mobile: isEmail ? '' : c.account.replace(/\D/g, ''),
    area_code: isEmail ? '' : c.area_code || '+86',
    password: c.password,
    device_id: deviceId,
    os: c.os || 'android',
  };

  const res = await dsPost('/api/v0/users/login', body);
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  if (!data) throw new Error('登录返回非 JSON: ' + text.slice(0, 200));

  const biz = data.data || {};
  if (data.code !== 0 || (biz.biz_code && biz.biz_code !== 0)) {
    throw new Error(`登录失败 biz_code=${biz.biz_code} ${biz.biz_msg || data.msg || ''}`);
  }
  const token = findToken(biz);
  if (!token) throw new Error('登录成功但没拿到 token: ' + JSON.stringify(biz).slice(0, 300));

  const st = {
    device_id: deviceId,
    token,
    cookies: cookieJar,
    account: c.account,
    saved_at: Date.now(),
  };
  saveJson(STATE_PATH, st);
  return st;
}

let cachedToken = null;
let lastStateAt = 0;

function syncState() {
  const st = state();
  if (st.saved_at && st.saved_at !== lastStateAt) {
    lastStateAt = st.saved_at;
    cookieJar = st.cookies || '';
    cachedToken = st.token || null;
  }
  return st;
}

async function ensureToken(force = false) {
  const st = syncState();
  if (!force && cachedToken) return cachedToken;
  if (st.token && !force) {
    const ok = await verify(st.token);
    if (ok) { cachedToken = st.token; return st.token; }
  }
  let fresh;
  try {
    fresh = await login();
  } catch (e) {
    const err = new Error('DeepSeek 登录态已失效，需要重新短信登录：~/dslogin/run.sh start，然后手机浏览器打开 http://127.0.0.1:8890/');
    err.status = 401;
    err.cause = e;
    throw err;
  }
  cachedToken = fresh.token;
  return cachedToken;
}

async function verify(token) {
  try {
    const res = await dsGet('/api/v0/users/current', { token });
    const data = await res.json();
    return data && data.code === 0;
  } catch {
    return false;
  }
}

/* ────────────────────────── 登录态守护 ────────────────────────── */

const HEALTH_PATH = path.join(CONF_DIR, 'health.json');
let healthState = loadJson(HEALTH_PATH, {
  last_check: 0,
  valid: null,
  last_refresh: 0,
  last_harvest: 0,
  needs_login: false,
  last_error: null,
});
let lastGuardNotify = 0;

function saveHealth(patch) {
  healthState = { ...healthState, ...patch };
  saveJson(HEALTH_PATH, healthState);
}

function notifyLoginNeeded(reason) {
  const now = Date.now();
  if (now - lastGuardNotify < 30 * 60 * 1000) return;
  lastGuardNotify = now;
  try {
    const { execFile } = require('child_process');
    execFile('termux-notification', [
      '--title', 'DeepSeek 登录已失效',
      '--content', `需要重新登录：http://127.0.0.1:8890/（${reason}）`,
      '--priority', 'high',
    ], () => {});
  } catch {}
}

async function tryBrowserRefresh() {
  let browser;
  try {
    browser = require('./browser');
  } catch (e) {
    return { ok: false, reason: '浏览器模块不可用' };
  }
  const got = await browser.harvestToken();
  if (!got || !got.token) return { ok: false, reason: '浏览器 profile 里没有 token' };
  if (got.token === state().token) return { ok: false, reason: '浏览器里的 token 与已保存的一样，已失效' };
  const ok = await verify(got.token);
  if (!ok) return { ok: false, reason: '浏览器里的 token 也已失效' };
  const st = state();
  st.token = got.token;
  st.cookies = got.cookies || st.cookies;
  st.account = st.account || 'web-login';
  st.saved_at = Date.now();
  saveJson(STATE_PATH, st);
  cachedToken = got.token;
  console.log('[guard] 已从浏览器 profile 刷新 token');
  return { ok: true };
}

async function guardOnce() {
  const st = state();
  if (!st.token) {
    saveHealth({ last_check: Date.now(), valid: false, needs_login: true, last_error: '没有 token' });
    return healthState;
  }
  const ok = await verify(st.token);
  if (ok) {
    saveHealth({
      last_check: Date.now(),
      valid: true,
      needs_login: false,
      last_refresh: healthState.last_refresh || Date.now(),
      last_error: null,
    });
    return healthState;
  }

  saveHealth({ last_check: Date.now(), valid: false });
  const harvestCooldown = 30 * 60 * 1000;
  if (!healthState.last_harvest || Date.now() - healthState.last_harvest > harvestCooldown) {
    saveHealth({ last_harvest: Date.now() });
    try {
      const r = await tryBrowserRefresh();
      if (r.ok) {
        saveHealth({ last_refresh: Date.now(), valid: true, needs_login: false, last_error: null });
        return healthState;
      }
      saveHealth({ needs_login: true, last_error: r.reason });
      notifyLoginNeeded(r.reason);
    } catch (e) {
      saveHealth({ needs_login: true, last_error: String(e.message || e) });
      notifyLoginNeeded('浏览器刷新失败');
    }
  } else {
    saveHealth({ needs_login: true });
  }
  return healthState;
}

const GUARD_MS = Number(process.env.DS_GUARD_MS || 10 * 60 * 1000);
let guardRunning = false;
function startGuardian() {
  const run = async () => {
    if (guardRunning) return;
    guardRunning = true;
    try {
      await guardOnce();
    } catch (e) {
      console.error('[guard]', e.message);
    } finally {
      guardRunning = false;
    }
  };
  setTimeout(run, 3000);
  const timer = setInterval(run, GUARD_MS);
  if (timer.unref) timer.unref();
}

/* ────────────────────────── PoW (官方 wasm) ────────────────────────── */

const inst = new WebAssembly.Instance(
  new WebAssembly.Module(fs.readFileSync(path.join(__dirname, 'sha3_wasm_bg.wasm'))),
  {}
);
const ex = inst.exports;
const malloc = (n) => ex.__wbindgen_export_0(n, 1);
const wfree = (p, n) => { try { ex.__wbindgen_export_2(p, n, 1); } catch {} };

function encStr(s) {
  const d = Buffer.from(s, 'utf8');
  const p = malloc(d.length);
  new Uint8Array(ex.memory.buffer).set(d, p);
  return [p, d.length];
}

/** 返回 nonce（整数），失败抛错 */
function powSolve(challenge, salt, expireAt, difficulty) {
  const sp = ex.__wbindgen_add_to_stack_pointer(-16);
  const [cp, cl] = encStr(challenge);
  const [pp, pl] = encStr(`${salt}_${expireAt}_`);
  try {
    ex.wasm_solve(sp, cp, cl, pp, pl, difficulty);
    const dv = new DataView(ex.memory.buffer);
    const ok = dv.getInt32(sp, true);
    const ans = dv.getFloat64(sp + 8, true);
    if (!ok) throw new Error('PoW 没解出来（difficulty=' + difficulty + '）');
    return Math.trunc(ans);
  } finally {
    ex.__wbindgen_add_to_stack_pointer(16);
    wfree(cp, cl);
    wfree(pp, pl);
  }
}

async function powHeaders(token, targetPath = '/api/v0/chat/completion') {
  const res = await dsPost('/api/v0/chat/create_pow_challenge', { target_path: targetPath }, { token });
  const data = await res.json();
  if (!data || data.code !== 0) {
    const err = new Error('取 PoW 挑战失败: ' + JSON.stringify(data).slice(0, 200));
    err.code = data && data.code;
    throw err;
  }
  const c = data.data.biz_data.challenge;
  const answer = powSolve(c.challenge, c.salt, c.expire_at, c.difficulty);
  const payload = JSON.stringify({
    algorithm: 'DeepSeekHashV1',
    challenge: c.challenge,
    salt: c.salt,
    answer,
    signature: c.signature,
    target_path: c.target_path,
  });
  return Buffer.from(payload, 'utf8').toString('base64');
}

/* ────────────────────────── 会话 / 对话 ────────────────────────── */

async function createSession(token) {
  const pow = await powHeaders(token, '/api/v0/chat/completion');
  const res = await dsPost(
    '/api/v0/chat_session/create',
    { target_path: '/api/v0/chat/completion' },
    { token, headers: { 'X-DS-PoW-Response': pow } }
  );
  const data = await res.json();
  if (!data || data.code !== 0) throw new Error('建会话失败: ' + JSON.stringify(data).slice(0, 200));
  const biz = data.data.biz_data;
  return biz.id || (biz.chat_session && biz.chat_session.id);
}

/* ── 会话复用：尽量在同一个 chat_session 里说话，不每请求都新建 ── */

const SESSION_PATH = path.join(CONF_DIR, 'session.json');
let sessionCache = null;

function readSessionFile() {
  const s = loadJson(SESSION_PATH, null);
  return s && s.token && s.id ? s : null;
}

async function getSession(token) {
  if (sessionCache && sessionCache.token === token) return sessionCache.id;
  const saved = readSessionFile();
  if (saved && saved.token === token) {
    sessionCache = saved;
    return saved.id;
  }
  const id = await createSession(token);
  sessionCache = { token, id, created_at: Date.now() };
  saveJson(SESSION_PATH, sessionCache);
  console.log('[session] 新建会话', id);
  return id;
}

function dropSession() {
  if (sessionCache) console.log('[session] 丢弃会话', sessionCache.id);
  sessionCache = null;
  try { fs.unlinkSync(SESSION_PATH); } catch {}
}

function isSessionError(text) {
  return /会话|session|context|上下文|消息不存在|message not found/i.test(String(text || ''));
}

/**
 * 发一条消息，边收边通过 onDelta 回调吐出。
 * onDelta({type:'content'|'thinking', text}) / onDelta({type:'error', text})
 */
async function complete(token, sessionId, prompt, opts, onDelta, send) {
  const pow = await powHeaders(token, '/api/v0/chat/completion');
  const body = {
    chat_session_id: sessionId,
    parent_message_id: null,
    model_type: opts.model_type || null,
    prompt,
    ref_file_ids: [],
    stream: true,
    thinking_enabled: !!opts.thinking,
    search_enabled: !!opts.search,
    preempt: false,
  };
  const res = send
    ? await send(body, { 'X-DS-PoW-Response': pow, Accept: 'text/event-stream' })
    : await dsPost('/api/v0/chat/completion', body, {
        token,
        headers: { 'X-DS-PoW-Response': pow, Accept: 'text/event-stream' },
      });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`上游 HTTP ${res.status}: ${t.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const dump = process.env.DUMP_SSE ? require('fs').createWriteStream(path.join(HOME, '.cache', 'sse.log'), { flags: 'a' }) : null;
  let fragType = 'content';
  let finished = false;

  const handle = (event, data) => {
    if (typeof data !== 'object' || data === null) return;
    const p = data.p, o = data.o, v = data.v;

    if (event === 'hint' && String(data.type).toLowerCase() === 'error') {
      onDelta({ type: 'error', text: data.content || data.msg || 'upstream hint error' });
      return;
    }
    if (event === 'toast' && String(data.type).toLowerCase() === 'error') {
      onDelta({ type: 'error', text: data.content || data.msg || 'upstream toast error' });
      return;
    }
    if (event === 'close') { finished = true; return; }

    // 专家模式：整段 response 带 fragments
    if (v && typeof v === 'object' && !Array.isArray(v) && v.response) {
      const frs = v.response.fragments || [];
      for (const f of frs) {
        if (f.type) fragType = f.type === 'THINK' ? 'thinking' : 'content';
        if (f.content) onDelta({ type: fragType, text: f.content });
      }
      return;
    }
    if (p === 'response/fragments' && o === 'APPEND' && Array.isArray(v) && v.length) {
      const f = v[0];
      if (f.type) fragType = f.type === 'THINK' ? 'thinking' : 'content';
      if (f.content) onDelta({ type: fragType, text: f.content });
      return;
    }
    if (p === 'response/fragments/-1/content') {
      if (typeof v === 'string' && v) onDelta({ type: fragType, text: v });
      return;
    }
    if (p === 'response/content') {
      if (typeof v === 'string' && v) onDelta({ type: 'content', text: v });
      return;
    }
    // 没有 p 字段的增量：续上一段（DeepSeek 的 SSE 会省略 p 表示沿用上一个路径）
    if (!p && typeof v === 'string' && v) {
      const t = fragType === 'thinking' ? 'thinking' : 'content';
      onDelta({ type: t, text: v });
      return;
    }
  };

  while (!finished) {
    const { value, done } = await reader.read();
    if (done) break;
    const piece = dec.decode(value, { stream: true });
    if (dump) dump.write(piece);
    buf += piece;
    const lines = buf.split('\n');
    buf = lines.pop();
    let evName = '';
    for (const line of lines) {
      if (line.startsWith('event:')) {
        evName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        const raw = line.slice(5).trim();
        if (!raw) continue;
        let data;
        try { data = JSON.parse(raw); } catch { continue; }
        handle(evName, data);
        evName = '';
      }
    }
  }
  try { await reader.cancel(); } catch {}
}

/* ────────────────────────── prompt 拼装 ────────────────────────── */

function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === 'string' ? c : c && c.type === 'text' ? c.text : ''))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

const TOOL_MARK = '《TOOL》';
const TOOL_END = '《/TOOL》';
const MARKERS = [TOOL_MARK, '```tool_call', '<tool_calls>'];
const ENDERS = { '《TOOL》': TOOL_END, '```tool_call': '```', '<tool_calls>': '</tool_calls>' };

function typeOf(v) {
  if (!v) return 'any';
  if (v.enum) return v.enum.map((x) => JSON.stringify(x)).join('|');
  if (v.type === 'array') return `array<${typeOf(v.items)}>`;
  if (v.type === 'object' && v.properties) return compactSchema(v);
  return v.type || 'any';
}

/* 只保留「参数名: 类型」，不再把整份 JSON Schema 塞进提示词 */
function compactSchema(params) {
  if (!params || typeof params !== 'object' || !params.properties) return '';
  const req = new Set(params.required || []);
  const inner = Object.entries(params.properties)
    .map(([k, v]) => `${k}${req.has(k) ? '' : '?'}: ${typeOf(v)}`)
    .join(', ');
  return `(${inner})`;
}

function toolsPreamble(tools) {
  const lines = tools.map((t) => {
    const f = t.function || t;
    const desc = String(f.description || '').replace(/\s+/g, ' ').slice(0, 60);
    return `- ${f.name}${compactSchema(f.parameters)}${desc ? ' — ' + desc : ''}`;
  });
  return [
    '【工具调用】',
    '需要调用工具时，只输出一个工具调用块，不要加解释，也不要包代码块：',
    TOOL_MARK + '{"name":"工具名","arguments":{...}}' + TOOL_END,
    '（也支持 DSML：<|DSML|tool_calls><|DSML|invoke name="工具名"><|DSML|parameter name="参数" string="true">值</|DSML|parameter></|DSML|invoke></|DSML|tool_calls>）',
    '规则：一次只调用一个工具；arguments 必须是合法 JSON；工具结果会以【工具返回】给出，不要自己编造。',
    '不需要工具时正常回答，不要出现任何工具标记。',
    '',
    '可用工具：',
    ...lines,
  ].join('\n');
}

function buildPrompt(messages, tools) {
  const msgs = (messages || []).filter(Boolean);
  const toolText = tools && tools.length ? toolsPreamble(tools) : '';
  const sysBits = msgs
    .filter((m) => m.role === 'system')
    .map((m) => textOf(m.content))
    .filter(Boolean);
  if (toolText) sysBits.push(toolText);

  const parts = [];
  if (sysBits.length) parts.push(`【系统设定，必须遵守】\n${sysBits.join('\n\n')}`);

  for (const m of msgs) {
    if (m.role === 'system') continue;
    if (m.role === 'tool') {
      const t = textOf(m.content);
      const name = m.name || m.tool_call_id || 'tool';
      parts.push(`【工具返回 ${name}】\n${t}`);
      continue;
    }
    if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length) {
      const t = textOf(m.content);
      if (t) parts.push(`【你之前的回复】\n${t}`);
      for (const c of m.tool_calls) {
        const f = c.function || {};
        parts.push(`【你已经发起了工具调用】${f.name}(${f.arguments || ''})`);
      }
      continue;
    }
    const t = textOf(m.content);
    if (!t) continue;
    if (m.role === 'assistant') parts.push(`【你之前的回复】\n${t}`);
    else parts.push(t);
  }
  return parts.join('\n\n');
}

/* 解析 JSON 形式的工具块 */
function parseCalls(payload) {
  let obj;
  try { obj = JSON.parse(payload); } catch { return []; }
  const arr = Array.isArray(obj) ? obj : obj.tool_calls ? obj.tool_calls : [obj];
  const out = [];
  for (const item of arr) {
    const f = item.function || item;
    const name = f.name || f.tool || f.tool_name;
    if (!name) continue;
    let args = f.arguments ?? f.parameters ?? f.args ?? {};
    if (typeof args === 'string') {
      try { args = JSON.parse(args); } catch { /* 原样留着 */ }
    }
    out.push({ name: String(name), args: typeof args === 'string' ? args : JSON.stringify(args) });
  }
  return out;
}

/* 解析 DeepSeek 原生 DSML 格式（模型自己爱用这个） */
function parseDsml(payload) {
  const calls = [];
  const invRe = /<[^>]*DSML[^>]*?invoke\s+name\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/[^>]*DSML[^>]*?invoke\s*>/gi;
  for (const m of payload.matchAll(invRe)) {
    const name = m[1];
    const body = m[2];
    const args = {};
    const pRe = /<[^>]*DSML[^>]*?parameter\s+name\s*=\s*"([^"]+)"([^>]*)>([\s\S]*?)<\/[^>]*DSML[^>]*?parameter\s*>/gi;
    for (const pm of body.matchAll(pRe)) {
      const key = pm[1];
      const attrs = pm[2] || '';
      let val = (pm[3] || '').trim();
      const cd = val.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
      if (cd) val = cd[1];
      if (/string\s*=\s*"true"/i.test(attrs)) args[key] = val;
      else { try { args[key] = JSON.parse(val); } catch { args[key] = val; } }
    }
    calls.push({ name, args: JSON.stringify(args) });
  }
  return calls;
}

const DSML_START_RE = /<[|｜]*\s*DSML\s*[|｜]*\s*(?:tool_?)?calls\s*>/i;
const DSML_END_RE = /<\/\s*[|｜]*\s*DSML\s*[|｜]*\s*(?:tool_?)?calls\s*>/i;

const START_STRINGS = ['《TOOL》', '```tool_call', '<tool_calls>'];

/* 缓冲区末尾有多少字符可能是「半个开始标记」，必须先扣住不能发 */
function holdLen(buf) {
  let hold = 0;
  for (const m of START_STRINGS) {
    for (let k = Math.min(m.length - 1, buf.length); k > 0; k--) {
      if (buf.endsWith(m.slice(0, k))) { if (k > hold) hold = k; break; }
    }
  }
  // 正在拼一个还没闭合的标签（DSML 的 <|DSML|tool_calls> 等）
  const lt = buf.lastIndexOf('<');
  if (lt >= 0 && buf.indexOf('>', lt) < 0) {
    const seg = buf.slice(lt);
    if (seg.length <= 60 && /^<[A-Za-z0-9_|｜\s"'=./-]*$/.test(seg) && seg.length > hold) hold = seg.length;
  }
  return hold;
}

/* 流式筛子：把正文和工具块分开 */
class Sieve {
  constructor(emit) {
    this.buf = '';
    this.emit = emit;
    this.maxMarker = Math.max(...MARKERS.map((m) => m.length)) - 1;
  }
  push(text) { this.buf += text; this.drain(false); }
  end() { this.drain(true); }

  drain(final) {
    for (;;) {
      // 1) 先找普通标记
      let best = -1;
      let mk = null;
      for (const m of MARKERS) {
        const i = this.buf.indexOf(m);
        if (i >= 0 && (best < 0 || i < best)) { best = i; mk = m; }
      }
      // 2) 再找 DSML 开始标记
      const dm = this.buf.match(DSML_START_RE);
      const dsmlPos = dm ? dm.index : -1;
      if (dsmlPos >= 0 && (best < 0 || dsmlPos < best)) {
        if (dsmlPos > 0) { this.emit({ type: 'content', text: this.buf.slice(0, dsmlPos) }); this.buf = this.buf.slice(dsmlPos); }
        const tail = this.buf.slice(dm[0].length);
        const em = tail.match(DSML_END_RE);
        if (!em) {
          if (final || this.buf.length > 40000) {
            this.emit({ type: 'content', text: this.buf });
            this.buf = '';
            continue;
          }
          return;
        }
        const body = tail.slice(0, em.index);
        this.buf = tail.slice(em.index + em[0].length);
        const calls = parseDsml(body);
        if (calls.length) for (const c of calls) this.emit({ type: 'tool', call: c });
        else this.emit({ type: 'content', text: body });
        continue;
      }

      if (best < 0) {
        // 没有开始标记：扣住可能是「半个标记」的尾巴
        const hold = Math.max(this.maxMarker, holdLen(this.buf));
        const keep = Math.max(0, this.buf.length - hold);
        if (keep > 0) { this.emit({ type: 'content', text: this.buf.slice(0, keep) }); this.buf = this.buf.slice(keep); }
        if (final && this.buf) { this.emit({ type: 'content', text: this.buf }); this.buf = ''; }
        return;
      }

      if (best > 0) { this.emit({ type: 'content', text: this.buf.slice(0, best) }); this.buf = this.buf.slice(best); }
      const ender = ENDERS[mk];
      const e = this.buf.indexOf(ender, mk.length);
      if (e < 0) {
        if (final || this.buf.length > 40000) {
          this.emit({ type: 'content', text: this.buf });
          this.buf = '';
          continue;
        }
        return;
      }
      const payload = this.buf.slice(mk.length, e).trim();
      this.buf = this.buf.slice(e + ender.length);
      const calls = parseCalls(payload);
      if (calls.length) for (const c of calls) this.emit({ type: 'tool', call: c });
      else this.emit({ type: 'content', text: payload });
    }
  }
}

/* 非流式：从整段文本里抠出工具调用，并把工具块从正文里删掉 */
function extractToolCalls(text) {
  const calls = [];
  for (const m of MARKERS) {
    const e = ENDERS[m];
    let i = 0;
    for (;;) {
      const a = text.indexOf(m, i);
      if (a < 0) break;
      const b = text.indexOf(e, a + m.length);
      if (b < 0) break;
      calls.push(...parseCalls(text.slice(a + m.length, b).trim()));
      i = b + e.length;
    }
  }
  // DSML
  let work = text;
  for (;;) {
    const sm = work.match(DSML_START_RE);
    if (!sm) break;
    const tail = work.slice(sm.index + sm[0].length);
    const em = tail.match(DSML_END_RE);
    if (!em) break;
    calls.push(...parseDsml(tail.slice(0, em.index)));
    work = work.slice(0, sm.index) + tail.slice(em.index + em[0].length);
  }
  return calls;
}

function stripToolBlocks(text) {
  let out = text;
  for (const m of MARKERS) {
    const e = ENDERS[m];
    for (;;) {
      const i = out.indexOf(m);
      if (i < 0) break;
      const j = out.indexOf(e, i + m.length);
      if (j < 0) { out = out.slice(0, i) + out.slice(i + m.length); break; }
      out = out.slice(0, i) + out.slice(j + e.length);
    }
  }
  for (;;) {
    const sm = out.match(DSML_START_RE);
    if (!sm) break;
    const tail = out.slice(sm.index + sm[0].length);
    const em = tail.match(DSML_END_RE);
    if (!em) { out = out.slice(0, sm.index) + '\n'; break; }
    out = out.slice(0, sm.index) + tail.slice(em.index + em[0].length);
  }
  return out.trim();
}

/* ────────────────────────── OpenAI 接口 ────────────────────────── */

function sse(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}
function json(res, code, obj) {
  const b = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': b.length,
  });
  res.end(b);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', (c) => {
      d += c;
      if (d.length > 20 * 1024 * 1024) { reject(new Error('body too large')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

/* 上游节流：避免高频请求触发风控 */
let lastUpstreamAt = 0;
let gateChain = Promise.resolve();
let recentStamps = [];

function gate() {
  const run = async () => {
    let now = Date.now();
    recentStamps = recentStamps.filter((t) => now - t < 60000);
    if (recentStamps.length >= 12) {
      const wait = 60000 - (now - recentStamps[0]) + 50;
      await new Promise((r) => setTimeout(r, Math.max(0, wait)));
      now = Date.now();
    }
    const gap = Date.now() - lastUpstreamAt;
    const minGap = 1500 + Math.floor(Math.random() * 1500); // 1.5–3 秒随机
    if (gap < minGap) await new Promise((r) => setTimeout(r, minGap - gap));
    lastUpstreamAt = Date.now();
    recentStamps.push(lastUpstreamAt);
  };
  const p = gateChain.then(run, run);
  gateChain = p.catch(() => {});
  return p;
}

async function handleChat(req, res, body) {
  const thinking = /reasoner|think/i.test(body.model || '') || !!conf().thinking;
  const tools = Array.isArray(body.tools) && body.tools.length ? body.tools : null;
  const prompt = buildPrompt(body.messages, tools);
  if (!prompt.trim()) return json(res, 400, { error: { message: 'empty prompt' } });

  await gate();
  let token = await ensureToken();
  let sessionId;
  try {
    sessionId = await getSession(token);
  } catch (e) {
    if (/40002|40003|Authorization|登录|需要重新/i.test(String(e.message || ''))) {
      token = await ensureToken(true);
      sessionId = await getSession(token);
    } else {
      dropSession();
      throw e;
    }
  }

  const id = 'chatcmpl-' + crypto.randomBytes(12).toString('hex');
  const created = Math.floor(Date.now() / 1000);
  let content = '';
  let reasoning = '';
  let errText = '';
  const toolCalls = [];

  function chunk(delta, finish = null) {
    return {
      id, object: 'chat.completion.chunk', created, model: body.model,
      choices: [{ index: 0, delta, finish_reason: finish }],
    };
  }

  function emitTool(call) {
    const idx = toolCalls.length;
    const callId = 'call_' + crypto.randomBytes(8).toString('hex');
    toolCalls.push({ id: callId, type: 'function', name: call.name, args: call.args });
    if (!body.stream) return;
    sse(res, chunk({
      tool_calls: [{
        index: idx, id: callId, type: 'function',
        function: { name: call.name, arguments: call.args },
      }],
    }));
  }

  const browserSend = process.env.DS_BROWSER === '1'
    ? async (reqBody, headers) => {
        const browser = require('./browser');
        const r = await browser.pageFetch('/api/v0/chat/completion', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'text/event-stream',
            authorization: 'Bearer ' + token,
            ...headers,
          },
          body: JSON.stringify(reqBody),
        }, 240000);
        return new Response(r.body, { status: r.status, headers: { 'content-type': 'text/event-stream' } });
      }
    : null;

  const sieve = new Sieve((ev) => {
    if (ev.type === 'content') {
      content += ev.text;
      if (body.stream) sse(res, chunk({ content: ev.text }));
    } else if (ev.type === 'tool') {
      emitTool(ev.call);
    }
  });

  const onDelta = (d) => {
    if (d.type === 'error') { errText = d.text; if (isSessionError(d.text)) dropSession(); return; }
    if (d.type === 'thinking') {
      reasoning += d.text;
      if (body.stream) sse(res, chunk({ reasoning: d.text }));
      return;
    }
    sieve.push(d.text);
  };

  if (body.stream) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    sse(res, chunk({ role: 'assistant' }));
    try {
      await complete(token, sessionId, prompt, { thinking, search: !!conf().search }, onDelta, browserSend);
    } catch (e) {
      errText = String(e.message || e);
      if (isSessionError(errText)) dropSession();
    }
    sieve.end();
    if (errText) {
      sse(res, { error: { message: errText, type: 'upstream_error' } });
      res.write('data: [DONE]\n\n');
      return res.end();
    }
    sse(res, chunk({}, toolCalls.length ? 'tool_calls' : 'stop'));
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  try {
    await complete(token, sessionId, prompt, { thinking, search: !!conf().search }, onDelta, browserSend);
  } catch (e) {
    errText = String(e.message || e);
    if (isSessionError(errText)) dropSession();
  }
  sieve.end();

  if (errText && !content && !toolCalls.length) {
    return json(res, 502, { error: { message: errText, type: 'upstream_error' } });
  }

  const message = { role: 'assistant', content: toolCalls.length ? (content || null) : content };
  if (reasoning) message.reasoning_content = reasoning;
  if (toolCalls.length) {
    message.tool_calls = toolCalls.map((t) => ({
      id: t.id, type: 'function', function: { name: t.name, arguments: t.args },
    }));
  }
  json(res, 200, {
    id, object: 'chat.completion', created, model: body.model,
    choices: [{ index: 0, message, finish_reason: toolCalls.length ? 'tool_calls' : 'stop' }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  try {
    if (url.pathname === '/health') {
      const st = state();
      if (!guardRunning && Date.now() - (healthState.last_check || 0) > 60000) {
        guardOnce().catch(() => {});
      }
      return json(res, 200, {
        status: 'ok',
        logged_in: !!st.token,
        token_valid: healthState.valid,
        last_check: healthState.last_check || null,
        last_refresh: healthState.last_refresh || null,
        needs_login: !!healthState.needs_login,
        last_error: healthState.last_error || null,
        account: st.account || null,
        saved_at: st.saved_at || null,
      });
    }
    if (url.pathname === '/refresh' && req.method === 'POST') {
      const h = await guardOnce();
      return json(res, 200, h);
    }
    if (url.pathname === '/v1/models') {
      return json(res, 200, {
        object: 'list',
        data: [
          { id: 'deepseek-chat', object: 'model', owned_by: 'deepseek-web' },
          { id: 'deepseek-reasoner', object: 'model', owned_by: 'deepseek-web' },
        ],
      });
    }
    if (url.pathname === '/v1/chat/completions' && req.method === 'POST') {
      const key = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (conf().api_key && key !== conf().api_key) {
        return json(res, 401, { error: { message: 'bad api key' } });
      }
      const body = await readBody(req);
      return await handleChat(req, res, body);
    }
    if (url.pathname === '/v1/messages' && req.method === 'POST') {
      return json(res, 404, { error: { message: 'only /v1/chat/completions is implemented' } });
    }
    json(res, 404, { error: 'not found' });
  } catch (e) {
    console.error('[err]', e);
    if (!res.headersSent) json(res, e.status || 500, { error: { message: String(e.message || e), type: e.status === 401 ? 'need_login' : 'server_error' } });
    else res.end();
  }
});

/* ────────────────────────── 入口 ────────────────────────── */

async function main() {
  const cmd = process.argv[2];
  if (cmd === 'login') {
    const st = await login();
    console.log('登录 OK，token 已保存:', STATE_PATH);
    console.log('账号:', st.account, ' token:', st.token.slice(0, 12) + '…');
    return;
  }
  if (cmd === 'status') {
    const st = state();
    if (!st.token) return console.log('还没登录过');
    console.log('账号:', st.account, ' 有效:', await verify(st.token));
    return;
  }
  const st = state();
  if (!st.token) {
    console.log('还没登录，收到第一个请求时再尝试登录…');
  }
  startGuardian();
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`DeepSeek 网页版代理已启动 → http://127.0.0.1:${PORT}/v1`);
  });
}

main();
