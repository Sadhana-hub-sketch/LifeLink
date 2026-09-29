import { GAP_DAYS } from "../constants.js";

export function gapDays(gender) {
  return GAP_DAYS[gender] ?? 90;
}

export function computeNextEligible(lastDonationDate, gender) {
  if (!lastDonationDate) return null;
  const last = new Date(lastDonationDate);
  if (isNaN(last.getTime())) return null;
  const gap = gapDays(gender);
  const next = new Date(last);
  next.setDate(next.getDate() + gap);
  return next;
}

export function daysLeft(nextEligibleDate, now = new Date()) {
  if (!nextEligibleDate) return 0;
  const next = new Date(nextEligibleDate);
  if (isNaN(next.getTime())) return 0;
  const diffMs = next.getTime() - new Date(now).getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / 86400000);
}
