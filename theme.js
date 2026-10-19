const storedTheme=localStorage.getItem('slate-theme');
const preferredTheme=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';
document.documentElement.dataset.theme=storedTheme==='light'||storedTheme==='dark'?storedTheme:preferredTheme;
