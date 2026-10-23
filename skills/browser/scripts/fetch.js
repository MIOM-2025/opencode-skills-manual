#!/usr/bin/env node
'use strict';

/*
 * Generic background web fetcher.
 * No browser window, no app, no npm dependencies.
 *
 * Usage:
 *   node fetch.js https://example.com
 *   node fetch.js https://example.com --mobile --json
 *   node fetch.js https://example.com --cookie cookies.txt --out page.html
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CACHE = process.env.BROWSER_CACHE || path.join(os.homedir(), '.cache/opencode/browser');
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

function parseArgs(argv) {
  const args = [];
  const opts = { headers: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mobile') opts.mobile = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--raw') opts.raw = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--cookie') opts.cookie = argv[++i];
    else if (a === '--max-chars') opts.maxChars = Number(argv[++i]);
    else if (a === '--header') opts.headers.push(argv[++i]);
    else if (a.startsWith('--')) throw new Error(`unknown option: ${a}`);
    else args.push(a);
  }
  return { args, opts };
}

function parseCookieFile(file) {
  if (!file) return '';
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const cookies = [];
  for (const raw of lines) {
    if (!raw || raw.startsWith('# ')) continue;
    const line = raw.startsWith('#HttpOnly_') ? raw.slice('#HttpOnly_'.length) : raw;
    if (line.startsWith('#')) continue;
    if (line.includes('\t')) {
      const p = line.split('\t');
      if (p.length >= 7) cookies.push(`${p[5]}=${p[6]}`);
    } else if (line.includes('=')) {
      cookies.push(line.trim());
    }
  }
  return cookies.join('; ');
}

function decodeEntities(s) {
  const named = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    hellip: '…', mdash: '—', ndash: '–', copy: '©', reg: '®'
  };
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, body) => {
    if (body[0] === '#') {
      const n = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return named[body.toLowerCase()] ?? m;
  });
}

function stripHtml(html) {
  return decodeEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

function extractTitle(html) {
  const m = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() : '';
}

function extractDescription(html) {
  const m = html.match(/<meta\b[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
    || html.match(/<meta\b[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)
    || html.match(/<meta\b[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i);
  return m ? decodeEntities(m[1]).trim() : '';
}

function extractLinks(html, base) {
  const out = [];
  const seen = new Set();
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < 80) {
    const href = m[1].trim();
    if (!href || href.startsWith('#') || /^(javascript|mailto|tel):/i.test(href)) continue;
    let url;
    try { url = new URL(href, base).href; } catch { continue; }
    if (seen.has(url)) continue;
    seen.add(url);
    const text = decodeEntities(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    out.push({ text: text || '(no text)', url });
  }
  return out;
}

async function main() {
  const { args, opts } = parseArgs(process.argv.slice(2));
  if (opts.help || !args[0]) {
    console.log(`web fetch — background HTTP reader

Usage:
  node fetch.js <url> [options]

Options:
  --mobile            use Android Chrome mobile UA
  --cookie <file>     Netscape or name=value cookie file
  --out <file>        save raw response body
  --json              print JSON (default for HTML)
  --raw               print raw body
  --max-chars <n>     text preview length (default 12000)
  --header "K: V"     extra request header (repeatable)

Default: Windows Chrome desktop UA, follows redirects, does not execute JavaScript.
`);
    return;
  }

  const url = args[0];
  if (!/^https?:\/\//i.test(url)) throw new Error('URL must start with http:// or https://');
  fs.mkdirSync(CACHE, { recursive: true });

  const headers = {
    'User-Agent': opts.mobile ? MOBILE_UA : DESKTOP_UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    ...Object.fromEntries(opts.headers.map(h => {
      const i = h.indexOf(':');
      return i === -1 ? [h, ''] : [h.slice(0, i).trim(), h.slice(i + 1).trim()];
    }))
  };
  const cookie = parseCookieFile(opts.cookie);
  if (cookie) headers.Cookie = cookie;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  let res;
  try {
    res = await fetch(url, { headers, redirect: 'follow', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || '';
  const out = opts.out || path.join(CACHE, 'last-response.bin');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buf);

  if (opts.raw) {
    process.stdout.write(buf.toString('utf8'));
    return;
  }

  const charset = /charset=([^;]+)/i.exec(contentType)?.[1]?.trim().toLowerCase();
  let body = buf.toString('utf8');
  if (charset && charset !== 'utf-8' && charset !== 'utf8') {
    try { body = new TextDecoder(charset).decode(buf); } catch {}
  }

  const isHtml = /html/i.test(contentType) || /<html[\s>]/i.test(body.slice(0, 500));
  const maxChars = Number.isFinite(opts.maxChars) ? opts.maxChars : 12000;
  const result = {
    requestedUrl: url,
    finalUrl: res.url,
    status: res.status,
    contentType,
    title: isHtml ? extractTitle(body) : '',
    description: isHtml ? extractDescription(body) : '',
    text: isHtml ? stripHtml(body).slice(0, maxChars) : body.slice(0, maxChars),
    links: isHtml ? extractLinks(body, res.url) : [],
    savedTo: out
  };
  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error(err.message || String(err));
  process.exitCode = 1;
});
