/* Writer Clock — dependency-free application and testable core. */
(function (global) {
  "use strict";

  var STORAGE_PREFIX = "writerClock.v1.";
  var FAVORITES_KEY = STORAGE_PREFIX + "favorites";
  var THEME_KEY = STORAGE_PREFIX + "theme";
  var FONT_KEY = STORAGE_PREFIX + "font";
  var DIM_KEY = STORAGE_PREFIX + "dim";
  var DOCK_KEY = STORAGE_PREFIX + "dock";
  var ORIGINAL_KEY = STORAGE_PREFIX + "preferOriginal";
  var RECENT_LIMIT = 24;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderQuoteHtml(quote, timePhrase) {
    var raw = String(quote || "");
    var phrase = String(timePhrase || "");
    var lower = raw.toLocaleLowerCase("ko");
    var index = phrase ? lower.indexOf(phrase.toLocaleLowerCase("ko")) : -1;

    if (index < 0) {
      return escapeHtml(raw).replace(/&lt;br\s*\/?&gt;/gi, "<br>");
    }

    return (
      escapeHtml(raw.slice(0, index)) +
      '<strong class="time-phrase">' +
      escapeHtml(raw.slice(index, index + phrase.length)) +
      "</strong>" +
      escapeHtml(raw.slice(index + phrase.length))
    ).replace(/&lt;br\s*\/?&gt;/gi, "<br>");
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function formatHHMM(date) {
    return pad2(date.getHours()) + ":" + pad2(date.getMinutes());
  }

  function isValidHHMM(value) {
    return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""));
  }

  function minutesOf(value) {
    if (!isValidHHMM(value)) return NaN;
    var parts = value.split(":");
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  function adjacentTime(value, delta) {
    var minutes = minutesOf(value);
    if (!Number.isFinite(minutes)) return null;
    minutes = (minutes + delta + 1440) % 1440;
    return pad2(Math.floor(minutes / 60)) + ":" + pad2(minutes % 60);
  }

  function ampmOf(value) {
    return minutesOf(value) < 720 ? "am" : "pm";
  }

  function formatKoreanTime(value) {
    if (!isValidHHMM(value)) return "--:--";
    var parts = value.split(":");
    var hour = Number(parts[0]);
    var hour12 = hour % 12 || 12;
    return (hour < 12 ? "오전 " : "오후 ") + hour12 + ":" + parts[1];
  }

  function quoteSignature(item) {
    if (!item) return "";
    return [item.time || "", item.title || "", item.author || "", item.q || ""].join("|");
  }

  function exactPool(data, hhmm) {
    if (!data || !data.precise || !isValidHHMM(hhmm)) return [];
    var list = data.precise[hhmm];
    if (!Array.isArray(list)) return [];
    var expected = ampmOf(hhmm);
    return list.filter(function (item) {
      return item && item.q && item.t && item.ampm === expected;
    });
  }

  function preferredExactPool(data, hhmm, preferOriginal) {
    var pool = exactPool(data, hhmm);
    if (!preferOriginal) return pool;
    var originals = pool.filter(function (item) {
      return item.kind === "원문";
    });
    return originals.length ? originals : pool;
  }

  function resolveCanonicalFavorite(data, item) {
    if (!item || typeof item !== "object" || !isValidHHMM(item.time)) return null;
    if (typeof item.q !== "string" || typeof item.title !== "string" || typeof item.author !== "string") {
      return null;
    }

    var signature = quoteSignature(item);
    var canonical = exactPool(data, item.time).find(function (candidate) {
      return quoteSignature(Object.assign({}, candidate, { time: item.time })) === signature;
    });
    if (!canonical) return null;

    var resolved = Object.assign({}, canonical, { time: item.time });
    if (typeof item.savedAt === "number" && Number.isFinite(item.savedAt)) {
      resolved.savedAt = item.savedAt;
    }
    return resolved;
  }

  function isInteractiveShortcutTarget(target) {
    var element = target && target.nodeType === 3 ? target.parentElement : target;
    if (!element) return false;
    if (typeof element.closest === "function") {
      return !!element.closest(
        "button, a, input, textarea, select, summary, [contenteditable]:not([contenteditable='false']), [role='button'], [role='link']",
      );
    }
    var tagName = String(element.tagName || "").toUpperCase();
    if (["BUTTON", "A", "INPUT", "TEXTAREA", "SELECT", "SUMMARY"].includes(tagName)) return true;
    if (element.isContentEditable) return true;
    return typeof element.getAttribute === "function" && ["button", "link"].includes(element.getAttribute("role"));
  }

  function pickExactQuote(data, hhmm, options) {
    options = options || {};
    var pool = preferredExactPool(data, hhmm, options.preferOriginal);
    if (!pool.length) return null;

    var recent = options.recent || new Set();
    var available = pool.filter(function (item) {
      return !recent.has(quoteSignature(item));
    });
    if (!available.length) {
      recent.clear();
      available = pool;
    }
    var index = options.randomIndex == null
      ? Math.floor(Math.random() * available.length)
      : Math.max(0, Math.min(available.length - 1, options.randomIndex));
    var picked = available[index];
    recent.add(quoteSignature(picked));
    while (recent.size > RECENT_LIMIT) recent.delete(recent.values().next().value);
    return picked;
  }

  function toggleFavoriteList(list, item) {
    var safeList = Array.isArray(list) ? list.slice() : [];
    var signature = quoteSignature(item);
    var index = safeList.findIndex(function (entry) {
      return quoteSignature(entry) === signature;
    });
    if (index >= 0) {
      safeList.splice(index, 1);
      return safeList;
    }
    safeList.push({
      time: item.time || "",
      t: item.t || "",
      q: item.q || "",
      title: item.title || "",
      author: item.author || "",
      kind: item.kind || "",
      ampm: item.ampm || "",
      sfw: item.sfw || "",
      review_status: item.review_status || "",
      source_match_basis: item.source_match_basis || "",
      source_review_basis: item.source_review_basis || "",
      period_review_status: item.period_review_status || "",
      content_warning: item.content_warning || "",
      savedAt: Date.now(),
    });
    return safeList;
  }

  var core = {
    escapeHtml: escapeHtml,
    renderQuoteHtml: renderQuoteHtml,
    formatHHMM: formatHHMM,
    isValidHHMM: isValidHHMM,
    minutesOf: minutesOf,
    adjacentTime: adjacentTime,
    ampmOf: ampmOf,
    formatKoreanTime: formatKoreanTime,
    quoteSignature: quoteSignature,
    exactPool: exactPool,
    preferredExactPool: preferredExactPool,
    resolveCanonicalFavorite: resolveCanonicalFavorite,
    isInteractiveShortcutTarget: isInteractiveShortcutTarget,
    pickExactQuote: pickExactQuote,
    periodReviewStatusText: periodReviewStatusText,
    reviewStatusText: reviewStatusText,
    toggleFavoriteList: toggleFavoriteList,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = core;
  if (typeof document === "undefined") return;

  var elements = {};
  [
    "clock", "clock-seconds", "period-label", "minute-progress-bar", "mode-label", "date-label", "stage", "quote", "source", "quote-badges", "quote-error",
    "previous-minute", "next-minute", "now-button", "time-picker", "shuffle-button", "favorite-button",
    "share-button", "settings-button", "library-button", "info-button", "install-button", "dock-button", "connection-status",
    "settings-dialog", "library-dialog", "info-dialog", "dim-slider", "dock-toggle", "original-toggle",
    "fullscreen-button", "update-button", "library-search", "favorites-list", "library-count",
    "export-favorites", "import-favorites-button", "import-favorites", "clear-favorites", "night-dim", "toast", "detail-time",
    "detail-expression", "detail-title", "detail-author", "detail-kind", "detail-review", "detail-period",
    "detail-warning", "detail-source-expression", "detail-source-title", "detail-source-author",
    "detail-source-quote", "detail-source-link"
  ].forEach(function (id) {
    elements[id] = document.getElementById(id);
  });

  var state = {
    live: true,
    key: null,
    currentQuote: null,
    recentByTime: Object.create(null),
    minuteTimer: null,
    secondTimer: null,
    dockTimer: null,
    driftTimer: null,
    toastTimer: null,
    wakeLock: null,
    installPrompt: null,
    waitingWorker: null,
  };

  function storageGet(key, fallback) {
    try {
      var value = localStorage.getItem(key);
      return value == null ? fallback : value;
    } catch (_error) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (_error) {
      toast("이 브라우저에서는 설정을 저장할 수 없습니다.");
      return false;
    }
  }

  function readFavorites() {
    try {
      var parsed = JSON.parse(storageGet(FAVORITES_KEY, "[]"));
      if (!Array.isArray(parsed)) return [];
      return parsed.map(function (item) {
        return resolveCanonicalFavorite(getData(), item);
      }).filter(Boolean);
    } catch (_error) {
      return [];
    }
  }

  function writeFavorites(list) {
    return storageSet(FAVORITES_KEY, JSON.stringify(list));
  }

  function getData() {
    return global.AUTHOR_CLOCK_QUOTES_KO || null;
  }

  function toast(message) {
    if (!elements.toast) return;
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () {
      elements.toast.hidden = true;
    }, 2800);
  }

  function recentFor(key) {
    if (!state.recentByTime[key]) state.recentByTime[key] = new Set();
    return state.recentByTime[key];
  }

  function preferOriginal() {
    return storageGet(ORIGINAL_KEY, "true") !== "false";
  }

  function updateShuffleAvailability() {
    var count = preferredExactPool(getData(), state.key, preferOriginal()).length;
    var disabled = count < 2;
    elements["shuffle-button"].disabled = disabled;
    elements["shuffle-button"].title = count === 0
      ? "이 시각에는 표시할 문장이 없습니다."
      : disabled
        ? "이 시각에는 다른 문장이 없습니다."
        : count + "개의 문장 중 다른 문장을 봅니다.";
  }

  function displayDate(date) {
    try {
      return new Intl.DateTimeFormat("ko-KR", {
        month: "long",
        day: "numeric",
        weekday: "long",
      }).format(date);
    } catch (_error) {
      return "";
    }
  }

  function updateTimeHeading() {
    var hour = Number(state.key.slice(0, 2));
    elements.clock.textContent = formatKoreanTime(state.key).replace(/^(오전|오후)\s/, "");
    elements.clock.dateTime = state.key;
    elements["period-label"].textContent = hour < 12 ? "오전" : "오후";
    elements["mode-label"].textContent = state.live
      ? "현재 시각 · LIVE"
      : "시간 탐색";
    elements["date-label"].textContent = state.live ? displayDate(new Date()) : "선택한 시각의 문장";
    elements["time-picker"].value = state.key;
  }

  function updateSecondDisplay() {
    clearTimeout(state.secondTimer);
    var now = new Date();
    var hour = now.getHours();
    document.body.dataset.daypart = hour < 6 ? "night" : hour < 10 ? "dawn" : hour < 17 ? "day" : hour < 21 ? "evening" : "night";
    if (state.live) {
      elements["clock-seconds"].textContent = String(now.getSeconds()).padStart(2, "0");
      elements["minute-progress-bar"].style.width = (((now.getSeconds() * 1000 + now.getMilliseconds()) / 60000) * 100).toFixed(2) + "%";
    } else {
      elements["clock-seconds"].textContent = "00";
      elements["minute-progress-bar"].style.width = "0%";
    }
    state.secondTimer = setTimeout(updateSecondDisplay, 1000 - now.getMilliseconds() + 12);
  }

  function sourceText(item) {
    var title = item.title || "작품 미상";
    var author = item.author || "작가 미상";
    return "『" + title + "』 · " + author;
  }

  function badge(label, className) {
    return '<span class="badge ' + (className || "") + '">' + escapeHtml(label) + "</span>";
  }

  function renderDetails(item) {
    elements["detail-time"].textContent = state.key || "—";
    elements["detail-expression"].textContent = item ? item.t : "—";
    elements["detail-title"].textContent = item ? (item.title || "미상") : "—";
    elements["detail-author"].textContent = item ? (item.author || "미상") : "—";
    elements["detail-kind"].textContent = item
      ? (item.kind === "원문" ? "한국어 공개저작 원문" : "외국 문학 한국어 번역")
      : "—";
    elements["detail-review"].textContent = item ? reviewStatusText(item) : "—";
    elements["detail-period"].textContent = item ? periodReviewStatusText(item) : "—";
    elements["detail-warning"].textContent = item && item.content_warning ? item.content_warning : "없음";
    elements["detail-source-expression"].textContent = item && item.source_t ? item.source_t : "—";
    elements["detail-source-title"].textContent = item && item.source_title ? item.source_title : "—";
    elements["detail-source-author"].textContent = item && item.source_author ? item.source_author : "—";
    elements["detail-source-quote"].textContent = item && item.source_q ? item.source_q : "—";
    var sourceLink = elements["detail-source-link"];
    if (item && item.source_url) {
      sourceLink.href = item.source_url;
      sourceLink.textContent = "원문 출전 열기";
      sourceLink.hidden = false;
    } else if (item && item.kind === "역" && item.source_q) {
      sourceLink.href = "docs/SOURCE_AUDIT.md";
      sourceLink.textContent = "canonical 출전 감사 보기";
      sourceLink.hidden = false;
    } else {
      sourceLink.removeAttribute("href");
      sourceLink.hidden = true;
    }
  }

  function reviewStatusText(item) {
    if (item.kind === "원문") return "캐시 원문과 부분 문자열 대조";
    if (item.review_status === "machine_checked") return "별도 원문 대조";
    if (item.review_status === "source_row_alias_matched") return "제목·작가 복합 별칭으로 원문 행 연결";
    if (item.review_status === "source_row_reviewed") return "개별 원문 행 검토 완료";
    if (item.review_status === "primary_source_verified") return "1차 출전 원문 확인";
    if (item.review_status === "source_row_matched") return "같은 분의 원문 행 연결";
    return "검토 상태 미기록";
  }

  function periodReviewStatusText(item) {
    if (item.kind === "원문") return "한국어 원문 문맥으로 24시간대 확정";
    if (item.period_review_status === "period_explicit") return "원문에 오전·오후 또는 24시간 표기 명시";
    if (item.period_review_status === "period_contextual") return "같은 대목의 문맥으로 시간대 확인";
    if (item.period_review_status === "period_ambiguous") return "원문만으로 오전·오후 미확정";
    if (item.period_review_status === "period_unreviewed") return "시간대 근거 검토 미완료";
    return "시간대 상태 미기록";
  }

  function renderQuote(item) {
    updateShuffleAvailability();
    elements.stage.setAttribute("aria-busy", "false");
    state.currentQuote = item;
    if (!item) {
      elements.stage.dataset.quoteLength = "short";
      elements.quote.textContent = "이 시각에 검증된 정밀 문장이 없습니다.";
      elements.source.textContent = "";
      elements["quote-badges"].innerHTML = badge("데이터 누락", "");
      elements["quote-error"].hidden = false;
      elements["quote-error"].textContent = state.key + " 항목을 데이터 감사에서 보완해야 합니다.";
      elements["favorite-button"].disabled = true;
      elements["share-button"].disabled = true;
      renderDetails(null);
      return;
    }

    var withTime = Object.assign({}, item, { time: state.key });
    state.currentQuote = withTime;
    var quoteLength = plainQuote(item.q).length;
    elements.stage.dataset.quoteLength = quoteLength > 180 ? "long" : quoteLength > 110 ? "medium" : "short";
    elements.quote.innerHTML = renderQuoteHtml(item.q, item.t);
    elements.source.textContent = sourceText(item);
    var badges = badge("분 단위 일치", "badge-exact");
    badges += badge(item.kind === "원문" ? "원문" : "번역", "");
    if (item.sfw === "nsfw" || item.content_warning) badges += badge("민감한 내용", "");
    else if (item.kind === "역" && item.sfw !== "sfw") badges += badge("내용 분류 미확인", "");
    if (item.review_status === "source_row_reviewed") badges += badge("출전 검토 완료", "");
    if (item.review_status === "primary_source_verified") badges += badge("1차 출전 확인", "");
    if (item.period_review_status === "period_ambiguous") {
      badges += badge("오전·오후 미확정", "badge-warning");
    }
    elements["quote-badges"].innerHTML = badges;
    elements["quote-error"].hidden = true;
    elements["favorite-button"].disabled = false;
    elements["share-button"].disabled = false;
    updateFavoriteButton();
    renderDetails(withTime);
  }

  function chooseQuote(shuffle) {
    var recent = recentFor(state.key);
    if (!shuffle) recent.clear();
    var picked = pickExactQuote(getData(), state.key, {
      preferOriginal: preferOriginal(),
      recent: recent,
    });
    renderQuote(picked);
  }

  function updateUrl() {
    if (!history || !history.replaceState || location.protocol === "file:") return;
    var url = new URL(location.href);
    if (state.live) url.searchParams.delete("time");
    else url.searchParams.set("time", state.key);
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  }

  function changeTime(key, live, shuffle) {
    if (!isValidHHMM(key)) return;
    var changed = key !== state.key || live !== state.live;
    state.key = key;
    state.live = !!live;
    updateTimeHeading();
    updateUrl();
    updateShuffleAvailability();
    if (changed || shuffle) {
      elements.stage.classList.add("is-swapping");
      setTimeout(function () {
        chooseQuote(!!shuffle);
        elements.stage.classList.remove("is-swapping");
      }, window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 120);
    }
  }

  function goLive() {
    changeTime(formatHHMM(new Date()), true, false);
    scheduleMinuteTick();
  }

  function stepMinute(delta) {
    changeTime(adjacentTime(state.key, delta), false, false);
  }

  function scheduleMinuteTick() {
    clearTimeout(state.minuteTimer);
    if (!state.live) return;
    var now = new Date();
    var delay = (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 25;
    state.minuteTimer = setTimeout(function () {
      if (state.live) changeTime(formatHHMM(new Date()), true, false);
      scheduleMinuteTick();
    }, delay);
  }

  function favoriteContains(item) {
    var signature = quoteSignature(item);
    return readFavorites().some(function (entry) {
      return quoteSignature(entry) === signature;
    });
  }

  function updateFavoriteButton() {
    var active = !!state.currentQuote && favoriteContains(state.currentQuote);
    elements["favorite-button"].setAttribute("aria-pressed", active ? "true" : "false");
    elements["favorite-button"].textContent = active ? "♥ 저장됨" : "♡ 저장";
    elements["library-button"].textContent = readFavorites().length ? "♥" : "♡";
  }

  function toggleCurrentFavorite() {
    if (!state.currentQuote) return;
    var wasSaved = favoriteContains(state.currentQuote);
    var next = toggleFavoriteList(readFavorites(), state.currentQuote);
    if (writeFavorites(next)) {
      updateFavoriteButton();
      renderFavorites();
      toast(wasSaved ? "저장에서 뺐습니다." : "문장을 저장했습니다.");
    }
  }

  function plainQuote(text) {
    return String(text || "").replace(/<br\s*\/?\s*>/gi, " ").replace(/\s+/g, " ").trim();
  }

  function renderFavorites() {
    var query = (elements["library-search"].value || "").trim().toLocaleLowerCase("ko");
    var list = readFavorites().slice().reverse();
    elements["library-count"].textContent = list.length + "개";
    var filtered = list.filter(function (item) {
      return !query || [item.q, item.title, item.author, item.time].join(" ").toLocaleLowerCase("ko").includes(query);
    });
    if (!filtered.length) {
      elements["favorites-list"].innerHTML = '<p class="empty-state">' +
        (query ? "검색 결과가 없습니다." : "아직 저장한 문장이 없습니다.") + "</p>";
      return;
    }
    elements["favorites-list"].innerHTML = filtered.map(function (item) {
      var sig = quoteSignature(item);
      return '<article class="favorite-card" role="listitem">' +
        '<button class="favorite-open" type="button" data-signature="' + escapeHtml(sig) + '">' +
        "<blockquote>“" + escapeHtml(plainQuote(item.q)) + "”</blockquote>" +
        "<small>" + escapeHtml(item.time + " · " + sourceText(item)) + "</small></button>" +
        '<button class="favorite-delete" type="button" data-signature="' + escapeHtml(sig) + '" aria-label="저장 삭제">×</button>' +
        "</article>";
    }).join("");
  }

  function findFavorite(signature) {
    return readFavorites().find(function (item) {
      return quoteSignature(item) === signature;
    });
  }

  function removeFavorite(signature) {
    var next = readFavorites().filter(function (item) {
      return quoteSignature(item) !== signature;
    });
    writeFavorites(next);
    renderFavorites();
    updateFavoriteButton();
    toast("저장에서 뺐습니다.");
  }

  function openFavorite(item) {
    var canonical = resolveCanonicalFavorite(getData(), item);
    if (!canonical) {
      toast("현재 데이터에서 확인할 수 없는 저장 문장입니다.");
      return;
    }
    closeDialog(elements["library-dialog"]);
    state.key = canonical.time;
    state.live = false;
    updateTimeHeading();
    updateUrl();
    renderQuote(canonical);
  }

  function exportFavorites() {
    var blob = new Blob([JSON.stringify({ version: 1, favorites: readFavorites() }, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "writerclock-favorites.json";
    anchor.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
    toast("저장한 문장을 내보냈습니다.");
  }

  function importFavorites(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result || ""));
        var incoming = Array.isArray(parsed) ? parsed : parsed.favorites;
        if (!Array.isArray(incoming)) throw new Error("invalid format");
        var merged = readFavorites();
        var accepted = 0;
        var rejected = 0;
        var added = 0;
        incoming.forEach(function (item) {
          var canonical = resolveCanonicalFavorite(getData(), item);
          if (!canonical) {
            rejected += 1;
            return;
          }
          accepted += 1;
          if (!merged.some(function (saved) { return quoteSignature(saved) === quoteSignature(canonical); })) {
            merged.push(canonical);
            added += 1;
          }
        });
        if (incoming.length && accepted === 0) throw new Error("no canonical favorites");
        if (!writeFavorites(merged)) return;
        renderFavorites();
        updateFavoriteButton();
        toast(rejected
          ? added + "개를 가져왔고, 확인할 수 없는 " + rejected + "개는 건너뛰었습니다."
          : added + "개의 저장 문장을 가져왔습니다.");
      } catch (_error) {
        toast("현재 데이터와 일치하는 작가시계 JSON 파일이 아닙니다.");
      }
      elements["import-favorites"].value = "";
    };
    reader.readAsText(file);
  }

  function shareCurrent() {
    if (!state.currentQuote) return;
    var item = state.currentQuote;
    var text = "“" + plainQuote(item.q) + "”\n— " + sourceText(item) + "\n" + formatKoreanTime(state.key);
    var url = new URL(location.href);
    url.searchParams.set("time", state.key);
    if (navigator.share) {
      navigator.share({ title: "작가시계 " + state.key, text: text, url: url.href })
        .then(function () { toast("문장을 공유했습니다."); })
        .catch(function (error) {
          if (!error || error.name !== "AbortError") copyShareText(text + "\n" + url.href);
        });
      return;
    }
    copyShareText(text + "\n" + url.href);
  }

  function copyShareText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(function () { toast("공유 문구를 복사했습니다."); })
        .catch(function () { toast("공유 문구를 복사하지 못했습니다."); });
    } else {
      toast("이 브라우저는 공유를 지원하지 않습니다.");
    }
  }

  function applyTheme(value) {
    var mode = ["auto", "light", "dark"].includes(value) ? value : "auto";
    document.documentElement.classList.remove("theme-light", "theme-dark");
    if (mode !== "auto") document.documentElement.classList.add("theme-" + mode);
    document.querySelectorAll("[data-theme]").forEach(function (button) {
      button.setAttribute("aria-pressed", button.dataset.theme === mode ? "true" : "false");
    });
  }

  function applyFont(value) {
    var sizes = { small: 0.86, normal: 1, large: 1.16 };
    var mode = sizes[value] ? value : "normal";
    document.documentElement.style.setProperty("--quote-scale", sizes[mode]);
    document.querySelectorAll("[data-font]").forEach(function (button) {
      button.setAttribute("aria-pressed", button.dataset.font === mode ? "true" : "false");
    });
  }

  function nightOpacity(date) {
    var minute = date.getHours() * 60 + date.getMinutes();
    if (minute >= 1320) return Math.min(0.46, ((minute - 1320) / 120) * 0.46);
    if (minute <= 360) return Math.max(0, ((360 - minute) / 360) * 0.46);
    return 0;
  }

  function applyDim() {
    var manual = Number(storageGet(DIM_KEY, "0")) || 0;
    var auto = document.body.classList.contains("dock-mode") ? nightOpacity(new Date()) : 0;
    elements["night-dim"].style.opacity = String(Math.max(manual, auto));
  }

  function requestWakeLock() {
    if (!document.body.classList.contains("dock-mode") || !navigator.wakeLock || state.wakeLock) return;
    navigator.wakeLock.request("screen").then(function (lock) {
      state.wakeLock = lock;
      lock.addEventListener("release", function () { state.wakeLock = null; });
    }).catch(function () {});
  }

  function releaseWakeLock() {
    if (!state.wakeLock) return;
    state.wakeLock.release().catch(function () {});
    state.wakeLock = null;
  }

  function applyDock(enabled) {
    document.body.classList.toggle("dock-mode", enabled);
    document.body.classList.toggle("controls-visible", enabled);
    elements["dock-toggle"].checked = enabled;
    elements["dock-button"].setAttribute("aria-pressed", enabled ? "true" : "false");
    elements["dock-button"].textContent = enabled ? "거치 종료" : "거치 시계";
    if (enabled) requestWakeLock(); else releaseWakeLock();
    applyDim();
    resetDockControls();
    applyDrift();
  }

  function resetDockControls() {
    if (!document.body.classList.contains("dock-mode")) return;
    document.body.classList.add("controls-visible");
    clearTimeout(state.dockTimer);
    state.dockTimer = setTimeout(function () {
      if (!document.querySelector("dialog[open]")) document.body.classList.remove("controls-visible");
    }, 5000);
  }

  function applyDrift() {
    clearTimeout(state.driftTimer);
    var enabled = document.body.classList.contains("dock-mode");
    if (!enabled) {
      document.body.style.removeProperty("--drift-x");
      document.body.style.removeProperty("--drift-y");
      return;
    }
    var t = Date.now() / 60000;
    document.body.style.setProperty("--drift-x", (Math.sin(t) * 0.8).toFixed(2) + "vw");
    document.body.style.setProperty("--drift-y", (Math.cos(t * 0.73) * 0.8).toFixed(2) + "vh");
    state.driftTimer = setTimeout(applyDrift, 30000);
  }

  function toggleDockMode() {
    var enabled = !document.body.classList.contains("dock-mode");
    storageSet(DOCK_KEY, enabled ? "true" : "false");
    applyDock(enabled);
    if (enabled && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(function () {});
    } else if (!enabled && document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }
  }

  function showDialog(dialog) {
    if (!dialog) return;
    resetDockControls();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function updateConnectionStatus() {
    var offline = navigator.onLine === false;
    elements["connection-status"].hidden = !offline;
    elements["connection-status"].textContent = offline ? "오프라인" : "";
  }

  function setupInstall() {
    window.addEventListener("beforeinstallprompt", function (event) {
      event.preventDefault();
      state.installPrompt = event;
      elements["install-button"].hidden = false;
    });
    window.addEventListener("appinstalled", function () {
      state.installPrompt = null;
      elements["install-button"].hidden = true;
      toast("작가시계를 설치했습니다.");
    });
    elements["install-button"].addEventListener("click", function () {
      if (!state.installPrompt) {
        toast("브라우저 메뉴에서 ‘홈 화면에 추가’를 선택하세요.");
        return;
      }
      state.installPrompt.prompt();
      state.installPrompt.userChoice.finally(function () {
        state.installPrompt = null;
        elements["install-button"].hidden = true;
      });
    });
  }

  function setupServiceWorker() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    navigator.serviceWorker.register("sw.js").then(function (registration) {
      if (registration.waiting) showUpdate(registration.waiting);
      registration.addEventListener("updatefound", function () {
        var worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", function () {
          if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdate(worker);
        });
      });
    }).catch(function () {
      toast("오프라인 캐시를 준비하지 못했습니다.");
    });
  }

  function showUpdate(worker) {
    state.waitingWorker = worker;
    elements["update-button"].hidden = false;
    toast("새 버전이 준비됐습니다.");
  }

  function setupEvents() {
    elements["previous-minute"].addEventListener("click", function () { stepMinute(-1); });
    elements["next-minute"].addEventListener("click", function () { stepMinute(1); });
    elements["now-button"].addEventListener("click", goLive);
    elements["time-picker"].addEventListener("change", function () {
      if (isValidHHMM(elements["time-picker"].value)) changeTime(elements["time-picker"].value, false, false);
    });
    elements["shuffle-button"].addEventListener("click", function () { changeTime(state.key, state.live, true); });
    elements["favorite-button"].addEventListener("click", toggleCurrentFavorite);
    elements["share-button"].addEventListener("click", shareCurrent);
    elements["dock-button"].addEventListener("click", toggleDockMode);
    elements["settings-button"].addEventListener("click", function () { showDialog(elements["settings-dialog"]); });
    elements["library-button"].addEventListener("click", function () { renderFavorites(); showDialog(elements["library-dialog"]); });
    elements["info-button"].addEventListener("click", function () { showDialog(elements["info-dialog"]); });
    elements["library-search"].addEventListener("input", renderFavorites);
    elements["favorites-list"].addEventListener("click", function (event) {
      var deleteButton = event.target.closest(".favorite-delete");
      var openButton = event.target.closest(".favorite-open");
      if (deleteButton) removeFavorite(deleteButton.dataset.signature);
      else if (openButton) openFavorite(findFavorite(openButton.dataset.signature));
    });
    elements["export-favorites"].addEventListener("click", exportFavorites);
    elements["import-favorites-button"].addEventListener("click", function () {
      elements["import-favorites"].click();
    });
    elements["import-favorites"].addEventListener("change", function () { importFavorites(this.files && this.files[0]); });
    elements["clear-favorites"].addEventListener("click", function () {
      if (!readFavorites().length) return;
      if (global.confirm("저장한 문장을 모두 지울까요?")) {
        writeFavorites([]);
        renderFavorites();
        updateFavoriteButton();
        toast("저장한 문장을 모두 지웠습니다.");
      }
    });
    document.querySelectorAll("[data-theme]").forEach(function (button) {
      button.addEventListener("click", function () { storageSet(THEME_KEY, button.dataset.theme); applyTheme(button.dataset.theme); });
    });
    document.querySelectorAll("[data-font]").forEach(function (button) {
      button.addEventListener("click", function () { storageSet(FONT_KEY, button.dataset.font); applyFont(button.dataset.font); });
    });
    elements["dim-slider"].addEventListener("input", function () { storageSet(DIM_KEY, this.value); applyDim(); });
    elements["dock-toggle"].addEventListener("change", function () { storageSet(DOCK_KEY, this.checked ? "true" : "false"); applyDock(this.checked); });
    elements["original-toggle"].addEventListener("change", function () {
      storageSet(ORIGINAL_KEY, this.checked ? "true" : "false");
      chooseQuote(false);
    });
    elements["fullscreen-button"].addEventListener("click", function () {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
      else if (document.exitFullscreen) document.exitFullscreen().catch(function () {});
    });
    elements["update-button"].addEventListener("click", function () {
      if (state.waitingWorker) state.waitingWorker.postMessage({ type: "SKIP_WAITING" });
      else location.reload();
    });
    navigator.serviceWorker && navigator.serviceWorker.addEventListener("controllerchange", function () { location.reload(); });
    window.addEventListener("online", updateConnectionStatus);
    window.addEventListener("offline", updateConnectionStatus);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") {
        if (state.live) changeTime(formatHHMM(new Date()), true, false);
        requestWakeLock();
        scheduleMinuteTick();
      }
    });
    window.addEventListener("pageshow", function () {
      if (state.live) changeTime(formatHHMM(new Date()), true, false);
    });
    ["pointermove", "pointerdown", "keydown", "touchstart"].forEach(function (name) {
      document.addEventListener(name, resetDockControls, { passive: true });
    });
    document.addEventListener("keydown", function (event) {
      if (isInteractiveShortcutTarget(event.target)) return;
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "ArrowLeft") stepMinute(-1);
      else if (event.key === "ArrowRight") stepMinute(1);
      else if (event.key.toLocaleLowerCase() === "n") goLive();
      else if (event.code === "Space") {
        event.preventDefault();
        if (!elements["shuffle-button"].disabled) changeTime(state.key, state.live, true);
      }
    });
  }

  function parseInitialTime() {
    try {
      var value = new URL(location.href).searchParams.get("time");
      if (isValidHHMM(value)) return value;
    } catch (_error) {}
    return null;
  }

  function init() {
    applyTheme(storageGet(THEME_KEY, "auto"));
    applyFont(storageGet(FONT_KEY, "normal"));
    elements["dim-slider"].value = storageGet(DIM_KEY, "0");
    elements["original-toggle"].checked = preferOriginal();
    setupEvents();
    setupInstall();
    setupServiceWorker();
    updateConnectionStatus();
    applyDock(storageGet(DOCK_KEY, "false") === "true");

    var initial = parseInitialTime();
    state.live = !initial;
    state.key = initial || formatHHMM(new Date());
    updateTimeHeading();
    chooseQuote(false);
    updateFavoriteButton();
    scheduleMinuteTick();
    updateSecondDisplay();
    applyDim();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(typeof window !== "undefined" ? window : this);
