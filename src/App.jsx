import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import NewRecord from './pages/NewRecord'
import RecordsList from './pages/RecordsList'
import RecordDetail from './pages/RecordDetail'
import Items from './pages/Items'
import Ranking from './pages/Ranking'
import Distances from './pages/Distances'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/new" element={<NewRecord />} />
      <Route path="/records" element={<RecordsList />} />
      <Route path="/records/:id" element={<RecordDetail />} />
      <Route path="/items" element={<Items />} />
      <Route path="/ranking" element={<Ranking />} />
      <Route path="/distances" element={<Distances />} />
    </Routes>
  )
}
