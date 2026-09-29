import express from "express";
import { Donor } from "../models/Donor.js";
import { donorAuth } from "../middleware/donor.js";
import { getCityByName, isValidCity } from "../utils/cities.js";
import { donorsFor } from "../utils/compatibility.js";
import { daysLeft } from "../utils/eligibility.js";
import { SEARCH_RADII_KM, MIN_ELIGIBLE_RESULTS, MAX_RESULTS } from "../constants.js";

const router = express.Router();

// 1. POST /donors - Register
router.post("/", async (req, res) => {
  try {
    const { name, gender, bloodGroup, phone, city, lat, lng, lastDonationDate } = req.body;

    if (!city || !isValidCity(city)) {
      return res.status(400).json({ error: "Invalid city specified" });
    }

    const cityData = getCityByName(city);
    const longitude = lng !== undefined && lng !== null && lng !== "" ? Number(lng) : cityData.lng;
    const latitude = lat !== undefined && lat !== null && lat !== "" ? Number(lat) : cityData.lat;

    const existing = await Donor.findOne({ phone });
    if (existing) {
      return res.status(409).json({ error: "Phone number already registered" });
    }

    const donor = new Donor({
      name,
      gender,
      bloodGroup,
      phone,
      city: cityData.name,
      location: {
        type: "Point",
        coordinates: [longitude, latitude] // GeoJSON longitude first
      },
      lastDonationDate: lastDonationDate ? new Date(lastDonationDate) : undefined
    });

    await donor.save();
    return res.status(201).json(donor);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Phone number already registered" });
    }
    return res.status(400).json({ error: err.message });
  }
});

// 2. POST /donors/login
router.post("/login", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    const donor = await Donor.findOne({ phone });
    if (!donor) {
      return res.status(404).json({ error: "No donor found with this number. Register first." });
    }

    return res.json(donor);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. GET /donors/me - Protected
router.get("/me", donorAuth, async (req, res) => {
  try {
    const dLeft = daysLeft(req.donor.nextEligibleDate);
    const donorObj = req.donor.toObject();
    donorObj.daysLeft = dLeft;
    donorObj.eligible = dLeft === 0;
    donorObj.eligibleOn = req.donor.nextEligibleDate;
    return res.json(donorObj);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. PATCH /donors/me - Protected
router.patch("/me", donorAuth, async (req, res) => {
  try {
    const { name, city, lat, lng, available } = req.body;
    const donor = req.donor;

    if (name !== undefined) donor.name = name;
    if (available !== undefined) donor.available = Boolean(available);

    if (city) {
      if (!isValidCity(city)) {
        return res.status(400).json({ error: "Invalid city specified" });
      }
      const cityData = getCityByName(city);
      donor.city = cityData.name;
      
      const longitude = lng !== undefined && lng !== null && lng !== "" ? Number(lng) : cityData.lng;
      const latitude = lat !== undefined && lat !== null && lat !== "" ? Number(lat) : cityData.lat;
      donor.location = {
        type: "Point",
        coordinates: [longitude, latitude]
      };
    } else if (lat !== undefined && lng !== undefined) {
      donor.location = {
        type: "Point",
        coordinates: [Number(lng), Number(lat)]
      };
    }

    await donor.save();

    const dLeft = daysLeft(donor.nextEligibleDate);
    const donorObj = donor.toObject();
    donorObj.daysLeft = dLeft;
    donorObj.eligible = dLeft === 0;
    donorObj.eligibleOn = donor.nextEligibleDate;

    return res.json(donorObj);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 5. GET /donors/search
router.get("/search", async (req, res) => {
  try {
    const { bloodGroup, city, lat, lng, radiusKm, minResults } = req.query;

    if (!bloodGroup) {
      return res.status(400).json({ error: "bloodGroup parameter is required" });
    }

    let searchLat = lat ? Number(lat) : null;
    let searchLng = lng ? Number(lng) : null;

    if ((searchLat === null || searchLng === null) && city) {
      const cityData = getCityByName(city);
      if (!cityData) {
        return res.status(400).json({ error: "Invalid city specified" });
      }
      searchLat = cityData.lat;
      searchLng = cityData.lng;
    }

    if (searchLat === null || searchLng === null) {
      return res.status(400).json({ error: "Location (lat/lng or valid city) is required" });
    }

    const compatibleGroups = donorsFor(bloodGroup);
    const minRes = minResults ? Number(minResults) : MIN_ELIGIBLE_RESULTS;
    const explicitRadius = radiusKm ? Number(radiusKm) : null;

    let targetRadiusKm = explicitRadius || 50;
    let autoExpanded = false;

    if (!explicitRadius) {
      for (const rKm of SEARCH_RADII_KM) {
        const count = await Donor.countDocuments({
          location: {
            $nearSphere: {
              $geometry: { type: "Point", coordinates: [searchLng, searchLat] },
              $maxDistance: rKm * 1000
            }
          },
          bloodGroup: { $in: compatibleGroups },
          available: true,
          $or: [
            { nextEligibleDate: null },
            { nextEligibleDate: { $lte: new Date() } }
          ]
        });

        if (count >= minRes) {
          targetRadiusKm = rKm;
          if (rKm > SEARCH_RADII_KM[0]) {
            autoExpanded = true;
          }
          break;
        }
      }
    }

    const maxDistanceMeters = targetRadiusKm * 1000;

    const aggregateResults = await Donor.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [searchLng, searchLat] },
          distanceField: "distanceMeters",
          maxDistance: maxDistanceMeters,
          spherical: true,
          query: { bloodGroup: { $in: compatibleGroups }, available: true }
        }
      },
      {
        $addFields: {
          daysLeft: {
            $max: [
              0,
              {
                $ceil: {
                  $divide: [
                    { $subtract: [{ $ifNull: ["$nextEligibleDate", "$$NOW"] }, "$$NOW"] },
                    86400000
                  ]
                }
              }
            ]
          }
        }
      },
      {
        $addFields: {
          eligible: { $eq: ["$daysLeft", 0] }
        }
      },
      {
        $sort: { eligible: -1, distanceMeters: 1 }
      },
      {
        $limit: MAX_RESULTS
      },
      {
        $project: {
          name: 1,
          bloodGroup: 1,
          city: 1,
          phone: 1,
          distanceMeters: 1,
          daysLeft: 1,
          eligible: 1,
          nextEligibleDate: 1,
          location: 1
        }
      }
    ]);

    const formattedDonors = aggregateResults.map(d => ({
      id: d._id.toString(),
      name: d.name,
      bloodGroup: d.bloodGroup,
      city: d.city,
      phone: d.phone,
      distanceKm: Math.round((d.distanceMeters / 1000) * 10) / 10,
      eligible: d.eligible,
      daysLeft: d.daysLeft,
      eligibleOn: d.nextEligibleDate || null,
      lat: d.location?.coordinates ? d.location.coordinates[1] : null,
      lng: d.location?.coordinates ? d.location.coordinates[0] : null
    }));

    const eligibleCount = formattedDonors.filter(d => d.eligible).length;

    return res.json({
      bloodGroup,
      compatibleGroups,
      radiusUsedKm: targetRadiusKm,
      expanded: autoExpanded,
      eligibleCount,
      donors: formattedDonors
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
