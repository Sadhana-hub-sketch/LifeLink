import express from "express";
import { Request } from "../models/Request.js";
import { Donor } from "../models/Donor.js";
import { donorAuth } from "../middleware/donor.js";
import { getCityByName, isValidCity } from "../utils/cities.js";
import { donorsFor, recipientsFor } from "../utils/compatibility.js";
import { daysLeft } from "../utils/eligibility.js";

const router = express.Router();

// 1. POST /requests - Create request
router.post("/", async (req, res) => {
  try {
    const {
      patientName,
      hospital,
      contactName,
      contactPhone,
      bloodGroup,
      units,
      city,
      lat,
      lng,
      urgency
    } = req.body;

    if (!city || !isValidCity(city)) {
      return res.status(400).json({ error: "Invalid city specified" });
    }

    const cityData = getCityByName(city);
    const longitude = lng !== undefined && lng !== null && lng !== "" ? Number(lng) : cityData.lng;
    const latitude = lat !== undefined && lat !== null && lat !== "" ? Number(lat) : cityData.lat;

    const request = new Request({
      patientName,
      hospital,
      contactName,
      contactPhone,
      bloodGroup,
      units: Number(units),
      city: cityData.name,
      location: {
        type: "Point",
        coordinates: [longitude, latitude]
      },
      urgency: urgency || "urgent"
    });

    await request.save();

    const result = request.toObject();
    const manageKey = request.manageKey;
    delete result.manageKey;

    return res.status(201).json({
      request: result,
      manageKey
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 2. GET /requests - Active requests
router.get("/", async (req, res) => {
  try {
    const { bloodGroup, city, urgency } = req.query;

    const query = {
      status: "open",
      expiresAt: { $gt: new Date() }
    };

    if (bloodGroup) query.bloodGroup = bloodGroup;
    if (city) query.city = city;
    if (urgency) query.urgency = urgency;

    const requests = await Request.find(query)
      .select("-manageKey")
      .lean();

    // Sort: critical > urgent > normal, then newest
    const urgencyOrder = { critical: 3, urgent: 2, normal: 1 };
    requests.sort((a, b) => {
      const uA = urgencyOrder[a.urgency] || 0;
      const uB = urgencyOrder[b.urgency] || 0;
      if (uA !== uB) return uB - uA;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Sanitization: omit contactPhone / acceptedBy donor details for public listing
    const sanitized = requests.map(r => {
      const acceptedCount = r.acceptedBy ? r.acceptedBy.length : 0;
      const copy = { ...r };
      delete copy.contactPhone;
      delete copy.acceptedBy;
      copy.acceptedCount = acceptedCount;
      return copy;
    });

    return res.json(sanitized);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. GET /requests/for-me - Protected
router.get("/for-me", donorAuth, async (req, res) => {
  try {
    const donor = req.donor;

    if (!donor.available) {
      return res.json({
        requests: [],
        reason: "You are currently marked as unavailable for donation"
      });
    }

    const dLeft = daysLeft(donor.nextEligibleDate);
    if (dLeft > 0) {
      return res.json({
        requests: [],
        reason: `Eligible in ${dLeft} days`
      });
    }

    const allowedRecipientGroups = recipientsFor(donor.bloodGroup);
    const donorLng = donor.location.coordinates[0];
    const donorLat = donor.location.coordinates[1];

    const matchingRequests = await Request.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [donorLng, donorLat] },
          distanceField: "distanceMeters",
          maxDistance: 50000, // 50 km
          spherical: true,
          query: {
            status: "open",
            expiresAt: { $gt: new Date() },
            bloodGroup: { $in: allowedRecipientGroups }
          }
        }
      },
      {
        $sort: { distanceMeters: 1 }
      },
      {
        $project: {
          patientName: 1,
          hospital: 1,
          contactName: 1,
          bloodGroup: 1,
          units: 1,
          unitsFulfilled: 1,
          city: 1,
          urgency: 1,
          status: 1,
          expiresAt: 1,
          createdAt: 1,
          distanceMeters: 1,
          acceptedBy: 1
        }
      }
    ]);

    const formatted = matchingRequests.map(r => {
      const acceptedCount = r.acceptedBy ? r.acceptedBy.length : 0;
      const hasAccepted = r.acceptedBy ? r.acceptedBy.some(a => a.donorId.toString() === donor._id.toString()) : false;
      const copy = { ...r };
      delete copy.acceptedBy;
      copy.acceptedCount = acceptedCount;
      copy.hasAccepted = hasAccepted;
      copy.distanceKm = Math.round((r.distanceMeters / 1000) * 10) / 10;
      return copy;
    });

    return res.json({ requests: formatted });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. GET /requests/:id - Public detail / Requester detail
router.get("/:id", async (req, res) => {
  try {
    const manageKeyHeader = req.headers["x-manage-key"];
    const request = await Request.findById(req.params.id).select("+manageKey");

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    const isManager = manageKeyHeader && manageKeyHeader === request.manageKey;

    if (isManager) {
      const populated = await Request.findById(req.params.id)
        .populate({
          path: "acceptedBy.donorId",
          select: "name phone bloodGroup city"
        })
        .lean();

      const acceptedList = (populated.acceptedBy || []).map(a => ({
        donorId: a.donorId ? a.donorId._id : null,
        name: a.donorId ? a.donorId.name : "Unknown",
        phone: a.donorId ? a.donorId.phone : "",
        bloodGroup: a.donorId ? a.donorId.bloodGroup : "",
        acceptedAt: a.acceptedAt,
        donated: a.donated
      }));

      delete populated.manageKey;
      populated.acceptedBy = acceptedList;
      return res.json(populated);
    } else {
      const publicDoc = request.toObject();
      delete publicDoc.manageKey;
      delete publicDoc.contactPhone;
      delete publicDoc.acceptedBy;
      publicDoc.acceptedCount = request.acceptedBy ? request.acceptedBy.length : 0;
      return res.json(publicDoc);
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. POST /requests/:id/accept - Protected (Donor accepts request)
router.post("/:id/accept", donorAuth, async (req, res) => {
  try {
    const donor = req.donor;
    const request = await Request.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    // Check request active
    if (request.status !== "open" || request.expiresAt <= new Date()) {
      return res.status(409).json({ error: "Request is no longer active" });
    }

    // Check donor available & eligible
    if (!donor.available) {
      return res.status(409).json({ error: "You are currently marked as unavailable" });
    }

    if (daysLeft(donor.nextEligibleDate) > 0) {
      return res.status(409).json({ error: "You are not eligible to donate yet" });
    }

    // Check blood compatibility: donor's bloodGroup must be compatible for request's recipient bloodGroup
    const compatibleDonors = donorsFor(request.bloodGroup);
    if (!compatibleDonors.includes(donor.bloodGroup)) {
      return res.status(409).json({ error: `Your blood group (${donor.bloodGroup}) is not compatible with request (${request.bloodGroup})` });
    }

    // Check already accepted
    const alreadyAccepted = request.acceptedBy.some(
      a => a.donorId.toString() === donor._id.toString()
    );
    if (alreadyAccepted) {
      return res.status(409).json({ error: "You have already accepted this request" });
    }

    // Atomic update
    const result = await Request.updateOne(
      {
        _id: request._id,
        status: "open",
        "acceptedBy.donorId": { $ne: donor._id }
      },
      {
        $push: {
          acceptedBy: {
            donorId: donor._id,
            acceptedAt: new Date(),
            donated: false
          }
        }
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(409).json({ error: "Could not accept request. It may have expired or already been accepted." });
    }

    return res.json({
      message: "Request accepted successfully",
      contactName: request.contactName,
      contactPhone: request.contactPhone,
      hospital: request.hospital,
      patientName: request.patientName
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 6. PATCH /requests/:id/cancel - Requester cancels request
router.patch("/:id/cancel", async (req, res) => {
  try {
    const manageKeyHeader = req.headers["x-manage-key"];
    if (!manageKeyHeader) {
      return res.status(401).json({ error: "Missing x-manage-key header" });
    }

    const request = await Request.findById(req.params.id).select("+manageKey");
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (request.manageKey !== manageKeyHeader) {
      return res.status(403).json({ error: "Invalid manage key" });
    }

    request.status = "cancelled";
    await request.save();

    return res.json({ message: "Request cancelled successfully", request });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
