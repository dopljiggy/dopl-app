/**
 * Shared `fireToast` helper. Extracted so the bell (desktop web) and the
 * standalone NotificationToastListener (mobile + desktop) can share one
 * implementation. Dispatches a `dopl:toast` CustomEvent; the ToastProvider
 * mounted at the root listens and renders.
 */
export type ToastDetail = {
  title: string;
  body?: string;
  avatarLetter?: string;
  href?: string;
};

export function fireToast(t: ToastDetail) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("dopl:toast", { detail: t }));
  }
}
