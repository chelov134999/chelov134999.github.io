(function createAnalytics(global) {
  function logEvent(name, payload) {
    let eventName = name;
    let eventPayload = payload;

    if (typeof name === 'object' && name) {
      eventName = name.type || 'event';
      eventPayload = { ...name };
      delete eventPayload.type;
    }

    const finalPayload = {
      ...(eventPayload || {}),
      timestamp: (eventPayload && eventPayload.timestamp) || Date.now(),
    };

    console.info('[analytics]', eventName, finalPayload);
    // TODO: integrate with internal analytics endpoint when available.
  }

  global.logEvent = logEvent;
})(window);
