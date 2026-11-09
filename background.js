// Toolbar icon = "use CPI Guider on this tab", for tenants whose URL does not match automatically. async function inject(tab) {

try {

await chrome.scripting.executeScrip

t({ target: {tabld: tab.id }, func: () => { window._cpiGuiderForce = true; } }); await chrome.scripting.executeS cript({ target: {tabld: tab.id }, files: ['content.js'] });

} catch (e) {

console.warn('CPI Guider. cannot run on this page', e);

}

}

chrome.action.onClicked.addListener (inject);
