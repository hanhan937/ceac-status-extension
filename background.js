const CEAC_URL = "https://ceac.state.gov/CEACStatTracker/Status.aspx";
const CONFIG_KEY = "ceacPrefillConfig";
const SESSION_KEY = "ceacPrefillPending";

function normalizeConfig(config) {
  const next = {
    visaType: String(config?.visaType || "").toUpperCase(),
    caseNumber: String(config?.caseNumber || "").trim(),
    passportNumber: String(config?.passportNumber || "").trim(),
    surname: String(config?.surname || "").trim(),
    location: String(config?.location || "").trim()
  };

  if (!["IV", "NIV"].includes(next.visaType)) {
    throw new Error("Choose IV or NIV before opening CEAC.");
  }
  if (!next.caseNumber || !next.passportNumber || !next.surname) {
    throw new Error("Complete case number, passport number, and surname first.");
  }
  if (next.surname.length > 5) {
    throw new Error("Surname must be no more than the first 5 letters.");
  }
  if (next.visaType === "NIV" && !next.location) {
    throw new Error("NIV checks require a consular location.");
  }

  return next;
}

async function getConfig() {
  const result = await chrome.storage.local.get(CONFIG_KEY);
  return normalizeConfig(result[CONFIG_KEY]);
}

async function rememberPending(tabId, config) {
  const result = await chrome.storage.session.get(SESSION_KEY);
  const pending = result[SESSION_KEY] || {};
  pending[String(tabId)] = {
    config,
    createdAt: Date.now()
  };
  await chrome.storage.session.set({ [SESSION_KEY]: pending });
}

async function readPending(tabId) {
  const result = await chrome.storage.session.get(SESSION_KEY);
  const pending = result[SESSION_KEY] || {};
  return pending[String(tabId)] || null;
}

async function clearPending(tabId) {
  const result = await chrome.storage.session.get(SESSION_KEY);
  const pending = result[SESSION_KEY] || {};
  delete pending[String(tabId)];
  await chrome.storage.session.set({ [SESSION_KEY]: pending });
}

async function fillTab(tabId, config) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: prefillCeacStatusForm,
    args: [config]
  });
  return result;
}

async function openCeacAndPrefill() {
  const config = await getConfig();
  const tab = await chrome.tabs.create({
    active: true,
    url: `${CEAC_URL}?App=${encodeURIComponent(config.visaType)}`
  });
  await rememberPending(tab.id, config);
  return { ok: true };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "openCeacAndPrefill") {
    return false;
  }

  openCeacAndPrefill()
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

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

function prefillCeacStatusForm(config) {
  const setValue = (id, value) => {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`CEAC field not found: ${id}`);
    }
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const chooseByValueOrText = (select, value) => {
    const normalized = String(value).trim().toLowerCase();
    return [...select.options].find((option) => {
      return (
        option.value.trim().toLowerCase() === normalized ||
        option.text.trim().toLowerCase() === normalized
      );
    });
  };

  const type = document.getElementById("Visa_Application_Type");
  if (type) {
    type.value = config.visaType;
    type.dispatchEvent(new Event("change", { bubbles: true }));
  }

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

  setValue("Visa_Case_Number", config.caseNumber);
  setValue("Passport_Number", config.passportNumber);
  setValue("Surname", config.surname);

  const captcha = document.getElementById("Captcha");
  if (!captcha) {
    throw new Error("CEAC CAPTCHA input was not found.");
  }
  captcha.focus();
  captcha.scrollIntoView({ behavior: "smooth", block: "center" });
  return "CEAC fields prefilled. Enter CAPTCHA manually.";
}
