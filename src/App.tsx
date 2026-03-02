import { Routes, Route } from 'react-router-dom'
import { BoardEditor } from './view/BoardEditor'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<BoardEditor />} />
    </Routes>
  )
}
