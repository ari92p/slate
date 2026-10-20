/** Reveal an updated document from a pointer or button's center.
 * apply must resolve after your framework has committed its DOM changes.
 */
export async function revealTheme(apply, { event, duration = 500, easing = 'ease-out' } = {}) {
  const root = document.documentElement;
  if (root.classList.contains('theme-ripple-active')) return false;
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    await apply();
    return true;
  }
  const rect = event?.currentTarget?.getBoundingClientRect();
  const pointer = event && event.detail !== 0 && Number.isFinite(event.clientX) && Number.isFinite(event.clientY);
  const x = pointer ? event.clientX : rect ? rect.left + rect.width / 2 : innerWidth / 2;
  const y = pointer ? event.clientY : rect ? rect.top + rect.height / 2 : innerHeight / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.style.setProperty('--theme-ripple-duration', `${duration}ms`);
  root.style.setProperty('--theme-ripple-x', `${x}px`);
  root.style.setProperty('--theme-ripple-y', `${y}px`);
  root.classList.add('theme-ripple-active');
  try {
    const transition = document.startViewTransition(apply);
    try {
      await transition.ready;
      root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] }, {
        duration, easing, fill: 'both', pseudoElement: '::view-transition-new(root)',
      });
    } catch {
      // A skipped snapshot still applies the theme. Release its overlay promptly.
      transition.skipTransition();
    }
    await transition.updateCallbackDone;
    await transition.finished.catch(() => {});
    return true;
  } finally {
    root.classList.remove('theme-ripple-active');
    root.style.removeProperty('--theme-ripple-duration');
    root.style.removeProperty('--theme-ripple-x');
    root.style.removeProperty('--theme-ripple-y');
  }
}

/** Ready-to-use class-based theme controller. Storage is optional and best effort. */
export function createThemeToggle({ initialTheme = 'dark', storageKey = 'theme', onChange } = {}) {
  if (!['dark', 'light'].includes(initialTheme)) throw new TypeError('initialTheme must be dark or light');
  let theme = initialTheme;
  try {
    const saved = storageKey && localStorage.getItem(storageKey);
    if (saved === 'dark' || saved === 'light') theme = saved;
  } catch { /* Storage can be unavailable in embedded webviews. */ }
  const apply = () => {
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(theme);
    try { if (storageKey) localStorage.setItem(storageKey, theme); } catch {}
    onChange?.(theme);
  };
  apply();
  return {
    get theme() { return theme; },
    toggle(event, options = {}) {
      return revealTheme(() => { theme = theme === 'dark' ? 'light' : 'dark'; apply(); }, { ...options, event });
    },
  };
}
