# CPI Guider (personal-use Chrome/Edge extension)

## Install
1. Unzip this folder.
2. Chrome: open chrome://extensions   |   Edge: open edge://extensions
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the `cpi-guider` folder.
5. Open your Cloud Integration tenant (URL containing /itspaces/). A blue **CPI Guider** button appears bottom-right.

## Features
- Messages: filter by iFlow, status, time range; detail with GUID, correlation ID, error text,
  custom headers, attachments (view/save), trace steps with payload and exchange properties.
- Deployed: list runtime artifacts, filter by name, show deploy errors.
- Tools: download iFlow ZIP, API Explorer for any GET under /itspaces/odata/api/v1.

## Notes
- It reuses your logged-in browser session; it sends nothing anywhere else.
- Trace payloads exist only for messages that ran with log level TRACE.
- The iFlow ID is auto-detected from URLs containing /integrationflows/<id>; otherwise type it.
- If a feature errors, use the API Explorer to test the endpoint, then adjust content.js.
- Add more tenant domains under "matches" in manifest.json if your URL is not *.hana.ondemand.com or *.cloud.sap.
