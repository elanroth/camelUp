import { useState } from 'react'
import { BoardEditor } from './view/BoardEditor'
import { PlayMode } from './view/PlayMode'
import { RandomTestView } from './view/RandomTestView'

type Tab = 'editor' | 'play-mode' | 'random-test'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('editor')

  return (
    <div className="h-screen flex flex-col">
      {/* Tab navigation */}
      <div className="flex-shrink-0 bg-amber-300 border-b-2 border-amber-400">
        <div className="flex">
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-6 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'editor'
                ? 'bg-amber-100 text-amber-900 border-b-2 border-amber-900'
                : 'text-amber-800 hover:bg-amber-200'
            }`}
          >
            🐪 Analyzer / Editor
          </button>
          <button
            onClick={() => setActiveTab('play-mode')}
            className={`px-6 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'play-mode'
                ? 'bg-amber-100 text-amber-900 border-b-2 border-amber-900'
                : 'text-amber-800 hover:bg-amber-200'
            }`}
          >
            🎮 Play Mode
          </button>
          <button
            onClick={() => setActiveTab('random-test')}
            className={`px-6 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'random-test'
                ? 'bg-amber-100 text-amber-900 border-b-2 border-amber-900'
                : 'text-amber-800 hover:bg-amber-200'
            }`}
          >
            🎲 Random Testing
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'editor' && <BoardEditor />}
        {activeTab === 'play-mode' && <PlayMode />}
        {activeTab === 'random-test' && <RandomTestView />}
      </div>
    </div>
  )
}
