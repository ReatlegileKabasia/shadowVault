// Global Configuration
const API_HOST = window.location.hostname || "localhost";
const API_PROTOCOL = window.location.protocol === "https:" ? "https:" : "http:";
const API_BASE_URL = window.SHADOWVAULT_API_BASE_URL || `${API_PROTOCOL}//${API_HOST}:8080`;
const API_URL = `${API_BASE_URL.replace(/\/+$/, "")}/api/incidents`;
const PASSCODE_HASH_KEY = "vault_pin_hash";
const USER_PASSCODE_HASHES_KEY = "vault_user_pin_hashes";
const ENCRYPTED_PREFIX = "sv2:";
const LEGACY_ENCRYPTION_PREFIX = "sv1:";
const PASSCODE_HASH_PREFIX = "pbkdf2-sha256$";
const PASSCODE_HASH_ITERATIONS = 310000;
const encryptionKeys = new Map();
let currentInput = "0";
let currentVaultPin = null;
let unlockAccountHint = null;
let accessToken = null;
let signedInUsername = null;
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
const passcodeDialog = document.getElementById("change-passcode-dialog");
const passcodeForm = document.getElementById("change-passcode-form");
const passcodeStatus = document.getElementById("passcode-status");
const privacySafetyDialog = document.getElementById("privacy-safety-dialog");
const deleteAccountDialog = document.getElementById("delete-account-dialog");
const deleteAccountForm = document.getElementById("delete-account-form");

async function derivePasscodeHash(passcode, salt, iterations) {
    const material = await window.crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(passcode),
        "PBKDF2",
        false,
        ["deriveBits"]
    );
    return new Uint8Array(await window.crypto.subtle.deriveBits(
        { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
        material,
        256
    ));
}

async function hashPasscode(passcode) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const hash = await derivePasscodeHash(passcode, salt, PASSCODE_HASH_ITERATIONS);
    return `${PASSCODE_HASH_PREFIX}${PASSCODE_HASH_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

async function verifyPasscode(passcode, storedHash) {
    if (typeof storedHash !== "string" || !storedHash) {
        return false;
    }
    if (storedHash.startsWith(PASSCODE_HASH_PREFIX)) {
        const [, iterationText, saltText, expectedText, ...extra] = storedHash.split("$");
        const iterations = Number(iterationText);
        if (extra.length || !Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) {
            throw new Error("Saved passcode settings are invalid. Clear this app's local data to reset them.");
        }
        const expected = base64ToBytes(expectedText || "");
        const actual = await derivePasscodeHash(passcode, base64ToBytes(saltText || ""), iterations);
        if (actual.length !== expected.length) {
            return false;
        }
        return actual.reduce((difference, byte, index) => difference | (byte ^ expected[index]), 0) === 0;
    }

    const digest = await window.crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(passcode)
    );
    const legacyHash = Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
    return legacyHash === storedHash;
}

function isLegacyPasscodeHash(storedHash) {
    return typeof storedHash === "string" && !storedHash.startsWith(PASSCODE_HASH_PREFIX);
}

function getUserPasscodeHashes() {
    const saved = localStorage.getItem(USER_PASSCODE_HASHES_KEY);
    if (!saved) {
        return Object.create(null);
    }
    const hashes = JSON.parse(saved);
    if (!hashes || Array.isArray(hashes) || typeof hashes !== "object") {
        throw new Error("Saved account passcodes are damaged. Clear this app's local data to reset them.");
    }
    return Object.assign(Object.create(null), hashes);
}

async function getEncryptionKey(pin, salt, iterations) {
    if (!window.crypto?.subtle) {
        throw new Error("Web Crypto is unavailable. Open this app on localhost or HTTPS.");
    }

    const cacheKey = `${iterations}:${pin}:${bytesToBase64(salt)}`;
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
            iterations,
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
    const key = await getEncryptionKey(pin, salt, PASSCODE_HASH_ITERATIONS);
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
    if (!value.startsWith(ENCRYPTED_PREFIX) && !value.startsWith(LEGACY_ENCRYPTION_PREFIX)) {
        return { text: value, legacy: true, failed: false };
    }

    try {
        return {
            text: await decryptPayload(value, pin),
            legacy: false,
            failed: false
        };
    } catch (error) {
        console.error("Could not decrypt incident details:", error);
        return { text: "[Could not decrypt: wrong PIN or damaged data]", legacy: false, failed: true };
    }
}

async function decryptPayload(value, pin) {
    const prefix = value.startsWith(ENCRYPTED_PREFIX)
        ? ENCRYPTED_PREFIX
        : value.startsWith(LEGACY_ENCRYPTION_PREFIX)
            ? LEGACY_ENCRYPTION_PREFIX
            : null;
    if (!prefix) {
        throw new Error("Encrypted incident data has an unsupported format.");
    }
    const payload = base64ToBytes(value.slice(prefix.length));
    if (payload.length < 16 + 12 + 16) {
        throw new Error("Encrypted incident data is incomplete.");
    }

    const salt = payload.slice(0, 16);
    const iv = payload.slice(16, 28);
    const ciphertext = payload.slice(28);
    const iterations = prefix === LEGACY_ENCRYPTION_PREFIX ? 100000 : PASSCODE_HASH_ITERATIONS;
    const key = await getEncryptionKey(pin, salt, iterations);
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
    if (currentInput.length >= 64) {
        return;
    }
    if (currentInput === "0" || currentInput === "Error") {
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

function calculateExpression(expression) {
    let position = 0;

    function skipWhitespace() {
        while (/\s/.test(expression[position] || "")) {
            position += 1;
        }
    }

    function parseNumber() {
        skipWhitespace();
        const match = expression.slice(position).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
        if (!match) {
            throw new Error("Invalid calculation.");
        }
        position += match[0].length;
        return Number(match[0]);
    }

    function parseFactor() {
        skipWhitespace();
        const operator = expression[position];
        if (operator === "+" || operator === "-") {
            position += 1;
            const value = parseFactor();
            return operator === "-" ? -value : value;
        }
        if (expression[position] === "(") {
            position += 1;
            const value = parseSum();
            skipWhitespace();
            if (expression[position] !== ")") {
                throw new Error("Invalid calculation.");
            }
            position += 1;
            return value;
        }
        return parseNumber();
    }

    function parseProduct() {
        let value = parseFactor();
        while (true) {
            skipWhitespace();
            const operator = expression[position];
            if (operator !== "*" && operator !== "/") {
                return value;
            }
            position += 1;
            const right = parseFactor();
            value = operator === "*" ? value * right : value / right;
        }
    }

    function parseSum() {
        let value = parseProduct();
        while (true) {
            skipWhitespace();
            const operator = expression[position];
            if (operator !== "+" && operator !== "-") {
                return value;
            }
            position += 1;
            const right = parseProduct();
            value = operator === "+" ? value + right : value - right;
        }
    }

    const result = parseSum();
    skipWhitespace();
    if (position !== expression.length || !Number.isFinite(result)) {
        throw new Error("Invalid calculation.");
    }
    return result;
}

async function evaluateCalc() {
    try {
        const userPasscodeHashes = getUserPasscodeHashes();
        for (const [username, storedHash] of Object.entries(userPasscodeHashes)) {
            if (await verifyPasscode(currentInput, storedHash)) {
                if (isLegacyPasscodeHash(storedHash)) {
                    userPasscodeHashes[username] = await hashPasscode(currentInput);
                    localStorage.setItem(USER_PASSCODE_HASHES_KEY, JSON.stringify(userPasscodeHashes));
                }
                unlockVault(currentInput, username);
                clearCalc();
                return;
            }
        }

        const storedHash = localStorage.getItem(PASSCODE_HASH_KEY);
        if (!storedHash && Object.keys(userPasscodeHashes).length === 0) {
            if (currentInput.length < 8) {
                window.alert("Choose a calculator passcode with at least 8 characters.");
                clearCalc();
                return;
            }
            if (window.confirm("First-time setup: use the current calculator display as your secret passcode?")) {
                localStorage.setItem(PASSCODE_HASH_KEY, await hashPasscode(currentInput));
                window.alert("Passcode saved securely on this device. Enter it again to unlock your vault.");
                clearCalc();
            }
            return;
        }

        if (storedHash && await verifyPasscode(currentInput, storedHash)) {
            if (isLegacyPasscodeHash(storedHash)) {
                localStorage.setItem(PASSCODE_HASH_KEY, await hashPasscode(currentInput));
            }
            unlockVault(currentInput, null);
            clearCalc();
            return;
        }
    } catch (error) {
        console.error("Could not verify the local passcode:", error);
        window.alert("Passcode verification is unavailable in this browser. Open the app over HTTPS.");
    }

    try {
        currentInput = calculateExpression(currentInput).toString();
    } catch {
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
    let accountHash = hashes[username];

    if (accountHash && !await verifyPasscode(currentVaultPin, accountHash)) {
        const enteredPin = window.prompt("Enter this account's calculator passcode.");
        if (!enteredPin || !await verifyPasscode(enteredPin, accountHash)) {
            throw new Error("That account's calculator passcode did not match.");
        }
        currentVaultPin = enteredPin;
        encryptionKeys.clear();
        if (isLegacyPasscodeHash(accountHash)) {
            accountHash = await hashPasscode(enteredPin);
        }
    } else if (!accountHash) {
        const firstDeviceHash = localStorage.getItem(PASSCODE_HASH_KEY);
        if (firstDeviceHash && await verifyPasscode(currentVaultPin, firstDeviceHash)) {
            accountHash = await hashPasscode(currentVaultPin);
            localStorage.removeItem(PASSCODE_HASH_KEY);
        } else {
            const newPin = window.prompt("Create a calculator passcode for this account (at least 8 calculator-key characters).");
            if (!newPin || newPin.length < 8 || !/^[0-9.+*/()\-]+$/.test(newPin)) {
                throw new Error("Choose a passcode of at least 8 calculator-key characters.");
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

function clearSignedInSession(message) {
    currentVaultPin = null;
    unlockAccountHint = null;
    accessToken = null;
    signedInUsername = null;
    encryptionKeys.clear();
    entriesList.replaceChildren();
    incidentForm.classList.add("hidden");
    accountSession.classList.add("hidden");
    accountPanel.classList.remove("hidden");
    document.getElementById("account-name").textContent = "";
    document.getElementById("account-password").value = "";
    accountStatus.textContent = message;
}

function triggerPanic() {
    vault.classList.add("hidden");
    clearSignedInSession("");
    clearCalc();
    screen.focus({ preventScroll: true });
}

document.getElementById("calculator-app").addEventListener("click", event => {
    const button = event.target.closest("button[data-append], button[data-calc]");
    if (!button) {
        return;
    }
    if (button.dataset.append !== undefined) {
        appendCalc(button.dataset.append);
    } else if (button.dataset.calc === "clear") {
        clearCalc();
    } else if (button.dataset.calc === "evaluate") {
        evaluateCalc();
    }
});

document.getElementById("panic-btn").addEventListener("click", triggerPanic);

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
        signedInUsername = result.username;
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
    clearSignedInSession("Signed out. Sign in to access an account.");
    setAccountMode("login");
});

document.getElementById("privacy-details-btn").addEventListener("click", () => {
    privacySafetyDialog.showModal();
});

document.getElementById("close-privacy-details-btn").addEventListener("click", () => {
    privacySafetyDialog.close();
});

document.getElementById("export-data-btn").addEventListener("click", async () => {
    if (!accessToken || !currentVaultPin) {
        apiStatus.textContent = "Unlock the vault and sign in before exporting.";
        return;
    }
    if (!window.confirm("This downloads your entry details as a readable plaintext JSON file. Anyone who can access that file can read it. Continue?")) {
        return;
    }

    apiStatus.textContent = "Preparing your private export...";
    try {
        const response = await fetch(API_URL, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!response.ok) {
            if (response.status === 401) {
                clearSignedInSession("Your session expired. Sign in again.");
            }
            throw new Error(`Export request failed (HTTP ${response.status}).`);
        }

        const records = await response.json();
        if (!Array.isArray(records)) {
            throw new Error("The server returned an unexpected archive response.");
        }
        const entries = [];
        for (const record of records) {
            const result = await decryptText(record.details || "", currentVaultPin);
            if (result.failed) {
                throw new Error(`Entry #${record.id} could not be decrypted. No export was created.`);
            }
            entries.push({
                id: record.id,
                title: record.title || "",
                timestamp: record.timestamp || "",
                details: result.text
            });
        }

        const exportData = {
            format: "shadowvault-entry-export-v1",
            exportedAt: new Date().toISOString(),
            entries
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: "application/json"
        });
        const objectUrl = URL.createObjectURL(blob);
        const download = document.createElement("a");
        const filenameUser = (signedInUsername || "account").replace(/[^a-z0-9_-]/gi, "_");
        download.href = objectUrl;
        download.download = `shadowvault-${filenameUser}-${new Date().toISOString().slice(0, 10)}.json`;
        download.click();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        apiStatus.textContent = "Export downloaded. Store it securely; its entry details are readable.";
    } catch (error) {
        apiStatus.textContent = `Could not export entries: ${error.message}`;
        console.error("Could not export account entries:", error);
    }
});

document.getElementById("delete-account-btn").addEventListener("click", () => {
    deleteAccountForm.reset();
    document.getElementById("delete-account-status").textContent = "";
    document.getElementById("confirm-delete-account-btn").disabled = false;
    deleteAccountDialog.showModal();
});

document.getElementById("cancel-delete-account-btn").addEventListener("click", () => {
    deleteAccountDialog.close();
});

deleteAccountForm.addEventListener("submit", async event => {
    event.preventDefault();
    const usernameInput = document.getElementById("delete-account-username");
    const passwordInput = document.getElementById("delete-account-password");
    const status = document.getElementById("delete-account-status");
    const submitButton = document.getElementById("confirm-delete-account-btn");
    if (!accessToken || !signedInUsername) {
        status.textContent = "Sign in before deleting an account.";
        return;
    }
    if (usernameInput.value.trim().toLowerCase() !== signedInUsername.toLowerCase()) {
        status.textContent = "The username did not match the signed-in account.";
        return;
    }

    submitButton.disabled = true;
    status.textContent = "Verifying your password and deleting the account...";
    try {
        const response = await fetch(`${API_BASE_URL.replace(/\/+$/, "")}/api/auth/me`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`
            },
            body: JSON.stringify({ password: passwordInput.value })
        });
        if (!response.ok) {
            let detail = `Account deletion failed (HTTP ${response.status}).`;
            try {
                const result = await response.json();
                detail = result.detail || result.message || detail;
            } catch {
                // Keep the HTTP error when the server response has no JSON body.
            }
            throw new Error(detail);
        }

        const username = signedInUsername;
        let localStorageWarning = "";
        try {
            const hashes = getUserPasscodeHashes();
            delete hashes[username];
            if (Object.keys(hashes).length) {
                localStorage.setItem(USER_PASSCODE_HASHES_KEY, JSON.stringify(hashes));
            } else {
                localStorage.removeItem(USER_PASSCODE_HASHES_KEY);
            }
        } catch (error) {
            console.error("Account was deleted, but its local passcode verifier could not be cleared:", error);
            localStorageWarning = " Clear this browser's ShadowVault site data to remove its local passcode verifier.";
        }

        deleteAccountDialog.close();
        accessToken = null;
        currentVaultPin = null;
        unlockAccountHint = null;
        signedInUsername = null;
        encryptionKeys.clear();
        accountSession.classList.add("hidden");
        incidentForm.classList.add("hidden");
        accountPanel.classList.remove("hidden");
        entriesList.replaceChildren();
        document.getElementById("account-name").textContent = "";
        document.getElementById("account-username").value = "";
        document.getElementById("account-password").value = "";
        accountStatus.textContent =
            "Account and entries were deleted from the active app database. Hosting backups and operational records may follow separate retention." +
            localStorageWarning;
    } catch (error) {
        status.textContent = error.message;
        console.error("Could not delete the account:", error);
    } finally {
        submitButton.disabled = false;
        passwordInput.value = "";
    }
});

document.getElementById("change-passcode-btn").addEventListener("click", () => {
    passcodeForm.reset();
    passcodeStatus.textContent = "";
    document.getElementById("save-passcode-btn").disabled = false;
    passcodeDialog.showModal();
});

document.getElementById("cancel-passcode-btn").addEventListener("click", () => {
    passcodeDialog.close();
});

passcodeForm.addEventListener("submit", async event => {
    event.preventDefault();
    const oldPin = document.getElementById("current-passcode").value;
    const newPin = document.getElementById("new-passcode").value;
    const confirmation = document.getElementById("confirm-passcode").value;
    const archiveAlreadyRekeyed = document.getElementById("archive-already-rekeyed").checked;
    const submitButton = document.getElementById("save-passcode-btn");
    submitButton.disabled = true;
    passcodeStatus.textContent = "Verifying your current passcode...";

    try {
        if (!accessToken || !unlockAccountHint || !currentVaultPin) {
            throw new Error("Sign in to your account before changing the passcode.");
        }
        if (oldPin !== currentVaultPin) {
            throw new Error("The current passcode did not match this device's unlocked passcode.");
        }
        if (newPin.length < 8 || newPin.length > 64 || !/^[0-9.+*/()\-]+$/.test(newPin)) {
            throw new Error("Use 8-64 numbers or calculator symbols.");
        }
        if (newPin !== confirmation) {
            throw new Error("The new passcodes did not match.");
        }
        if (newPin === oldPin) {
            throw new Error("Choose a passcode different from the current one.");
        }

        const passcodeHashes = getUserPasscodeHashes();
        const currentHash = passcodeHashes[unlockAccountHint];
        if (!await verifyPasscode(oldPin, currentHash)) {
            throw new Error("The current passcode did not match the saved account passcode.");
        }

        const updatedHash = await hashPasscode(newPin);
        const storageProbe = `${USER_PASSCODE_HASHES_KEY}_probe`;
        localStorage.setItem(storageProbe, "available");
        localStorage.removeItem(storageProbe);

        if (!archiveAlreadyRekeyed) {
            passcodeStatus.textContent = "Loading your encrypted archive...";
            const loadResponse = await fetch(API_URL, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (!loadResponse.ok) {
                throw new Error(`Could not load the archive (HTTP ${loadResponse.status}).`);
            }
            const entries = await loadResponse.json();
            if (!Array.isArray(entries)) {
                throw new Error("The server returned an unexpected archive response.");
            }
            if (entries.length > 500) {
                throw new Error("Your archive contains more than 500 entries. Export or archive older entries before changing its encryption passcode.");
            }

            passcodeStatus.textContent = "Re-encrypting your saved entries...";
            const rekeyedEntries = [];
            for (const entry of entries) {
                const decrypted = await decryptText(entry.details || "", oldPin);
                if (decrypted.failed) {
                    throw new Error(`Entry #${entry.id} could not be opened with the current passcode. No archive changes were saved. If it uses an earlier passcode, use its recovery option first.`);
                }
                rekeyedEntries.push({
                    id: entry.id,
                    details: await encryptText(decrypted.text, newPin)
                });
            }

            if (rekeyedEntries.length > 0) {
                const updateResponse = await fetch(`${API_URL}/rekey`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({ entries: rekeyedEntries })
                });
                if (!updateResponse.ok) {
                    throw new Error(`The server could not update your encrypted archive (HTTP ${updateResponse.status}).`);
                }
                const result = await updateResponse.json();
                if (result.updated !== rekeyedEntries.length) {
                    throw new Error("The server did not confirm every entry update.");
                }
            }
        }

        passcodeHashes[unlockAccountHint] = updatedHash;
        localStorage.setItem(USER_PASSCODE_HASHES_KEY, JSON.stringify(passcodeHashes));
        currentVaultPin = newPin;
        encryptionKeys.clear();
        document.getElementById("current-passcode").value = "";
        document.getElementById("new-passcode").value = "";
        document.getElementById("confirm-passcode").value = "";
        passcodeDialog.close();
        apiStatus.textContent = archiveAlreadyRekeyed
            ? "This device now uses the archive's existing passcode."
            : "Passcode changed and archive re-encrypted. Use the new passcode on your other devices too.";
        await loadEntriesFromBackend();
    } catch (error) {
        passcodeStatus.textContent = error.message;
        console.error("Could not change the calculator passcode:", error);
    } finally {
        submitButton.disabled = false;
    }
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
                clearSignedInSession("Your session expired. Sign in again.");
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
        loadingMessage.className = "empty-state loading-msg";
        loadingMessage.setAttribute("role", "status");
        loadingMessage.textContent = "Connecting to the vault server. It may take up to a minute to wake up...";
        entriesList.replaceChildren(loadingMessage);

        const response = await fetch(API_URL, {
            headers: { "Authorization": `Bearer ${accessToken}` }
        });
        if (!response.ok) {
            if (response.status === 401) {
                clearSignedInSession("Your session expired. Sign in again.");
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
        message.className = "empty-state";
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
        const message = document.createElement("div");
        message.className = "empty-state";
        const icon = document.createElement("span");
        icon.className = "empty-state-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = "✦";
        const title = document.createElement("strong");
        title.textContent = "Your archive is ready";
        const description = document.createElement("span");
        description.textContent = "Your saved entries will appear here.";
        message.append(icon, title, description);
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

        const title = document.createElement("h3");
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
        if (result.failed) {
            const recoverButton = document.createElement("button");
            recoverButton.type = "button";
            recoverButton.className = "legacy-recovery-btn";
            recoverButton.textContent = "Recover & re-encrypt with current passcode";
            recoverButton.addEventListener("click", async () => {
                const previousPin = window.prompt("Enter the earlier calculator passcode used to encrypt this entry.");
                if (!previousPin) {
                    return;
                }
                recoverButton.disabled = true;
                try {
                    if (!currentVaultPin || !accessToken) {
                        throw new Error("Sign in to the account before recovering this entry.");
                    }
                    const recovered = await decryptPayload(item.details || "", previousPin);
                    const encrypted = await encryptText(recovered, currentVaultPin);
                    const response = await fetch(`${API_URL}/${encodeURIComponent(item.id)}`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${accessToken}`
                        },
                        body: JSON.stringify({ details: encrypted })
                    });
                    if (!response.ok) {
                        throw new Error(`The recovered entry could not be saved (HTTP ${response.status}).`);
                    }
                    details.textContent = recovered;
                    metadata.textContent = `Database Record ID: #${item.id} | ${item.timestamp || ""} | Re-encrypted with the current passcode`;
                    recoverButton.remove();
                } catch (error) {
                    console.error("Could not decrypt an entry with the supplied earlier passcode:", error);
                    details.textContent = `Could not recover this entry: ${error.message} Its saved data was not changed.`;
                    recoverButton.disabled = false;
                }
            });
            card.appendChild(recoverButton);
        }
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