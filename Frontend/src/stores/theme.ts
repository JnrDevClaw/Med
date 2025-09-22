import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'light' | 'dark';

// Get initial theme from localStorage or default to light
function getInitialTheme(): Theme {
  if (!browser) return 'light';
  
  const stored = localStorage.getItem('medconnect-theme');
  if (stored === 'dark' || stored === 'light') return stored;
  
  // Check system preference
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  
  return 'light';
}

// Create theme store
export const theme = writable<Theme>(getInitialTheme());

// Theme toggle function
export function toggleTheme() {
  theme.update(current => {
    const newTheme = current === 'light' ? 'dark' : 'light';
    
    if (browser) {
      localStorage.setItem('medconnect-theme', newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
    }
    
    return newTheme;
  });
}

// Initialize theme on client
if (browser) {
  theme.subscribe(value => {
    document.documentElement.setAttribute('data-theme', value);
    localStorage.setItem('medconnect-theme', value);
  });
  
  // Set initial theme
  const initialTheme = getInitialTheme();
  document.documentElement.setAttribute('data-theme', initialTheme);
}