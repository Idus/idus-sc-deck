// Elgato Stream Deck build: the same small interface as lib/sdk.js (OpenDeck), on top of Elgato's
// official SDK (@elgato/streamdeck v2, needed for Marketplace DRM). dev/build-elgato.cjs swaps this
// file in for lib/sdk.js when it bundles plugin.js.
// Key images are drawn with their text turned into outlines (textpaths.cjs), so they look the same
// on a PC without the Idus fonts.
"use strict";

const { default: streamDeck, SingletonAction } = require("@elgato/streamdeck");
const { textToPaths } = require("./textpaths.cjs");

/* global __IDUS_ACTIONS__ */
const ACTIONS = __IDUS_ACTIONS__; // action UUIDs, injected at build time (the manifest is not readable under DRM)

const handlers = {};
const lastImage = new Map(); // context -> last image sent (skip identical redraws)

function emit(event, msg) {
  for (const fn of handlers[event] || []) {
    try { fn(msg); } catch (e) { streamDeck.logger.error(`[${event}] ${(e && e.stack) || e}`); }
  }
}
const toMsg = (ev) => ({ action: ev.action.manifestId, context: ev.action.id, payload: ev.payload || {} });
const byId = (context) => streamDeck.actions.getActionById(context);
const quiet = (p) => { if (p && p.catch) p.catch(() => {}); };

function outlines(image) {
  const m = /^data:image\/svg\+xml;base64,(.*)$/s.exec(image || "");
  if (!m) return image;
  return "data:image/svg+xml;base64," + Buffer.from(textToPaths(Buffer.from(m[1], "base64").toString("utf8"))).toString("base64");
}

const sdk = {
  args: {},
  on(event, fn) { (handlers[event] = handlers[event] || []).push(fn); },
  send() {},
  setImage(context, image) {
    if (lastImage.get(context) === image) return;
    lastImage.set(context, image);
    const a = byId(context);
    if (a && a.isKey()) quiet(a.setImage(outlines(image)));
  },
  forget(context) { lastImage.delete(context); },
  setSettings(context, settings) { const a = byId(context); if (a) quiet(a.setSettings(settings)); },
  openUrl(url) { quiet(streamDeck.system.openUrl(url)); },
  showOk(context) { const a = byId(context); if (a && a.isKey()) quiet(a.showOk()); },
  showAlert(context) { const a = byId(context); if (a) quiet(a.showAlert()); },
  // Elgato only delivers to the settings page that is open right now
  toInspector(context, _action, payload) {
    const cur = streamDeck.ui.action;
    if (cur && cur.id === context) quiet(streamDeck.ui.sendToPropertyInspector(payload));
  },
  log(message) { streamDeck.logger.info(String(message)); },

  connect() {
    for (const uuid of ACTIONS) {
      const a = new SingletonAction();
      Object.defineProperty(a, "manifestId", { value: uuid });
      a.onWillAppear = (ev) => emit("willAppear", toMsg(ev));
      a.onWillDisappear = (ev) => emit("willDisappear", toMsg(ev));
      a.onKeyUp = (ev) => emit("keyUp", toMsg(ev));
      a.onDidReceiveSettings = (ev) => emit("didReceiveSettings", toMsg(ev));
      a.onPropertyInspectorDidAppear = (ev) => emit("propertyInspectorDidAppear", toMsg(ev));
      a.onSendToPlugin = (ev) => emit("sendToPlugin", toMsg(ev));
      streamDeck.actions.registerAction(a);
    }
    quiet(streamDeck.connect());
  },
};

module.exports = sdk;
