# SAP CPI Guider (personal-use Chrome/Edge extension)

## Works on any tenant
No URL editing needed. It activates automatically on any host whose path starts with /itspaces/ or /shell/ (SAP domains, regional hosts,
custom domains, Neo, Edge Integration Cell). On custom domains it first checks that the page is a SAPUI5 app, so unrelated sites are ignored.
If your tenant has an unusual URL, open it and click the CPI Guider toolbar icon (puzzle-piece menu > pin it) to run it on that tab.

## Install
1. Unzip this folder.
2. Chrome: open chrome://extensions   |   Edge: open edge://extensions
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the `cpi-guider` folder.
5. Open your Cloud Integration tenant (URL containing /shell/ or /itspaces/). A **SAP CPI Guider** button appears bottom-right.

## Features
- Themes: Theme tab with Auto, Light, Dark, Yellow, Ocean, Forest, Rose, or any colour you pick (text colours adjust to stay readable).
  Your choice is remembered.
- Motion design: spring-eased panel open/close, sliding tab indicator, staggered table rows, shimmer loading skeletons,
  a 10-minute trace countdown bar, and canvas marks that reveal step by step in execution order (use Replay to rewatch).
  Respects the system "reduce motion" setting.
- Step-by-step red/green overlay: on an iFlow's design page the panel lists its recent messages by itself. Click a message and its path
  plays on the diagram in execution order - each completed step turns green, the step that failed turns red (with a run count if it ran
  several times) and playback stops there. A player bar lets you pause, step forward one step at a time, restart and change the speed.
  Click a badge, or double-click a step, to see its payload and exchange properties.
  IMPORTANT: SAP only records step data for messages that ran with log level TRACE (failed messages keep it only briefly, and traces expire
  after about an hour). Use "Apply to iFlow" with TRACE - tick "Keep trace on" so it is renewed every 8 minutes - run the flow, then pick the new message.
  If the page has no diagram (e.g. the monitor list), the overlay waits and appears by itself when you open that iFlow in Design view.
  It also appears automatically on SAP's own trace page. If the diagram's shape names are not recognised, the output pane lists both sides.
- Log level: set TRACE/DEBUG/INFO for the iFlow from the panel (internal SAP command, trace resets after ~10 min).
- Messages: filter by iFlow, status, time range; detail with GUID, correlation ID, error text,
  custom headers, attachments (view/save), trace steps with payload and exchange properties.
- Deployed: list runtime artifacts, filter by name, show deploy errors.
- Tools: download iFlow ZIP, API Explorer for any GET under /itspaces/odata/api/v1.

## Notes
- It reuses your logged-in browser session; it sends nothing anywhere else.
- Trace payloads exist only for messages that ran with log level TRACE.
- The iFlow ID is auto-detected from URLs containing /integrationflows/<id>; otherwise type it.
- If a feature errors, use the API Explorer to test the endpoint, then adjust content.js.
- The OData base path is auto-detected (/api/v1, /itspaces/odata/api/v1 or /odata/api/v1).
