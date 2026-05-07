import { apiClient } from "@/utils/apiClient";

export type DemoOnboardingEventAction =
  | "modal_shown"
  | "modal_closed"
  | "modal_selection";

type DemoOnboardingPayload = {
  calculationType?: string;
  targetPath?: string;
  dontShowAgain?: boolean;
};

function isDemoUserLocal(): boolean {
  try {
    const current = JSON.parse(localStorage.getItem("current_user") || "null");
    return (current?.licenseType || "").toLowerCase() === "demo";
  } catch {
    return false;
  }
}

export async function trackDemoOnboardingEvent(
  action: DemoOnboardingEventAction,
  payload: DemoOnboardingPayload = {}
) {
  if (!isDemoUserLocal()) return;
  try {
    await apiClient("/api/demo-onboarding/events", {
      method: "POST",
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    // Tracking hatası kullanıcı deneyimini bozmasın
  }
}
