// Theme Management
(function() {
  const THEME_KEY = 'pe1-theme';
  let themeToggle = document.getElementById('themeToggle');
  
  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  
  function getStoredTheme() {
    return localStorage.getItem(THEME_KEY);
  }
  
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }
  
  function initTheme() {
    const stored = getStoredTheme();
    const system = getSystemTheme();
    const theme = stored || system;
    setTheme(theme);
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!getStoredTheme()) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
  
  // Initialize theme immediately (before DOMContentLoaded to prevent flash)
  initTheme();
  
  // Toggle handler - runs after DOM is ready
  function setupToggle() {
    themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || getSystemTheme();
        const next = current === 'dark' ? 'light' : 'dark';
        setTheme(next);
      });
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupToggle);
  } else {
    setupToggle();
  }
})();

// PWA Install Logic
let deferredPrompt = null;
const installBtn = document.getElementById('installBtn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) {
    installBtn.hidden = false;
  }
});

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    installBtn.hidden = true;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User ${outcome} the install prompt`);
    deferredPrompt = null;
  });
}

window.addEventListener('appinstalled', () => {
  console.log('PWA installed');
  if (installBtn) {
    installBtn.hidden = true;
  }
  deferredPrompt = null;
});

if (window.matchMedia('(display-mode: standalone)').matches) {
  if (installBtn) {
    installBtn.hidden = true;
  }
}

// Samsung Internet install hint (no beforeinstallprompt support)
function showSamsungInstallHint() {
  const isSamsung = /SamsungBrowser/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const dismissed = localStorage.getItem('samsungInstallDismissed');
  
  if (isSamsung && !isStandalone && !dismissed) {
    const hint = document.createElement('div');
    hint.id = 'samsungInstallHint';
    hint.style.cssText = 'position:fixed;bottom:1rem;left:1rem;right:1rem;max-width:400px;margin:0 auto;background:var(--color-accent);color:white;padding:1rem;border-radius:12px;box-shadow:var(--shadow-float);z-index:1000;font-size:0.9rem;line-height:1.5;';
    hint.innerHTML = `
      <strong>📱 Als App installieren</strong><br>
      Tippe auf <strong>⋮ Menü</strong> (unten rechts) → <strong>"App installieren"</strong> oder <strong>"Zum Startbildschirm"</strong>.
      <button onclick="this.parentElement.remove();localStorage.setItem('samsungInstallDismissed','1')" style="margin-top:0.5rem;padding:0.4rem 1rem;background:#fbbf24;border:none;border-radius:6px;font-weight:600;">Verstanden</button>
    `;
    document.body.appendChild(hint);
  }
}

// Show hint after short delay
setTimeout(showSamsungInstallHint, 3000);

// Also add a persistent install button for Samsung in the UI
function addSamsungInstallButton() {
  const isSamsung = /SamsungBrowser/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  if (isSamsung && !isStandalone) {
    // Add to first feature card or main content
    const firstCard = document.querySelector('.features .feature-card, .features article');
    if (firstCard && !document.getElementById('samsungInstallInfo')) {
      const info = document.createElement('div');
      info.id = 'samsungInstallInfo';
      info.style.cssText = 'margin-top:1rem;padding:1rem;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:8px;font-size:0.85rem;color:var(--color-text);text-align:center;';
      info.innerHTML = `
        <strong>📱 Samsung Internet:</strong> Installation über <strong>⋮ Menü (unten rechts)</strong> → <strong>"App installieren"</strong> oder <strong>"Zum Startbildschirm"</strong>.<br>
        <small>Erscheint nach 1-2 Besuchen. Falls nicht: Seite als Lesezeichen speichern → Startbildschirm hinzufügen.</small>
      `;
      firstCard.appendChild(info);
    }
  }
}

// Run when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addSamsungInstallButton);
} else {
  addSamsungInstallButton();
}

document.addEventListener('DOMContentLoaded', () => {
  const currentPage = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav a').forEach(link => {
    if (link.getAttribute('href') === currentPage) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}