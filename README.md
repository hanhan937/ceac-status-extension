# CEAC Status Prefill Chrome Extension

This Chrome extension opens the official U.S. Department of State CEAC visa status page and prefills saved IV or NIV fields. It does not read, solve, bypass, or submit CAPTCHA.

## Local Install

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this directory: `ceac-status-extension`.
5. Open the extension settings and save your CEAC details.
6. Click the extension button, then Open and Prefill.

## Chrome Web Store Package

Zip the contents of this directory, not the parent directory:

```bash
cd ceac-status-extension
zip -r ../ceac-status-prefill-extension.zip .
```

The Chrome Web Store listing should disclose that case, passport, surname, and consular location data are stored locally in Chrome extension storage and are used only to prefill the official CEAC status page.

## Scope

- Official CEAC URL: `https://ceac.state.gov/CEACStatTracker/Status.aspx`
- Permissions: `storage`, `tabs`, `scripting`
- Host access: CEAC status tracker page only
- CAPTCHA: manual only
- Submission: manual only
