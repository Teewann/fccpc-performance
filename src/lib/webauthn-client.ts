// ── WebAuthn client helpers ──────────────────────────────────────────

/**
 * Enroll a new biometric device (fingerprint/face)
 * Call this once from Settings page
 */
export async function enrollDevice(
  deviceLabel: string,
  activationCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
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

    // Step 2: Get enrollment options from server
    const optionsRes = await fetch("/api/webauthn?action=enroll-options");
    const options = await optionsRes.json();

    // Step 3: Convert challenge from base64url to ArrayBuffer
    const challenge = Uint8Array.from(
      atob(options.challenge.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0)
    ).buffer;

    // Step 4: Use the browser's WebAuthn API to create credentials
    const credential = await navigator.credentials.create({
      publicKey: {
        ...options,
        challenge,
        user: {
          ...options.user,
          id: Uint8Array.from(
            atob(options.user.id.replace(/-/g, "+").replace(/_/g, "/")),
            (c) => c.charCodeAt(0)
          ),
        },
      },
    });

    if (!credential) {
      return { success: false, error: "Biometric enrollment failed" };
    }

    // Step 5: Send the credential back to the server for verification
    const response = {
      id: (credential as any).id,
      rawId: btoa(String.fromCharCode(...new Uint8Array((credential as any).rawId))),
      type: (credential as any).type,
      response: {
        clientDataJSON: btoa(
          String.fromCharCode(...new Uint8Array((credential as any).response.clientDataJSON))
        ),
        attestationObject: btoa(
          String.fromCharCode(...new Uint8Array((credential as any).response.attestationObject))
        ),
      },
    };

    const verifyRes = await fetch("/api/webauthn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "enroll-verify",
        response,
        expectedChallenge: options.challenge,
        deviceLabel,
        code: activationCode,
      }),
    });
    const verifyData = await verifyRes.json();

    if (!verifyRes.ok) {
      return { success: false, error: verifyData.error || "Verification failed" };
    }

    return { success: true };
  } catch (error) {
    console.error("Enrollment error:", error);
    return { success: false, error: "Biometric enrollment failed. Please try again." };
  }
}

/**
 * Verify biometric (fingerprint/face) before check-in
 * Call this every time a user tries to check in
 */
export async function verifyBiometric(): Promise<boolean> {
  try {
    // Step 1: Get authentication options from server
    const optionsRes = await fetch("/api/webauthn?action=auth-options");
    const options = await optionsRes.json();

    if (!options.allowCredentials || options.allowCredentials.length === 0) {
      // No device enrolled
      return true; // Skip verification if no device is enrolled
    }

    // Step 2: Convert challenge from base64url to ArrayBuffer
    const challenge = Uint8Array.from(
      atob(options.challenge.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0)
    ).buffer;

    // Step 3: Use the browser's WebAuthn API to get assertion
    const assertion = await navigator.credentials.get({
      publicKey: {
        ...options,
        challenge,
        allowCredentials: options.allowCredentials.map((cred: any) => ({
          ...cred,
          id: Uint8Array.from(
            atob(cred.id.replace(/-/g, "+").replace(/_/g, "/")),
            (c) => c.charCodeAt(0)
          ),
        })),
      },
    });

    if (!assertion) {
      return false;
    }

    // Step 4: Send the assertion to the server for verification
    const response = {
      id: (assertion as any).id,
      rawId: btoa(String.fromCharCode(...new Uint8Array((assertion as any).rawId))),
      type: (assertion as any).type,
      response: {
        clientDataJSON: btoa(
          String.fromCharCode(...new Uint8Array((assertion as any).response.clientDataJSON))
        ),
        authenticatorData: btoa(
          String.fromCharCode(...new Uint8Array((assertion as any).response.authenticatorData))
        ),
        signature: btoa(
          String.fromCharCode(...new Uint8Array((assertion as any).response.signature))
        ),
        userHandle: (assertion as any).response.userHandle
          ? btoa(String.fromCharCode(...new Uint8Array((assertion as any).response.userHandle)))
          : null,
      },
    };

    const verifyRes = await fetch("/api/webauthn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "auth-verify",
        response,
        expectedChallenge: options.challenge,
      }),
    });
    const verifyData = await verifyRes.json();

    return verifyRes.ok && verifyData.success === true;
  } catch (error) {
    console.error("Verification error:", error);
    return false;
  }
}

/**
 * Check if the user has any enrolled biometric devices
 */
export async function hasEnrolledDevice(): Promise<boolean> {
  try {
    const res = await fetch("/api/webauthn?action=check-enrolled");
    const data = await res.json();
    return data.hasCredential === true;
  } catch {
    return false;
  }
}