import { useState } from 'react'
import Lobby from './Lobby'
import GameCanvas from './GameCanvas'
import Level2 from './Level2'
import Level3 from './Level3'
import Level4 from './Level4'

type Screen = 'lobby' | 'level1' | 'level2' | 'level3' | 'level4'

export default function App() {
  const [screen, setScreen] = useState<Screen>('lobby')

  const goLobby = () => setScreen('lobby')

  if (screen === 'level1') return <GameCanvas onBack={goLobby} />
  if (screen === 'level2') return <Level2 onBack={goLobby} />
  if (screen === 'level3') return <Level3 onBack={goLobby} />
  if (screen === 'level4') return <Level4 onBack={goLobby} />
  return <Lobby onPlay={id => setScreen(`level${id}` as Screen)} />
}
