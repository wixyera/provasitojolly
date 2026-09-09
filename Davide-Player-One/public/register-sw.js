(function () {
  if (!('serviceWorker' in navigator)) return;
  var reloaded = false;
  var hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (hadController && !reloaded) { reloaded = true; location.reload(); }
  });
  function register() {
    navigator.serviceWorker.register('/sw.js', {updateViaCache:'none'}).then(function (registration) {
      return registration.update();
    }).catch(function () {});
  }
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, {once:true});
})();
