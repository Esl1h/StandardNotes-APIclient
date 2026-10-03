/**
 * Minimal stand-in for the Standard Notes host, so the plugin can be driven
 * through its real component relay (EditorKit) inside an iframe.
 *
 * Like the real host it sends `component-registered` exactly once, on the
 * iframe load event, with no retry.
 */
const HOST_HTML = `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%;display:block}</style>
</head>
<body>
<iframe id="f"></iframe>
<script>
  const frame = document.getElementById('f');
  let streamMessage = null;
  window.logs = [];

  const reply = (original, data) =>
    frame.contentWindow.postMessage({ action: 'reply', original, data }, '*');

  window.sendNote = (uuid, text) =>
    reply(streamMessage, {
      item: {
        uuid,
        content_type: 'Note',
        content: { text, title: 'note' },
        clientData: {},
        isMetadataUpdate: false,
      },
    });

  window.addEventListener('message', (event) => {
    let message = event.data;
    if (typeof message === 'string') {
      try {
        message = JSON.parse(message);
      } catch {
        return;
      }
    }
    const saved = message.data && message.data.items && message.data.items[0];
    window.logs.push({ action: message.action, text: saved ? saved.content.text : undefined });
    if (message.action === 'stream-context-item') {
      streamMessage = message;
      window.sendNote('n1', window.__initialNote);
    }
    if (message.action === 'save-items') {
      reply(message, {});
    }
  });

  frame.onload = () => {
    frame.contentWindow.postMessage(
      {
        action: 'component-registered',
        sessionKey: 'k',
        componentData: {},
        data: { uuid: 'c1', environment: 'web', platform: 'web' },
      },
      '*'
    );
  };
  frame.src = '/index.html';
</script>
</body>
</html>`;

/**
 * Opens the plugin inside the fake host and streams `text` as the first note.
 * `throttle` slows the CPU down (CDP rate) to mimic a mobile WebView.
 * `opaqueOrigin` serves the host with origin "null" and no referrer, like
 * the mobile app, whose web UI runs from a local file inside a WebView.
 */
async function openHost(page, { text, throttle = 1, opaqueOrigin = false }) {
  if (throttle > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  }
  await page.addInitScript((note) => {
    window.__initialNote = note;
  }, text);
  const headers = opaqueOrigin
    ? {
        // Opaque origin for the host; the plugin iframe inherits the sandbox,
        // as the real one has no allow-same-origin.
        'Content-Security-Policy': 'sandbox allow-scripts',
        'Referrer-Policy': 'no-referrer',
      }
    : {};
  await page.route('**/__sn-host.html', (route) =>
    route.fulfill({ contentType: 'text/html', headers, body: HOST_HTML })
  );
  await page.goto('/__sn-host.html');
  return page.frameLocator('#f');
}

/** Messages the plugin has posted to the host so far, optionally by action. */
function hostLogs(page, action) {
  return page.evaluate(
    (name) => window.logs.filter((entry) => !name || entry.action === name),
    action
  );
}

export { openHost, hostLogs };
