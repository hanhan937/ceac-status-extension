const CONFIG_KEY = "ceacPrefillConfig";

const form = document.getElementById("settings-form");
const caseLabel = document.getElementById("case-label");
const locationRow = document.getElementById("location-row");
const locationInput = document.getElementById("location");
const statusText = document.getElementById("status");
const clearButton = document.getElementById("clear");

function visaType() {
  return form.elements.visaType.value;
}

function updateFormMode() {
  const type = visaType();
  caseLabel.textContent = type === "IV" ? "Immigrant case number" : "Application ID or case number";
  locationRow.hidden = type !== "NIV";
  locationInput.required = type === "NIV";
}

function readForm() {
  return {
    visaType: visaType(),
    caseNumber: document.getElementById("caseNumber").value.trim(),
    location: locationInput.value.trim(),
    passportNumber: document.getElementById("passportNumber").value.trim(),
    surname: document.getElementById("surname").value.trim()
  };
}

function validate(config) {
  if (!["IV", "NIV"].includes(config.visaType)) {
    return "Choose IV or NIV.";
  }
  if (!config.caseNumber || !config.passportNumber || !config.surname) {
    return "Complete case number, passport number, and surname.";
  }
  if (config.surname.length > 5) {
    return "Surname must be no more than the first 5 letters.";
  }
  if (config.visaType === "NIV" && !config.location) {
    return "NIV checks require a consular location.";
  }
  return "";
}

async function load() {
  const result = await chrome.storage.local.get(CONFIG_KEY);
  const config = result[CONFIG_KEY] || { visaType: "IV" };
  form.elements.visaType.value = config.visaType || "IV";
  document.getElementById("caseNumber").value = config.caseNumber || "";
  locationInput.value = config.location || "";
  document.getElementById("passportNumber").value = config.passportNumber || "";
  document.getElementById("surname").value = config.surname || "";
  updateFormMode();
}

form.addEventListener("change", updateFormMode);

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

clearButton.addEventListener("click", async () => {
  await chrome.storage.local.remove(CONFIG_KEY);
  form.reset();
  form.elements.visaType.value = "IV";
  updateFormMode();
  statusText.textContent = "Cleared.";
});

load();
