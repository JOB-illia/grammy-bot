import { initializeFirebase } from "./firebase";
import { verifyEmailConnection } from "./emailService";

export async function initializeServices(): Promise<void> {
  console.log("Initializing services...");

  // Initialize Firebase
  await initializeFirebase();
  console.log("✅ Firebase initialized");

  // Verify email connection
  const emailConnected = await verifyEmailConnection();
  if (emailConnected) {
    console.log("✅ Email service connected");
  } else {
    console.warn("⚠️ Email service not available");
  }

  console.log("✅ All services initialized");
}

export * from "./scheduler.service";
