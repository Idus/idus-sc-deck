// Minimal Stream Deck / OpenDeck plugin connection (SDK v2 protocol), zero dependencies.
// Needs Node.js 22+ for the built-in WebSocket client.
"use strict";

const handlers = {};
let ws = null;
const lastImage = new Map(); // context -> last image sent (skip identical redraws)

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) out[String(argv[i]).replace(/^-+/, "")] = argv[i + 1];
  return out;
}

function send(msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

const sdk = {
  args: parseArgs(process.argv),
  on(event, fn) { (handlers[event] = handlers[event] || []).push(fn); },
  send,
  setImage(context, image) {
    if (lastImage.get(context) === image) return;
    lastImage.set(context, image);
    send({ event: "setImage", context, payload: { image, target: 0 } });
  },
  forget(context) { lastImage.delete(context); },
  setSettings(context, settings) { send({ event: "setSettings", context, payload: settings }); },
  openUrl(url) { send({ event: "openUrl", payload: { url } }); },
  showOk(context) { send({ event: "showOk", context }); },
  showAlert(context) { send({ event: "showAlert", context }); },
  toInspector(context, action, payload) { send({ event: "sendToPropertyInspector", context, action, payload }); },
  log(message) { send({ event: "logMessage", payload: { message: String(message) } }); },

  connect() {
    const { port, pluginUUID, registerEvent } = sdk.args;
    if (!port || !pluginUUID || !registerEvent) {
      console.error("Idus SC Deck: missing -port / -pluginUUID / -registerEvent (start it from OpenDeck)");
      process.exit(1);
    }
    if (typeof WebSocket !== "function") {
      console.error(`Idus SC Deck needs Node.js 22 or newer (found ${process.version}).`);
      process.exit(1);
    }
    ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.addEventListener("open", () => send({ event: registerEvent, uuid: pluginUUID }));
    ws.addEventListener("message", (ev) => {
      let msg;
      try { msg = JSON.parse(String(ev.data)); } catch { return; }
      for (const fn of handlers[msg.event] || []) {
        try { fn(msg); } catch (e) { console.error(`[${msg.event}]`, e && e.stack || e); }
      }
    });
    ws.addEventListener("close", () => process.exit(0));
    ws.addEventListener("error", (e) => console.error("websocket error", e && e.message));
  },
};

module.exports = sdk;
