import { startRegistration, startAuthentication } from "@simplewebauthn/browser";

// ─── Check Activation Code ──────────────────────────────────────────
export async function checkActivationCode(code: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch("/api/webauthn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check-activation", code }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { valid: false, error: data.error || "Invalid code" };
    }
    return { valid: true };
  } catch (error) {
    return { valid: false, error: "Network error. Please try again." };
  }
}

// ─── Enroll Device ──────────────────────────────────────────────────
export async function enrollDevice(deviceLabel: string, activationCode: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("🔵 Step 1: Checking activation code...");
    
    // Step 1: Validate the activation code first
    const codeCheck = await fetch("/api/webauthn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "check-activation",
        code: activationCode,
      }),
    });
    const codeData = await codeCheck.json();
    if (!codeCheck.ok) {
      return { success: false, error: codeData.error || "Invalid activation code" };
    }

    console.log("✅ Activation code valid");

    // Step 2: Get enrollment options from server
    console.log("🔵 Step 2: Getting enrollment options...");
    const optionsRes = await fetch("/api/webauthn?action=enroll-options");
    if (!optionsRes.ok) {
      return { success: false, error: "Failed to get enrollment options" };
    }
    const options = await optionsRes.json();
    console.log("✅ Enrollment options received");

    // Step 3: Use startRegistration from @simplewebauthn/browser
    // This handles all the base64url conversion automatically
    console.log("🔵 Step 3: Starting registration...");
    let credential;
    try {
      credential = await startRegistration(options);
    } catch (err: any) {
      console.error("WebAuthn registration error:", err);
      if (err.name === "InvalidStateError") {
        return { success: false, error: "This device is already enrolled. Please use a different device or remove the existing one." };
      }
      if (err.name === "NotAllowedError") {
        return { success: false, error: "Registration was cancelled or timed out. Please try again." };
      }
      return { success: false, error: err?.message || "Enrollment was cancelled or the device doesn't support this." };
    }

    if (!credential) {
      return { success: false, error: "Biometric enrollment failed" };
    }

    console.log("✅ Credentials created");

    // Step 4: Send the credential back to the server for verification
    console.log("🔵 Step 4: Sending to server for verification...");
    const verifyRes = await fetch("/api/webauthn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "enroll-verify",
        response: credential,
        expectedChallenge: options.challenge,
        deviceLabel: deviceLabel || "Unnamed device",
        code: activationCode,
      }),
    });
    const verifyData = await verifyRes.json();

    if (!verifyRes.ok) {
      return { success: false, error: verifyData.error || "Verification failed" };
    }

    console.log("✅ Enrollment successful!");
    return { success: true };
  } catch (error: any) {
    console.error("Enrollment error:", error);
    return { success: false, error: error?.message || "Biometric enrollment failed. Please try again." };
  }
}

// ─── Verify Biometric ──────────────────────────────────────────────
export async function verifyBiometric(): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("🔵 Step 1: Getting authentication options...");
    const optionsRes = await fetch("/api/webauthn?action=auth-options");
    if (!optionsRes.ok) {
      return { success: false, error: "Failed to get authentication options" };
    }
    const options = await optionsRes.json();
    console.log("✅ Authentication options received");

    if (!options.allowCredentials || options.allowCredentials.length === 0) {
      return { success: false, error: "No enrolled device found. Set up fingerprint/face check-in in Settings first." };
    }

    // Step 2: Use startAuthentication from @simplewebauthn/browser
    // This handles all the base64url conversion automatically
    console.log("🔵 Step 2: Starting authentication...");
    let assertion;
    try {
      assertion = await startAuthentication(options);
    } catch (err: any) {
      console.error("WebAuthn authentication error:", err);
      if (err.name === "NotAllowedError") {
        return { success: false, error: "Verification was cancelled or timed out. Please try again." };
      }
      return { success: false, error: err?.message || "Verification was cancelled." };
    }

    if (!assertion) {
      return { success: false, error: "Biometric verification was cancelled or failed" };
    }

    console.log("✅ Assertion received");

    // Step 3: Send the assertion to the server for verification
    console.log("🔵 Step 3: Sending to server for verification...");
    const verifyRes = await fetch("/api/webauthn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "auth-verify",
        response: assertion,
        expectedChallenge: options.challenge,
      }),
    });
    const verifyData = await verifyRes.json();

    if (!verifyRes.ok) {
      return { success: false, error: verifyData.error || "Verification failed" };
    }

    console.log("✅ Verification successful!");
    return { success: true };
  } catch (error: any) {
    console.error("Verification error:", error);
    return { success: false, error: error?.message || "Verification was cancelled or failed" };
  }
}

// ─── Check if user has any enrolled devices ──────────────────────
export async function hasEnrolledDevice(): Promise<boolean> {
  try {
    const res = await fetch("/api/webauthn?action=check-enrolled");
    if (!res.ok) {
      return false;
    }
    const data = await res.json();
    return data.hasCredential === true;
  } catch {
    return false;
  }
}

// ─── List all enrolled devices ─────────────────────────────────────
export async function listMyDevices(): Promise<{ id: string; deviceLabel: string; createdAt: string }[]> {
  try {
    const res = await fetch("/api/webauthn?action=list-devices");
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    return data.devices || [];
  } catch {
    return [];
  }
}

// ─── Remove a device ──────────────────────────────────────────────
export async function removeDevice(id: string): Promise<boolean> {
  try {
    const res = await fetch("/api/webauthn", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    return res.ok;
  } catch {
    return false;
  }
}