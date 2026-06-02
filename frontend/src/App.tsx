// frontend/src/App.tsx
import AppRouter from './router/AppRouter'
import { ToastProvider } from './components/toast/ToastProvider'

export default function App() {
  return (
    <ToastProvider>
      <AppRouter />
    </ToastProvider>
  )
}
