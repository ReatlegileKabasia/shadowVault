// Global Configuration
const API_HOST = window.location.hostname || "localhost";
const API_PROTOCOL = window.location.protocol === "https:" ? "https:" : "http:";
const API_BASE_URL = window.SHADOWVAULT_API_BASE_URL || `${API_PROTOCOL}//${API_HOST}:8080`;
const API_URL = `${API_BASE_URL.replace(/\/+$/, "")}/api/incidents`;
const SECRET_PIN = "1234";
const ENCRYPTED_PREFIX = "sv1:";
const encryptionKeys = new Map();
let currentInput = "0";
let currentVaultPin = null;

// DOM Elements
const screen = document.getElementById("calc-screen");
const vault = document.getElementById("secret-vault");
const incidentForm = document.getElementById("incident-form");
const entriesList = document.getElementById("entries-list");
const apiStatus = document.getElementById("api-status");

async function getEncryptionKey(pin, salt) {
    if (!window.crypto?.subtle) {
        throw new Error("Web Crypto is unavailable. Open this app on localhost or HTTPS.");
    }

    const cacheKey = `${pin}:${bytesToBase64(salt)}`;
    if (encryptionKeys.has(cacheKey)) {
        return encryptionKeys.get(cacheKey);
    }

    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(pin),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
    const key = await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );

    encryptionKeys.set(cacheKey, key);
    return key;
}

async function encryptText(plainText, pin) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await getEncryptionKey(pin, salt);
    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        new TextEncoder().encode(plainText)
    );

    const payload = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    payload.set(salt);
    payload.set(iv, salt.length);
    payload.set(new Uint8Array(encrypted), salt.length + iv.length);
    return ENCRYPTED_PREFIX + bytesToBase64(payload);
}

async function decryptText(value, pin) {
    if (!value.startsWith(ENCRYPTED_PREFIX)) {
        return { text: value, legacy: true, failed: false };
    }

    try {
        const payload = base64ToBytes(value.slice(ENCRYPTED_PREFIX.length));
        if (payload.length < 16 + 12 + 16) {
            throw new Error("Encrypted incident data is incomplete.");
        }

        const salt = payload.slice(0, 16);
        const iv = payload.slice(16, 28);
        const ciphertext = payload.slice(28);
        const key = await getEncryptionKey(pin, salt);
        const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            ciphertext
        );

        return { text: new TextDecoder().decode(decrypted), legacy: false, failed: false };
    } catch (error) {
        console.error("Could not decrypt incident details:", error);
        return { text: "[Could not decrypt: wrong PIN or damaged data]", legacy: false, failed: true };
    }
}

function bytesToBase64(bytes) {
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
}

function base64ToBytes(value) {
    const binary = atob(value);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
}

// --- CALCULATOR & DECOY LOGIC ---
function appendCalc(value) {
    if (currentInput === "0") {
        currentInput = value;
    } else {
        currentInput += value;
    }
    updateScreen();
}

function clearCalc() {
    currentInput = "0";
    updateScreen();
}

function updateScreen() {
    screen.value = currentInput;
}

function evaluateCalc() {
    if (currentInput === SECRET_PIN) {
        unlockVault(currentInput);
        clearCalc();
        return;
    }

    try {
        currentInput = eval(currentInput).toString();
    } catch (error) {
        currentInput = "Error";
    }
    updateScreen();
}

function unlockVault(pin) {
    currentVaultPin = pin;
    vault.classList.remove("hidden");
    loadEntriesFromBackend();
}

function triggerPanic() {
    vault.classList.add("hidden");
    currentVaultPin = null;
    encryptionKeys.clear();
    clearCalc();
    window.location.href = "https://www.google.com";
}

// --- FULL-STACK API INTEGRATION (FETCH API) ---

/**
 * Listens for form submission and sends data to Java backend using HTTP POST
 */
incidentForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const titleInput = document.getElementById("incident-title");
    const detailsInput = document.getElementById("incident-details");
    apiStatus.textContent = "Saving incident...";

    try {
        if (!currentVaultPin) {
            throw new Error("Unlock the vault again before saving.");
        }

        const encryptedDetails = await encryptText(detailsInput.value, currentVaultPin);
        const newIncident = {
            title: titleInput.value,
            details: encryptedDetails,
            timestamp: new Date().toLocaleString()
        };

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(newIncident)
        });

        if (!response.ok) {
            throw new Error(`Save failed (HTTP ${response.status}).`);
        }

        titleInput.value = "";
        detailsInput.value = "";
        const loaded = await loadEntriesFromBackend();
        apiStatus.textContent = loaded
            ? "Incident saved."
            : "Incident saved, but the incident list could not be refreshed.";
    } catch (error) {
        apiStatus.textContent = `Could not save incident: ${error.message}`;
        console.error("Could not save incident:", error);
    }
});

/**
 * Sends HTTP GET request to retrieve all saved logs from Java database
 */
async function loadEntriesFromBackend() {
    try {
        if (!currentVaultPin) {
            throw new Error("Unlock the vault to decrypt incidents.");
        }

        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error(`Request failed (HTTP ${response.status}).`);
        }

        const entries = await response.json();
        if (!Array.isArray(entries)) {
            throw new Error("The server returned an unexpected response.");
        }

        await renderEntries(entries, currentVaultPin);
        return true;
    } catch (error) {
        console.error("Error connecting to server:", error);
        entriesList.replaceChildren();
        const message = document.createElement("p");
        message.className = "empty-msg";
        message.textContent = `Could not load incidents: ${error.message}`;
        entriesList.appendChild(message);
        return false;
    }
}

/**
 * Decrypts incident details locally and renders the results.
 */
async function renderEntries(entries, pin) {
    entriesList.replaceChildren();

    if (entries.length === 0) {
        const message = document.createElement("p");
        message.className = "empty-msg";
        message.textContent = "No incidents recorded yet.";
        entriesList.appendChild(message);
        return;
    }

    const decryptedEntries = await Promise.all(
        entries.map(async item => ({
            item,
            result: await decryptText(item.details || "", pin)
        }))
    );

    decryptedEntries.reverse().forEach(function ({ item, result }) {
        const card = document.createElement("div");
        card.className = "entry-card";

        const title = document.createElement("h4");
        title.textContent = item.title || "";
        const details = document.createElement("p");
        details.textContent = result.text;
        const metadata = document.createElement("span");
        const encryptionLabel = result.failed
            ? "Decryption failed"
            : result.legacy
                ? "Legacy, unencrypted"
                : "Encrypted";
        metadata.textContent = `Database Record ID: #${item.id} | ${item.timestamp || ""} | ${encryptionLabel}`;

        card.append(title, details, metadata);
        entriesList.appendChild(card);
    });
}

if (
    "serviceWorker" in navigator &&
    (window.location.protocol === "https:" ||
        ["localhost", "127.0.0.1"].includes(window.location.hostname))
) {
    navigator.serviceWorker.register("./sw.js").catch(error => {
        console.error("Could not register the offline app shell:", error);
    });
}