# CEAC Status Prefill Extension Design

This document explains how the Chrome extension works and what each file does.

## Purpose

The extension opens the official U.S. Department of State CEAC visa status page and prefills user-saved IV or NIV fields.

It intentionally does not:

- read CAPTCHA
- solve CAPTCHA
- bypass CAPTCHA
- submit the CEAC form

The user still manually enters CAPTCHA and submits the form.

## Why This Extension Exists

Chrome's built-in autofill is mainly designed for common fields such as names, addresses, phone numbers, payment cards, and passwords. The CEAC status page uses visa-specific fields such as case/application number, passport number, surname fragment, visa type, and sometimes consular location.

A careful product claim is:

> Built-in browser autofill may not recognize CEAC's visa-specific fields. This extension lets users save those fields locally and prefill the official CEAC status page with one click.

## Data And Privacy Model

User data is saved in Chrome extension local storage with `chrome.storage.local`.

Saved fields:

- visa type: `IV` or `NIV`
- case/application number
- consular location for NIV
- passport number
- first 5 letters of surname

The extension does not send this data to any server controlled by the extension author. It only injects the saved values into the official CEAC status page after the user clicks the extension button.

## File Overview

### `manifest.json`

Chrome's entry point for the extension.

It defines:

- Manifest V3 format
- extension name, version, and description
- popup page
- background service worker
- options page
- permissions
- CEAC host access
- extension icons

Important fields:

```json
"action": {
  "default_popup": "popup.html",
  "default_title": "CEAC Status Prefill"
}
```

This tells Chrome to open `popup.html` when the user clicks the extension icon.

```json
"background": {
  "service_worker": "background.js"
}
```

This registers `background.js` as the Manifest V3 service worker.

```json
"options_page": "options.html"
```

This tells Chrome which page to open when the user opens extension settings.

```json
"permissions": [
  "storage",
  "tabs",
  "scripting"
]
```

These permissions are needed for:

- `storage`: save user configuration locally
- `tabs`: open the official CEAC page in a new tab
- `scripting`: inject the prefill function into the CEAC page

```json
"host_permissions": [
  "https://ceac.state.gov/CEACStatTracker/Status.aspx*"
]
```

This limits page access to the official CEAC status tracker page.

### `options.html`

The settings page markup.

It contains the form where users configure:

- visa type
- case/application number
- consular location for NIV
- passport number
- first 5 letters of surname

The JavaScript for this page is loaded with:

```html
<script src="options.js"></script>
```

### `options.js`

Controls the settings page behavior.

Responsibilities:

- load saved configuration from Chrome storage
- show or hide the consular location field based on IV/NIV
- validate form input
- save configuration
- clear configuration

Important constant:

```js
const CONFIG_KEY = "ceacPrefillConfig";
```

This key is used in `chrome.storage.local`.

Important functions:

```js
function updateFormMode()
```

Updates the settings form when the user chooses IV or NIV.

For IV:

- label becomes `Immigrant case number`
- consular location is hidden
- consular location is not required

For NIV:

- label becomes `Application ID or case number`
- consular location is shown
- consular location is required

```js
function readForm()
```

Reads current values from the settings form and returns a config object.

```js
function validate(config)
```

Checks that required values exist before saving.

Rules:

- visa type must be `IV` or `NIV`
- case/application number is required
- passport number is required
- surname is required
- surname must be at most 5 letters
- NIV requires consular location

```js
async function load()
```

Loads saved user configuration from `chrome.storage.local` and populates the form.

Submit handler:

```js
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const config = readForm();
  const error = validate(config);
  if (error) {
    statusText.textContent = error;
    return;
  }
  await chrome.storage.local.set({ [CONFIG_KEY]: config });
  statusText.textContent = "Saved.";
});
```

This validates and saves the configuration locally.

Clear handler:

```js
clearButton.addEventListener("click", async () => {
  await chrome.storage.local.remove(CONFIG_KEY);
  form.reset();
  form.elements.visaType.value = "IV";
  updateFormMode();
  statusText.textContent = "Cleared.";
});
```

This removes the saved configuration.

### `popup.html`

The extension popup markup shown when the user clicks the extension icon.

It contains:

- title
- settings gear button
- configuration summary
- `Open and Prefill` button
- status message area

The JavaScript for this page is loaded with:

```html
<script src="popup.js"></script>
```

### `popup.js`

Controls the popup behavior.

Responsibilities:

- check whether configuration exists
- enable or disable `Open and Prefill`
- open the options page
- send a message to the background service worker

Important function:

```js
function isConfigured(config)
```

Checks whether the saved configuration is complete enough to run.

Important function:

```js
async function refresh()
```

Reads configuration from `chrome.storage.local`.

If configuration is complete:

- shows a ready message
- enables the button

If configuration is missing:

- asks the user to configure settings first
- disables the button

Main button handler:

```js
openButton.addEventListener("click", async () => {
  statusText.textContent = "Opening CEAC...";
  openButton.disabled = true;
  const response = await chrome.runtime.sendMessage({ type: "openCeacAndPrefill" });
  if (response?.ok) {
    statusText.textContent = "Opened. Enter CAPTCHA manually.";
    window.close();
    return;
  }
  statusText.textContent = response?.error || "Could not open CEAC.";
  openButton.disabled = false;
});
```

This sends a message to `background.js`.

Settings button handler:

```js
settingsButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
```

This opens the extension settings page.

### `background.js`

The main automation logic.

Responsibilities:

- validate saved configuration
- open a new CEAC tab
- remember which tab should be prefilled
- wait for the CEAC page to finish loading
- inject the prefill function
- clear temporary pending state

Important constants:

```js
const CEAC_URL = "https://ceac.state.gov/CEACStatTracker/Status.aspx";
const CONFIG_KEY = "ceacPrefillConfig";
const SESSION_KEY = "ceacPrefillPending";
```

`CONFIG_KEY` is for long-lived user settings.

`SESSION_KEY` is for temporary tab state. It tracks which newly opened tab should receive the prefill script.

Important function:

```js
function normalizeConfig(config)
```

Validates and normalizes saved user settings before using them.

It:

- uppercases visa type
- trims string values
- ensures IV/NIV is selected
- ensures required fields exist
- ensures surname has at most 5 letters
- ensures NIV has consular location

Important function:

```js
async function getConfig()
```

Reads saved config from `chrome.storage.local` and validates it.

Important function:

```js
async function openCeacAndPrefill()
```

This is called when the popup sends the `openCeacAndPrefill` message.

It:

1. reads saved config
2. opens a new tab at the CEAC page
3. adds `?App=IV` or `?App=NIV`
4. records that this tab should be prefilled

```js
const tab = await chrome.tabs.create({
  active: true,
  url: `${CEAC_URL}?App=${encodeURIComponent(config.visaType)}`
});
```

Message listener:

```js
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "openCeacAndPrefill") {
    return false;
  }

  openCeacAndPrefill()
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
```

This receives the popup request and starts the open-and-prefill flow.

Tab update listener:

```js
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url?.startsWith(CEAC_URL)) {
    return;
  }

  const pending = await readPending(tabId);
  if (!pending) {
    return;
  }

  try {
    await fillTab(tabId, pending.config);
  } finally {
    await clearPending(tabId);
  }
});
```

This waits until the CEAC tab finishes loading. If that tab is marked as pending, it injects the prefill function.

Important function:

```js
async function fillTab(tabId, config)
```

Injects `prefillCeacStatusForm` into the CEAC page:

```js
const [{ result }] = await chrome.scripting.executeScript({
  target: { tabId },
  func: prefillCeacStatusForm,
  args: [config]
});
```

### `prefillCeacStatusForm`

This function lives inside `background.js`, but Chrome runs it inside the CEAC webpage after injection.

It performs DOM operations on the actual CEAC page.

Important helper:

```js
const setValue = (id, value) => {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`CEAC field not found: ${id}`);
  }
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
};
```

This fills a field and dispatches `input` and `change` events so the CEAC page can react as if the user typed or changed the value.

Visa type:

```js
const type = document.getElementById("Visa_Application_Type");
if (type) {
  type.value = config.visaType;
  type.dispatchEvent(new Event("change", { bubbles: true }));
}
```

NIV location:

```js
if (config.visaType === "NIV") {
  const selects = [...document.querySelectorAll("select")].filter(
    (element) => element.id !== "Visa_Application_Type"
  );
  const locationSelect = selects.find((select) => chooseByValueOrText(select, config.location));
  if (!locationSelect) {
    throw new Error("CEAC location option was not found.");
  }
  const locationOption = chooseByValueOrText(locationSelect, config.location);
  locationSelect.value = locationOption.value;
  locationSelect.dispatchEvent(new Event("change", { bubbles: true }));
}
```

This finds a location option by matching either option value or visible option text.

Main fields:

```js
setValue("Visa_Case_Number", config.caseNumber);
setValue("Passport_Number", config.passportNumber);
setValue("Surname", config.surname);
```

CAPTCHA focus:

```js
const captcha = document.getElementById("Captcha");
if (!captcha) {
  throw new Error("CEAC CAPTCHA input was not found.");
}
captcha.focus();
captcha.scrollIntoView({ behavior: "smooth", block: "center" });
```

This only focuses the CAPTCHA input so the user can manually type it.

### `styles.css`

Shared CSS for popup and options page.

It defines:

- colors
- layout
- popup width
- settings page panel
- form controls
- primary and secondary buttons
- icon button
- hidden-field behavior

### `icons/`

Contains PNG icons used by Chrome and the Chrome Web Store.

Files:

- `icons/icon16.png`
- `icons/icon32.png`
- `icons/icon48.png`
- `icons/icon128.png`

### `README.md`

Basic user and packaging instructions.

It explains:

- how to install locally through `chrome://extensions`
- how to zip the extension for Chrome Web Store upload
- extension scope
- permissions
- CAPTCHA and submission boundaries

## End-To-End Flow

```text
User opens extension settings
        |
        v
options.html renders settings form
        |
        v
options.js validates and saves config
        |
        v
Data is stored in chrome.storage.local
        |
        v
User clicks extension icon
        |
        v
popup.html opens
        |
        v
popup.js checks saved config
        |
        v
User clicks Open and Prefill
        |
        v
popup.js sends message to background.js
        |
        v
background.js opens official CEAC page in a new tab
        |
        v
background.js stores pending tab state in chrome.storage.session
        |
        v
CEAC page finishes loading
        |
        v
background.js injects prefillCeacStatusForm
        |
        v
CEAC fields are filled
        |
        v
CAPTCHA input is focused
        |
        v
User manually enters CAPTCHA
        |
        v
User manually submits the CEAC form
```

## Chrome Web Store Positioning

Recommended wording:

> A local-only helper that opens the official CEAC visa status page and prefills user-saved fields. CAPTCHA entry and form submission remain manual.

Avoid claiming full automation because the extension intentionally does not solve CAPTCHA or submit the form.

## Local Test Steps

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select `/Users/jiangchuanhe/workspace/ceac-status-extension`.
6. Pin the extension if needed.
7. Open the extension settings.
8. Save IV or NIV details.
9. Click the extension icon.
10. Click Open and Prefill.
11. Confirm the official CEAC page opens with fields filled.
12. Manually enter CAPTCHA and submit.
