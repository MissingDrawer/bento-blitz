# 🍱 Bento Blitz — 便當接接樂

> 一款在行動裝置與瀏覽器上運行的 2D 雙重任務休閒遊戲。
> 用滑鼠或手指左右移動角色，接住掉落的便當得分，同時還要正確處理突如其來的手機來電！

---

## 遊戲玩法

### 基礎操作
- **滑鼠**：在畫面上移動滑鼠，角色會平滑跟隨
- **觸控**：用手指在畫面上滑動（支援行動裝置）
- 接住 🟩 **便當** → `+10 分`
- 碰到 💀 **陷阱** → `-15 分`
- 分數掉到 `-100` 以下 → **Game Over**

### 雙重任務：手機來電

每隔 **10 秒**，畫面左右側會彈出手機來電 UI，必須在 **3 秒內** 做出正確反應：

| 來電類型 | 正確動作 | 正確結果 | 錯誤或逾時 |
|----------|----------|----------|------------|
| 📞 **正經電話**（老闆、PM、主管） | 點「接聽」| 定身 3 秒 + 顯示職場垃圾話 | 扣 50 分 |
| ⚠️ **詐騙電話**（飆股、貸款、中獎）| 點「掛斷」| 無懲罰，繼續接便當 | 分數歸零 + 定身 5 秒 |

---

## 環境需求

| 工具 | 版本 |
|------|------|
| Node.js | `v18.x`（建議 `v18.20.1+`） |
| npm | `10.x`（建議 `10.5.0+`） |

> ⚠️ **注意**：Vite 5.x 需要 Node.js 18+。此專案使用 Vite 5，不支援 Node.js 16 及以下版本。

---

## 套件版本

### 執行依賴 (dependencies)

| 套件 | 版本 |
|------|------|
| `react` | `18.3.1` |
| `react-dom` | `18.3.1` |

### 開發依賴 (devDependencies)

| 套件 | 版本 |
|------|------|
| `vite` | `5.4.21` |
| `@vitejs/plugin-react` | `4.7.0` |
| `typescript` | `5.9.3` |
| `@types/react` | `18.3.31` |
| `@types/react-dom` | `18.3.7` |

---

## 快速啟動

```bash
# 1. 進入專案資料夾
cd bento-blitz

# 2. 安裝依賴（首次執行）
npm install

# 3. 啟動開發伺服器
npm run dev
```

開啟瀏覽器前往 → **http://localhost:5173**

### 其他指令

```bash
# 編譯正式版本（輸出至 dist/）
npm run build

# 預覽正式版本
npm run preview

# TypeScript 型別檢查
npx tsc --noEmit
```

---

## 專案結構

```
bento-blitz/
├── index.html              # HTML 入口，設定 viewport 禁止縮放（行動裝置用）
├── vite.config.ts          # Vite 設定（使用 @vitejs/plugin-react）
├── tsconfig.json           # TypeScript 嚴格模式設定
├── package.json
└── src/
    ├── main.tsx            # React 掛載入口
    ├── App.tsx             # 根元件（只包裝 GameCanvas）
    └── GameCanvas.tsx      # 遊戲主元件（全部核心邏輯）
```

### GameCanvas.tsx 架構

```
requestAnimationFrame loop
├── update(gs, now, dt)
│   ├── 玩家移動（平滑追蹤 targetX）
│   ├── 生成掉落物（便當 / 陷阱）
│   ├── 碰撞偵測（AABB）
│   ├── 生成手機來電（每 10 秒）
│   └── 來電逾時處理
├── render(ctx, gs, now)     ← Canvas 繪製
│   ├── 背景城市景
│   ├── 掉落物（幾何圖形）
│   ├── 玩家角色（定身時變藍）
│   ├── HUD（分數 / 最高分 / 計時）
│   └── 定身遮罩 / 開始 / 結束畫面
└── 僅在 calls 或 status 改變時 → setState
    └── React 重繪手機來電 HTML Overlay（含倒數條）
```

> 遊戲狀態全部存在 `useRef`（不觸發 re-render），HTML overlay 只在來電增減時才同步，確保 60fps 不中斷。

---

## 技術選型說明

- **React + TypeScript**：元件化 UI + 型別安全
- **HTML5 Canvas**：高效能 2D 遊戲渲染，避免 DOM diff 開銷
- **HTML Overlay**：手機來電 UI 用 React 絕對定位覆蓋 canvas，方便處理按鈕點擊事件
- **requestAnimationFrame**：原生 60fps 遊戲迴圈，不依賴 `setInterval`
- **Vite**：極速 HMR 開發體驗，無需額外 webpack 設定

---

## 後續擴充方向（待實作）

- [ ] 替換幾何圖形為實際美術素材（sprite sheet）
- [ ] 接入 Claude API 動態生成職場垃圾話
- [ ] 音效（接便當、來電鈴聲、定身音效）
- [ ] 難度曲線（隨時間加快掉落速度 & 縮短來電反應時間）
- [ ] 排行榜（localStorage 或後端 API）
- [ ] PWA 設定（可安裝到手機主畫面）
