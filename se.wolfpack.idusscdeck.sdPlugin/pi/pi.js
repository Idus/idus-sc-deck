// Shared settings-panel wiring for Idus SC Deck (OpenDeck / Stream Deck property inspector).
// Fields with data-setting="name" are loaded from and saved to the key's settings.
// Settings go out on the action context (actionInfo.context).
(function () {
  let socket = null, context = null, action = null, settings = {};
  // OpenDeck (Linux) or Elgato Stream Deck (Windows) — set on <html data-target> by make-pi
  const ELG = document.documentElement.dataset.target === "elgato";
  const infoFns = [];

  function fill() {
    document.querySelectorAll("[data-setting]").forEach((el) => {
      const k = el.dataset.setting, v = settings[k];
      if (el.type === "checkbox") el.checked = v === undefined || v === null ? el.dataset.default === "true" : !!v;
      else if (v !== undefined && v !== null) el.value = v;
      else if (el.dataset.default !== undefined) el.value = el.dataset.default;
    });
    views();
    document.dispatchEvent(new CustomEvent("pi-settings", { detail: settings }));
  }

  // Keys with several views (STAT, LOG): blocks marked data-show="a b" only show for those views
  function views() {
    const sel = document.querySelector('select[data-setting="show"]');
    if (!sel) return;
    const v = settings.show || sel.value || sel.dataset.default;
    document.querySelectorAll("[data-show]").forEach((el) => { el.hidden = !el.dataset.show.split(" ").includes(v); });
  }

  function save() {
    document.querySelectorAll("[data-setting]").forEach((el) => {
      const k = el.dataset.setting;
      settings[k] = el.type === "checkbox" ? el.checked : el.value.trim();
    });
    if (socket && socket.readyState === 1) socket.send(JSON.stringify({ event: "setSettings", context, payload: settings }));
    views();
    document.dispatchEvent(new CustomEvent("pi-settings", { detail: settings }));
  }

  function start(port, uuid, registerEvent, _info, actionInfo) {
    const a = typeof actionInfo === "string" ? JSON.parse(actionInfo) : actionInfo;
    context = a.context; action = a.action;
    settings = (a.payload && a.payload.settings) || {};
    fill();
    socket = new WebSocket("ws://127.0.0.1:" + port);
    socket.onopen = () => {
      socket.send(JSON.stringify({ event: registerEvent, uuid }));
      PI.send({ cmd: "info" });
    };
    socket.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.event === "didReceiveSettings") { settings = (m.payload && m.payload.settings) || {}; fill(); }
      if (m.event === "sendToPropertyInspector" && m.payload && m.payload.type === "info") infoFns.forEach((fn) => fn(m.payload));
    };
  }

  window.PI = {
    send(payload) { if (socket && socket.readyState === 1) socket.send(JSON.stringify({ event: "sendToPlugin", context, action, payload })); },
    onInfo(fn) { infoFns.push(fn); },
    get settings() { return settings; },
  };
  window.connectElgatoStreamDeckSocket = start;
  window.connectSocket = start;
  if (window.openDeckConnection && window.openDeckConnection.then) window.openDeckConnection.then((a) => start.apply(null, a));

  document.addEventListener("DOMContentLoaded", () => {
    views();
    document.querySelectorAll("[data-setting]").forEach((el) => {
      el.addEventListener("change", save);
    });
    // Links open in the default browser: Stream Deck takes an openUrl message, OpenDeck turns
    // window.open with a target into openUrl.
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("a[href^='http']");
      if (!a) return;
      e.preventDefault();
      if (ELG && socket && socket.readyState === 1) socket.send(JSON.stringify({ event: "openUrl", payload: { url: a.href } }));
      else window.open(a.href, "_blank");
    });
    // Copy buttons: data-copy-pre="<id of the pre>". Clipboard first, then select + execCommand,
    // else leave it selected for Ctrl+C.
    document.querySelectorAll("[data-copy-pre]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const el = document.getElementById(btn.dataset.copyPre), text = el.textContent;
        const done = () => { const old = btn.dataset.label || btn.textContent; btn.dataset.label = old;
          btn.textContent = "Copied ✓"; btn.classList.add("done"); setTimeout(() => { btn.textContent = old; btn.classList.remove("done"); }, 2200); };
        const fallback = () => {
          const r = document.createRange(); r.selectNodeContents(el); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
          let ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
          if (ok) done(); else btn.textContent = "Press Ctrl+C";
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
        else fallback();
      });
    });
    // Shared footer
    const f = document.querySelector("footer[data-idus]");
    if (f && ELG) {
      // Elgato Marketplace: support/tip links belong on the product page, so only GitHub here,
      // plus a "read more" about Star Citizen on Linux.
      f.innerHTML = 'Made by Idus · <a href="https://github.com/Idus/idus-sc-deck">GitHub</a> — help, source and feedback' +
        '<details class="more"><summary>Star Citizen on Linux? Read more</summary>' +
        '<p>Most of these keys also exist for <a href="https://github.com/nekename/OpenDeck">OpenDeck</a>, the Stream Deck software for Linux — same plugin, <a href="https://github.com/Idus/idus-sc-deck">Idus SC Deck</a>.</p>' +
        '<p>Star Citizen runs on Linux thanks to the <b>Star Citizen Linux Users Group (LUG)</b>: <a href="https://github.com/starcitizen-lug/lug-helper">LUG Helper</a> installs the game, and the <a href="https://github.com/starcitizen-lug/knowledge-base">knowledge base</a> and <a href="https://starcitizen-lug.github.io">LUG wiki</a> help with the rest.</p>' +
        '<p>On Linux, <a href="https://github.com/Idus/idus-sc-toolbox">Idus SC Toolbox</a> adds a launcher update check, keybind backups, shader cleanup and StarStrings updates. <b class="warn">Made for and developed on CachyOS</b> (Arch-based, KDE Plasma 6) — other distributions may need adjustments.</p>' +
        '</details><span class="fine">Unofficial fan project, not affiliated with Cloud Imperium Games.</span>';
    } else if (f) {
      f.innerHTML = 'Made by Idus · <a href="https://github.com/Idus/idus-sc-deck">GitHub</a> · ' +
        '<a href="https://ko-fi.com/N4N2QZHKK">☕ Tip me on Ko-fi</a><br>' +
        'New to SC? Code <a class="ref" href="https://www.robertsspaceindustries.com/enlist?referral=STAR-2GDF-FDKH">STAR-2GDF-FDKH</a> gives 5,000 aUEC.<br>' +
        '<span class="fine">Unofficial fan project, not affiliated with Cloud Imperium Games.</span>';
    }
  });
})();
