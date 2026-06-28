const CONFIG_KEY = "ceacPrefillConfig";

const summary = document.getElementById("summary");
const statusText = document.getElementById("status");
const openButton = document.getElementById("open");
const settingsButton = document.getElementById("settings");

function isConfigured(config) {
  if (!config || !["IV", "NIV"].includes(config.visaType)) {
    return false;
  }
  if (!config.caseNumber || !config.passportNumber || !config.surname) {
    return false;
  }
  return config.visaType !== "NIV" || Boolean(config.location);
}

async function refresh() {
  const result = await chrome.storage.local.get(CONFIG_KEY);
  const config = result[CONFIG_KEY];
  if (isConfigured(config)) {
    summary.textContent = `${config.visaType} profile is ready. CAPTCHA stays manual.`;
    openButton.disabled = false;
  } else {
    summary.textContent = "Add your CEAC details in settings first.";
    openButton.disabled = true;
  }
}

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

settingsButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

refresh();
