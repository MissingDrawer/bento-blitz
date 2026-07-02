import { useState, useEffect } from 'react'
import homeBg from './assets/home_bg.png'
import { LEVELS, LevelDef, loadHiScore, getStars } from './gameData'

interface LobbyProps {
  onPlay: (levelId: number) => void
}

export default function Lobby({ onPlay }: LobbyProps) {
  const [selectedLevel, setSelectedLevel] = useState<number | null>(1)
  const [hiScore, setHiScore] = useState(() => loadHiScore())
  const [, forceUpdate] = useState(0)

  // Re-read hi-score on mount (might have changed after a game)
  useEffect(() => { setHiScore(loadHiScore()) }, [])

  // Recalculate layout on resize
  useEffect(() => {
    const onResize = () => forceUpdate(n => n + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const vw = typeof window !== 'undefined' ? window.innerWidth  : 720
  const vh = typeof window !== 'undefined' ? window.innerHeight : 480
  const scale = Math.min(1.6, Math.max(0.7, Math.min(vw, vh) / 480))

  // Button positions (%) aligned to each circle in home_bg.png
  const levelNodes: Array<{ level: LevelDef; cx: string; cy: string }> = [
    { level: LEVELS[0], cx: '15%', cy: '68%' }, // GREEN  bottom-left
    { level: LEVELS[1], cx: '18%', cy: '33%' }, // YELLOW upper-left
    { level: LEVELS[2], cx: '74%', cy: '22%' }, // PURPLE upper-right
    { level: LEVELS[3], cx: '80%', cy: '64%' }, // INDIGO bottom-right
  ]

  const btnW  = Math.round(Math.min(160, vw * 0.13))
  const btnH  = Math.round(btnW * 0.52)
  const fTitle = Math.max(11, Math.round(btnW * 0.115))
  const fSub   = Math.max(9,  Math.round(btnW * 0.085))

  const canStart = selectedLevel != null && (LEVELS.find(l => l.id === selectedLevel)?.unlocked ?? false)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', fontFamily: 'sans-serif' }}>

      {/* Background image */}
      <img
        src={homeBg}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
        alt=""
      />

      {/* Level buttons — positioned over the circles in the background art */}
      {levelNodes.map(({ level, cx, cy }) => {
        const isSelected = selectedLevel === level.id
        const lvlHi = level.id === 1 ? hiScore : 0
        const stars = getStars(lvlHi)
        return (
          <div
            key={level.id}
            onPointerDown={() => { if (level.unlocked) setSelectedLevel(level.id) }}
            style={{
              position: 'absolute',
              left: cx, top: cy,
              transform: 'translate(-50%,-50%)',
              width: btnW, minHeight: btnH,
              background: isSelected
                ? level.bg
                : level.unlocked
                  ? 'rgba(10,20,50,0.82)'
                  : 'rgba(8,8,14,0.80)',
              border: `2px solid ${isSelected ? level.accent : level.unlocked ? 'rgba(180,200,255,0.35)' : 'rgba(80,80,80,0.4)'}`,
              borderRadius: 10,
              boxShadow: isSelected
                ? `0 0 24px ${level.accent}90, 0 4px 14px rgba(0,0,0,0.6)`
                : '0 3px 10px rgba(0,0,0,0.55)',
              cursor: level.unlocked ? 'pointer' : 'default',
              touchAction: 'manipulation', userSelect: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 3, padding: '6px 4px',
            }}
          >
            {/* Number badge */}
            <div style={{
              position: 'absolute', top: 5, left: 6,
              width: 18, height: 18, borderRadius: '50%',
              background: isSelected ? level.accent : 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 10,
              color: isSelected ? '#000' : '#fff',
            }}>{level.id}</div>

            <div style={{ fontSize: Math.round(btnW * 0.17) }}>{level.unlocked ? level.icon : '🔒'}</div>
            <div style={{ color: level.unlocked ? '#fff' : '#555', fontWeight: 700, fontSize: fTitle, textAlign: 'center' }}>
              {level.name}
            </div>
            {level.unlocked ? (
              <>
                <div style={{ fontSize: fSub, color: '#f0c040' }}>
                  {'⭐'.repeat(stars)}{'☆'.repeat(3 - stars)}
                </div>
                <div style={{ fontSize: Math.max(8, fSub - 1), color: '#8ab' }}>
                  {lvlHi > 0 ? `最高 ${lvlHi}` : '尚未遊玩'}
                </div>
              </>
            ) : (
              <div style={{ fontSize: fSub, color: '#555' }}>即將推出</div>
            )}

            {isSelected && (
              <div style={{ position: 'absolute', inset: 0, borderRadius: 8, background: `radial-gradient(circle,${level.accent}20 0%,transparent 70%)`, pointerEvents: 'none' }} />
            )}
          </div>
        )
      })}

      {/* Top gradient bar — title + hi-score */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${Math.round(10 * scale)}px ${Math.round(16 * scale)}px`,
        background: 'linear-gradient(180deg,rgba(0,0,0,0.7) 0%,rgba(0,0,0,0) 100%)',
        pointerEvents: 'none',
      }}>
        <div style={{ color: '#f0c040', fontSize: Math.round(20 * scale), fontWeight: 800, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
          🍱 便當接接樂
        </div>
        <div style={{
          color: '#f0c040', fontSize: Math.round(13 * scale),
          background: 'rgba(0,0,0,0.5)', padding: `3px ${Math.round(10 * scale)}px`,
          borderRadius: 20, border: '1px solid rgba(240,192,64,0.4)',
          pointerEvents: 'auto',
        }}>🏆 {hiScore}</div>
      </div>

      {/* Bottom gradient bar — utility buttons + start */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        display: 'flex', alignItems: 'center', gap: Math.round(8 * scale),
        padding: `${Math.round(10 * scale)}px ${Math.round(14 * scale)}px`,
        background: 'linear-gradient(0deg,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0) 100%)',
      }}>
        {[['📅', '每日簽到'], ['🎁', '每日獎勵']].map(([icon, label]) => (
          <button key={label} style={{
            padding: `${Math.round(7 * scale)}px ${Math.round(10 * scale)}px`,
            background: 'rgba(0,0,0,0.55)', color: '#ddd',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: Math.round(8 * scale), fontSize: Math.round(12 * scale),
            cursor: 'pointer', fontFamily: 'sans-serif', whiteSpace: 'nowrap',
          }}>{icon} {label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onPointerDown={() => { if (canStart && selectedLevel != null) onPlay(selectedLevel) }}
          style={{
            padding: `${Math.round(11 * scale)}px ${Math.round(24 * scale)}px`,
            background: canStart ? 'linear-gradient(135deg,#f0a020,#e06010)' : 'rgba(60,60,60,0.7)',
            color: canStart ? '#fff' : '#666',
            border: canStart ? '2px solid #f0c040' : '2px solid #444',
            borderRadius: Math.round(10 * scale),
            fontWeight: 700, fontSize: Math.round(16 * scale),
            cursor: canStart ? 'pointer' : 'not-allowed',
            fontFamily: 'sans-serif', whiteSpace: 'nowrap',
            boxShadow: canStart ? '0 4px 20px rgba(240,160,32,0.5)' : 'none',
            touchAction: 'manipulation',
            textShadow: canStart ? '0 1px 4px rgba(0,0,0,0.4)' : 'none',
          }}
        >{canStart ? '開始挑戰 →' : '選擇關卡'}</button>
      </div>
    </div>
  )
}
