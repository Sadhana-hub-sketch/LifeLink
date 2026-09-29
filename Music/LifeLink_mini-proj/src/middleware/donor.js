import { Donor } from "../models/Donor.js";

export async function donorAuth(req, res, next) {
  const donorId = req.headers["x-donor-id"];
  if (!donorId) {
    return res.status(401).json({ error: "Unauthorized: Missing x-donor-id header" });
  }

  try {
    const donor = await Donor.findById(donorId);
    if (!donor) {
      return res.status(401).json({ error: "Unauthorized: Donor not found" });
    }
    req.donor = donor;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized: Invalid donor ID" });
  }
}
