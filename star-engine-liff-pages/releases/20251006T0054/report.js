(function initReportPage() {
  const params = new URLSearchParams(window.location.search);
  const config = window.STAR_ENGINE_CONFIG || {};
  const reportEndpoint = config.reportDataUrl || config.report_data_url || 'https://chelov134999.app.n8n.cloud/webhook/report-data';
  const planPage = config.plansPageUrl || config.planPageUrl || config.planUrl || 'plans.html?v=20251006T0054';
  const samplePage = config.sampleReportUrl || 'sample-report.html';
  const lineFallbackUrl = config.lineFallbackUrl || 'https://line.me/R/ti/p/@star-up';

  const dom = {
    skeleton: document.getElementById('report-skeleton'),
    loading: document.getElementById('report-loading'),
    content: document.getElementById('report-content'),
    error: document.getElementById('report-error'),
    errorMessage: document.getElementById('report-error-message'),
    errorRetry: document.getElementById('error-retry'),
    errorReturn: document.getElementById('error-return-line'),
    btnReturnLine: document.getElementById('btn-return-line'),
    ctaPlan: document.getElementById('cta-plan-main'),
    ctaSecondary: document.getElementById('cta-secondary'),
    cognosEyebrow: document.getElementById('cognos-eyebrow'),
    cognosTitle: document.getElementById('cognos-title'),
    cognosSubtitle: document.getElementById('cognos-subtitle'),
    alertLoss: document.getElementById('alert-loss'),
    alertGain: document.getElementById('alert-gain'),
    prefs: document.getElementById('report-preferences'),
    prefGoal: document.getElementById('pref-goal'),
    prefTone: document.getElementById('pref-tone'),
    metrics: document.getElementById('report-metrics'),
    competitors: document.getElementById('report-competitors'),
    actions: document.getElementById('report-actions'),
    drafts: document.getElementById('report-drafts'),
  };

  const state = {
    token: params.get('token') || params.get('report_token') || '',
    leadId: params.get('lead_id') || params.get('leadId') || '',
    templateId: 'unknown',
    retry: 0,
    maxRetry: 3,
  };

  function setView({ skeleton = false, loading = false, content = false, error = false }) {
    if (dom.skeleton) dom.skeleton.hidden = !skeleton;
    if (dom.loading) dom.loading.hidden = !loading;
    if (dom.content) dom.content.hidden = !content;
    if (dom.error) dom.error.hidden = !error;
  }

  function closeToLine() {
    try {
      if (window.liff?.closeWindow) {
        window.liff.closeWindow();
        return;
      }
    } catch (error) {
      console.warn('[liff] closeWindow failed', error);
    }
    window.location.href = lineFallbackUrl;
  }

  async function requestReport() {
    const headers = { 'Content-Type': 'application/json' };
    let url = reportEndpoint;
    let options = { method: 'GET', headers };

    if (state.token) {
      options = {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'getbytoken', token: state.token }),
      };
    } else if (state.leadId) {
      const requestUrl = new URL(reportEndpoint);
      requestUrl.searchParams.set('lead_id', state.leadId);
      url = requestUrl.toString();
    }

    const response = await fetch(url, options);
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || response.statusText);
    }
    const payload = text ? JSON.parse(text) : {};
    return payload;
  }

  function validatePayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return { ok: false, message: '回應為空' };
    }

    const report = payload.report;
    if (!report || typeof report !== 'object') {
      return { ok: false, message: '缺少報告內容' };
    }

    const metrics = report.metrics || report.kpi;
    const competitors = report.competitors || report.competitors_agent;
    const actions = report.weekly_actions;
    const drafts = report.reply_drafts;

    const missing = [];
    if (!report.goal_label) missing.push('目標說明');
    if (!report.tone_label) missing.push('語氣說明');
    if (!metrics || (Array.isArray(metrics) ? metrics.length === 0 : Object.keys(metrics).length === 0)) {
      missing.push('關鍵指標');
    }
    if (!Array.isArray(competitors) || !competitors.length) missing.push('競品資料');
    if (!Array.isArray(actions) || !actions.length) missing.push('本週三件事');
    if (!Array.isArray(drafts) || !drafts.length) missing.push('回覆草稿');

    if (missing.length) {
      return { ok: false, message: `缺少欄位：${missing.join('、')}` };
    }

    return { ok: true };
  }

  function renderReport(payload) {
    const { renderMetrics, renderCompetitors, renderActions, renderDrafts } = window.ReportUtils || {};
    const report = payload.report || {};
    const preferences = payload.preferences || {};
    const psychology = payload.psychology || {};

    const nickname = report.owner_name || preferences.nickname || payload.nickname || '店長';
    const storeName = report.store_name || preferences.store_name || '你的門市';
    const city = report.city || preferences.city || payload.city || '';
    const goalLabel = report.goal_label || '—';
    const toneLabel = report.tone_label || '—';

    const lossMessage = psychology.message || `若不處理，預估流失金額尚待計算。`;
    const gainMessage = `看看我能為 ${storeName} 挽回多少營收。`;

    state.templateId = psychology.template_id || payload.template_id || 'unknown';
    state.leadId = payload.lead_id || state.leadId;

    if (dom.cognosEyebrow) {
      dom.cognosEyebrow.textContent = `Hi ${nickname}，我是 Cognos`;
    }
    if (dom.cognosTitle) {
      dom.cognosTitle.textContent = `我正在守護 ${storeName}`;
    }
    if (dom.cognosSubtitle) {
      const locationText = city ? `${city} 的競品與評論` : '附近的競品與評論';
      dom.cognosSubtitle.textContent = `我已定位 ${storeName}，正在蒐集 ${locationText}，30 秒內把行動方案交到你手上。`;
    }

    if (dom.alertLoss) {
      dom.alertLoss.textContent = lossMessage;
    }
    if (dom.alertGain) {
      dom.alertGain.textContent = gainMessage;
    }

    if (dom.prefs) {
      dom.prefGoal.textContent = `目標：${goalLabel}`;
      dom.prefTone.textContent = `語氣：${toneLabel}`;
      dom.prefs.hidden = false;
    }

    if (renderMetrics && dom.metrics) {
      renderMetrics(dom.metrics, report.metrics || report.kpi);
    }
    if (renderCompetitors && dom.competitors) {
      renderCompetitors(dom.competitors, report.competitors || report.competitors_agent);
    }
    if (renderActions && dom.actions) {
      renderActions(dom.actions, report.weekly_actions);
    }
    if (renderDrafts && dom.drafts) {
      renderDrafts(dom.drafts, report.reply_drafts, {
        onCopy: async (text) => {
          try {
            await navigator.clipboard.writeText(text);
            logEvent('report_draft_copy', {
              lead_id: state.leadId,
              template_id: state.templateId,
            });
          } catch (error) {
            console.warn('[report] copy failed', error);
          }
        },
      });
    }

    if (dom.ctaPlan) {
      const search = new URLSearchParams({
        lead_id: state.leadId || '',
        template_id: state.templateId || 'unknown',
      });
      dom.ctaPlan.href = `${planPage}?${search.toString()}`;
    }
  }

  function handleSuccess(payload) {
    renderReport(payload);
    setView({ content: true });
    state.retry = 0;
    logEvent('report_load', {
      status: 'complete',
      lead_id: state.leadId,
      template_id: state.templateId,
    });
  }

  function handlePending(payload) {
    setView({ loading: true });
    logEvent('report_load', {
      status: 'pending',
      lead_id: state.leadId,
      template_id: state.templateId,
      retry: state.retry,
    });

    if (state.retry >= state.maxRetry) {
      setView({ error: true });
      if (dom.errorMessage) {
        dom.errorMessage.textContent = '分析仍在進行中，請稍後從 LINE 再次開啟報表。';
      }
      logEvent('report_load', {
        status: 'timeout',
        lead_id: state.leadId,
        template_id: state.templateId,
      });
      return;
    }

    const nextCheck = Number(payload.next_check || 10) * 1000;
    state.retry += 1;
    setTimeout(startFetch, Math.min(Math.max(nextCheck, 5000), 20000));
  }

  function handleFailure(error) {
    setView({ error: true });
    if (dom.errorMessage) {
      dom.errorMessage.textContent = error?.message || '無法載入報表，請稍後再試。';
    }
    logEvent('report_load', {
      status: 'failed',
      lead_id: state.leadId,
      template_id: state.templateId,
      error: error?.message || String(error),
    });
  }

  async function startFetch() {
    try {
      if (!state.retry) {
        setView({ skeleton: true });
      }
      const payload = await requestReport();

      if (payload.status && typeof payload.status === 'object') {
        const stateValue = payload.status.state || payload.status;
        if (stateValue === 'failed') {
          throw new Error(payload.status.message || '生成報表失敗');
        }
      }

      const status = (typeof payload.status === 'string') ? payload.status : payload.status?.state;
      if (status === 'pending') {
        handlePending(payload);
        return;
      }

      const validation = validatePayload(payload);
      if (!validation.ok) {
        throw new Error(validation.message);
      }

      handleSuccess(payload);
    } catch (error) {
      handleFailure(error);
    } finally {
      if (dom.skeleton) dom.skeleton.hidden = true;
    }
  }

  if (dom.ctaSecondary) {
    dom.ctaSecondary.addEventListener('click', () => {
      const search = new URLSearchParams({
        lead_id: state.leadId || '',
        template_id: state.templateId || 'unknown',
      });
      const targetUrl = `${samplePage}?${search.toString()}`;
      window.open(targetUrl, '_blank');
      logEvent('cta_click', {
        action: 'secondary',
        lead_id: state.leadId,
        template_id: state.templateId,
        source: 'report',
      });
    });
  }

  if (dom.ctaPlan) {
    dom.ctaPlan.addEventListener('click', () => {
      logEvent('cta_click', {
        action: 'main',
        lead_id: state.leadId,
        template_id: state.templateId,
        source: 'report',
      });
    });
  }

  const closeButtons = [dom.btnReturnLine, dom.errorReturn];
  closeButtons.forEach((button) => {
    if (!button) return;
    button.addEventListener('click', () => {
      closeToLine();
    });
  });

  if (dom.errorRetry) {
    dom.errorRetry.addEventListener('click', () => {
      state.retry = 0;
      setView({ skeleton: true });
      startFetch();
    });
  }

  startFetch();
})();
