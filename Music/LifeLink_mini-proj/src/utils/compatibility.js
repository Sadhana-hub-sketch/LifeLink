import { BLOOD_GROUPS } from "../constants.js";

export const DONORS_FOR_RECIPIENT = {
  "A+":  ["A+", "A-", "O+", "O-"],
  "A-":  ["A-", "O-"],
  "B+":  ["B+", "B-", "O+", "O-"],
  "B-":  ["B-", "O-"],
  "AB+": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
  "AB-": ["A-", "B-", "AB-", "O-"],
  "O+":  ["O+", "O-"],
  "O-":  ["O-"]
};

export function donorsFor(recipientGroup) {
  return DONORS_FOR_RECIPIENT[recipientGroup] || [];
}

export function recipientsFor(donorGroup) {
  return BLOOD_GROUPS.filter(recGroup => {
    const allowed = DONORS_FOR_RECIPIENT[recGroup] || [];
    return allowed.includes(donorGroup);
  });
}
