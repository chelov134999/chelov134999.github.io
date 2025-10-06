(function initReportPage() {
  const params = new URLSearchParams(window.location.search);
  const config = window.STAR_ENGINE_CONFIG || {};
  const reportEndpoint = config.reportDataUrl || config.report_data_url || 'https://chelov134999.app.n8n.cloud/webhook/report-data';
  const assistantUrlDefault = config.trialUrl || config.trial_url || '';
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
    ctaPrimary: document.getElementById('cta-primary'),
    ctaAssistant: document.getElementById('cta-assistant'),
    heroRating: document.getElementById('hero-rating'),
    heroRatingHint: document.getElementById('hero-rating-hint'),
    heroReviews: document.getElementById('hero-reviews'),
    heroReviewsHint: document.getElementById('hero-reviews-hint'),
    heroGap: document.getElementById('hero-gap'),
    heroGapHint: document.getElementById('hero-gap-hint'),
    heroNote: document.getElementById('hero-note'),
    heroInsight: document.getElementById('hero-insight'),
    heroInsightText: document.getElementById('hero-insight-text'),
    indicator: document.getElementById('report-indicator'),
    trust: document.getElementById('report-trust'),
    cognosEyebrow: document.getElementById('cognos-eyebrow'),
    cognosTitle: document.getElementById('cognos-title'),
    cognosSubtitle: document.getElementById('cognos-subtitle'),
    alertLoss: document.getElementById('alert-loss'),
    alertGain: document.getElementById('alert-gain'),
    prefs: document.getElementById('report-preferences'),
    prefGoal: document.getElementById('pref-goal'),
    prefTone: document.getElementById('pref-tone'),
    metrics: document.getElementById('report-metrics'),
    metricsEmpty: document.getElementById('report-metrics-empty'),
    competitors: document.getElementById('report-competitors'),
    competitorsEmpty: document.getElementById('report-competitors-empty'),
    actions: document.getElementById('report-actions'),
    actionsEmpty: document.getElementById('report-actions-empty'),
    drafts: document.getElementById('report-drafts'),
    draftsEmpty: document.getElementById('report-drafts-empty'),
    summaryMetrics: document.getElementById('summary-metrics'),
    summaryMetricsLabel: document.getElementById('summary-metrics-label'),
    summaryMetricsText: document.getElementById('summary-metrics-text'),
    summaryCompetitors: document.getElementById('summary-competitors'),
    summaryCompetitorsLabel: document.getElementById('summary-competitors-label'),
    summaryCompetitorsText: document.getElementById('summary-competitors-text'),
    summaryActions: document.getElementById('summary-actions'),
    summaryActionsLabel: document.getElementById('summary-actions-label'),
    summaryActionsText: document.getElementById('summary-actions-text'),
    summaryDrafts: document.getElementById('summary-drafts'),
    summaryDraftsLabel: document.getElementById('summary-drafts-label'),
    summaryDraftsText: document.getElementById('summary-drafts-text'),
  };

  const state = {
    token: params.get('token') || params.get('report_token') || '',
    leadId: params.get('lead_id') || params.get('leadId') || '',
    templateId: 'unknown',
    retry: 0,
    maxRetry: 3,
    assistantUrl: assistantUrlDefault,
    primaryAction: 'refresh',
  };
  function setAnchorState(anchor, enabled, href = '#') {
    if (!anchor) return;
    anchor.setAttribute('href', enabled ? href : '#');
    anchor.classList.toggle('btn--disabled', !enabled);
    anchor.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  }

  if (dom.ctaAssistant) {
    setAnchorState(dom.ctaAssistant, Boolean(state.assistantUrl), state.assistantUrl || '#');
  }

  function setSummaryBlock(container, labelEl, textEl, { label, text }) {
    if (!container || !labelEl || !textEl) return;
    if (!text) {
      container.hidden = true;
      textEl.textContent = '';
      return;
    }
    if (label) {
      labelEl.textContent = label;
    }
    textEl.textContent = text;
    container.hidden = false;
  }

  function truncateText(value, max = 80) {
    if (!value) return '';
    const pure = String(value).trim();
    if (!pure) return '';
    return pure.length > max ? `${pure.slice(0, max)}…` : pure;
  }

  function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function formatNumber(value) {
    const number = toNumber(value);
    if (number == null) return '';
    return number.toLocaleString('zh-Hant-TW');
  }

  function formatCurrency(value) {
    const number = toNumber(value);
    if (number == null) return '';
    return `NT$${number.toLocaleString('zh-Hant-TW')}`;
  }

  function updatePrimaryAction(action, { disabled = false } = {}) {
    state.primaryAction = action;
    if (!dom.ctaPrimary) return;
    let label = '查看完整報表';
    let targetHref = state.reportPageUrl || '#';

    if (action === 'line') {
      label = '回到 LINE';
      targetHref = lineFallbackUrl;
    } else if (action === 'refresh') {
      label = '重新整理';
      targetHref = '#';
    } else if (action === 'report') {
      targetHref = state.reportPageUrl || '#';
      disabled = disabled || !state.reportPageUrl;
    }

    dom.ctaPrimary.textContent = label;
    setAnchorState(dom.ctaPrimary, !disabled, targetHref || '#');
  }

  function toggleEmptyState(element, hasContent) {
    if (!element) return;
    element.hidden = hasContent;
  }

  function openAssistant(source = 'report') {
    if (!state.assistantUrl) {
      return;
    }
    logEvent('cta_click', {
      action: 'assistant',
      lead_id: state.leadId,
      template_id: state.templateId,
      source,
    });
    window.open(state.assistantUrl, '_blank', 'noopener,noreferrer');
  }

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

    return { ok: true };
  }

  function renderReport(payload) {
    const {
      renderMetrics,
      renderCompetitors,
      renderActions,
      renderDrafts,
      pickMetric,
    } = window.ReportUtils || {};
    const report = payload.report || {};
    const preferences = payload.preferences || {};
    const psychology = payload.psychology || {};

    const resolveText = (...values) => {
      for (const value of values) {
        if (value == null) continue;
        const text = String(value).trim();
        if (text) return text;
      }
      return '';
    };

    const formatRatingValue = (value) => {
      if (value == null) return '';
      const number = Number(value);
      if (!Number.isFinite(number)) return '';
      const rounded = Math.round(number * 10) / 10;
      return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
    };

    const normalizePercentValue = (value) => {
      if (value == null) return null;
      const number = Number(value);
      if (!Number.isFinite(number)) return null;
      if (Math.abs(number) <= 1) {
        return number * 100;
      }
      return number;
    };

    const percentLabel = (value) => {
      if (value == null) return '';
      const abs = Math.abs(value);
      if (abs === 0) return '0%';
      if (abs >= 10) return `${Math.round(abs)}%`;
      return `${abs.toFixed(1)}%`;
    };

    const metricsSource = report.metrics || report.kpi;
    const competitorsSource = report.competitors || report.competitors_agent;
    const actionsSource = report.weekly_actions;
    const draftsSource = report.reply_drafts;

    const nickname = resolveText(report.owner_name, preferences.nickname, payload.nickname, payload.owner_name) || '店長';
    const storeNameResolved = resolveText(report.store_name, preferences.store_name, payload.store_name);
    const storeName = storeNameResolved || '你的門市';
    const storeLabel = storeNameResolved || storeName;
    const city = resolveText(report.city, preferences.city, payload.city);
    const locationDisplay = city ? `${city}・${storeLabel}` : storeLabel;

    const goalLabelRaw = resolveText(report.goal_label, preferences.goal_label, payload.goal_label);
    const toneLabelRaw = resolveText(report.tone_label, preferences.tone_label, payload.tone_label);
    const goalLabel = goalLabelRaw || '—';
    const toneLabel = toneLabelRaw || '—';
    const preferenceSummaryParts = [];
    if (goalLabelRaw) preferenceSummaryParts.push(`目標鎖定「${goalLabel}」`);
    if (toneLabelRaw) preferenceSummaryParts.push(`語氣採用「${toneLabel}」`);

    const storeRating = toNumber(report.store_rating ?? report.rating_now ?? report.rating ?? report.score);
    const ratingDisplay = storeRating != null ? `${formatRatingValue(storeRating)} ★` : '';
    const reviewsTotal = toNumber(report.store_review_count ?? report.reviews_total ?? report.reviews ?? report.review_count);
    const reviewsText = reviewsTotal != null ? formatNumber(reviewsTotal) : '';
    const latestReview = resolveText(report.latest_review_summary, report.review_highlight, report.review_summary);

    const lossEstimate = report.estimated_loss || report.projected_loss || psychology.loss_estimate || psychology.loss_amount;
    const gainEstimate = report.estimated_gain || report.projected_gain || psychology.gain_estimate || psychology.gain_amount;

    const reviewHighlight = latestReview || (reviewsText ? `已同步 ${reviewsText} 則評論` : '');
    const lossMessage = lossEstimate
      ? `若不處理，預估流失 ${formatCurrency(lossEstimate)}。`
      : `AI 正在估算 ${storeLabel} 可能的流失風險。`;
    const gainMessage = gainEstimate
      ? `把握本週機會，可望挽回 ${formatCurrency(gainEstimate)}。`
      : `看看我能為 ${storeLabel} 挽回多少營收。`;

    const assistantFromPayload = payload.assistant_url
      || payload.trial_url
      || payload.links?.assistant
      || payload.links?.assistant_url
      || '';

    state.templateId = psychology.template_id || payload.template_id || 'unknown';
    state.leadId = payload.lead_id || state.leadId;
    if (assistantFromPayload) {
      state.assistantUrl = assistantFromPayload;
    }

    if (dom.cognosEyebrow) {
      dom.cognosEyebrow.textContent = `Hi ${nickname}，我是 Cognos`;
    }
    if (dom.cognosTitle) {
      dom.cognosTitle.textContent = `${storeLabel} 關鍵摘要`;
    }
    const locationText = city ? `${city} 的競品與評論` : '附近的競品與評論';
    if (dom.cognosSubtitle) {
      dom.cognosSubtitle.textContent = reviewHighlight
        ? `最新評論：${reviewHighlight}`
        : `我正持續整理 ${locationText}，完成後立刻通知你。`;
    }

    if (dom.heroRating) {
      dom.heroRating.textContent = ratingDisplay || '—';
    }
    if (dom.heroRatingHint) {
      dom.heroRatingHint.textContent = ratingDisplay
        ? `${storeLabel} 最新 Google 星等`
        : `${storeLabel} 星等同步中`;
    }
    if (dom.heroReviews) {
      dom.heroReviews.textContent = reviewsText ? `${reviewsText} 則` : '—';
    }
    if (dom.heroReviewsHint) {
      dom.heroReviewsHint.textContent = reviewsText
        ? `${storeLabel} 評論總數即時更新`
        : `${storeLabel} 評論整理中`;
    }
    if (dom.heroNote) {
      const heroLines = [`30 秒初檢已完成，${locationDisplay} 的關鍵摘要如下。`];
      if (preferenceSummaryParts.length) {
        heroLines.push(`${preferenceSummaryParts.join('，')}。`);
      }
      dom.heroNote.textContent = heroLines.join(' ');
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

    if (dom.trust) {
      dom.trust.textContent = preferenceSummaryParts.length
        ? `${preferenceSummaryParts.join('，')}，後續推播會依此設定。`
        : `${storeLabel} 的偏好設定已保存，報表更新會即時通知。`;
    }

    const metricsRendered = renderMetrics && dom.metrics
      ? renderMetrics(dom.metrics, metricsSource, { emptyMessage: '' })
      : [];
    toggleEmptyState(dom.metricsEmpty, metricsRendered && metricsRendered.length > 0);

    const competitorsRendered = renderCompetitors && dom.competitors
      ? renderCompetitors(dom.competitors, competitorsSource, { emptyMessage: '' })
      : [];
    toggleEmptyState(dom.competitorsEmpty, competitorsRendered && competitorsRendered.length > 0);

    const riskGapMetric = pickMetric
      ? pickMetric(report.metrics, ['risk_gap_percent', 'risk_gap_percentage', 'risk_gap'])
        || pickMetric(report.metrics?.overview, ['risk_gap_percent', 'risk_gap_percentage', 'risk_gap'])
        || pickMetric(report.kpi, ['risk_gap_percent', 'risk_gap_percentage', 'risk_gap'])
      : null;
    let riskGapPercent = riskGapMetric ? normalizePercentValue(riskGapMetric.value) : null;
    if (riskGapPercent == null && typeof report.metrics === 'object' && !Array.isArray(report.metrics)) {
      riskGapPercent = normalizePercentValue(
        report.metrics.risk_gap_percent
        ?? report.metrics.risk_gap_percentage
        ?? report.metrics.risk_gap,
      );
    }
    const riskGapTarget = resolveText(
      riskGapMetric?.target,
      riskGapMetric?.raw?.target,
      riskGapMetric?.raw?.name,
      report.metrics?.risk_gap_target,
      report.metrics?.top_competitor_name,
    );
    const riskGapHint = resolveText(
      riskGapMetric?.hint,
      riskGapMetric?.raw?.note,
      riskGapMetric?.raw?.description,
      report.metrics?.risk_gap_hint,
      report.metrics?.risk_gap_description,
    );

    const ratingNumber = storeRating;
    const topCompetitor = competitorsRendered[0];
    const competitorRating = toNumber(topCompetitor?.rating);
    let gapValue = '—';
    let gapHint = riskGapHint || `${riskGapTarget || topCompetitor?.name || '競品'} 資料整理中`;
    let gapDescription = '';

    if (riskGapPercent != null) {
      const label = percentLabel(riskGapPercent);
      const competitorName = riskGapTarget || topCompetitor?.name || '主要競品';
      if (Math.abs(riskGapPercent) < 0.5) {
        gapValue = '與競品持平';
        gapHint = `${competitorName} 差距小於 1%`;
        gapDescription = `與 ${competitorName} 幾乎持平`;
      } else if (riskGapPercent > 0) {
        gapValue = `落後 ${label}`;
        gapHint = riskGapHint || `${competitorName} 暫時領先`;
        gapDescription = `目前落後 ${competitorName} ${label}`;
      } else {
        gapValue = `領先 ${label}`;
        gapHint = riskGapHint || `${competitorName} 差距正在擴大`;
        gapDescription = `領先 ${competitorName} ${label}`;
      }
    } else if (ratingNumber != null && competitorRating != null) {
      const diff = ratingNumber - competitorRating;
      const diffAbs = Math.abs(diff);
      const diffLabel = diffAbs ? diffAbs.toFixed(1).replace(/\.0$/, '') : '0';
      const competitorName = topCompetitor?.name || '競品';
      if (diffAbs < 0.05) {
        gapValue = '與競品持平';
        gapHint = `${competitorName} ${competitorRating.toFixed ? competitorRating.toFixed(1) : competitorRating} ★`;
        gapDescription = `與 ${competitorName} 持平`;
      } else if (diff > 0) {
        gapValue = `領先 ${diffLabel} ★`;
        gapHint = `${competitorName} ${competitorRating.toFixed ? competitorRating.toFixed(1) : competitorRating} ★`;
        gapDescription = `領先 ${competitorName} ${diffLabel} ★`;
      } else {
        gapValue = `落後 ${diffLabel} ★`;
        gapHint = `${competitorName} ${competitorRating.toFixed ? competitorRating.toFixed(1) : competitorRating} ★`;
        gapDescription = `落後 ${competitorName} ${diffLabel} ★`;
      }
    }

    if (dom.heroGap) {
      dom.heroGap.textContent = gapValue;
    }
    if (dom.heroGapHint) {
      dom.heroGapHint.textContent = gapHint;
    }

    const actionsRendered = renderActions && dom.actions
      ? renderActions(dom.actions, actionsSource, { emptyMessage: '' })
      : [];
    toggleEmptyState(dom.actionsEmpty, actionsRendered && actionsRendered.length > 0);

    const draftsRendered = renderDrafts && dom.drafts
      ? renderDrafts(dom.drafts, draftsSource, {
        emptyMessage: '',
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
      })
      : [];
    toggleEmptyState(dom.draftsEmpty, draftsRendered && draftsRendered.length > 0);

    const firstMetric = metricsRendered[0];
    const firstAction = actionsRendered[0];
    const firstDraft = draftsRendered[0];

    const metricsSummary = latestReview
      ? { label: '最新評論摘要', text: truncateText(latestReview, 96) }
      : firstMetric
        ? {
            label: firstMetric.label || '關鍵指標',
            text: `目前為 ${
              firstMetric.currency
                ? formatCurrency(firstMetric.value)
                : (formatNumber(firstMetric.value) || firstMetric.value || '—')
            }`,
          }
        : null;

    const competitorSummary = topCompetitor
      ? {
          label: '競品第一名',
          text: truncateText(
            `${topCompetitor.name || '競品'}${
              topCompetitor.rating != null
                ? ` ｜ ${Number(topCompetitor.rating).toFixed ? Number(topCompetitor.rating).toFixed(1) : topCompetitor.rating} ★`
                : ''
            }${
              topCompetitor.reviews != null ? ` ｜ ${formatNumber(topCompetitor.reviews)} 則` : ''
            }${
              gapDescription ? ` ｜ ${gapDescription}` : ''
            }`,
            96,
          ),
        }
      : null;

    const actionsSummary = firstAction
      ? {
          label: '本週優先事項',
          text: truncateText(firstAction.text, 96),
        }
      : null;

    const draftSummary = firstDraft
      ? {
          label: firstDraft.tone ? `首選語氣：${firstDraft.tone}` : '首選草稿',
          text: truncateText(firstDraft.text, 96),
        }
      : null;

    const summaryFallbacks = {
      metrics: {
        label: '同步提醒',
        text: `${storeLabel} 最新評論整理中，很快送上亮點。`,
      },
      competitors: {
        label: '競品同步',
        text: `${city || '附近'} 競品差距分析中，完成後會第一時間通知你。`,
      },
      actions: {
        label: '行動建議',
        text: 'AI 正彙整本週優先事項，很快就緒。',
      },
      drafts: {
        label: '草稿準備中',
        text: 'AI 正為你撰寫回覆草稿，完成後自動推送。',
      },
    };

    setSummaryBlock(dom.summaryMetrics, dom.summaryMetricsLabel, dom.summaryMetricsText, metricsSummary || summaryFallbacks.metrics);
    setSummaryBlock(dom.summaryCompetitors, dom.summaryCompetitorsLabel, dom.summaryCompetitorsText, competitorSummary || summaryFallbacks.competitors);
    setSummaryBlock(dom.summaryActions, dom.summaryActionsLabel, dom.summaryActionsText, actionsSummary || summaryFallbacks.actions);
    setSummaryBlock(dom.summaryDrafts, dom.summaryDraftsLabel, dom.summaryDraftsText, draftSummary || summaryFallbacks.drafts);

    if (dom.cognosSubtitle) {
      if (competitorSummary && competitorSummary.text) {
        dom.cognosSubtitle.textContent = competitorSummary.text;
      } else if (metricsSummary && metricsSummary.text) {
        dom.cognosSubtitle.textContent = metricsSummary.text;
      } else {
        const preferenceFallback = preferenceSummaryParts.length
          ? `${preferenceSummaryParts.join('，')}，我會依此更新提醒。`
          : `我正持續整理 ${locationText}，完成後立即通知你。`;
        dom.cognosSubtitle.textContent = preferenceFallback;
      }
    }

    const preferenceReminder = preferenceSummaryParts.length
      ? `${preferenceSummaryParts.join('，')}，我會依此協助。`
      : '';
    const insightText = gapDescription
      ? `${gapDescription}。${firstAction ? `建議優先處理：${truncateText(firstAction.text, 60)}` : '建議持續關注評論更新。'}`
      : (metricsSummary?.text || actionsSummary?.text || draftSummary?.text || preferenceReminder || '我會持續監控評論與競品狀態。');

    if (dom.heroInsight && dom.heroInsightText) {
      if (insightText) {
        dom.heroInsight.hidden = false;
        dom.heroInsightText.textContent = insightText;
      } else {
        dom.heroInsight.hidden = true;
        dom.heroInsightText.textContent = '';
      }
    }

    const resolvedReportUrl = payload.report_url
      || payload.links?.report
      || report.report_url
      || '';
    if (resolvedReportUrl) {
      state.reportPageUrl = resolvedReportUrl;
    }
    if (!state.reportPageUrl && payload.report_token) {
      const base = new URL(window.location.href);
      base.searchParams.set('token', payload.report_token);
      state.reportPageUrl = base.toString();
    }
    updatePrimaryAction('report', { disabled: !state.reportPageUrl });

    if (dom.ctaAssistant) {
      setAnchorState(dom.ctaAssistant, Boolean(state.assistantUrl), state.assistantUrl || '#');
    }
  }

  function handleSuccess(payload) {
    renderReport(payload);
    setView({ content: true });
    state.retry = 0;
    updatePrimaryAction('report', { disabled: !state.reportPageUrl });
    if (dom.indicator) {
      dom.indicator.textContent = '分析完成';
    }
    if (dom.skeleton) {
      dom.skeleton.innerHTML = '';
      dom.skeleton.hidden = true;
      dom.skeleton.remove();
      dom.skeleton = null;
    }
    logEvent('report_load', {
      status: 'complete',
      lead_id: state.leadId,
      template_id: state.templateId,
    });
  }

  function handlePending(payload) {
    setView({ loading: true });
    updatePrimaryAction('line');
    if (dom.indicator) {
      dom.indicator.textContent = 'AI 整理中';
    }
    if (dom.trust) {
      dom.trust.textContent = '資料較多，我會完成後立刻通知你。';
    }
    logEvent('report_load', {
      status: 'pending',
      lead_id: state.leadId,
      template_id: state.templateId,
      retry: state.retry,
    });

    if (state.retry >= state.maxRetry) {
      setView({ error: true });
      if (dom.errorMessage) {
        dom.errorMessage.textContent = '報表仍在生成，稍後會透過 LINE 通知你最新版本。';
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
    updatePrimaryAction('refresh');
    if (dom.indicator) {
      dom.indicator.textContent = '需要協助';
    }
    if (dom.trust) {
      dom.trust.textContent = '我正在重新整理資料，稍後會提醒你再次查看。';
    }
    if (dom.errorMessage) {
      dom.errorMessage.textContent = error?.message || '暫時載入不到報表，我會稍後提醒你再試一次。';
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
      updatePrimaryAction('line');
      if (!state.retry) {
        setView({ skeleton: true });
      }
      const payload = await requestReport();

      if (payload.status && typeof payload.status === 'object') {
        const stateValue = payload.status.state || payload.status;
        if (stateValue === 'failed') {
          const message = payload.status.message || '生成報表失敗，請稍後再試。';
          throw new Error(message);
        }
      }

      const status = (typeof payload.status === 'string') ? payload.status : payload.status?.state;
      if (status === 'pending') {
        handlePending(payload);
        return;
      }

      const validation = validatePayload(payload);
      if (!validation.ok) {
        throw new Error(validation.message || '報表內容缺失，請稍後再試。');
      }

      handleSuccess(payload);
    } catch (error) {
      handleFailure(error);
    } finally {
      if (dom.skeleton) dom.skeleton.hidden = true;
    }
  }

  if (dom.ctaPrimary) {
    dom.ctaPrimary.addEventListener('click', (event) => {
      const isDisabled = dom.ctaPrimary.classList.contains('btn--disabled');
      if (isDisabled) {
        event.preventDefault();
        return;
      }

      if (state.primaryAction === 'line') {
        event.preventDefault();
        closeToLine();
        return;
      }

      if (state.primaryAction === 'refresh') {
        event.preventDefault();
        logEvent('cta_click', {
          action: 'refresh',
          lead_id: state.leadId,
          template_id: state.templateId,
          source: 'report',
        });
        state.retry = 0;
        startFetch();
        return;
      }

      if (state.primaryAction === 'report') {
        logEvent('cta_click', {
          action: 'open_report',
          lead_id: state.leadId,
          template_id: state.templateId,
          source: 'report',
        });
        return;
      }

      event.preventDefault();
    });
  }

  if (dom.ctaAssistant) {
    dom.ctaAssistant.addEventListener('click', (event) => {
      event.preventDefault();
      if (dom.ctaAssistant.classList.contains('btn--disabled')) return;
      openAssistant('report');
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
