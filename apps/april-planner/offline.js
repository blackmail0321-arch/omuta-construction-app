(function () {
'use strict';
const $ = id => document.getElementById(id);
let registration, reloadForUpdate = false;
const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
function status(text, kind = '') {
  $('offline-status').textContent = text;
  $('offline-banner').dataset.state = kind;
}
function askWorker(worker, type = 'CACHE_STATUS') {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => reject(Error('準備状況を確認できませんでした。')), 8000);
    channel.port1.onmessage = event => {clearTimeout(timeout);channel.port1.close();resolve(event.data);};
    worker.postMessage({type}, [channel.port2]);
  });
}
function updateAvailable() {
  if (!registration?.waiting) return;
  $('offline-update').hidden = false;
}
async function setup() {
  $('offline-retry').hidden = true;
  if (location.protocol === 'file:') {
    status('PC用の単体ファイルで利用中です。iPadへの保存は公開用URLから行います。');return;
  }
  if (!window.isSecureContext || !('serviceWorker' in navigator)) {
    status('iPad単独利用の準備は、SafariでHTTPSの公開用URLを開いて行ってください。');return;
  }
  status('オフライン利用の準備中です。この画面を開いたままお待ちください。', 'loading');
  try {
    const scope = new URL('./', location.href).href;
    registration = await navigator.serviceWorker.getRegistration(scope);
    if (!registration?.active || registration.scope !== scope) registration = await navigator.serviceWorker.register('./service-worker.js', {scope: './', updateViaCache: 'none'});
    updateAvailable();
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => {if (installing.state === 'installed') updateAvailable();});
    });
    if (navigator.onLine) registration.update().catch(() => {});
    const active = registration.active ? registration : await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(Error('準備が完了していません。通信を確認して再試行してください。')), 15000))
    ]);
    // An existing active worker belongs to the current installed version. Its cache is verified before showing ready.
    let result = await askWorker(active.active);
    if (!result.ready && navigator.onLine) result = await askWorker(active.active, 'REPAIR_CACHE');
    if (!result.ready) throw Error('必要なファイルを保存できませんでした。通信を確認して再試行してください。');
    status(standalone() ? 'オフライン利用の準備完了。このアイコンから通信なしで使えます。' : 'オフライン利用の準備完了。iPadでは「共有」から「ホーム画面に追加」してください。', 'ready');
    $('offline-connection').textContent = navigator.onLine ? '端末内保存' : 'オフライン · 端末内保存';
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  } catch (error) {
    status('オフライン利用の準備が完了していません。' + error.message, 'error');
    $('offline-retry').hidden = false;
  }
}
$('offline-help').onclick = () => $('offline-dialog').showModal();
$('offline-retry').onclick = setup;
$('offline-update').onclick = () => {
  if (!registration?.waiting) return;
  if (window.Planner?.hasUnsavedChanges()) {alert('入力画面を保存して閉じてから更新してください。');return;}
  if (!confirm('保存済みの記録は保持したままアプリを更新します。念のためバックアップの保存をおすすめします。更新しますか？')) return;
  reloadForUpdate = true;
  registration.waiting.postMessage({type: 'ACTIVATE_UPDATE'});
};
navigator.serviceWorker?.addEventListener('controllerchange', () => {if (reloadForUpdate) location.reload();});
for (const type of ['online', 'offline']) addEventListener(type, () => {
  $('offline-connection').textContent = navigator.onLine ? '端末内保存' : 'オフライン · 端末内保存';
});
setup();
})();
