import { useStore } from './store'
import { StartScreen } from './components/StartScreen'
import { GraphScreen } from './components/GraphScreen'
import { ValidationPlanView } from './components/ValidationPlanView'

export default function App() {
  const view = useStore((s) => s.view)
  if (view === 'start') return <StartScreen />
  if (view === 'validation_plan') return <ValidationPlanView />
  return <GraphScreen />
}
