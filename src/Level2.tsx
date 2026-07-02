interface LevelProps { onBack: () => void }

export default function Level2({ onBack }: LevelProps) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(135deg,#1a2a4a,#2a5298)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'sans-serif', color: '#fff', gap: 16,
    }}>
      <div style={{ fontSize: 72 }}>♻️</div>
      <div style={{ fontSize: 30, fontWeight: 700 }}>垃圾分類王</div>
      <div style={{ fontSize: 16, color: '#93c5fd' }}>即將推出...</div>
      <button
        onPointerDown={onBack}
        style={{
          marginTop: 16, padding: '10px 28px',
          background: 'rgba(255,255,255,0.1)', color: '#fff',
          border: '2px solid rgba(255,255,255,0.3)',
          borderRadius: 10, fontSize: 16, cursor: 'pointer', fontFamily: 'sans-serif',
        }}
      >← 返回大廳</button>
    </div>
  )
}
