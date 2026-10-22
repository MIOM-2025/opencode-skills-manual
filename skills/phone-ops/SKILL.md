---
name: phone-ops
description: Generic phone quick ops (pq) — current app, UI tree, find/tap/type/wait/scroll by on-screen text, screenshot, media control, one-command multi-step flows. App-agnostic, works with any app on this phone. Use this first for any common phone operation.
---

# Phone Ops (pq) — 通用常用操作，适配所有 App

**没有任何 App 专属配置**：不写死包名、坐标、资源 id。一律「看屏幕上的字 → 点它 → 回读验证」。
命令入口是 `pq`（装在本机 PATH，源码在 `skills/phone-ops/scripts/pq`）。

## 为什么用它

- **一条命令 = 一步完整操作**（含自动回读验证），比「dump → 找坐标 → 点 → 再 dump」四次往返快一个量级。
- **多步串一条**：`pq step …` 或 shell 里 `pq tap 播放 && pq wait 暂停`。Termux 悬浮窗会周期性抢焦点，**串在一条 shell 调用里最稳**，少给悬浮窗干涉的机会。
- Portal 掉线会**自动修复**；Portal 全挂时自动退到 adb（树走 uiautomator XML，截屏/按键走 adb）。

## 行动节奏 —— 开局直接动手（最高优先，先读这个）

1. **开局直接操作**：拿到任务立刻发第一条命令（`pq now` 或 `pq ui 关键词`），不写长计划、不做多余推理。
2. **一步一循环**：做完一步，看命令末尾的「回读行」决定下一步；不要一口气猜 5 步以后的事。`pq step` 只用于已经确定的短链（≤4-5 步）。
3. **每步最多等 0.5 秒**：所有默认等待都很短（wait 默认 0.5s、sleep 0.1~0.35s）；目标没出现就**立刻换招**——换关键词 / 用 `pq tap` 自动滑屏 / `pq shot` 截图看一眼——绝不原地傻等。
4. **失败立刻报+立刻换**：一条命令失败就说明原因并给替代动作，继续下一步；绝不把同一条命令重复发两遍。
5. 节奏目标：看到屏幕 → 发命令 → 看回读 → 下一步，一轮 1~2 秒内完成。

## 速查表

```bash
pq now                        # 当前 App / 包名 / 键盘 / 焦点输入框内容
pq ui [关键词] [N]            # 元素表：text|desc|class|坐标|clk(可点)|ed(可输入)
pq find 关键词 [N]            # 候选列表（按面积排序；找不到自动滑屏搜索）
pq tap 关键词[|序号]          # 点最佳匹配（找不到自动滑屏）+ 自动回读
pq type "文字" [false]        # 输入到焦点框（默认先清空；false=追加）
pq typein 框关键词 "文字"     # 自动滑屏找输入框 → 点框 → 输入
pq wait 关键词 [秒=0.5]       快速确认元素是否出现（默认 0.5s；没出现立刻换招）
pq scrollto 关键词 [up|down]  # 指定方向滚动查找（up=手指上滑看下方；自带多次滑动+轮询）
pq shot [路径]                # 截图，默认 ~/.cache/pq/pq.png（可 read 查看）
pq app 包名|名称片段          # 启动；给片段会自动搜已装包（唯一才启动）
pq stop 包名 / pq link URL    # 停止 / 深链
pq key back|home|enter|...    # 按键（也接受数字 keycode）
pq swipe x1 y1 x2 y2 [ms]     # 滑动
pq media [state|play|pause|next|previous|stop]   # 媒体会话（全 App 通用）
pq toast 文字                 # 屏幕打提示（执行留痕）
pq recover                    # 手动修复 Portal
```

`pq step` 一条命令跑完整流程（任何一步失败立即停）：

```bash
pq step "app:com.android.settings" "wait:设置" "tap:搜索" "type:蓝牙" "key:enter"
pq step "scrollto:关于手机" "tap:关于手机" "wait:版本号" "shot"
```

## 使用铁律

1. **对任意 App 都是同一套循环**：`now/ui` 看 → `tap/type/key` 做 → 命令回显里的「回读行」验证。树里看不到就 `pq shot` 截图看一眼再继续。
2. **找不到就自动滑屏**：`find/tap/typein` 目标不在屏幕上时会自动向上滑、再向下滑找（滑到内容不再变化=到头，双向到头才放弃）。`scrollto` 可指定方向手动控制。`PQ_AUTOSCROLL=0` 关闭，`PQ_MAX_SWIPES=N`（默认 10）控制上限。
3. **定位靠屏幕上真实文字**（text 或 desc 均参与匹配），中文直接写；默认纯文本忽略大小写，`PQ_RE=1` 才当正则。
4. **tap 的自动防呆**：优先「可点 且 非输入框」的最小元素；点到不可点元素时会改点它最近的可点祖先（列表行/卡片整行点得准）；不会把要发的句子点进草稿框。序号 `|2` 挑第 2 候选。
5. **验证看回读行**：`✓ tap「…」→ app=… 目标文案数=N`；数量变 0 = 页面跳转/内容已变。
6. 屏幕 1080×2412 竖屏；坐标一律用 `pq` 自己算，不要手写。
7. `PQ_QUIET=1` 静音 toast（批量时用）；截图文件优先 `~/.cache/pq/`（手机没有 /tmp）。
