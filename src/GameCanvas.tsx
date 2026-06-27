import { useRef, useEffect, useState, useCallback } from 'react'

// ─── Canvas dimensions ───────────────────────────────────────────────────────
const CW = 720
const CH = 480

// ─── Game tuning ─────────────────────────────────────────────────────────────
const PLAYER_W = 54
const PLAYER_H = 64
const ITEM_SIZE = 42
const ITEM_SPAWN_MS = 1500
const CALL_SPAWN_MS = 10_000
const CALL_TIMEOUT_MS = 3000      // seconds before call auto-expires
const FREEZE_MS = 3000            // freeze duration for any mistake
const GAME_DURATION_MS = 60_000   // 1-minute countdown
const PLAYER_SPEED = 14           // px per frame at 60fps
const SCORE_BENTO = 10
const SCORE_TRAP = -15
const SCORE_LEGIT_ANSWER = 20     // bonus for correctly answering legit call
const SCORE_LEGIT_MISS = -50      // missed legit call penalty
const GAMEOVER_SCORE = -100       // game over threshold

const LEGIT_CALLERS = [
  { name: '老闆', sub: '週報發了嗎？' },
  { name: 'PM 緊急', sub: '需求又改了！' },
  { name: '董事長', sub: '你在哪？快接！' },
  { name: '大客戶', sub: '緊急問題！' },
  { name: '主管', sub: '現在有空嗎？' },
  { name: '人資', sub: '面談時間確認' },
]

const SCAM_CALLERS = [
  { name: '股票飆股達人', sub: '年報酬 300%！' },
  { name: '低利房貸免審', sub: '今天就撥款！' },
  { name: '恭喜！您中獎了', sub: '領取百萬大獎！' },
  { name: '外國投資機構', sub: '保證獲利！' },
  { name: '法院傳票通知', sub: '立即接聽！（詐騙）' },
]

// ─── Types ────────────────────────────────────────────────────────────────────
interface FallingItem {
  id: number
  x: number
  y: number
  type: 'bento' | 'trap'
  speed: number
  wobble: number   // phase offset for horizontal sway
}

interface PhoneCall {
  id: number
  side: 'left' | 'right'
  type: 'legit' | 'scam'
  caller: string
  sub: string
  spawnTime: number
  resolved: boolean
}

interface GameState {
  status: 'idle' | 'playing' | 'gameover'
  score: number
  hiScore: number
  playerX: number
  targetX: number
  frozen: boolean
  frozenUntil: number
  frozenMsg: string | null
  items: FallingItem[]
  calls: PhoneCall[]
  nextItemTime: number
  nextCallTime: number
  idCounter: number
  lastFrameTs: number
  elapsed: number           // total ms since game start
  timeLeft: number          // countdown ms remaining
  timeUp: boolean           // true if game ended by timer
  callsDirty: boolean       // signal React to re-render overlays
}

// ─── Helper: random int in [min, max] ────────────────────────────────────────
const rng = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

// ─── Helper: random pick ─────────────────────────────────────────────────────
const pick = <T,>(arr: T[]): T => arr[rng(0, arr.length - 1)]

// ─── Rendering helpers ────────────────────────────────────────────────────────

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frozen: boolean,
) {
  const cx = x + PLAYER_W / 2

  // Body
  ctx.fillStyle = frozen ? '#7b9ec9' : '#4a90e2'
  drawRoundRect(ctx, x, y + 20, PLAYER_W, PLAYER_H - 20, 8)
  ctx.fill()

  // Head
  ctx.fillStyle = frozen ? '#c9a87b' : '#f5c97a'
  ctx.beginPath()
  ctx.arc(cx, y + 18, 18, 0, Math.PI * 2)
  ctx.fill()

  // Eyes
  ctx.fillStyle = '#333'
  if (frozen) {
    // X eyes when frozen
    ctx.font = 'bold 10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('x  x', cx, y + 18)
  } else {
    ctx.beginPath()
    ctx.arc(cx - 6, y + 14, 3, 0, Math.PI * 2)
    ctx.arc(cx + 6, y + 14, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  // Mouth
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 2
  ctx.beginPath()
  if (frozen) {
    ctx.moveTo(cx - 6, y + 24)
    ctx.lineTo(cx + 6, y + 24)
  } else {
    ctx.arc(cx, y + 22, 6, 0, Math.PI)
  }
  ctx.stroke()

  // Lunch box in hands (arms)
  ctx.fillStyle = '#f0f0f0'
  drawRoundRect(ctx, x + 8, y + 44, PLAYER_W - 16, 16, 4)
  ctx.fill()
  ctx.strokeStyle = '#aaa'
  ctx.lineWidth = 1
  ctx.stroke()

  if (frozen) {
    // freeze indicator
    ctx.fillStyle = 'rgba(100,180,255,0.4)'
    drawRoundRect(ctx, x - 2, y - 2, PLAYER_W + 4, PLAYER_H + 4, 10)
    ctx.fill()
  }
}

function drawBento(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Box
  ctx.fillStyle = '#2ecc71'
  drawRoundRect(ctx, x, y, ITEM_SIZE, ITEM_SIZE, 6)
  ctx.fill()
  ctx.strokeStyle = '#27ae60'
  ctx.lineWidth = 2
  ctx.stroke()

  // Lid line
  ctx.strokeStyle = '#27ae60'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x + 4, y + ITEM_SIZE * 0.38)
  ctx.lineTo(x + ITEM_SIZE - 4, y + ITEM_SIZE * 0.38)
  ctx.stroke()

  // Rice grain dots
  ctx.fillStyle = '#f0f0e0'
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.beginPath()
      ctx.ellipse(
        x + 8 + i * 9,
        y + ITEM_SIZE * 0.62 + j * 8,
        3,
        2,
        0,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
  }

  // +10 label
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 11px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('+10', x + ITEM_SIZE / 2, y - 4)
}

function drawTrap(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const cx = x + ITEM_SIZE / 2
  const cy = y + ITEM_SIZE / 2

  // Spiky hazard shape
  ctx.fillStyle = '#e74c3c'
  ctx.beginPath()
  const spikes = 6
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (i * Math.PI) / spikes - Math.PI / 2
    const r = i % 2 === 0 ? ITEM_SIZE / 2 : ITEM_SIZE / 3.5
    if (i === 0) ctx.moveTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
    else ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
  }
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#c0392b'
  ctx.lineWidth = 2
  ctx.stroke()

  // Skull icon (simple)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 18px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('💀', cx, cy)
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = '#ff6b6b'
  ctx.font = 'bold 11px sans-serif'
  ctx.fillText('-15', cx, y - 4)
}

function drawBackground(ctx: CanvasRenderingContext2D, elapsed: number) {
  // Gradient sky → floor
  const grad = ctx.createLinearGradient(0, 0, 0, CH)
  grad.addColorStop(0, '#1a1a2e')
  grad.addColorStop(1, '#16213e')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CW, CH)

  // Scrolling city silhouette (simple rectangles)
  ctx.fillStyle = '#0f3460'
  const buildingData = [
    [0,   0, 62, 220],
    [57,  0, 48, 280],
    [100, 0, 55, 250],
    [150, 0, 50, 300],
    [195, 0, 44, 230],
    [234, 0, 65, 260],
    [294, 0, 50, 315],
    [339, 0, 58, 245],
    [392, 0, 52, 270],
    [439, 0, 46, 235],
    [480, 0, 62, 295],
    [537, 0, 50, 260],
    [582, 0, 56, 225],
    [633, 0, 48, 280],
    [676, 0, 48, 250],
  ]
  for (const [bx, , bw, bh] of buildingData) {
    ctx.fillRect(bx, CH - bh, bw, bh)
    // Windows
    ctx.fillStyle = elapsed % 2000 < 1000 ? '#e2b96f' : '#c9952a'
    for (let wy = CH - bh + 10; wy < CH - 20; wy += 20) {
      for (let wx = bx + 6; wx < bx + bw - 8; wx += 14) {
        if (Math.random() > 0.3) {
          ctx.fillRect(wx, wy, 7, 9)
        }
      }
    }
    ctx.fillStyle = '#0f3460'
  }

  // Ground / road
  ctx.fillStyle = '#0d2137'
  ctx.fillRect(0, CH - 60, CW, 60)
  ctx.fillStyle = '#1a3a55'
  ctx.fillRect(0, CH - 62, CW, 4)

  // Road markings
  ctx.fillStyle = '#f0c040'
  ctx.setLineDash([30, 20])
  ctx.strokeStyle = '#f0c040'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, CH - 30)
  ctx.lineTo(CW, CH - 30)
  ctx.stroke()
  ctx.setLineDash([])
}

function drawHUD(
  ctx: CanvasRenderingContext2D,
  score: number,
  hiScore: number,
  timeLeft: number,
) {
  // Top bar backdrop
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(0, 0, CW, 48)

  ctx.fillStyle = '#fff'
  ctx.font = 'bold 20px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(`分數：${score}`, 14, 30)

  ctx.textAlign = 'right'
  ctx.fillStyle = '#f0c040'
  ctx.fillText(`最高：${hiScore}`, CW - 14, 30)

  // Countdown timer
  const sec = Math.ceil(timeLeft / 1000)
  ctx.textAlign = 'center'
  ctx.fillStyle = timeLeft < 10000 ? '#f87171' : '#aad4ff'
  ctx.font = 'bold 16px sans-serif'
  ctx.fillText(`⏱ ${sec}s`, CW / 2, 30)
}

function drawFreezeOverlay(
  ctx: CanvasRenderingContext2D,
  msg: string | null,
  frozenUntil: number,
  now: number,
) {
  if (!msg) return
  const remaining = Math.max(0, frozenUntil - now)
  ctx.fillStyle = 'rgba(20,60,120,0.72)'
  ctx.fillRect(0, CH / 2 - 80, CW, 160)

  ctx.fillStyle = '#fff'
  ctx.font = 'bold 22px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('📵 定身中！', CW / 2, CH / 2 - 40)

  ctx.font = '15px sans-serif'
  ctx.fillStyle = '#aee'

  // Word-wrap the message
  const words = msg.split('')
  let line = ''
  let lineY = CH / 2 - 10
  for (const ch of words) {
    if (ctx.measureText(line + ch).width > CW - 40) {
      ctx.fillText(line, CW / 2, lineY)
      line = ch
      lineY += 22
    } else {
      line += ch
    }
  }
  ctx.fillText(line, CW / 2, lineY)

  ctx.fillStyle = '#f0c040'
  ctx.font = 'bold 18px sans-serif'
  ctx.fillText(`解凍倒數：${(remaining / 1000).toFixed(1)}s`, CW / 2, CH / 2 + 60)
}

function drawIdleScreen(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(0, 0, CW, CH)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#f0c040'
  ctx.font = 'bold 32px sans-serif'
  ctx.fillText('🍱 便當接接樂', CW / 2, CH / 2 - 100)

  ctx.fillStyle = '#fff'
  ctx.font = '18px sans-serif'
  ctx.fillText('60秒內接便當得分，躲陷阱', CW / 2, CH / 2 - 50)
  ctx.fillText('正確處理來電，別被定身！', CW / 2, CH / 2 - 24)

  ctx.fillStyle = '#4ade80'
  ctx.font = 'bold 22px sans-serif'
  ctx.fillText('點擊畫面 / 按鈕開始遊戲', CW / 2, CH / 2 + 16)

  // Legend
  ctx.font = '14px sans-serif'
  ctx.fillStyle = '#aaa'
  ctx.fillText('綠色方塊 = +10  |  紅色星爆 = -15', CW / 2, CH / 2 + 54)
  ctx.fillText('老闆來電 → 接聽(+20)  |  詐騙 → 掛斷', CW / 2, CH / 2 + 76)
  ctx.fillText('漏接老闆 / 誤接詐騙 → 定身 3 秒', CW / 2, CH / 2 + 98)
}

function drawGameOver(
  ctx: CanvasRenderingContext2D,
  score: number,
  hiScore: number,
  timeUp: boolean,
) {
  ctx.fillStyle = 'rgba(0,0,0,0.75)'
  ctx.fillRect(0, 0, CW, CH)

  ctx.textAlign = 'center'
  ctx.fillStyle = timeUp ? '#f0c040' : '#e74c3c'
  ctx.font = 'bold 40px sans-serif'
  ctx.fillText(timeUp ? '⏰ 時間到！' : 'GAME OVER', CW / 2, CH / 2 - 80)

  ctx.fillStyle = '#fff'
  ctx.font = 'bold 24px sans-serif'
  ctx.fillText(`最終分數：${score}`, CW / 2, CH / 2 - 30)

  ctx.fillStyle = '#f0c040'
  ctx.font = '20px sans-serif'
  ctx.fillText(`最高分：${hiScore}`, CW / 2, CH / 2 + 10)

  ctx.fillStyle = '#4ade80'
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText('點擊畫面重新開始', CW / 2, CH / 2 + 70)
}

// ─── Initial state factory ────────────────────────────────────────────────────
function initState(hiScore = 0): GameState {
  return {
    status: 'idle',
    score: 0,
    hiScore,
    playerX: CW / 2 - PLAYER_W / 2,
    targetX: CW / 2 - PLAYER_W / 2,
    frozen: false,
    frozenUntil: 0,
    frozenMsg: null,
    items: [],
    calls: [],
    nextItemTime: 0,
    nextCallTime: CALL_SPAWN_MS,
    idCounter: 0,
    lastFrameTs: 0,
    elapsed: 0,
    timeLeft: GAME_DURATION_MS,
    timeUp: false,
    callsDirty: false,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gsRef = useRef<GameState>(initState())
  const rafRef = useRef(0)
  const moveDirRef = useRef<-1 | 0 | 1>(0)

  // React state — only for HTML overlays (phone calls) & status display
  const [calls, setCalls] = useState<PhoneCall[]>([])
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'gameover'>('idle')

  // ── Start / restart game ───────────────────────────────────────────────────
  const startGame = useCallback(() => {
    const gs = gsRef.current
    const hi = Math.max(gs.hiScore, gs.score)
    gsRef.current = initState(hi)
    gsRef.current.status = 'playing'
    gsRef.current.nextItemTime = performance.now() + 500
    gsRef.current.nextCallTime = performance.now() + CALL_SPAWN_MS
    gsRef.current.lastFrameTs = performance.now()
    setGameStatus('playing')
    setCalls([])
  }, [])

  // ── Phone call action handlers ────────────────────────────────────────────
  const handleAnswer = useCallback((callId: number) => {
    const gs = gsRef.current
    const call = gs.calls.find(c => c.id === callId)
    if (!call || call.resolved) return
    call.resolved = true
    gs.callsDirty = true

    if (call.type === 'legit') {
      // Correct! Bonus score, no freeze
      gs.score += SCORE_LEGIT_ANSWER
    } else {
      // Scam — accidentally answered: freeze 3s
      gs.frozen = true
      gs.frozenUntil = performance.now() + FREEZE_MS
      gs.frozenMsg = '你接了詐騙電話！😱 小心陌生來電！'
    }
  }, [])

  const handleDecline = useCallback((callId: number) => {
    const gs = gsRef.current
    const call = gs.calls.find(c => c.id === callId)
    if (!call || call.resolved) return
    call.resolved = true
    gs.callsDirty = true

    if (call.type === 'scam') {
      // Correct! No penalty
    } else {
      // Legit call — hung up on boss: penalty + freeze 3s
      gs.score += SCORE_LEGIT_MISS
      gs.frozen = true
      gs.frozenUntil = performance.now() + FREEZE_MS
      gs.frozenMsg = '老闆電話沒接！😰 被念了 3 秒！'
    }
  }, [])

  // ── Game update logic (called each frame) ─────────────────────────────────
  const update = useCallback((gs: GameState, now: number, dt: number) => {
    gs.elapsed += dt

    // Countdown timer
    gs.timeLeft -= dt
    if (gs.timeLeft <= 0) {
      gs.timeLeft = 0
      gs.timeUp = true
      gs.status = 'gameover'
    }

    // Unfreeze
    if (gs.frozen && now >= gs.frozenUntil) {
      gs.frozen = false
      gs.frozenMsg = null
    }

    // Move player (if not frozen)
    if (!gs.frozen) {
      if (moveDirRef.current !== 0) {
        // Button / keyboard: direct movement
        gs.playerX += moveDirRef.current * PLAYER_SPEED
        gs.targetX = gs.playerX
      } else {
        // Mouse-follow smooth movement
        const dx = gs.targetX - gs.playerX
        if (Math.abs(dx) > 1) {
          gs.playerX += Math.sign(dx) * Math.min(Math.abs(dx), PLAYER_SPEED)
        }
      }
    }
    // Clamp player
    gs.playerX = Math.max(0, Math.min(CW - PLAYER_W, gs.playerX))

    // Spawn falling items
    if (now >= gs.nextItemTime) {
      gs.nextItemTime = now + ITEM_SPAWN_MS - Math.min(gs.elapsed * 0.05, 600)
      const isBento = Math.random() < 0.65
      gs.items.push({
        id: gs.idCounter++,
        x: rng(8, CW - ITEM_SIZE - 8),
        y: -ITEM_SIZE,
        type: isBento ? 'bento' : 'trap',
        speed: 1.8 + Math.random() * 1.2 + gs.elapsed * 0.0001,
        wobble: Math.random() * Math.PI * 2,
      })
    }

    // Move items & check collision
    const playerTop = CH - 60 - PLAYER_H
    const playerLeft = gs.playerX
    const playerRight = gs.playerX + PLAYER_W

    gs.items = gs.items.filter(item => {
      item.y += item.speed
      // Gentle horizontal sway
      item.x += Math.sin(item.wobble + gs.elapsed * 0.003) * 0.4

      // Off-screen
      if (item.y > CH) return false

      // Collision with player (AABB)
      const itemRight = item.x + ITEM_SIZE
      const itemBottom = item.y + ITEM_SIZE
      if (
        item.x < playerRight &&
        itemRight > playerLeft &&
        item.y < playerTop + PLAYER_H &&
        itemBottom > playerTop
      ) {
        gs.score += item.type === 'bento' ? SCORE_BENTO : SCORE_TRAP
        if (gs.score > gs.hiScore) gs.hiScore = gs.score
        return false // consumed
      }
      return true
    })

    // Spawn phone calls
    if (now >= gs.nextCallTime) {
      gs.nextCallTime = now + CALL_SPAWN_MS
      const isLegit = Math.random() < 0.55
      const callerList = isLegit ? LEGIT_CALLERS : SCAM_CALLERS
      const callerInfo = pick(callerList)
      gs.calls.push({
        id: gs.idCounter++,
        side: Math.random() < 0.5 ? 'left' : 'right',
        type: isLegit ? 'legit' : 'scam',
        caller: callerInfo.name,
        sub: callerInfo.sub,
        spawnTime: now,
        resolved: false,
      })
      gs.callsDirty = true
    }

    // Resolve timed-out calls
    gs.calls.forEach(call => {
      if (call.resolved) return
      const age = now - call.spawnTime
      if (age >= CALL_TIMEOUT_MS) {
        call.resolved = true
        gs.callsDirty = true
        if (call.type === 'legit') {
          // Missed legit call — penalty + freeze 3s
          gs.score += SCORE_LEGIT_MISS
          gs.frozen = true
          gs.frozenUntil = now + FREEZE_MS
          gs.frozenMsg = '老闆電話漏接了！😰 被念了 3 秒！'
        }
        // Scam timed out = scammer gave up, no penalty
      }
    })

    // Remove resolved calls after a tick
    const prevLen = gs.calls.length
    gs.calls = gs.calls.filter(c => !c.resolved)
    if (gs.calls.length !== prevLen) gs.callsDirty = true

    // Game over condition
    if (gs.score <= GAMEOVER_SCORE) {
      gs.status = 'gameover'
    }
  }, [])

  // ── Render (canvas only) ───────────────────────────────────────────────────
  const render = useCallback((ctx: CanvasRenderingContext2D, gs: GameState, now: number) => {
    drawBackground(ctx, gs.elapsed)

    // Falling items
    for (const item of gs.items) {
      if (item.type === 'bento') drawBento(ctx, item.x, item.y)
      else drawTrap(ctx, item.x, item.y)
    }

    // Player
    const playerY = CH - 60 - PLAYER_H
    drawPlayer(ctx, gs.playerX, playerY, gs.frozen)

    // HUD
    drawHUD(ctx, gs.score, gs.hiScore, gs.timeLeft)

    // Freeze overlay
    if (gs.frozen) {
      drawFreezeOverlay(ctx, gs.frozenMsg, gs.frozenUntil, now)
    }

    // Idle / game-over screens
    if (gs.status === 'idle') drawIdleScreen(ctx)
    if (gs.status === 'gameover') drawGameOver(ctx, gs.score, gs.hiScore, gs.timeUp)
  }, [])

  // ── Game loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!

    let statusSent = gsRef.current.status

    const loop = (now: number) => {
      const gs = gsRef.current
      const dt = Math.min(now - gs.lastFrameTs, 50) // cap at 50ms (tab focus resume)
      gs.lastFrameTs = now

      if (gs.status === 'playing') {
        update(gs, now, dt)
      }

      render(ctx, gs, now)

      // Sync to React only on changes
      if (gs.callsDirty) {
        gs.callsDirty = false
        setCalls([...gs.calls])
      }
      if (gs.status !== statusSent) {
        statusSent = gs.status
        setGameStatus(gs.status)
        if (gs.status === 'gameover') setCalls([])
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [update, render])

  // ── Keyboard controls ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  moveDirRef.current = -1
      if (e.key === 'ArrowRight') moveDirRef.current = 1
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') moveDirRef.current = 0
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // ── Input: get canvas-space X from client event ───────────────────────────
  const clientToCanvasX = useCallback((clientX: number) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = CW / rect.width
    return (clientX - rect.left) * scaleX - PLAYER_W / 2
  }, [])

  // ── Mouse handlers ────────────────────────────────────────────────────────
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (gsRef.current.status !== 'playing') return
    gsRef.current.targetX = clientToCanvasX(e.clientX)
  }, [clientToCanvasX])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const gs = gsRef.current
    if (gs.status === 'idle' || gs.status === 'gameover') {
      startGame()
      return
    }
    gs.targetX = clientToCanvasX(e.clientX)
  }, [clientToCanvasX, startGame])

  // ── Touch handlers ────────────────────────────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const gs = gsRef.current
    if (gs.status === 'idle' || gs.status === 'gameover') {
      e.preventDefault()
      startGame()
    }
  }, [startGame])

  // ── Call countdown helper ─────────────────────────────────────────────────
  const CallOverlay = ({ call }: { call: PhoneCall }) => {
    const [timeLeft, setTimeLeft] = useState(CALL_TIMEOUT_MS)

    useEffect(() => {
      const interval = setInterval(() => {
        const remaining = CALL_TIMEOUT_MS - (performance.now() - call.spawnTime)
        setTimeLeft(Math.max(0, remaining))
      }, 100)
      return () => clearInterval(interval)
    }, [call.spawnTime])

    const isLeft = call.side === 'left'
    const isLegit = call.type === 'legit'
    const pct = timeLeft / CALL_TIMEOUT_MS

    return (
      <div
        style={{
          position: 'absolute',
          top: '28%',
          ...(isLeft ? { left: 0 } : { right: 0 }),
          width: 168,
          background: isLegit
            ? 'linear-gradient(135deg,#1e3a5f,#2a5298)'
            : 'linear-gradient(135deg,#5f1e1e,#982a2a)',
          borderRadius: isLeft ? '0 16px 16px 0' : '16px 0 0 16px',
          padding: '12px 10px 10px',
          boxShadow: isLegit
            ? '0 4px 24px rgba(42,82,152,0.7)'
            : '0 4px 24px rgba(152,42,42,0.7)',
          color: '#fff',
          fontFamily: 'sans-serif',
          zIndex: 20,
          userSelect: 'none',
          border: `2px solid ${isLegit ? '#4a90e2' : '#e74c3c'}`,
          animation: 'slideIn 0.25s ease-out',
        }}
      >
        {/* Caller info */}
        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>
          {isLegit ? '📞 來電' : '⚠️ 疑似詐騙'}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>
          {call.caller}
        </div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
          {call.sub}
        </div>

        {/* Countdown bar */}
        <div
          style={{
            height: 4,
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 2,
            marginTop: 8,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct * 100}%`,
              background: pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#f0c040' : '#f87171',
              transition: 'width 0.1s linear',
            }}
          />
        </div>
        <div style={{ fontSize: 11, textAlign: 'right', marginTop: 2, opacity: 0.7 }}>
          {(timeLeft / 1000).toFixed(1)}s
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button
            onPointerDown={e => { e.stopPropagation(); handleAnswer(call.id) }}
            style={{
              flex: 1,
              padding: '7px 4px',
              background: '#22c55e',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            📞 接聽
          </button>
          <button
            onPointerDown={e => { e.stopPropagation(); handleDecline(call.id) }}
            style={{
              flex: 1,
              padding: '7px 4px',
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            ❌ 掛斷
          </button>
        </div>

        {/* Hint */}
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            textAlign: 'center',
            color: isLegit ? '#93c5fd' : '#fca5a5',
            fontWeight: 600,
          }}
        >
          {isLegit ? '⚠️ 必須接聽！' : '⚠️ 必須掛斷！'}
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const containerW = Math.min(CW, typeof window !== 'undefined' ? window.innerWidth : CW)
  const scale = containerW / CW

  return (
    <div
      style={{
        position: 'relative',
        width: CW * scale,
        height: CH * scale,
        overflow: 'hidden',
        borderRadius: 12,
        boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
      }}
    >
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(var(--slide-x, -100%)); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>

      <canvas
        ref={canvasRef}
        width={CW}
        height={CH}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          touchAction: 'none',
          cursor: gameStatus === 'playing' ? 'none' : 'pointer',
        }}
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      />

      {/* Phone call overlays */}
      {gameStatus === 'playing' &&
        calls.map(call => (
          <CallOverlay key={call.id} call={call} />
        ))}

      {/* D-pad buttons */}
      {gameStatus === 'playing' && (
        <div style={{
          position: 'absolute',
          bottom: Math.max(10, Math.round(14 * scale)),
          left: Math.max(10, Math.round(14 * scale)),
          display: 'flex',
          gap: Math.max(6, Math.round(10 * scale)),
          zIndex: 30,
        }}>
          {(['←', '→'] as const).map((label, i) => (
            <button
              key={label}
              onPointerDown={e => { e.stopPropagation(); moveDirRef.current = i === 0 ? -1 : 1 }}
              onPointerUp={e => { e.stopPropagation(); moveDirRef.current = 0 }}
              onPointerLeave={e => { e.stopPropagation(); moveDirRef.current = 0 }}
              onPointerCancel={e => { e.stopPropagation(); moveDirRef.current = 0 }}
              style={{
                width: Math.max(52, Math.round(72 * scale)),
                height: Math.max(52, Math.round(72 * scale)),
                background: 'rgba(20,50,110,0.82)',
                border: '2px solid rgba(120,190,255,0.75)',
                borderRadius: Math.round(12 * scale),
                color: '#fff',
                fontSize: Math.max(20, Math.round(30 * scale)),
                fontWeight: 700,
                cursor: 'pointer',
                touchAction: 'none',
                userSelect: 'none',
                boxShadow: '0 3px 10px rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
