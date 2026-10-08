// Instalación como app (PWA): service worker para jugar sin conexión y botón «Instalar».

export function setupInstall(button, hint) {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) {
    hint.textContent = 'Estás jugando la versión instalada.';
    return;
  }
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    button.hidden = false;
    hint.textContent = 'Se instala como una app: pantalla completa y funciona sin conexión después de la primera carga.';
  });
  button.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    button.hidden = true;
  });
  window.addEventListener('appinstalled', () => {
    button.hidden = true;
    hint.textContent = '¡Instalada! Búscala en tu pantalla de inicio.';
  });
}
