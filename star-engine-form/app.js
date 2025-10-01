const form = document.getElementById('lead-form');
const resultSection = document.getElementById('result');
const resultMessage = document.getElementById('result-message');
const resultJson = document.getElementById('result-json');
const copyButton = document.getElementById('copy-button');

let liffReady = false;
let liffId = new URLSearchParams(window.location.search).get('liffId') || window.LIFF_ID || '';
let cachedUserId = '';

async function initLiff() {
  if (!window.liff || !liffId) {
    return;
  }
  try {
    await liff.init({ liffId });
    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }
    const context = liff.getContext();
    const decoded = liff.getDecodedIDToken?.();
    cachedUserId = context?.userId || decoded?.sub || '';
    liffReady = true;
  } catch (error) {
    console.warn('[LIFF] 初始化失敗：', error);
  }
}

function buildPayload(data) {
  return {
    action: 'form_submit',
    city: data.get('city').trim(),
    route: data.get('route').trim(),
    number: data.get('number').trim(),
    name: data.get('name').trim(),
    submittedAt: new Date().toISOString(),
  };
}

function showResult(payload, message) {
  resultSection.hidden = false;
  resultMessage.textContent = message;
  resultJson.textContent = JSON.stringify(payload, null, 2);
}

async function postToN8n(payload, userId) {
  if (!userId) return false;
  try {
    const body = {
      destination: userId,
      events: [
        {
          type: 'message',
          message: {
            type: 'text',
            text: JSON.stringify(payload),
          },
          timestamp: Date.now(),
          source: { type: 'user', userId },
          replyToken: '',
          mode: 'active',
        },
      ],
    };
    const resp = await fetch('https://chelov134999.app.n8n.cloud/webhook/lead-entry', {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      console.warn('[n8n] webhook 回應非 2xx', resp.status, await resp.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('[n8n] webhook 呼叫失敗', error);
    return false;
  }
}

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(resultJson.textContent);
    copyButton.textContent = '已複製';
    setTimeout(() => (copyButton.textContent = '複製資料'), 2000);
  } catch (error) {
    console.warn('複製失敗：', error);
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const payload = buildPayload(data);

  if (!payload.city || !payload.route || !payload.number || !payload.name) {
    showResult(payload, '請確認四個欄位都已填寫。');
    return;
  }

  let success = false;

  if (liffReady && cachedUserId) {
    success = await postToN8n(payload, cachedUserId);
    if (success) {
      try {
        await liff.sendMessages([
          { type: 'text', text: '✅資料已送出，我正在生成初檢結果，請稍候查看。' },
        ]);
      } catch (error) {
        console.warn('sendMessages 失敗：', error);
      }
      showResult(payload, '資料已送交星級引擎，視窗可關閉，稍候會在 LINE 收到診斷。');
      setTimeout(() => liff.closeWindow(), 1500);
      return;
    }
  }

  showResult(
    payload,
    success
      ? '資料已送出，但無法確認 LINE 使用者 ID，請稍候回到 LINE 確認。'
      : '目前無法直接傳送，請複製下列資料貼回 LINE 對話框。'
  );
});

initLiff();
