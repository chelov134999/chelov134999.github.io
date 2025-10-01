const form = document.getElementById('lead-form');
const resultSection = document.getElementById('result');
const resultMessage = document.getElementById('result-message');
const resultJson = document.getElementById('result-json');
const copyButton = document.getElementById('copy-button');

let liffReady = false;
let liffId = new URLSearchParams(window.location.search).get('liffId') || window.LIFF_ID || '';

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

  try {
    if (liffReady) {
      await liff.sendMessages([
        {
          type: 'text',
          text: JSON.stringify(payload),
        },
      ]);
      showResult(payload, '資料已傳送至星級引擎，請返回 LINE 查看診斷。');
      setTimeout(() => liff.closeWindow(), 1200);
    } else {
      showResult(payload, '目前未在 LIFF 中執行，請手動複製資料送回聊天。');
    }
  } catch (error) {
    console.error('送出失敗：', error);
    showResult(payload, '傳送至星級引擎時發生問題，請稍後再試或改為複製下方資料。');
  }
});

initLiff();
