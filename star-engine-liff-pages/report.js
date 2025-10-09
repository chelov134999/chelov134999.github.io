(function initReportPage() {
  const params = new URLSearchParams(window.location.search);
  const config = window.STAR_ENGINE_CONFIG || {};

  const reportEndpoint = config.reportEndpoint
    || config.reportDataUrl
    || config.report_data_url
    || 'https://chelov134999.app.n8n.cloud/webhook/report-data';
  const assistantEntryUrl = config.assistantEntryUrl || config.assistant_entry_url || '';
  const lineFallbackUrl = config.lineFallbackUrl || config.trialUrl || config.trial_url || 'https://line.me/R/ti/p/@star-up';
  const reportUrlBase = config.reportUrl || config.report_url || 'report.html';
  const formUrl = config.formUrl || config.form_url || 'index.html';

  const ANALYSIS_TIPS = [
    'AI 正在同步評論、曝光與守護任務…',
    '若資料偏多，系統會自動補齊後推播提醒。',
  ];

  const METRIC_STATE_PRESETS = {
    good: { label: '狀態良好', hint: '保持目前節奏即可。', icon: '🟢' },
    watch: { label: '需要關注', hint: '建議安排守護任務追蹤。', icon: '⚠️' },
    risk: { label: '立即處理', hint: '請優先處理風險項目。', icon: '🚨' },
  };

  const METRIC_DEFINITIONS = {
    review_health: {
      label: '評價健康',
      unit: '分',
      defaultHint: 'AI 正在檢查低星評論與回覆速度。',
      icons: { default: '🛡️', good: '🛡️', watch: '⚠️', risk: '🚨' },
      states: {
        good: { label: '健康', hint: '評論維持穩定，持續維運即可。' },
        watch: { label: '需留意', hint: '建議優先回覆待辦評論。' },
        risk: { label: '急需處理', hint: '請立即處理低星或未回覆評論。' },
      },
    },
    ai_visibility: {
      label: 'AI 可見度',
      unit: '分',
      defaultHint: 'AI 正在比對曝光與搜尋表現。',
      icons: { default: '📡', good: '📡', watch: '🟡', risk: '🚨' },
      states: {
        good: { label: '曝光穩定', hint: '持續更新內容維持可見度。' },
        watch: { label: '需加強', hint: '建議加強熱門關鍵字佈局。' },
        risk: { label: '嚴重不足', hint: '請安排守護專家補強曝光。' },
      },
    },
    pending_reviews: {
      label: '待辦評論',
      unit: '分',
      defaultHint: 'AI 正在排列守護任務與補件步驟。',
      icons: { default: '📝', good: '📝', watch: '📝', risk: '🚨' },
      states: {
        good: { label: '控管良好', hint: '評論待辦少，維持目前配置。' },
        watch: { label: '需跟進', hint: '建議排程回覆重要評論。' },
        risk: { label: '請立即處理', hint: '多筆待辦評論需立刻處理。' },
      },
    },
  };

  const TASK_SECTION_CONFIG = {
    priority_tasks: { emptyText: 'AI 正在整理守護任務。' },
    collection_steps: { emptyText: '補件清單整理中，稍後指引你補齊缺漏。' },
    repair_checklist: { emptyText: '目前沒有需要立即補救的評論。' },
  };

  const dom = {
    metricCards: document.querySelectorAll('.metric-card'),
    toast: document.getElementById('report-toast'),
    loading: document.getElementById('report-loading'),
    error: document.getElementById('report-error'),
    errorMessage: document.getElementById('report-error-message'),
    errorRetry: document.getElementById('report-error-retry'),
    errorHome: document.getElementById('report-error-home'),
    ctaPrimary: document.getElementById('report-cta-primary'),
    ctaRefresh: document.getElementById('report-cta-refresh'),
    ctaSecondary: document.getElementById('report-cta-secondary'),
    title: document.getElementById('report-title'),
    subtitle: document.getElementById('report-subtitle'),
    tasksSubtitle: document.getElementById('tasks-subtitle'),
  };

  const state = {
    token: params.get('token') || params.get('report_token') || '',
    leadId: params.get('lead_id') || params.get('leadId') || '',
    metricsRaw: null,
    metricsList: [],
    tasks: {
      priority_tasks: [],
      collection_steps: [],
      repair_checklist: [],
    },
    warnings: [],
    reportUrlOverride: '',
    isLoading: false,
  };

  function logEvent(name, payload) {
    if (typeof window.logEvent === 'function') {
      window.logEvent(name, payload);
    }
  }

  function showToast(message, duration = 2200) {
    if (!dom.toast) return;
    dom.toast.textContent = message;
    dom.toast.hidden = false;
    setTimeout(() => {
      dom.toast.hidden = true;
    }, duration);
  }

  function setLoading(isLoading) {
    state.isLoading = isLoading;
    if (dom.loading) {
      dom.loading.hidden = !isLoading;
    }
  }

  function showError(message) {
    if (dom.error) {
      dom.error.hidden = false;
    }
    if (dom.errorMessage) {
      dom.errorMessage.textContent = message || '暫時無法取得資料，請稍後再試。';
    }
  }

  function hideError() {
    if (dom.error) {
      dom.error.hidden = true;
    }
  }

  function determineMetricState(score) {
    if (score == null || Number.isNaN(Number(score))) return null;
    const value = Number(score);
    if (value >= 75) return 'good';
    if (value >= 55) return 'watch';
    return 'risk';
  }

  function parseMetricScore(metric) {
    if (!metric) return null;
    if (metric.display_score !== undefined) return metric.display_score;
    if (metric.score !== undefined) return metric.score;
    if (metric.value !== undefined) return metric.value;
    return null;
  }

  function formatMetricScore(value, unit = '') {
    if (value == null || value === '') return '—';
    const num = Number(value);
    if (Number.isFinite(num)) {
      const normalized = Math.abs(num) <= 1 ? num * 100 : num;
      return unit ? `${Math.round(normalized)} ${unit}` : `${Math.round(normalized)}`;
    }
    return String(value);
  }

  function resolveMetricDefinition(metricId) {
    return METRIC_DEFINITIONS[metricId] || {
      label: metricId,
      unit: '',
      defaultHint: 'AI 正在更新指標。',
      icons: { default: '⭐' },
      states: {},
    };
  }

  function renderMetricCard(metricId, metricData = null) {
    const definition = resolveMetricDefinition(metricId);
    const cards = document.querySelectorAll(`.metric-card[data-metric="${metricId}"]`);
    if (!cards.length) return;

    const scoreRaw = parseMetricScore(metricData);
    const stateKey = scoreRaw != null ? determineMetricState(scoreRaw) : null;
    const definitionState = stateKey && definition.states ? definition.states[stateKey] : null;
    const preset = stateKey ? METRIC_STATE_PRESETS[stateKey] : null;
    const label = metricData?.label || definition.label;
    const hintText = metricData?.hint || metricData?.description || definitionState?.hint || preset?.hint || definition.defaultHint;
    const stateLabel = metricData?.state_label || definitionState?.label || preset?.label || (stateKey ? stateKey.toUpperCase() : '整理中');
    const iconMap = definition.icons || {};
    const iconValue = metricData?.icon || definitionState?.icon || preset?.icon || iconMap[stateKey] || iconMap.default;
    const unit = metricData?.unit || definition.unit || '';
    const scoreDisplay = metricData?.display_score || formatMetricScore(scoreRaw, unit);

    cards.forEach((card) => {
      ['metric-card--state-good', 'metric-card--state-watch', 'metric-card--state-risk']
        .forEach((className) => card.classList.remove(className));
      if (stateKey) {
        card.classList.add(`metric-card--state-${stateKey}`);
      }
      const iconEl = card.querySelector('.metric-card__icon');
      if (iconEl && iconValue) {
        iconEl.textContent = iconValue;
      }
      const labelEl = card.querySelector('.metric-card__label');
      if (labelEl) {
        labelEl.textContent = label;
      }
      const scoreEl = card.querySelector('[data-role="score"]');
      if (scoreEl) {
        scoreEl.textContent = scoreDisplay;
      }
      const stateEl = card.querySelector('[data-role="state"]');
      if (stateEl) {
        stateEl.textContent = scoreRaw == null ? '整理中' : stateLabel;
      }
      const hintEl = card.querySelector('[data-role="hint"]');
      if (hintEl) {
        hintEl.textContent = hintText;
      }
    });
  }

  function resolveMetricId(candidate = {}, fallback) {
    if (!candidate || typeof candidate !== 'object') {
      return fallback;
    }
    return candidate.id
      || candidate.metric_id
      || candidate.metricId
      || candidate.key
      || candidate.code
      || fallback;
  }

  function normalizeMetricsInput(metrics) {
    const list = [];
    const map = {};

    const pushEntry = (entry, fallbackId) => {
      if (entry == null) return;
      const resolvedId = resolveMetricId(entry, fallbackId);
      const normalized = resolvedId && (!entry.id || entry.id !== resolvedId)
        ? { ...entry, id: resolvedId }
        : entry;
      if (resolvedId) {
        map[resolvedId] = normalized;
      }
      list.push(normalized);
    };

    if (Array.isArray(metrics)) {
      metrics.forEach((item, index) => {
        pushEntry(item, `metric_${index}`);
      });
    } else if (metrics && typeof metrics === 'object') {
      Object.entries(metrics).forEach(([key, value]) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          pushEntry(value, key);
        } else {
          pushEntry({ value }, key);
        }
      });
    }

    return { list, map };
  }

  function renderMetrics(metrics = []) {
    state.metricsRaw = metrics;
    const { list, map } = normalizeMetricsInput(metrics);
    state.metricsList = list;
    Object.keys(METRIC_DEFINITIONS).forEach((metricId) => {
      renderMetricCard(metricId, map[metricId] || null);
    });
  }

  function normalizeTaskItem(item) {
    if (item == null) return null;
    if (typeof item === 'string') {
      return { title: item, detail: '' };
    }
    if (Array.isArray(item)) {
      return { title: item.join('、'), detail: '' };
    }
    const title = item.title || item.name || item.label || item.summary || '';
    const detail = item.detail || item.description || item.note || item.hint || '';
    const actionUrl = item.url || item.link || item.action_url || '';
    return { title, detail, actionUrl };
  }

  function renderTasks(tasks = {}) {
    state.tasks = {
      priority_tasks: Array.isArray(tasks.priority_tasks) ? tasks.priority_tasks : [],
      collection_steps: Array.isArray(tasks.collection_steps) ? tasks.collection_steps : [],
      repair_checklist: Array.isArray(tasks.repair_checklist) ? tasks.repair_checklist : [],
    };

    Object.entries(TASK_SECTION_CONFIG).forEach(([taskKey, config]) => {
      const containers = document.querySelectorAll(`[data-task="${taskKey}"]`);
      const items = state.tasks[taskKey] || [];
      containers.forEach((container) => {
        const listEl = container.querySelector('[data-role="list"]');
        const emptyEl = container.querySelector('[data-role="empty"]');
        if (!listEl) return;
        listEl.innerHTML = '';
        if (!items.length) {
          if (emptyEl) {
            emptyEl.textContent = config.emptyText;
            emptyEl.hidden = false;
          }
          return;
        }
        if (emptyEl) {
          emptyEl.hidden = true;
        }
        items.forEach((rawItem) => {
          const normalized = normalizeTaskItem(rawItem);
          if (!normalized || !normalized.title) return;
          const li = document.createElement('li');
          if (normalized.detail) {
            const strong = document.createElement('strong');
            strong.textContent = normalized.title;
            li.appendChild(strong);
            const detail = document.createElement('p');
            detail.textContent = normalized.detail;
            li.appendChild(detail);
          } else {
            li.textContent = normalized.title;
          }
          if (normalized.actionUrl) {
            const link = document.createElement('a');
            link.href = normalized.actionUrl;
            link.target = '_blank';
            link.rel = 'noopener';
            link.textContent = '立即處理';
            link.className = 'task-link';
            li.appendChild(link);
          }
          listEl.appendChild(li);
        });
      });
    });
  }

  function buildUrlWithParams(baseUrl, paramsMap = {}) {
    if (!baseUrl) return '#';
    try {
      const target = new URL(baseUrl, window.location.origin);
      Object.entries(paramsMap)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .forEach(([key, value]) => target.searchParams.set(key, value));
      return target.toString();
    } catch (error) {
      return baseUrl;
    }
  }

  async function requestJSON(url, options = {}) {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || response.statusText);
    }
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error('回應格式錯誤');
    }
  }

  async function fetchReport() {
    const headers = { 'Content-Type': 'application/json' };
    let url = reportEndpoint;
    let options = { method: 'GET', headers };

    const perform = async (targetUrl, fetchOptions) => requestJSON(targetUrl, fetchOptions);

    if (state.token) {
      try {
        const target = new URL(reportEndpoint);
        target.searchParams.set('token', state.token);
        url = target.toString();
      } catch (error) {
        url = `${reportEndpoint}?token=${encodeURIComponent(state.token)}`;
      }
      const fallback = () => perform(reportEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'getbytoken', token: state.token }),
      });
      try {
        return await perform(url, options);
      } catch (error) {
        return fallback();
      }
    }

    if (state.leadId) {
      try {
        const target = new URL(reportEndpoint);
        target.searchParams.set('lead_id', state.leadId);
        url = target.toString();
      } catch (error) {
        url = `${reportEndpoint}?lead_id=${encodeURIComponent(state.leadId)}`;
      }
    }

    return perform(url, options);
  }

  function extractMetrics(payload = {}) {
    return payload.metrics
      || payload.metric_cards
      || payload.summary?.metrics
      || payload.report?.metrics
      || [];
  }

  function extractTasks(payload = {}) {
    return payload.tasks
      || payload.summary?.tasks
      || payload.report?.tasks
      || {
        priority_tasks: payload.priority_tasks || [],
        collection_steps: payload.collection_steps || [],
        repair_checklist: payload.repair_checklist || [],
      };
  }

  function extractWarnings(payload = {}) {
    return payload.warnings
      || payload.report?.warnings
      || payload.flags?.warnings
      || [];
  }

  function syncLinks() {
    if (dom.ctaSecondary) {
      dom.ctaSecondary.setAttribute('href', buildUrlWithParams(formUrl, { lead_id: state.leadId || undefined }));
    }
    if (dom.errorHome) {
      dom.errorHome.setAttribute('href', buildUrlWithParams(formUrl, { lead_id: state.leadId || undefined }));
    }
  }

  async function loadReport(showToastOnSuccess = false) {
    setLoading(true);
    hideError();
    try {
      const data = await fetchReport();
      state.reportUrlOverride = data.report_url || data.reportUrl || '';
      if (data.report_token) {
        state.token = data.report_token;
      } else if (data.report?.token) {
        state.token = data.report.token;
      }
      if (data.lead_id) {
        state.leadId = data.lead_id;
      }
      syncLinks();

      const metrics = extractMetrics(data);
      const tasks = extractTasks(data);
      const warnings = extractWarnings(data);
      state.warnings = Array.isArray(warnings) ? warnings : [];

      renderMetrics(metrics);
      renderTasks(tasks);

      if (dom.subtitle && Array.isArray(metrics) && metrics.length) {
        dom.subtitle.textContent = '以下為你的三大指標概況，依據守護任務優先順序整理。';
      }
      if (dom.tasksSubtitle && Array.isArray(tasks?.priority_tasks) && tasks.priority_tasks.length) {
        dom.tasksSubtitle.textContent = '優先完成守護任務，其次處理補件與評論清單。';
      }

      if (showToastOnSuccess) {
        showToast('已更新最新結果', 1600);
      }
    } catch (error) {
      console.error('[report] load failed', error);
      showError(error.message || '暫時無法取得資料，請稍後再試。');
      showToast('載入失敗，請稍後再試', 2200);
    } finally {
      setLoading(false);
    }
  }

  async function handleAssistantEntry() {
    if (!assistantEntryUrl) {
      showToast('尚未設定守護專家入口，請稍後再試。');
      return;
    }
    if (!state.leadId) {
      showToast('缺少 lead_id，請返回主頁重新申請。');
      return;
    }
    if (dom.ctaPrimary) {
      dom.ctaPrimary.disabled = true;
      dom.ctaPrimary.classList.add('btn--loading');
    }
    try {
      const payload = {
        lead_id: state.leadId,
        metrics: state.metricsRaw ?? state.metricsList,
        tasks: state.tasks,
      };
      const result = await requestJSON(assistantEntryUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      logEvent('cta_click', { action: 'assistant_entry_report', lead_id: state.leadId });
      if (result && result.ok === false) {
        const message = result.message || '同步守護專家失敗，請稍後再試。';
        showToast(message);
        return;
      }
      showToast('已同步守護專家，準備開啟報表…', 1800);
      const target = buildUrlWithParams(result?.report_url || state.reportUrlOverride || reportUrlBase, {
        lead_id: state.leadId,
        token: state.token,
      });
      window.open(target, '_blank');
    } catch (error) {
      console.error('[assistant-entry/report]', error);
      showToast(`同步失敗：${error.message}`);
    } finally {
      if (dom.ctaPrimary) {
        dom.ctaPrimary.disabled = false;
        dom.ctaPrimary.classList.remove('btn--loading');
      }
    }
  }

  function handleRefresh() {
    if (state.isLoading) return;
    loadReport(true);
  }

  function bindEvents() {
    if (dom.ctaPrimary) {
      dom.ctaPrimary.addEventListener('click', handleAssistantEntry);
    }
    if (dom.ctaRefresh) {
      dom.ctaRefresh.addEventListener('click', handleRefresh);
    }
    if (dom.errorRetry) {
      dom.errorRetry.addEventListener('click', handleRefresh);
    }
    if (dom.errorHome) {
      dom.errorHome.setAttribute('href', buildUrlWithParams(formUrl, { lead_id: state.leadId || undefined }));
    }
    if (dom.ctaSecondary) {
      dom.ctaSecondary.setAttribute('href', buildUrlWithParams(formUrl, { lead_id: state.leadId || undefined }));
    }
  }

  function init() {
    bindEvents();
    renderMetrics([]);
    renderTasks({});
    syncLinks();
    loadReport();
  }

  init();
})();
