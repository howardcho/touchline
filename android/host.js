// This adapter is loaded only by the offline Android package, before the shared app.
(() => {
  const call = command => {
    const reply = JSON.parse(window.TouchlineAndroid.request(JSON.stringify(command)));
    if (reply.error) throw new Error(reply.error);
    return reply.value;
  };
  let clockView;
  window.touchlineNative = {
    setClockView: enabled => {
      if (clockView === enabled) return;
      call({action:'fullscreen',enabled:!!enabled});
      clockView = enabled;
    },
    premium: {
      status: () => call({action:'premiumStatus'}),
      purchase: () => call({action:'purchasePremium'}),
      restore: () => call({action:'restorePremium'}),
      debugUnlock: () => call({action:'debugUnlockPremium'})
    },
    audio: {postMessage: command => {
      try { return Promise.resolve(call(command)); }
      catch (error) { return Promise.reject(error); }
    }},
    postMessage: command => call({action:'keepAwake',enabled:!!command.keepAwake})
  };
})();
