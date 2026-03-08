import { apiClient } from "./apiClient";

export type SubmitFeedbackPayload = {
  rating: number;
  comment?: string;
  pageOrContext?: string;
  demoSessionId?: string;
};

export async function submitFeedbackApi(payload: SubmitFeedbackPayload): Promise<void> {
  const res = await apiClient("/api/feedback", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Geri bildirim gönderilemedi.");
  }
}
