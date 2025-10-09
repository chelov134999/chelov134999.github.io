(function createReportUtils(global) {
  const ReportUtils = global.ReportUtils || {};

  function toArray(input) {
    if (!input) return [];
    if (Array.isArray(input)) return input.filter(Boolean);
    if (typeof input === 'object') {
      return Object.entries(input).map(([key, value]) => ({ id: key, ...value }));
    }
    return [input];
  }

  function formatNumber(value) {
    if (value == null || value === '') return '';
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    return number.toLocaleString('zh-Hant-TW');
  }

  function formatCurrency(value) {
    if (value == null || value === '') return '';
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    return `NT$${number.toLocaleString('zh-Hant-TW')}`;
  }

  function formatScoreValue(value) {
    if (value == null || value === '') return '';
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    const normalized = Math.abs(number) <= 1 ? number * 100 : number;
    const formatted = Number.isInteger(normalized) ? normalized : Number(normalized.toFixed(1));
    return String(formatted);
  }

  function canonicalKey(value) {
    if (value == null) return '';
    return String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function normalizeMetricEntry(entry, fallbackKey = '') {
    const base = { key: fallbackKey || '', raw: entry };
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return {
        ...base,
        value: entry,
        label: '',
        hint: '',
        target: '',
      };
    }
    const value = entry.value
      ?? entry.percent
      ?? entry.percentage
      ?? entry.score
      ?? entry.amount
      ?? entry.metric
      ?? entry.count
      ?? entry.number
      ?? null;
    return {
      ...base,
      value,
      label: entry.label || entry.title || entry.name || entry.metric_label || '',
      hint: entry.note || entry.description || entry.detail || entry.hint || '',
      target: entry.target || entry.competitor || entry.name || entry.store || entry.top_name || '',
    };
  }

  function pickMetric(metrics, keys) {
    if (!metrics) return null;
    const keyList = (Array.isArray(keys) ? keys : [keys])
      .map(canonicalKey)
      .filter(Boolean);
    if (!keyList.length) return null;

    const matchesKey = (candidate) => {
      const key = canonicalKey(candidate);
      return key && keyList.includes(key);
    };

    if (Array.isArray(metrics)) {
      for (const item of metrics) {
        if (!item) continue;
        const identifiers = [
          item.id,
          item.key,
          item.code,
          item.slug,
          item.metric_id,
          item.metricId,
          item.name,
          item.label,
          item.title,
        ];
        for (const identifier of identifiers) {
          if (matchesKey(identifier)) {
            return normalizeMetricEntry(item, identifier || '');
          }
        }
        for (const [childKey, childValue] of Object.entries(item)) {
          if (matchesKey(childKey)) {
            return normalizeMetricEntry(childValue, childKey);
          }
        }
      }
      return null;
    }

    const visited = new Set();
    const traverse = (obj) => {
      if (!obj || typeof obj !== 'object' || visited.has(obj)) return null;
      visited.add(obj);
      for (const [key, value] of Object.entries(obj)) {
        if (matchesKey(key)) {
          return normalizeMetricEntry(value, key);
        }
      }
      for (const value of Object.values(obj)) {
        if (value && typeof value === 'object') {
          const found = traverse(value);
          if (found) return found;
        }
      }
      return null;
    };

    return traverse(metrics);
  }

  function clearContainer(container, emptyMessage) {
    if (!container) return;
    container.innerHTML = '';
    if (emptyMessage) {
      const fallback = document.createElement('p');
      fallback.className = 'muted';
      fallback.textContent = emptyMessage;
      container.appendChild(fallback);
    }
  }

  function renderMetrics(container, metrics, options = {}) {
    if (!container) return [];
    const items = toArray(metrics).map((item) => {
      if (item && typeof item === 'object') {
        const label = item.label || item.title || item.name || item.id || '';
        const note = item.note || item.description || item.detail || '';
        const delta = item.delta ?? item.diff ?? item.change ?? '';
        const deltaLabel = item.delta_label || item.deltaLabel || '';
        const severity = item.severity || item.level || '';
        const currency = item.currency || '';
        const id = item.id || item.key || item.metric_id || item.metricId || item.slug || item.code || label;

        const valueSources = [
          ['value', item.value],
          ['score', item.score],
          ['amount', item.amount],
          ['metric', item.metric],
          ['count', item.count],
          ['number', item.number],
        ];
        let rawValue = null;
        let valueSource = '';
        for (const [sourceKey, sourceValue] of valueSources) {
          if (sourceValue !== null && sourceValue !== undefined && sourceValue !== '') {
            rawValue = sourceValue;
            valueSource = sourceKey;
            break;
          }
        }

        const hasValue = !(rawValue === null || rawValue === undefined || rawValue === '');

        return {
          id,
          label,
          value: rawValue,
          note,
          delta,
          deltaLabel,
          severity,
          currency,
          valueSource,
          pending: !hasValue,
          raw: item,
        };
      }
      const hasValue = !(item === null || item === undefined || item === '');
      return {
        id: '',
        label: '',
        value: item,
        note: '',
        delta: '',
        deltaLabel: '',
        severity: '',
        currency: '',
        valueSource: '',
        pending: !hasValue,
        raw: item,
      };
    });

    container.innerHTML = '';
    if (!items.length) {
      clearContainer(container, options.emptyMessage || '資料準備中，稍後自動更新。');
      return [];
    }

    items.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'report-metric';
      if (item.severity) {
        card.dataset.severity = item.severity;
      }
      if (item.pending) {
        card.classList.add('report-metric--pending');
      }

      if (item.label) {
        const label = document.createElement('h3');
        label.textContent = item.label;
        card.appendChild(label);
      }

      const value = document.createElement('p');
      let displayValue = '尚未同步';
      if (!item.pending) {
        if (item.currency) {
          displayValue = formatCurrency(item.value) || '尚未同步';
        } else if (item.valueSource === 'score') {
          const scoreText = formatScoreValue(item.value);
          displayValue = scoreText ? `${scoreText} 分` : '尚未同步';
        } else {
          const raw = item.value;
          let formatted = formatNumber(raw);
          if (!formatted && raw !== null && raw !== undefined && raw !== '') {
            formatted = String(raw);
          }
          displayValue = formatted || '尚未同步';
        }
      }
      value.className = 'report-metric__value';
      value.textContent = displayValue;
      card.appendChild(value);

      if (item.delta || item.deltaLabel) {
        const delta = document.createElement('span');
        delta.className = 'report-metric__delta';
        delta.textContent = item.deltaLabel || String(item.delta);
        card.appendChild(delta);
      }

      if (item.note || item.pending) {
        const note = document.createElement('p');
        note.className = 'report-metric__note';
        note.textContent = item.pending ? '同步完成後立即補上。' : item.note;
        card.appendChild(note);
      }

      container.appendChild(card);
    });

    return items;
  }

  function renderCompetitors(container, competitors, options = {}) {
    if (!container) return [];
    const items = toArray(competitors).map((item) => {
      if (item && typeof item === 'object') {
        const rating = item.rating ?? item.score;
        const distance = item.distance_m ?? item.distance ?? item.distanceKm;
        const reviews = item.reviews_total ?? item.review_count ?? item.reviews;
        const trend = item.trend ?? item.delta ?? '';
        return {
          name: item.name || item.label || '未命名店家',
          rating,
          reviews,
          distance,
          note: item.note || item.highlight || '',
          trend,
        };
      }
      return {
        name: String(item || '未命名店家'),
        rating: '',
        reviews: '',
        distance: '',
        note: '',
        trend: '',
      };
    });

    container.innerHTML = '';
    if (!items.length) {
      clearContainer(container, options.emptyMessage || '競品資料整理中，稍後自動更新。');
      return [];
    }

    items.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'report-competitor';
      if (index === 0) {
        li.classList.add('report-competitor--leader');
      }

      const name = document.createElement('strong');
      name.textContent = item.name;
      li.appendChild(name);

      const meta = document.createElement('span');
      const ratingText = item.rating != null ? `${Number(item.rating).toFixed ? Number(item.rating).toFixed(1) : item.rating} ★` : '— ★';
      const reviewText = item.reviews != null ? `${formatNumber(item.reviews)} 則` : '— 則';
      let distanceText = '';
      if (item.distance != null) {
        const distanceNumber = Number(item.distance);
        if (Number.isFinite(distanceNumber)) {
          distanceText = distanceNumber >= 1000
            ? `${(distanceNumber / 1000).toFixed(1)} 公里`
            : `${Math.round(distanceNumber)} 公尺`;
        } else {
          distanceText = String(item.distance);
        }
      } else {
        distanceText = '距離未知';
      }

      meta.className = 'report-competitor__meta';
      meta.textContent = `${ratingText}｜${reviewText}｜${distanceText}`;
      li.appendChild(meta);

      if (item.note) {
        const note = document.createElement('p');
        note.className = 'report-competitor__note';
        note.textContent = item.note;
        li.appendChild(note);
      }

      if (item.trend) {
        const trend = document.createElement('span');
        trend.className = 'report-competitor__trend';
        trend.textContent = String(item.trend);
        li.appendChild(trend);
      }

      container.appendChild(li);
    });

    return items;
  }

  function renderActions(container, actions, options = {}) {
    if (!container) return [];
    const items = toArray(actions).map((item) => {
      if (item && typeof item === 'object') {
        return {
          text: item.text || item.title || item.task || '',
          owner: item.owner || item.assignee || '',
          due: item.due || item.deadline || '',
          note: item.note || item.detail || '',
        };
      }
      return {
        text: String(item || ''),
        owner: '',
        due: '',
        note: '',
      };
    }).filter((item) => item.text);

    container.innerHTML = '';
    if (!items.length) {
      clearContainer(container, options.emptyMessage || '本週行動清單準備中。');
      return [];
    }

    items.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'report-action';
      if (index === 0) {
        li.classList.add('report-action--primary');
      }

      const text = document.createElement('p');
      text.className = 'report-action__text';
      text.textContent = item.text;
      li.appendChild(text);

      if (item.owner || item.due) {
        const meta = document.createElement('span');
        meta.className = 'report-action__meta';
        const owner = item.owner ? `負責：${item.owner}` : '';
        const due = item.due ? `期限：${item.due}` : '';
        meta.textContent = [owner, due].filter(Boolean).join(' ｜ ');
        li.appendChild(meta);
      }

      if (item.note) {
        const note = document.createElement('p');
        note.className = 'report-action__note';
        note.textContent = item.note;
        li.appendChild(note);
      }

      container.appendChild(li);
    });

    return items;
  }

  function renderDrafts(container, drafts, options = {}) {
    if (!container) return [];
    const items = toArray(drafts).map((item, index) => {
      if (item && typeof item === 'object') {
        return {
          title: item.title || item.label || `草稿 #${index + 1}`,
          tone: item.tone || item.style || '',
          text: item.text || item.body || '',
        };
      }
      return {
        title: `草稿 #${index + 1}`,
        tone: '',
        text: String(item || ''),
      };
    }).filter((item) => item.text);

    container.innerHTML = '';
    if (!items.length) {
      clearContainer(container, options.emptyMessage || '草稿準備中，稍後自動推送。');
      return [];
    }

    const showCopy = options.showCopy !== false;
    items.forEach((item, index) => {
      const card = document.createElement('article');
      card.className = 'report-draft';

      const header = document.createElement('header');
      header.className = 'report-draft__header';

      const title = document.createElement('strong');
      title.textContent = item.title || `草稿 #${index + 1}`;
      header.appendChild(title);

      if (item.tone) {
        const tone = document.createElement('span');
        tone.className = 'report-draft__tone';
        tone.textContent = item.tone;
        header.appendChild(tone);
      }

      card.appendChild(header);

      const body = document.createElement('p');
      body.className = 'report-draft__body';
      body.textContent = item.text;
      card.appendChild(body);

      if (showCopy) {
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'btn btn--ghost report-draft__copy';
        copyBtn.textContent = options.copyLabel || '複製草稿';
        copyBtn.addEventListener('click', () => {
          options.onCopy?.(item.text, index);
        });
        card.appendChild(copyBtn);
      }

      container.appendChild(card);
    });

    return items;
  }

  ReportUtils.renderMetrics = renderMetrics;
  ReportUtils.renderCompetitors = renderCompetitors;
  ReportUtils.renderActions = renderActions;
  ReportUtils.renderDrafts = renderDrafts;
  ReportUtils.formatNumber = formatNumber;
  ReportUtils.formatCurrency = formatCurrency;
  ReportUtils.formatScoreValue = formatScoreValue;
  ReportUtils.pickMetric = pickMetric;

  global.ReportUtils = ReportUtils;
})(window);
