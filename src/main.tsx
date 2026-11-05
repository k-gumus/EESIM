import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './styles.css';
import App from './App';
import { useCircuit } from './store/circuitStore';
import { runner } from './sim/runner';
import { useUI } from './store/uiStore';

// Geliştirme modunda test/otomasyon için erişim noktası
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__ieeesim = { circuit: useCircuit, runner, ui: useUI };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
