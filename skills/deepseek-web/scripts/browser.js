/**
 * 用真实 headless Chromium（持久化 profile）做登录态巡检 / 刷新。
 *
 * 思路：
 * - 复用 ~/.cache/dslogin-profile 里已登录过的浏览器 profile
 * - 需要时拉起 headless_shell，打开 chat.deepseek.com
 * - 从页面 localStorage 读 userToken（这是 web 端唯一的鉴权凭据）
 * - 顺手把 document.cookie 一起带回来
 *
 * 注意：DeepSeek 不接受「只带 cookie」的鉴权（会返回 40002 Missing Token），
 * 所以 cookie 不能凭空换出新 token；这个模块的价值是复用仍然有效的浏览器会话。
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const HOME = process.env.HOME || '$HOME';
const PROFILE = process.env.DS_PROFILE || path.join(HOME, '.cache', 'dslogin-profile');
const BIN = process.env.CHROME_BIN || '$PREFIX/bin/headless_shell';
const START_URL = 'https://chat.deepseek.com/';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

let child = null;
let proc = null;

function portFile() {
  return path.join(PROFILE, 'DevToolsActivePort');
}

function readPort() {
  try {
    const txt = fs.readFileSync(portFile(), 'utf8').trim().split('\n');
    const port = parseInt(txt[0], 10);
    return Number.isFinite(port) ? port : null;
  } catch {
    return null;
  }
}

async function cdpAlive(port) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function launch() {
  if (proc && !proc.killed) return;
  fs.mkdirSync(PROFILE, { recursive: true });
  const args = [
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=430,900',
    '--lang=zh-CN',
    `--user-agent=${UA}`,
    `--user-data-dir=${PROFILE}`,
    '--remote-debugging-port=0',
    START_URL,
  ];
  proc = spawn(BIN, args, { stdio: ['ignore', 'ignore', 'ignore'], detached: true });
  proc.unref();
}

async function ensureBrowser(timeoutMs = 25000) {
  let port = readPort();
  if (port && (await cdpAlive(port))) return port;

  await launch();
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    await new Promise((r) => setTimeout(r, 500));
    port = readPort();
    if (port && (await cdpAlive(port))) return port;
  }
  throw new Error('headless chromium 没起来');
}

async function pageTarget(port) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(5000) })).json();
  return (
    list.find((t) => t.type === 'page' && t.url.includes('chat.deepseek.com')) ||
    list.find((t) => t.type === 'page') ||
    null
  );
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.ready = new Promise((res, rej) => {
      this.ws.addEventListener('open', () => res());
      this.ws.addEventListener('error', (e) => rej(new Error('CDP WS error')));
    });
    this.ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      const p = this.pending.get(msg.id);
      if (p) { this.pending.delete(msg.id); p(msg); }
    });
  }
  async send(method, params = {}, timeoutMs = 30000) {
    await this.ready;
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method} timeout`));
      }, timeoutMs);
      this.pending.set(id, (msg) => {
        clearTimeout(timer);
        if (msg.error) reject(new Error(msg.error.message || 'CDP error'));
        else resolve(msg.result);
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { try { this.ws.close(); } catch {} }
}

async function withPage(fn, timeoutMs = 45000) {
  const port = await ensureBrowser();
  const target = await pageTarget(port);
  if (!target) throw new Error('没有可用的页面');
  const cdp = new CDP(target.webSocketDebuggerUrl);
  try {
    await cdp.send('Runtime.enable');
    const res = await cdp.send(
      'Runtime.evaluate',
      { expression: `(${fn.toString()})()`, awaitPromise: true, returnByValue: true },
      timeoutMs
    );
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text || '页面脚本异常');
    }
    return res.result?.value;
  } finally {
    cdp.close();
  }
}

/**
 * 从浏览器 profile 里取当前登录凭据。
 * @returns {Promise<{token:string, cookies:string, url:string}|null>}
 */
async function harvestToken() {
  const data = await withPage(async () => {
    const raw = localStorage.getItem('userToken');
    let token = null;
    if (raw) {
      try {
        const obj = JSON.parse(raw);
        token = obj && typeof obj.value === 'string' ? obj.value : null;
      } catch {
        token = raw;
      }
    }
    return { token, cookies: document.cookie, url: location.href, ua: navigator.userAgent };
  });
  if (!data || !data.token) return null;
  return data;
}

/**
 * 在页面里直接发同源请求（真实浏览器 TLS / 指纹 / cookie）。
 * @returns {Promise<{status:number, body:string}>}
 */
async function pageFetch(url, { method = 'GET', headers = {}, body = null } = {}, timeoutMs = 60000) {
  return withPage(async () => {
    const res = await fetch(url, {
      method,
      headers,
      body,
      credentials: 'include',
    });
    const text = await res.text();
    return { status: res.status, body: text };
  }, timeoutMs);
}

function stopBrowser() {
  try { if (proc) process.kill(-proc.pid, 'SIGTERM'); } catch {}
  try { if (proc) proc.kill('SIGTERM'); } catch {}
  proc = null;
}

module.exports = { ensureBrowser, harvestToken, pageFetch, stopBrowser, PROFILE, UA };
