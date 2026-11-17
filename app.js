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