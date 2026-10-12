/* -----------------------------------------------------------------------------
   Kurd Castle — preview PWA glue
   Registers the service worker (so the game installs and runs offline) and adds
   an "Install app" affordance when the browser offers one. Kept out of main.js
   so the headless test harness never touches it.
   --------------------------------------------------------------------------- */

(function () {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;

  // file:// and sandboxed frames cannot register a worker; that is fine, the
  // game itself does not depend on it.
  if (location.protocol === 'file:') return;

  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
    /* offline play is a bonus, not a requirement */
  });

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    showInstallButton();
  });

  function showInstallButton() {
    if (document.getElementById('install-app')) return;
    const button = document.createElement('button');
    button.id = 'install-app';
    button.textContent = 'Install';
    button.title = 'Install Kurd Castle on this device';
    button.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      button.remove();
    });
    (document.getElementById('hud') || document.body).appendChild(button);
  }
})();
