const params = new URLSearchParams(window.location.search);
const config = window.STAR_ENGINE_CONFIG || {};

const webhookUrl = config.webhookUrl || 'https://chelov134999.app.n8n.cloud/webhook/lead-entry';
const liffId = config.formLiffId || config.liffId || '';
const reportUrl = config.reportUrl || config.report_url || '';
const formUrl = config.formUrl || config.form_url || window.location.href;

const state = {
  mode: params.get('view') === 'report' && params.get('token') ? 'report' : 'form',
  token: params.get('token') || '',
  liffReady: false,
  liffInClient: false,
  userId: '',
  countdownTimer: null,
};

const els = {
  formCard: document.getElementById('form-card'),
  form: document.getElementById('lead-form'),
  submitBtn: document.getElementById('submit-btn'),
  waitingCard: document.getElementById('waiting-card'),
  waitingMessage: document.getElementById('waiting-message'),
  waitingCount: document.getElementById('waiting-count'),
  resultCard: document.getElementById('result-card'),
  lineBtn: document.getElementById('line-btn'),
  toast: document.getElementById('toast'),
};

function redirectToReport() {
  if (!state.token) {
    showToast('缺少報表 token，請回 LINE 重新開啟。');
    return;
  }
  if (!reportUrl) {
    showToast('尚未設定報表頁，將回到表單。');
    return;
  }
  const target = `${reportUrl}${reportUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(state.token)}`;
  window.location.replace(target);
}

function showToast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.hidden = false;
  setTimeout(() => {
    els.toast.hidden = true;
  }, 2400);
}

function showSection(section) {
  if (els.formCard) els.formCard.hidden = section !== 'form';
  if (els.waitingCard) els.waitingCard.hidden = section !== 'waiting';
  if (els.resultCard) els.resultCard.hidden = section !== 'result';
}

function toggleLoading(isLoading) {
  if (!els.submitBtn) return;
  els.submitBtn.disabled = isLoading;
  els.submitBtn.textContent = isLoading ? '分析中…' : '送出並分析';
}

function cancelCountdown() {
  if (state.countdownTimer) {
    clearInterval(state.countdownTimer);
    state.countdownTimer = null;
  }
}

function startCountdown(seconds = 60) {
  cancelCountdown();
  let remaining = seconds;
  const phases = [
    {
      when: seconds,
      text: '正在鎖定門市在 Google Maps 的足跡與關鍵評論…',
      triggered: false,
    },
    {
      when: Math.max(seconds - 20, 0),
      text: '已呼叫 DataForSEO Search API，比對商圈競品與熱搜趨勢…',
      triggered: false,
    },
    {
      when: Math.max(seconds - 40, 0),
      text: '生成危機指標、補救草稿與 LINE 推播 CTA 中…',
      triggered: false,
    },
  ];

  const updateDisplay = () => {
    if (els.waitingCount) {
      els.waitingCount.textContent = remaining;
    }
  };
  const updateMessage = () => {
    if (!els.waitingMessage) return;
    for (const phase of phases) {
      if (!phase.triggered && remaining <= phase.when) {
        els.waitingMessage.textContent = phase.text;
        phase.triggered = true;
        break;
      }
    }
  };

  updateDisplay();
  updateMessage();
  state.countdownTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      cancelCountdown();
      showSection('result');
      return;
    }
    updateDisplay();
    updateMessage();
  }, 1000);
}

async function initLiff() {
  if (!window.liff || !liffId) {
    return;
  }
  try {
    await liff.init({ liffId });
    await liff.ready;
    if (!liff.isLoggedIn()) {
      liff.login({ scope: ['profile', 'openid'] });
      return;
    }
    state.liffReady = true;
    state.liffInClient = liff.isInClient?.() ?? false;
    try {
      const profile = await liff.getProfile();
      state.userId = profile?.userId || liff.getContext?.()?.userId || '';
    } catch (error) {
      console.warn('[LIFF] getProfile failed', error);
    }
  } catch (error) {
    console.warn('[LIFF] init failed', error);
  }
}

async function handleFormSubmit(event) {
  event.preventDefault();
  if (!els.form) return;

  if (!els.form.reportValidity()) {
    return;
  }

  const formData = new FormData(els.form);
  const payload = {
    city: (formData.get('city') || '').trim(),
    route: (formData.get('route') || '').trim(),
    number: (formData.get('number') || '').trim(),
    name: (formData.get('name') || '').trim(),
    submittedAt: new Date().toISOString(),
  };

  toggleLoading(true);
  showSection('waiting');

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [
          {
            replyToken: '',
            type: 'message',
            timestamp: Date.now(),
            source: { type: 'user', userId: state.userId || 'anonymous' },
            message: { type: 'text', text: `${payload.city}${payload.route}${payload.number} ${payload.name}` },
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${response.status} ${text}`);
    }
    startCountdown(60);
  } catch (error) {
    cancelCountdown();
    showSection('form');
    showToast(`送出失敗：${error.message}`);
  } finally {
    toggleLoading(false);
  }
}

function attachListeners() {
  if (els.form) {
    els.form.addEventListener('submit', handleFormSubmit);
  }
  if (els.lineBtn) {
    els.lineBtn.addEventListener('click', () => {
      const target = reportUrl || 'https://line.me/R/';
      if (state.liffReady) {
        try {
          liff.openWindow({ url: target, external: false });
        } catch (error) {
          console.warn('[LIFF] openWindow failed', error);
          try {
            liff.closeWindow();
          } catch (closeError) {
            console.warn('[LIFF] closeWindow failed', closeError);
          }
        }
      } else {
        window.open(target, '_blank');
      }
    });
  }
}

(function bootstrap() {
  if (state.mode === 'report') {
    redirectToReport();
    return;
  }

  attachListeners();
  showSection('form');
  initLiff();
})();
