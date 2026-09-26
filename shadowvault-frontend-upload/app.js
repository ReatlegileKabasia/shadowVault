// Global Configuration
const API_HOST = window.location.hostname || "localhost";
const API_PROTOCOL = window.location.protocol === "https:" ? "https:" : "http:";
const API_BASE_URL = window.SHADOWVAULT_API_BASE_URL || `${API_PROTOCOL}//${API_HOST}:8080`;
const API_URL = `${API_BASE_URL.replace(/\/+$/, "")}/api/incidents`;
const PASSCODE_HASH_KEY = "vault_pin_hash";
const USER_PASSCODE_HASHES_KEY = "vault_user_pin_hashes";
const ENCRYPTED_PREFIX = "sv1:";
const LEGACY_ENCRYPTION_PIN = "1234";
const encryptionKeys = new Map();
let currentInput = "0";
let currentVaultPin = null;
let unlockAccountHint = null;
let accessToken = null;
let accountMode = "login";
let deferredInstallPrompt = null;

// DOM Elements
const screen = document.getElementById("calc-screen");
const vault = document.getElementById("secret-vault");
const incidentForm = document.getElementById("incident-form");
const entriesList = document.getElementById("entries-list");
const apiStatus = document.getElementById("api-status");
const accountForm = document.getElementById("account-form");
const accountPanel = document.getElementById("account-panel");
const accountSession = document.getElementById("account-session");
const accountStatus = document.getElementById("account-status");

async function hashPasscode(passcode) {
    const data = new TextEncoder().encode(passcode);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}

function getUserPasscodeHashes() {
    const saved = localStorage.getItem(USER_PASSCODE_HASHES_KEY);
    if (!saved) {
        return {};
    }
    const hashes = JSON.parse(saved);
    if (!hashes || Array.isArray(hashes) || typeof hashes !== "object") {
        throw new Error("Saved account passcodes are damaged. Clear this app's local data to reset them.");
    }
    return hashes;
}

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
        return {
            text: await decryptPayload(value, pin),
            legacy: false,
            failed: false
        };
    } catch (error) {
        if (pin !== LEGACY_ENCRYPTION_PIN) {
            try {
                return {
                    text: await decryptPayload(value, LEGACY_ENCRYPTION_PIN),
                    legacy: false,
                    failed: false
                };
            } catch {
                // The saved ciphertext does not match either supported local key.
            }
        }
        console.error("Could not decrypt incident details:", error);
        return { text: "[Could not decrypt: wrong PIN or damaged data]", legacy: false, failed: true };
    }
}

async function decryptPayload(value, pin) {
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
    return new TextDecoder().decode(decrypted);
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

async function evaluateCalc() {
    try {
        const userPasscodeHashes = getUserPasscodeHashes();
        for (const [username, storedHash] of Object.entries(userPasscodeHashes)) {
            if (await hashPasscode(currentInput) === storedHash) {
                unlockVault(currentInput, username);
                clearCalc();
                return;
            }
        }

        const storedHash = localStorage.getItem(PASSCODE_HASH_KEY);
        if (!storedHash && Object.keys(userPasscodeHashes).length === 0) {
            if (currentInput.length < 4) {
                window.alert("Choose a calculator passcode with at least 4 characters.");
                clearCalc();
                return;
            }
            if (window.confirm("First-time setup: use the current calculator display as your secret passcode?")) {
                localStorage.setItem(PASSCODE_HASH_KEY, await hashPasscode(currentInput));
                window.alert("Passcode saved on this device. Enter it again to unlock your vault.");
                clearCalc();
            }
            return;
        }

        if (storedHash && await hashPasscode(currentInput) === storedHash) {
            unlockVault(currentInput, null);
            clearCalc();
            return;
        }
    } catch (error) {
        console.error("Could not verify the local passcode:", error);
        window.alert("Passcode verification is unavailable in this browser. Open the app over HTTPS.");
    }

    try {
        currentInput = eval(currentInput).toString();
    } catch (error) {
        currentInput = "Error";
    }
    updateScreen();
}

function unlockVault(pin, username) {
    currentVaultPin = pin;
    unlockAccountHint = username || null;
    vault.classList.remove("hidden");
    setAccountMode("login");
    const usernameInput = document.getElementById("account-username");
    usernameInput.value = unlockAccountHint || "";
    usernameInput.readOnly = false;
    accountPanel.classList.remove("hidden");
    accountSession.classList.add("hidden");
    incidentForm.classList.add("hidden");
    accountStatus.textContent = "Sign in or create an account to load its incidents.";
}

function setAccountMode(mode) {
    accountMode = mode;
    const registering = mode === "register";
    const usernameInput = document.getElementById("account-username");
    document.getElementById("account-heading").textContent =
        registering ? "Create your account" : "Sign in to your account";
    document.getElementById("account-submit-btn").textContent =
        registering ? "Create account" : "Sign in";
    document.getElementById("account-mode-btn").textContent =
        registering ? "I already have an account" : "Create a new account";
    document.getElementById("account-password").setAttribute(
        "autocomplete",
        registering ? "new-password" : "current-password"
    );
    usernameInput.readOnly = false;
    if (registering && unlockAccountHint) {
        usernameInput.value = "";
    } else if (!registering && unlockAccountHint) {
        usernameInput.value = unlockAccountHint;
    }
}

async function verifyOrSetAccountPasscode(username) {
    const hashes = getUserPasscodeHashes();
    const currentHash = await hashPasscode(currentVaultPin);
    let accountHash = hashes[username];

    if (accountHash && accountHash !== currentHash) {
        const enteredPin = window.prompt("Enter this account's calculator passcode.");
        if (!enteredPin || await hashPasscode(enteredPin) !== accountHash) {
            throw new Error("That account's calculator passcode did not match.");
        }
        currentVaultPin = enteredPin;
        encryptionKeys.clear();
    } else if (!accountHash) {
        const firstDeviceHash = localStorage.getItem(PASSCODE_HASH_KEY);
        if (firstDeviceHash === currentHash) {
            accountHash = firstDeviceHash;
            localStorage.removeItem(PASSCODE_HASH_KEY);
        } else {
            const newPin = window.prompt("Create a calculator passcode for this account (at least 4 characters).");
            if (!newPin || newPin.length < 4 || !/^[0-9.+*/()\-]+$/.test(newPin)) {
                throw new Error("Choose a passcode of at least 4 calculator-key characters.");
            }
            const confirmation = window.prompt("Enter the account calculator passcode again to confirm.");
            if (confirmation !== newPin) {
                throw new Error("The account calculator passcodes did not match.");
            }
            currentVaultPin = newPin;
            encryptionKeys.clear();
            accountHash = await hashPasscode(newPin);
        }
    }

    hashes[username] = accountHash;
    localStorage.setItem(USER_PASSCODE_HASHES_KEY, JSON.stringify(hashes));
    unlockAccountHint = username;
}

function triggerPanic() {
    vault.classList.add("hidden");
    currentVaultPin = null;
    unlockAccountHint = null;
    accessToken = null;
    encryptionKeys.clear();
    clearCalc();
    window.location.href = "https://www.google.com";
}

document.getElementById("account-mode-btn").addEventListener("click", () => {
    setAccountMode(accountMode === "login" ? "register" : "login");
    accountStatus.textContent = "";
});

accountForm.addEventListener("submit", async event => {
    event.preventDefault();
    const usernameInput = document.getElementById("account-username");
    const passwordInput = document.getElementById("account-password");
    accountStatus.textContent = accountMode === "register" ? "Creating account..." : "Signing in...";

    try {
        const endpoint = accountMode === "register" ? "register" : "login";
        const response = await fetch(`${API_BASE_URL.replace(/\/+$/, "")}/api/auth/${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: usernameInput.value.trim(),
                password: passwordInput.value
            })
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.detail || result.message || `Authentication failed (HTTP ${response.status}).`);
        }
        if (!result.accessToken) {
            throw new Error("The server did not return an access token.");
        }

        await verifyOrSetAccountPasscode(result.username);
        accessToken = result.accessToken;
        passwordInput.value = "";
        accountStatus.textContent = "";
        document.getElementById("account-name").textContent = `Signed in as ${result.username}`;
        accountPanel.classList.add("hidden");
        accountSession.classList.remove("hidden");
        incidentForm.classList.remove("hidden");
        await loadEntriesFromBackend();
    } catch (error) {
        accountStatus.textContent = error.message;
        console.error("Account sign-in failed:", error);
    }
});

document.getElementById("logout-btn").addEventListener("click", () => {
    accessToken = null;
    accountSession.classList.add("hidden");
    incidentForm.classList.add("hidden");
    accountPanel.classList.remove("hidden");
    entriesList.replaceChildren();
    setAccountMode("login");
    accountStatus.textContent = "Signed out. Sign in to access an account.";
});

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
        if (!currentVaultPin || !accessToken) {
            throw new Error("Unlock the vault and sign in before saving.");
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
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`
            },
            body: JSON.stringify(newIncident)
        });

        if (!response.ok) {
            if (response.status === 401) {
                accessToken = null;
                accountSession.classList.add("hidden");
                incidentForm.classList.add("hidden");
                accountPanel.classList.remove("hidden");
                accountStatus.textContent = "Your session expired. Sign in again.";
            }
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
        if (!currentVaultPin || !accessToken) {
            throw new Error("Unlock the vault and sign in to load incidents.");
        }

        const loadingMessage = document.createElement("p");
        loadingMessage.className = "empty-msg loading-msg";
        loadingMessage.setAttribute("role", "status");
        loadingMessage.textContent = "Connecting to the vault server. It may take up to a minute to wake up...";
        entriesList.replaceChildren(loadingMessage);

        const response = await fetch(API_URL, {
            headers: { "Authorization": `Bearer ${accessToken}` }
        });
        if (!response.ok) {
            if (response.status === 401) {
                accessToken = null;
                accountSession.classList.add("hidden");
                incidentForm.classList.add("hidden");
                accountPanel.classList.remove("hidden");
                accountStatus.textContent = "Your session expired. Sign in again.";
                return false;
            }
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
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js")
            .then(() => console.log("Service Worker registered successfully."))
            .catch(error => console.error("Service Worker registration failed:", error));
    });
}

const installButton = document.getElementById("install-app-btn");
window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton.classList.remove("hidden");
});

installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
        return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installButton.classList.add("hidden");
});

window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    installButton.classList.add("hidden");
});