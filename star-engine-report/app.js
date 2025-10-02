const config = window.STAR_ENGINE_CONFIG || {};
const reportEndpoint = config.reportEndpoint || 'https://chelov134999.app.n8n.cloud/webhook/report-data';
const checkoutPrimaryUrl = config.checkoutPrimaryUrl || config.checkout_primary_url || '';
const checkoutSecondaryUrl = config.checkoutSecondaryUrl || config.checkout_secondary_url || '';
const formUrl = config.formUrl || config.form_url || 'https://liff.line.me/2008215846-5LwXlWVN?view=form';
const reportLiffId = config.reportLiffId || config.liffId || '';

const state = {
  token: new URLSearchParams(window.location.search).get('token') || '',
  liffReady: false,
  liffInClient: false,
  seatTimer: null,
  seatBase: 8,
  seatLow: 7,
};

const els = {
  heroStore: document.getElementById('hero-store'),
  heroStoreInline: document.getElementById('hero-store-inline'),
  heroDanger: document.getElementById('hero-danger'),
  heroRating: document.getElementById('hero-rating'),
  heroAvg: document.getElementById('hero-avg'),
  heroGap: document.getElementById('hero-gap'),
  heroLoss: document.getElementById('hero-loss'),
  statRating: document.getElementById('stat-rating'),
  statNegative: document.getElementById('stat-negative'),
  statLoss: document.getElementById('stat-loss'),
  reviewsList: document.getElementById('reviews-list'),
  competitorPrimary: document.getElementById('competitor-primary'),
  competitorTable: document.getElementById('competitor-table'),
  competitorDetails: document.getElementById('competitor-details'),
  planToday: document.getElementById('plan-today'),
  planWeek: document.getElementById('plan-week'),
  planMonth: document.getElementById('plan-month'),
  radarSection: document.getElementById('section-radar'),
  radarList: document.getElementById('radar-list'),
  seatCounter: document.getElementById('seat-counter'),
  toast: document.getElementById('toast'),
  ctaPrimary: document.getElementById('cta-primary'),
  ctaSecondary: document.getElementById('cta-secondary'),
  ctaHome: document.getElementById('cta-home'),
  backToForm: document.getElementById('back-to-form'),
};

const sanitize = (text) => (text || '').toString().replace(/\s+/g, ' ').trim();

function showToast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.hidden = false;
  setTimeout(() => {
    els.toast.hidden = true;
  }, 2200);
}

async function copyDraft(draft) {
  if (!draft) {
    showToast('草稿無內容');
    return;
  }
  try {
    if (state.liffReady && state.liffInClient) {
      await liff.sendMessages([{ type: 'text', text: draft }]);
      showToast('草稿已送到聊天視窗');
      return;
    }
    await navigator.clipboard.writeText(draft);
    showToast('草稿已複製');
  } catch (error) {
    console.warn('[copyDraft]', error);
    showToast('複製失敗，請手動複製');
  }
}

function renderList(target, items) {
  if (!target) return;
  target.innerHTML = '';
  (items || []).forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    target.appendChild(li);
  });
  if (!target.childElementCount) {
    const li = document.createElement('li');
    li.textContent = '暫無建議';
    target.appendChild(li);
  }
}

function renderReviews(replyDrafts = []) {
  if (!els.reviewsList) return;
  els.reviewsList.innerHTML = '';
  if (!replyDrafts.length) {
    const empty = document.createElement('p');
    empty.textContent = '近期沒有 1~3★ 評論，保持追蹤以維持好評。';
    empty.style.color = 'rgba(15,23,42,0.6)';
    els.reviewsList.appendChild(empty);
    return;
  }
  replyDrafts.forEach((item, index) => {
    const card = document.createElement('article');
    card.className = 'review-card';
    card.innerHTML = `
      <div class="review-card__topline">
        <span class="review-card__tag">${item.tag || `危機點 #${index + 1}`}</span>
        <span class="review-card__meta">${item.rating != null ? `${item.rating.toFixed ? item.rating.toFixed(1) : item.rating} ★` : '低評'} · ${sanitize(item.relativeTime || '近期')}</span>
      </div>
      <p class="review-card__text">${sanitize(item.text) || '（評論內容為空）'}</p>
      <p class="review-card__meta">${sanitize(item.author || '匿名')} · 智能草稿準備就緒</p>
    `;
    const actions = document.createElement('div');
    actions.className = 'review-card__actions';
    const button = document.createElement('button');
    button.className = 'btn btn--ghost-light';
    button.type = 'button';
    button.innerHTML = '✂️ 一鍵複製草稿';
    button.addEventListener('click', () => copyDraft(item.replyDraft));
    actions.appendChild(button);
    card.appendChild(actions);
    els.reviewsList.appendChild(card);
  });
}

function renderCompetitors(report = {}) {
  if (!els.competitorPrimary) return;
  const insight = report.insight || {};
  const top = insight.topCompetitor || {};
  const diffRating = typeof insight.diffRating === 'number' ? insight.diffRating.toFixed(1) : '--';
  const diffReviews = typeof insight.diffReviews === 'number' ? Math.abs(insight.diffReviews) : null;
  els.competitorPrimary.innerHTML = `
    <strong>商圈領先者：</strong>${sanitize(top.name) || '未找到'}<br>
    評分差距：${diffRating === '--' ? '—' : `${diffRating} ★`}，評論量差距：${diffReviews != null ? `${diffReviews} 則` : '—'}
  `;

  if (!els.competitorTable) return;
  const rows = (report.competitors || []).map((item) => `
    <tr>
      <td>${sanitize(item.name)}</td>
      <td>${typeof item.rating === 'number' ? item.rating.toFixed(1) : '—'}</td>
      <td>${item.reviewCount != null ? item.reviewCount : '—'}</td>
      <td>${sanitize(item.address || '')}</td>
    </tr>
  `).join('');
  els.competitorTable.innerHTML = rows
    ? `<thead><tr><th>商家</th><th>評分</th><th>評論數</th><th>地址</th></tr></thead><tbody>${rows}</tbody>`
    : '<tbody><tr><td colspan="4">暫無競品資料</td></tr></tbody>';
}

function startSeatTicker(allocation = {}) {
  const base = Number(allocation.remaining) || 8;
  const lower = Math.max(1, Number(allocation.today) || Math.max(1, base - 1));
  state.seatBase = base;
  state.seatLow = lower;
  if (!els.seatCounter) return;
  els.seatCounter.textContent = base;
  if (state.seatTimer) clearInterval(state.seatTimer);
  let toggle = false;
  state.seatTimer = setInterval(() => {
    toggle = !toggle;
    els.seatCounter.textContent = toggle ? lower : base;
  }, 6000);
}

function renderRadar(external) {
  if (!els.radarSection || !els.radarList) return;
  const items = external?.items || [];
  if (!items.length) {
    els.radarSection.hidden = true;
    els.radarList.innerHTML = '';
    return;
  }
  els.radarSection.hidden = false;
  els.radarList.innerHTML = '';
  items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'radar-item';
    card.innerHTML = `<strong>${sanitize(item.source || '外部渠道')}</strong><br>${sanitize(item.title || '')}<br>${sanitize(item.snippet || '')}`;
    els.radarList.appendChild(card);
  });
}

function renderStats(report) {
  const metrics = report.metrics || {};
  if (els.heroRating) els.heroRating.textContent = `${typeof metrics.rating === 'number' ? metrics.rating.toFixed(1) : '--'} ★`;
  if (els.heroAvg) els.heroAvg.textContent = `${typeof metrics.competitorAvg === 'number' ? metrics.competitorAvg.toFixed(1) : '--'} ★`;

  const diffRating = typeof metrics.competitorAvg === 'number' && typeof metrics.rating === 'number'
    ? (metrics.competitorAvg - metrics.rating).toFixed(1)
    : null;
  if (els.heroGap) {
    if (diffRating !== null && !Number.isNaN(Number(diffRating))) {
      const val = Number(diffRating);
      els.heroGap.textContent = val > 0 ? `${val.toFixed(1)} ★ 落後` : `${Math.abs(val).toFixed(1)} ★ 領先`;
    } else {
      els.heroGap.textContent = '--';
    }
  }
  if (els.heroLoss) {
    if (typeof metrics.revenueLoss === 'number') {
      els.heroLoss.textContent = `NT$${metrics.revenueLoss.toLocaleString('zh-TW')}`;
    } else {
      els.heroLoss.textContent = '--';
    }
  }
  if (els.statRating) {
    if (diffRating !== null && !Number.isNaN(diffRating)) {
      const sign = Number(diffRating) > 0 ? `落後 ${diffRating} ★` : `領先 ${Math.abs(Number(diffRating)).toFixed(1)} ★`;
      els.statRating.textContent = sign;
    } else {
      els.statRating.textContent = '尚無差距資料';
    }
  }
  if (els.statNegative) {
    const negative = metrics.negativeRecent != null ? metrics.negativeRecent : report.primary?.recentSummary?.negativeRecent;
    els.statNegative.textContent = `${negative != null ? negative : '--'} 則`;
  }
  if (els.statLoss) {
    if (typeof metrics.revenueLoss === 'number') {
      els.statLoss.textContent = `NT$${metrics.revenueLoss.toLocaleString('zh-TW')}`;
    } else {
      els.statLoss.textContent = '—';
    }
  }
}

function renderReport(report) {
  const hero = report.hero || {};
  const storeName = sanitize(hero.storeName) || '您的門市';
  if (els.heroStore) els.heroStore.textContent = storeName;
  if (els.heroStoreInline) els.heroStoreInline.textContent = storeName;
  if (els.heroDanger) els.heroDanger.textContent = sanitize(hero.dangerLabel) || '智能體完成初檢，建議立即展開守護流程。';

  renderStats(report);
  renderReviews(report.primary?.replyDrafts || []);
  renderCompetitors(report);
  renderList(els.planToday, report.actionPlan?.today || []);
  renderList(els.planWeek, report.actionPlan?.week || []);
  renderList(els.planMonth, report.actionPlan?.month || []);
  renderRadar(report.externalInsights);
  startSeatTicker(report.allocation);
}

async function fetchReport() {
  if (!state.token) {
    if (els.heroDanger) {
      els.heroDanger.textContent = 'token 無效，請回到 LINE 聊天視窗重新開啟報表。';
    }
    return;
  }
  try {
    const response = await fetch(`${reportEndpoint}?token=${encodeURIComponent(state.token)}`, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-store' },
    });
    if (!response.ok) {
      throw new Error(`查詢失敗：${response.status}`);
    }
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.message || 'token 已失效，請回 LINE 重新開啟報表');
    }
    renderReport(payload.report || {});
  } catch (error) {
    console.warn('[fetchReport]', error);
    if (els.heroDanger) {
      els.heroDanger.textContent = `無法載入診斷資料：${error.message}`;
    }
  }
}

async function initLiff() {
  if (!window.liff || !reportLiffId) {
    await fetchReport();
    return;
  }
  try {
    await liff.init({ liffId: reportLiffId });
    await liff.ready;
    state.liffReady = true;
    state.liffInClient = liff.isInClient?.() ?? false;
  } catch (error) {
    console.warn('[LIFF] init failed', error);
  }
  await fetchReport();
}

function openUrl(url, { appendToken = false } = {}) {
  if (!url) {
    showToast('尚未設定連結');
    return;
  }
  const target = appendToken && state.token
    ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(state.token)}`
    : url;
  if (state.liffReady && state.liffInClient) {
    liff.openWindow({ url: target, external: false });
  } else {
    window.open(target, '_blank');
  }
}

function attachListeners() {
  if (els.ctaPrimary) {
    els.ctaPrimary.addEventListener('click', () => {
      const target = config.reportUrl || window.location.href;
      openUrl(target, { appendToken: true });
    });
  }
  if (els.ctaSecondary) {
    els.ctaSecondary.addEventListener('click', () => {
      openUrl(checkoutPrimaryUrl || checkoutSecondaryUrl, { appendToken: false });
    });
  }
  if (els.ctaHome) {
    els.ctaHome.addEventListener('click', () => {
      openUrl(formUrl);
    });
  }
  if (els.backToForm) {
    els.backToForm.addEventListener('click', (event) => {
      event.preventDefault();
      openUrl(formUrl);
    });
  }
}

(function bootstrap() {
  attachListeners();
  if (!state.token) {
    if (els.heroDanger) {
      els.heroDanger.textContent = '連線逾時或缺少驗證，請回到 LINE 聊天視窗重新開啟報表。';
    }
  }
  initLiff();
})();
