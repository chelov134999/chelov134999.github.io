const config = window.STAR_ENGINE_CONFIG || {};
const reportEndpoint = config.reportEndpoint || 'https://chelov134999.app.n8n.cloud/webhook/report-data';
const checkoutPrimaryUrl = config.checkoutPrimaryUrl || config.checkout_primary_url || 'https://chelov134999.app.n8n.cloud/pay/star-guard-4980';
const checkoutSecondaryUrl = config.checkoutSecondaryUrl || config.checkout_secondary_url || 'https://chelov134999.app.n8n.cloud/pay/star-cabin-2980';
const formUrl = config.formUrl || config.form_url || 'https://liff.line.me/2008215846-5LwXlWVN?view=form';
const trialUrl = config.trialUrl || 'https://line.me/ti/p/@star-up';
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
  heroGap: document.getElementById('hero-gap'),
  heroLoss: document.getElementById('hero-loss'),
  reviewsSummary: document.getElementById('reviews-summary'),
  reviewsList: document.getElementById('reviews-list'),
  competitorPrimary: document.getElementById('competitor-primary'),
  competitorTable: document.getElementById('competitor-table'),
  competitorDetails: document.getElementById('competitor-details'),
  planToday: document.getElementById('plan-today'),
  planWeek: document.getElementById('plan-week'),
  planMonth: document.getElementById('plan-month'),
  seatCounter: document.getElementById('seat-counter'),
  toast: document.getElementById('toast'),
  ctaPrimary: document.getElementById('cta-primary'),
  ctaSecondary: document.getElementById('cta-secondary'),
  ctaHome: document.getElementById('cta-home'),
  ctaHeadline: document.getElementById('cta-headline'),
  backToForm: document.getElementById('back-to-form'),
};

const sanitize = (text) => (text || '').toString().replace(/\s+/g, ' ').trim();

function showToast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.hidden = false;
  setTimeout(() => {
    els.toast.hidden = true;
  }, 2400);
}

function renderReviews(report = {}) {
  if (!els.reviewsList) return;
  els.reviewsList.innerHTML = '';
  const drafts = Array.isArray(report.reply_drafts) ? report.reply_drafts : [];
  if (!drafts.length) {
    const empty = document.createElement('p');
    empty.textContent = '完整報表會依最新評論生成草稿，待 LINE 推播即可查看。';
    empty.className = 'muted';
    els.reviewsList.appendChild(empty);
    return;
  }
  drafts.forEach((draft, index) => {
    const card = document.createElement('article');
    card.className = 'review-card';
    const toneLabel = draft.tone ? draft.tone.toUpperCase() : `草稿 #${index + 1}`;
    card.innerHTML = `
      <div class="review-card__topline">
        <span class="review-card__tag">${toneLabel}</span>
        <span class="review-card__meta">智能草稿</span>
      </div>
      <p class="review-card__text">${sanitize(draft.text)}</p>
    `;
    const actions = document.createElement('div');
    actions.className = 'review-card__actions';
    const button = document.createElement('button');
    button.className = 'btn btn--ghost-light';
    button.type = 'button';
    button.textContent = '複製草稿';
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(draft.text || '');
        showToast('已複製草稿，貼上即可使用');
      } catch (error) {
        showToast('複製失敗，請手動複製');
      }
    });
    actions.appendChild(button);
    card.appendChild(actions);
    els.reviewsList.appendChild(card);
  });
}

function renderCompetitors(report = {}) {
  if (!els.competitorPrimary || !els.competitorTable) return;
  const auto = Array.isArray(report.competitors_auto) ? report.competitors_auto : [];
  const manual = Array.isArray(report.competitors_selected) ? report.competitors_selected : [];
  const combined = [...manual, ...auto];

  if (!combined.length) {
    els.competitorPrimary.textContent = '競品資料預備中，稍後會自動更新。';
    els.competitorTable.innerHTML = '<tbody><tr><td colspan="4">暫無競品資料</td></tr></tbody>';
    return;
  }

  const top = combined[0];
  const rating = typeof top.rating === 'number' ? `${top.rating.toFixed(1)} ★` : '— ★';
  const reviews = top.reviews_total != null ? `${top.reviews_total} 則評論` : '評論數不足';
  const distance = top.distance_m != null ? `${top.distance_m} 公尺` : '距離未知';

  els.competitorPrimary.innerHTML = `
    <strong>${sanitize(top.name)}</strong><br>
    評分 ${rating}｜${reviews}｜距離 ${distance}
  `;

  const rows = combined.slice(0, 5).map((item) => `
    <tr>
      <td>${sanitize(item.name)}</td>
      <td>${typeof item.rating === 'number' ? item.rating.toFixed(1) : '—'}</td>
      <td>${item.reviews_total != null ? item.reviews_total : '—'}</td>
      <td>${item.distance_m != null ? `${item.distance_m} m` : '—'}</td>
    </tr>
  `).join('');

  els.competitorTable.innerHTML = `
    <thead><tr><th>商家</th><th>評分</th><th>評論數</th><th>距離</th></tr></thead>
    <tbody>${rows}</tbody>
  `;
}

function renderActions(report = {}) {
  renderList(els.planToday, [report.weekly_actions?.[0]].filter(Boolean));
  renderList(els.planWeek, [report.weekly_actions?.[1]].filter(Boolean));
  renderList(els.planMonth, [report.weekly_actions?.[2]].filter(Boolean));
}

function renderList(target, items) {
  if (!target) return;
  target.innerHTML = '';
  (items || []).forEach((text) => {
    const li = document.createElement('li');
    li.textContent = sanitize(text);
    target.appendChild(li);
  });
  if (!target.childElementCount) {
    const li = document.createElement('li');
    li.textContent = '尚無建議';
    target.appendChild(li);
  }
}

function updateHero(report = {}) {
  const store = report.store || {};
  const rating = typeof store.rating === 'number' ? store.rating : null;
  const competitorAvg = (() => {
    const list = Array.isArray(report.competitors_auto) ? report.competitors_auto : [];
    if (!list.length) return null;
    const values = list.map((item) => item.rating).filter((value) => typeof value === 'number');
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  })();
  const diffRating = rating != null && competitorAvg != null ? competitorAvg - rating : null;

  if (els.heroStore) els.heroStore.textContent = sanitize(store.name) || '您的門市';
  if (els.heroStoreInline) els.heroStoreInline.textContent = sanitize(store.name) || '您的門市';
  if (els.heroRating) els.heroRating.textContent = rating != null ? `${rating.toFixed(1)} ★` : '-- ★';
  if (els.heroGap) {
    if (diffRating != null) {
      els.heroGap.textContent = diffRating > 0 ? `落後 ${diffRating.toFixed(1)} ★` : `領先 ${Math.abs(diffRating).toFixed(1)} ★`;
    } else {
      els.heroGap.textContent = '--';
    }
  }
  if (els.heroLoss) {
    els.heroLoss.textContent = report.weekly_actions?.length ? '建議立即執行三件事' : '--';
  }

  if (els.heroDanger) {
    const goalLabel = report.goal_label || '建議立即啟動智能守護方案';
    els.heroDanger.textContent = `${goalLabel} · 完整結果已更新`;
  }

  updateCtaHeadline({
    storeName: sanitize(store.name) || '您的門市',
    rating,
    diffRating,
    negative: report.review_negative ?? 0,
  });
}

function renderReviewSummary(report = {}) {
  if (!els.reviewsSummary) return;
  const goalLabel = report.goal_label || '智能體已根據您的設定生成專屬初檢。';
  els.reviewsSummary.textContent = `${goalLabel} 完整報告已經可以在 LINE 查看。`;
}

function renderReport(report) {
  if (!report) {
    showToast('無法載入報告內容');
    return;
  }
  updateHero(report);
  renderReviewSummary(report);
  renderReviews(report);
  renderCompetitors(report);
  renderActions(report);
  startSeatTicker();
}

function startSeatTicker() {
  if (!els.seatCounter) return;
  els.seatCounter.textContent = state.seatBase;
  if (state.seatTimer) clearInterval(state.seatTimer);
  let toggle = false;
  state.seatTimer = setInterval(() => {
    toggle = !toggle;
    els.seatCounter.textContent = toggle ? state.seatLow : state.seatBase;
  }, 6000);
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

function openUrl(url) {
  if (!url) {
    showToast('尚未設定連結');
    return;
  }
  if (state.liffReady && state.liffInClient) {
    liff.openWindow({ url, external: false });
  } else {
    window.open(url, '_blank');
  }
}

function attachListeners() {
  if (els.ctaPrimary) {
    els.ctaPrimary.addEventListener('click', (event) => {
      event.preventDefault();
      openUrl(trialUrl);
    });
  }
  if (els.ctaSecondary) {
    els.ctaSecondary.addEventListener('click', (event) => {
      event.preventDefault();
      openUrl(checkoutSecondaryUrl || checkoutPrimaryUrl);
    });
  }
  if (els.ctaHome) {
    els.ctaHome.addEventListener('click', (event) => {
      event.preventDefault();
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
      els.heroDanger.textContent = '缺少驗證資訊，請回到 LINE 聊天視窗重新開啟報表。';
    }
  }
  initLiff();
})();
