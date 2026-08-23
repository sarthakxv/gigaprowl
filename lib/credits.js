export function creditsAreUnlimited() {
  return process.env.NODE_ENV === "development";
}
