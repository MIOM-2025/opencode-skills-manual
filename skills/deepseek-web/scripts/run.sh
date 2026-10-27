#!/usr/bin/env bash
# DeepSeek 网页版本地代理：启动 / 停止 / 状态
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$HOME/.config/deepseek-web/server.log"
PIDF="$HOME/.config/deepseek-web/server.pid"
PORT="${PORT:-8899}"

# 仓库里 wasm 存的是 base64，首次运行前解出来
if [ ! -f "$DIR/sha3_wasm_bg.wasm" ] && [ -f "$DIR/sha3_wasm_bg.wasm.b64" ]; then
  base64 -d "$DIR/sha3_wasm_bg.wasm.b64" > "$DIR/sha3_wasm_bg.wasm" 2>/dev/null || true
fi

case "${1:-start}" in
  start)
    if [ -f "$PIDF" ] && kill -0 "$(cat "$PIDF")" 2>/dev/null; then
      echo "已经在跑（pid $(cat "$PIDF")）"; exit 0
    fi
    mkdir -p "$(dirname "$LOG")"
    nohup setsid node "$DIR/server.js" >>"$LOG" 2>&1 &
    echo $! > "$PIDF"
    sleep 1
    if curl -s -m 3 "http://127.0.0.1:$PORT/health" >/dev/null; then
      echo "已启动 → http://127.0.0.1:$PORT/v1"
    else
      echo "启动失败，看日志：$LOG"; tail -20 "$LOG"
    fi
    ;;
  stop)
    [ -f "$PIDF" ] && kill "$(cat "$PIDF")" 2>/dev/null && rm -f "$PIDF" && echo "已停止" || echo "没在跑"
    ;;
  restart)
    "$0" stop; sleep 1; "$0" start
    ;;
  status)
    curl -s -m 3 "http://127.0.0.1:$PORT/health" || echo "没在跑"
    echo
    ;;
  login)
    node "$DIR/server.js" login
    ;;
  *)
    echo "用法: $0 [start|stop|restart|status|login]"
    ;;
esac
