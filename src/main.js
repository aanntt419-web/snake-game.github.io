import './style.css'
import { insertScore, fetchLeaderboard } from './supabase.js'

// 게임 설정
const GRID_SIZE = 8
const CELL_SIZE = 40
const INITIAL_SPEED_MS = 350 // 한 칸 이동 간격(ms) - 값이 클수록 뱀이 느리게 움직임

// 방향 상수
const DIRECTION = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 }
}

// DOM 요소
const canvas = document.getElementById('game-canvas')
const ctx = canvas.getContext('2d')
const scoreEl = document.getElementById('score')
const speedDisplayEl = document.getElementById('speed-display')
const highScoreEl = document.getElementById('high-score')
const finalScoreEl = document.getElementById('final-score')
const gameOverEl = document.getElementById('game-over')
const startScreenEl = document.getElementById('start-screen')
const startBtn = document.getElementById('start-btn')
const restartBtn = document.getElementById('restart-btn')
const pauseBtn = document.getElementById('pause-btn')
const pauseOverlayEl = document.getElementById('pause-overlay')
const resumeBtn = document.getElementById('resume-btn')
const quitBtn = document.getElementById('quit-btn')
const recordBtn = document.getElementById('record-btn')
const nicknameInput = document.getElementById('nickname-input')
const recordErrorEl = document.getElementById('record-error')
const recordSuccessEl = document.getElementById('record-success')
const leaderboardListEl = document.getElementById('leaderboard-list')

// 캔버스 크기 설정
canvas.width = GRID_SIZE * CELL_SIZE
canvas.height = GRID_SIZE * CELL_SIZE

// 게임 상태
let snake = []
let previousSnake = [] // 보간용 이전 프레임
let direction = null
let nextDirection = null
let fruit = null
let score = 0
let highScore = parseInt(localStorage.getItem('snakeHighScore') || '0', 10)
let isRunning = false
let isPaused = false
let lastTickTime = 0
let animationId = null
let hasRecordedThisGame = false // 동일 게임에서 중복 저장 방지

// 선형 보간
function lerp(a, b, t) {
  return a + (b - a) * t
}

// 뱀 초기화 (중앙에 3칸)
function initSnake() {
  const center = Math.floor(GRID_SIZE / 2)
  snake = [
    { x: center, y: center },
    { x: center - 1, y: center },
    { x: center - 2, y: center }
  ]
  previousSnake = snake.map(s => ({ ...s }))
}

// 과일 랜덤 생성 (뱀 몸체와 겹치지 않게)
function spawnFruit() {
  const snakeSet = new Set(snake.map(s => `${s.x},${s.y}`))
  const emptyCells = []
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      if (!snakeSet.has(`${x},${y}`)) {
        emptyCells.push({ x, y })
      }
    }
  }
  if (emptyCells.length === 0) return null
  return emptyCells[Math.floor(Math.random() * emptyCells.length)]
}

// 벽 충돌 감지
function isWallCollision(x, y) {
  return x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE
}

// 자기 몸 충돌 감지 (머리가 꼬리에 닿는지)
function isSelfCollision(newHead) {
  return snake.some((segment, index) => {
    if (index === 0) return false
    return segment.x === newHead.x && segment.y === newHead.y
  })
}

// 반대 방향인지 확인 (방향 전환 시 사용)
function isOpposite(d1, d2) {
  return d1.x === -d2.x && d1.y === -d2.y
}

// 과일 먹음 감지
function isEatingFruit(newHead) {
  return fruit && fruit.x === newHead.x && fruit.y === newHead.y
}

// 게임 로직 업데이트 (격자 기반)
function gameTick() {
  if (!direction) return

  const head = snake[0]
  const dir = nextDirection && !isOpposite(direction, nextDirection) ? nextDirection : direction
  direction = dir
  nextDirection = null

  const newHead = {
    x: head.x + dir.x,
    y: head.y + dir.y
  }

  if (isWallCollision(newHead.x, newHead.y)) {
    gameOver()
    return
  }

  if (isSelfCollision(newHead)) {
    gameOver()
    return
  }

  previousSnake = snake.map(s => ({ ...s }))
  snake.unshift(newHead)

  if (isEatingFruit(newHead)) {
    score += 10
    fruit = spawnFruit()
    if (fruit === null) {
      gameOver()
      return
    }
    updateScore()
  } else {
    snake.pop()
  }
}

// 연결된 뱀 그리기 (몸통 전체를 하나의 관으로)
function drawSnakeBody(segmentPixels) {
  if (segmentPixels.length < 2) return

  const tubeWidth = CELL_SIZE - 4
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = tubeWidth

  ctx.beginPath()
  ctx.moveTo(segmentPixels[0].x, segmentPixels[0].y)
  for (let i = 1; i < segmentPixels.length; i++) {
    ctx.lineTo(segmentPixels[i].x, segmentPixels[i].y)
  }

  ctx.strokeStyle = '#14532d'
  ctx.lineWidth = tubeWidth + 4
  ctx.stroke()

  ctx.strokeStyle = '#22c55e'
  ctx.lineWidth = tubeWidth
  ctx.stroke()
}

// 사과 그리기 (둥근 몸통 + 꼭지 + 잎)
function drawApple(cx, cy) {
  const r = CELL_SIZE / 2 - 5

  ctx.fillStyle = '#dc2626'
  ctx.beginPath()
  ctx.ellipse(cx, cy, r, r * 1.15, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = '#b91c1c'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.strokeStyle = '#422006'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx, cy - r)
  ctx.lineTo(cx + 1, cy - r - 6)
  ctx.stroke()

  ctx.fillStyle = '#16a34a'
  ctx.beginPath()
  ctx.ellipse(cx + 5, cy - r - 4, 4, 6, -0.4, 0, Math.PI * 2)
  ctx.fill()
}

// 머리 강조 (연결된 몸통 위에, 방향에 맞는 눈)
function drawSnakeHead(px, py, dir) {
  const r = CELL_SIZE / 2 - 2

  ctx.fillStyle = '#4ade80'
  ctx.beginPath()
  ctx.arc(px, py, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = '#166534'
  ctx.lineWidth = 3
  ctx.stroke()

  // 눈 (방향에 따라 위치 조정)
  const eyeRadius = r * 0.25
  const eyeOffset = r * 0.5
  const pupilRadius = eyeRadius * 0.5

  const eyeDirX = dir?.x ?? 1
  const eyeDirY = dir?.y ?? 0
  const perpX = -eyeDirY
  const perpY = eyeDirX

  const eye1X = px + eyeDirX * eyeOffset + perpX * eyeOffset * 0.5
  const eye1Y = py + eyeDirY * eyeOffset + perpY * eyeOffset * 0.5
  const eye2X = px + eyeDirX * eyeOffset - perpX * eyeOffset * 0.5
  const eye2Y = py + eyeDirY * eyeOffset - perpY * eyeOffset * 0.5

  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(eye1X, eye1Y, eyeRadius, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(eye2X, eye2Y, eyeRadius, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#0f172a'
  ctx.beginPath()
  ctx.arc(eye1X, eye1Y, pupilRadius, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(eye2X, eye2Y, pupilRadius, 0, Math.PI * 2)
  ctx.fill()
}

// 그리기 (progress: 0~1, 현재 틱 진행도)
function draw(progress) {
  const w = canvas.width
  const h = canvas.height

  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 1
  for (let i = 1; i < GRID_SIZE; i++) {
    ctx.beginPath()
    ctx.moveTo(i * CELL_SIZE, 0)
    ctx.lineTo(i * CELL_SIZE, h)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i * CELL_SIZE)
    ctx.lineTo(w, i * CELL_SIZE)
    ctx.stroke()
  }

  ctx.strokeStyle = '#334155'
  ctx.lineWidth = 1
  ctx.strokeRect(0, 0, w, h)

  if (fruit) {
    drawApple(fruit.x * CELL_SIZE + CELL_SIZE / 2, fruit.y * CELL_SIZE + CELL_SIZE / 2)
  }

  // 뱀 그리기 (연결된 몸통 + 전체 보간)
  if (previousSnake.length > 0) {
    const segmentPixels = []
    for (let i = 0; i < snake.length; i++) {
      const from = i > 0 ? previousSnake[i - 1] : previousSnake[0]
      const to = snake[i]
      const drawX = lerp(from.x, to.x, progress)
      const drawY = lerp(from.y, to.y, progress)
      segmentPixels.push({
        x: drawX * CELL_SIZE + CELL_SIZE / 2,
        y: drawY * CELL_SIZE + CELL_SIZE / 2
      })
    }
    drawSnakeBody(segmentPixels)
    if (segmentPixels.length > 0) {
      drawSnakeHead(segmentPixels[0].x, segmentPixels[0].y, direction)
    }
  }
}

function updateScore() {
  scoreEl.textContent = `점수: ${score}`
  if (score > highScore) {
    highScore = score
    localStorage.setItem('snakeHighScore', highScore)
    highScoreEl.textContent = `최고: ${highScore}`
  }
}

function gameOver() {
  isRunning = false
  isPaused = false
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
  pauseBtn.classList.add('hidden')
  pauseOverlayEl.classList.add('hidden')
  finalScoreEl.textContent = score
  recordErrorEl.classList.add('hidden')
  recordSuccessEl.classList.add('hidden')
  nicknameInput.value = ''
  hasRecordedThisGame = false
  gameOverEl.classList.remove('hidden')
}

function startGame() {
  startScreenEl.classList.add('hidden')
  gameOverEl.classList.add('hidden')
  pauseOverlayEl.classList.add('hidden')
  pauseBtn.classList.remove('hidden')

  initSnake()
  direction = DIRECTION.RIGHT
  nextDirection = null
  fruit = spawnFruit()
  score = 0
  updateScore()
  highScoreEl.textContent = `최고: ${highScore}`
  isRunning = true
  isPaused = false
  lastTickTime = performance.now()

  draw(1)
}

function pauseGame() {
  isPaused = true
  pauseOverlayEl.classList.remove('hidden')
}

function resumeGame() {
  isPaused = false
  pauseOverlayEl.classList.add('hidden')
  lastTickTime = performance.now()
}

function quitGame() {
  isRunning = false
  isPaused = false
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
  pauseOverlayEl.classList.add('hidden')
  pauseBtn.classList.add('hidden')
  startScreenEl.classList.remove('hidden')
}

// 메인 루프 (requestAnimationFrame + 시간 기반 틱)
function gameLoop(timestamp) {
  if (!isRunning) {
    if (animationId) cancelAnimationFrame(animationId)
    return
  }

  if (!isPaused) {
    while (lastTickTime + INITIAL_SPEED_MS <= timestamp && direction) {
      gameTick()
      lastTickTime += INITIAL_SPEED_MS
    }
  }

  const progress = isPaused ? 1 : Math.min(1, (timestamp - lastTickTime) / INITIAL_SPEED_MS)
  draw(progress)

  animationId = requestAnimationFrame(gameLoop)
}

startBtn.addEventListener('click', () => {
  startGame()
  animationId = requestAnimationFrame(gameLoop)
})

restartBtn.addEventListener('click', () => {
  startScreenEl.classList.add('hidden')
  gameOverEl.classList.add('hidden')
  startGame()
  animationId = requestAnimationFrame(gameLoop)
})

recordBtn.addEventListener('click', async () => {
  if (hasRecordedThisGame) return
  const nickname = nicknameInput.value.trim()
  if (!nickname) {
    recordErrorEl.textContent = '닉네임을 입력해주세요 (1~20자)'
    recordErrorEl.classList.remove('hidden')
    recordSuccessEl.classList.add('hidden')
    return
  }
  if (nickname.length > 20) {
    recordErrorEl.textContent = '닉네임은 20자 이하여야 합니다'
    recordErrorEl.classList.remove('hidden')
    return
  }
  recordErrorEl.classList.add('hidden')
  recordBtn.disabled = true

  const { error } = await insertScore(nickname, score)
  recordBtn.disabled = false

  if (error) {
    recordErrorEl.textContent = '기록 실패: ' + (error.message || '네트워크 오류')
    recordErrorEl.classList.remove('hidden')
  } else {
    hasRecordedThisGame = true
    loadLeaderboard()
    gameOverEl.classList.add('hidden')
    startScreenEl.classList.remove('hidden')
  }
})

async function loadLeaderboard() {
  leaderboardListEl.innerHTML = '<li class="leaderboard-loading">불러오는 중...</li>'
  const { data, error } = await fetchLeaderboard(10)
  if (error) {
    leaderboardListEl.innerHTML = '<li class="leaderboard-error">리더보드를 불러올 수 없습니다</li>'
    return
  }
  if (!data || data.length === 0) {
    leaderboardListEl.innerHTML = '<li class="leaderboard-empty">아직 기록이 없습니다</li>'
    return
  }
  leaderboardListEl.innerHTML = data
    .map(
      (row, i) =>
        `<li><span class="rank">${i + 1}</span><span class="name">${escapeHtml(row.nickname)}</span><span class="score">${row.score}</span></li>`
    )
    .join('')
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

pauseBtn.addEventListener('click', pauseGame)
resumeBtn.addEventListener('click', resumeGame)
quitBtn.addEventListener('click', quitGame)

// 키보드 입력
document.addEventListener('keydown', (e) => {
  if (!isRunning || isPaused) return

  switch (e.key) {
    case 'ArrowUp':
      e.preventDefault()
      nextDirection = DIRECTION.UP
      break
    case 'ArrowDown':
      e.preventDefault()
      nextDirection = DIRECTION.DOWN
      break
    case 'ArrowLeft':
      e.preventDefault()
      nextDirection = DIRECTION.LEFT
      break
    case 'ArrowRight':
      e.preventDefault()
      nextDirection = DIRECTION.RIGHT
      break
  }
})

// 초기 표시
highScoreEl.textContent = `최고: ${highScore}`
speedDisplayEl.textContent = `속도: ${INITIAL_SPEED_MS}ms`

loadLeaderboard()
