import express from "express";
import { Donation } from "../models/Donation.js";
import { Donor } from "../models/Donor.js";
import { Request } from "../models/Request.js";
import { donorAuth } from "../middleware/donor.js";
import { computeNextEligible, daysLeft } from "../utils/eligibility.js";

const router = express.Router();

// 1. POST /donations - Log donation (walk-in or requester confirmed)
router.post("/", async (req, res) => {
  try {
    const manageKey = req.headers["x-manage-key"];
    const donorHeader = req.headers["x-donor-id"];

    let targetDonor = null;
    let targetRequest = null;
    let donatedAtDate = req.body.donatedAt ? new Date(req.body.donatedAt) : new Date();
    let units = req.body.units ? Number(req.body.units) : 1;

    if (donatedAtDate > new Date()) {
      return res.status(400).json({ error: "Donation date cannot be in the future" });
    }

    if (manageKey && req.body.requestId) {
      // Mode 2: Confirmed by requester using manageKey
      const request = await Request.findById(req.body.requestId).select("+manageKey");
      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }
      if (request.manageKey !== manageKey) {
        return res.status(403).json({ error: "Invalid manage key" });
      }

      const donorId = req.body.donorId;
      if (!donorId) {
        return res.status(400).json({ error: "donorId is required for requester confirmation" });
      }

      const acceptance = request.acceptedBy.find(a => a.donorId.toString() === donorId.toString());
      if (!acceptance) {
        return res.status(400).json({ error: "This donor has not accepted this request" });
      }
      if (acceptance.donated) {
        return res.status(409).json({ error: "Donation has already been logged for this donor on this request" });
      }

      targetDonor = await Donor.findById(donorId);
      if (!targetDonor) {
        return res.status(404).json({ error: "Donor not found" });
      }
      targetRequest = request;

    } else if (donorHeader) {
      // Mode 1: Walk-in logged by donor
      targetDonor = await Donor.findById(donorHeader);
      if (!targetDonor) {
        return res.status(401).json({ error: "Unauthorized: Donor not found" });
      }
    } else {
      return res.status(401).json({ error: "Authentication required (x-donor-id or x-manage-key header)" });
    }

    // Step 1: Check eligibility guard
    if (targetDonor.nextEligibleDate && targetDonor.nextEligibleDate > donatedAtDate) {
      const remainingDays = daysLeft(targetDonor.nextEligibleDate, donatedAtDate);
      return res.status(409).json({
        error: `Donor is not eligible yet. Eligible in ${remainingDays} days.`
      });
    }

    // Step 2: Create donation record
    const donation = new Donation({
      donorId: targetDonor._id,
      requestId: targetRequest ? targetRequest._id : null,
      bloodGroup: targetDonor.bloodGroup,
      city: targetDonor.city,
      units,
      donatedAt: donatedAtDate
    });

    await donation.save();

    // Step 3: Update Donor
    const newNextEligible = computeNextEligible(donatedAtDate, targetDonor.gender);
    await Donor.updateOne(
      { _id: targetDonor._id },
      {
        $set: {
          lastDonationDate: donatedAtDate,
          nextEligibleDate: newNextEligible
        },
        $inc: { donationCount: 1 }
      }
    );

    // Step 4: Update Request if applicable
    if (targetRequest) {
      await Request.updateOne(
        { _id: targetRequest._id, "acceptedBy.donorId": targetDonor._id },
        {
          $inc: { unitsFulfilled: units },
          $set: { "acceptedBy.$.donated": true }
        }
      );

      const updatedRequest = await Request.findById(targetRequest._id);
      if (updatedRequest && updatedRequest.unitsFulfilled >= updatedRequest.units) {
        await Request.updateOne({ _id: targetRequest._id }, { $set: { status: "fulfilled" } });
      }
    }

    const dLeft = daysLeft(newNextEligible);

    return res.status(201).json({
      donation,
      nextEligibleDate: newNextEligible,
      daysLeft: dLeft
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. GET /donations/me - Protected
router.get("/me", donorAuth, async (req, res) => {
  try {
    const donations = await Donation.find({ donorId: req.donor._id })
      .populate("requestId", "hospital patientName urgency")
      .sort({ donatedAt: -1 })
      .lean();

    return res.json(donations);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
