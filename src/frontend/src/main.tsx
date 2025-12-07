/**
 * Application entry point mounting React to DOM.
 * Initializes root render with App component.
 */
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
