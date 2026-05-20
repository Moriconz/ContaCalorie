/**
 * THEME MANAGER
 * Gestisce cambio tema DARK/LIGHT con persistenza in localStorage
 */

export class ThemeManager {
  constructor(storageKey = 'theme') {
    this.storageKey = storageKey;
    this.themes = ['dark', 'light'];
    this.current = this.loadTheme();
    this.init();
  }

  loadTheme() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved && this.themes.includes(saved)) {
      return saved;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }

  init() {
    this.applyTheme(this.current);
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem(this.storageKey)) {
          this.setTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  }

  applyTheme(theme) {
    if (!this.themes.includes(theme)) {
      console.warn(`❌ Tema non valido: ${theme}`);
      return;
    }
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.add(`theme-${theme}`);
    this.themes.forEach((t) => {
      if (t !== theme) {
        document.documentElement.classList.remove(`theme-${t}`);
      }
    });
    this.current = theme;
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    console.log(`🎨 Tema: ${theme}`);
  }

  setTheme(theme) {
    if (!this.themes.includes(theme)) {
      console.warn(`❌ Tema non valido: ${theme}`);
      return;
    }
    this.applyTheme(theme);
    localStorage.setItem(this.storageKey, theme);
  }

  toggleTheme() {
    const next = this.current === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
    return next;
  }

  getTheme() {
    return this.current;
  }

  isDark() {
    return this.current === 'dark';
  }

  isLight() {
    return this.current === 'light';
  }
}

export const themeManager = new ThemeManager();
