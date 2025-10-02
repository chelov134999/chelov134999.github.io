(function loadStarEngineConfig() {
  const runtime = window.__STAR_ENGINE_CONFIG__ || {};
  const defaults = {
    formLiffId: '2008215846-5LwXlWVN',
    reportLiffId: '2008215846-5LwXlWVN',
    liffId: '2008215846-5LwXlWVN',
    webhookUrl: 'https://chelov134999.app.n8n.cloud/webhook/lead-entry',
    reportEndpoint: 'https://chelov134999.app.n8n.cloud/webhook/report-data',
    reportUrl: 'https://liff.line.me/2008215846-5LwXlWVN?view=report',
  };

  const coalesce = (key) => (runtime[key] ?? defaults[key] ?? '');

  const config = {
    formLiffId: coalesce('formLiffId') || coalesce('liffId'),
    reportLiffId: coalesce('reportLiffId') || coalesce('liffId'),
    liffId: coalesce('liffId'),
    webhookUrl: coalesce('webhookUrl'),
    reportEndpoint: coalesce('reportEndpoint'),
    reportUrl: coalesce('reportUrl'),
    formUrl: coalesce('formUrl') || coalesce('form_url'),
    googlePlacesApiKey: coalesce('googlePlacesApiKey'),
    scraperApiKey: coalesce('scraperApiKey'),
    sampleReportUrl: coalesce('sampleReportUrl'),
    checkoutPrimaryUrl: coalesce('checkoutPrimaryUrl'),
    checkoutSecondaryUrl: coalesce('checkoutSecondaryUrl'),
  };

  const missing = Object.entries({
    webhookUrl: config.webhookUrl,
    reportEndpoint: config.reportEndpoint,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    console.warn('[star-engine] 以下設定缺失，部分功能將無法使用：', missing.join(', '));
  }

  window.STAR_ENGINE_CONFIG = Object.freeze(config);
})();
