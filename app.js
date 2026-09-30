/* Countdown + rotating quotes. No dependencies, no external requests. */
(function () {
  "use strict";

  var DEFAULTS = {
    target: "2026-10-01T08:30:00Z",
    targetLabel: "Thursday 1 October, 09:30 BST",
    zeroMessage: "Thank you",
    quoteIntervalSeconds: 9
  };
  var FALLBACK_QUOTE = { text: "Welcome.", author: "" };

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    countdown: $("countdown"),
    value: $("countdown-value"),
    label: $("countdown-label"),
    thanks: $("thanks"),
    quotes: $("quotes"),
    layers: Array.prototype.slice.call(document.querySelectorAll("#quotes .quote"))
  };

  /* ------------------------------------------------------------------ */
  /* Config                                                              */
  /* ------------------------------------------------------------------ */

  function loadJSON(url) {
    return fetch(url, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error(url + " returned HTTP " + res.status);
      return res.json();
    });
  }

  function normaliseConfig(raw) {
    var cfg = {};
    var src = raw && typeof raw === "object" ? raw : {};
    Object.keys(DEFAULTS).forEach(function (k) {
      cfg[k] = src[k] !== undefined && src[k] !== null ? src[k] : DEFAULTS[k];
    });
    var secs = Number(cfg.quoteIntervalSeconds);
    cfg.quoteIntervalSeconds = isFinite(secs) && secs >= 2 ? secs : DEFAULTS.quoteIntervalSeconds;
    return cfg;
  }

  /* ------------------------------------------------------------------ */
  /* Countdown                                                           */
  /* ------------------------------------------------------------------ */

  var targetMs = NaN;
  var tickTimer = null;
  var finished = false;

  function remainingMs() {
    if (!isFinite(targetMs)) return NaN;
    return Math.max(0, targetMs - Date.now());
  }

  function format(ms) {
    // Ceil so the display reads 0:00 exactly at the target and never earlier.
    var total = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(total / 60);
    var s = total % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function tick() {
    clearTimeout(tickTimer);
    tickTimer = null;
    if (finished || !isFinite(targetMs)) return;

    var rem = targetMs - Date.now();
    if (rem <= 0) {
      finish();
      return;
    }
    els.value.textContent = format(rem);

    // Next update just after the displayed value changes (the next whole
    // second of remaining time), recomputed from Date.now() every time.
    var delay = rem % 1000;
    if (delay === 0) delay = 1000;
    tickTimer = setTimeout(tick, delay + 10);
  }

  function finish(immediate) {
    if (finished) return;
    finished = true;
    clearTimeout(tickTimer);
    tickTimer = null;
    els.value.textContent = "0:00";
    els.countdown.hidden = true;

    els.thanks.hidden = false;
    if (immediate) {
      els.thanks.classList.add("is-visible");
    } else {
      // Force a style flush so the opacity transition runs from 0.
      void els.thanks.offsetWidth;
      requestAnimationFrame(function () { els.thanks.classList.add("is-visible"); });
      // Belt and braces in case rAF is throttled (background tab).
      setTimeout(function () { els.thanks.classList.add("is-visible"); }, 50);
    }
  }

  function startCountdown(cfg) {
    targetMs = Date.parse(cfg.target);
    els.thanks.textContent = String(cfg.zeroMessage || DEFAULTS.zeroMessage);

    if (!isFinite(targetMs)) {
      console.warn("[countdown] config.target is not a valid date, using default:", cfg.target);
      targetMs = Date.parse(DEFAULTS.target);
    }

    if (cfg.targetLabel) {
      els.label.textContent = "until " + cfg.targetLabel;
      els.countdown.setAttribute("aria-label", "Time remaining until " + cfg.targetLabel);
    }

    if (targetMs - Date.now() <= 0) {
      finish(true); // loaded after the target: show the message straight away
    } else {
      tick();
    }
  }

  // Tabs that sleep can miss or delay timers: recompute on return.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") tick();
  });
  window.addEventListener("pageshow", function () { tick(); });

  /* ------------------------------------------------------------------ */
  /* Quotes                                                              */
  /* ------------------------------------------------------------------ */

  var quotes = [];
  var deck = [];
  var lastIndex = -1;
  var activeLayer = 0;
  var intervalMs = DEFAULTS.quoteIntervalSeconds * 1000;
  var quoteTimer = null;
  var nextQuoteAt = 0;
  var pausedRemaining = null;
  var hovering = false;
  var pressing = false;

  function validQuotes(data) {
    if (!Array.isArray(data)) return [];
    return data
      .filter(function (q) {
        return q && typeof q === "object" && typeof q.text === "string" && q.text.trim() !== "";
      })
      .map(function (q) {
        return {
          text: q.text.trim(),
          author: typeof q.author === "string" ? q.author.trim() : ""
        };
      });
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function newDeck() {
    var d = shuffle(quotes.map(function (_, i) { return i; }));
    // Never repeat across the reshuffle boundary.
    if (d.length > 1 && d[0] === lastIndex) {
      var k = 1 + Math.floor(Math.random() * (d.length - 1));
      var t = d[0]; d[0] = d[k]; d[k] = t;
    }
    return d;
  }

  function nextIndex() {
    if (!deck.length) deck = newDeck();
    lastIndex = deck.shift();
    return lastIndex;
  }

  function fillLayer(layer, q) {
    var text = layer.querySelector(".quote-text");
    var author = layer.querySelector(".quote-author");
    text.textContent = q.text;
    if (q.author) {
      author.textContent = q.author;
      author.hidden = false;
    } else {
      author.textContent = "";
      author.hidden = true;
    }
  }

  function show(q, crossFade) {
    var incoming = crossFade ? 1 - activeLayer : activeLayer;
    var outgoing = 1 - incoming;
    fillLayer(els.layers[incoming], q);
    els.layers[incoming].classList.add("is-active");
    els.layers[incoming].removeAttribute("aria-hidden");
    els.layers[outgoing].classList.remove("is-active");
    els.layers[outgoing].setAttribute("aria-hidden", "true");
    activeLayer = incoming;
  }

  function isPaused() { return hovering || pressing; }

  function schedule(ms) {
    clearTimeout(quoteTimer);
    nextQuoteAt = Date.now() + ms;
    quoteTimer = setTimeout(advance, ms);
  }

  function advance() {
    quoteTimer = null;
    if (quotes.length < 2) return;
    if (isPaused()) { pausedRemaining = 0; return; }
    show(quotes[nextIndex()], true);
    schedule(intervalMs);
  }

  function pause() {
    if (pausedRemaining !== null || quotes.length < 2) return;
    pausedRemaining = quoteTimer ? Math.max(0, nextQuoteAt - Date.now()) : 0;
    clearTimeout(quoteTimer);
    quoteTimer = null;
  }

  function resume() {
    if (isPaused() || pausedRemaining === null) return;
    // Give the reader a moment after they let go before changing.
    var ms = Math.max(pausedRemaining, 1500);
    pausedRemaining = null;
    schedule(ms);
  }

  function setHover(v) { hovering = v; v ? pause() : resume(); }
  function setPress(v) { pressing = v; v ? pause() : resume(); }

  // Hover-to-pause deliberately omitted: a parked cursor on a wall display
  // would freeze rotation indefinitely. Press-and-hold still pauses.
  els.quotes.addEventListener("pointerdown", function () { setPress(true); });
  ["pointerup", "pointercancel"].forEach(function (type) {
    window.addEventListener(type, function () { if (pressing) setPress(false); });
  });
  // Suppress the long-press context menu on touch so holding just pauses.
  els.quotes.addEventListener("contextmenu", function (e) {
    if (pressing) e.preventDefault();
  });

  function startQuotes(list, cfg) {
    intervalMs = cfg.quoteIntervalSeconds * 1000;
    quotes = list;
    deck = [];
    lastIndex = -1;
    show(quotes[nextIndex()], false);
    if (quotes.length > 1) {
      if (isPaused()) pausedRemaining = intervalMs;
      else schedule(intervalMs);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */

  var configReady = loadJSON("config.json")
    .then(normaliseConfig)
    .catch(function (err) {
      console.warn("[countdown] Could not load config.json, using built-in defaults.", err);
      return normaliseConfig(DEFAULTS);
    })
    .then(function (cfg) {
      startCountdown(cfg);
      return cfg;
    });

  var quotesReady = loadJSON("quotes.json")
    .then(function (data) {
      var list = validQuotes(data);
      if (!list.length) throw new Error("quotes.json contained no usable quotes");
      return list;
    })
    .catch(function (err) {
      console.warn("[countdown] Could not load quotes.json, showing fallback line.", err);
      return [FALLBACK_QUOTE];
    });

  Promise.all([configReady, quotesReady]).then(function (r) {
    startQuotes(r[1], r[0]);
  });

  // Test hook.
  window.__countdown = {
    remainingMs: remainingMs,
    isFinished: function () { return finished; },
    tick: tick
  };
})();
