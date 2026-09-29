import express from "express";
import { Request } from "../models/Request.js";
import { Donor } from "../models/Donor.js";
import { BLOOD_GROUPS } from "../constants.js";
import { donorsFor } from "../utils/compatibility.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const filterCity = req.query.city ? req.query.city.trim() : null;

    // 1. Calculate Demand per (city, bloodGroup)
    const demandMatch = {
      status: "open",
      expiresAt: { $gt: new Date() }
    };
    if (filterCity) {
      demandMatch.city = new RegExp(`^${filterCity}$`, "i");
    }

    const demandAgg = await Request.aggregate([
      { $match: demandMatch },
      {
        $group: {
          _id: { city: "$city", bloodGroup: "$bloodGroup" },
          demand: { $sum: { $subtract: ["$units", "$unitsFulfilled"] } }
        }
      }
    ]);

    const demandMap = new Map(); // key: "city|bloodGroup" -> number
    const activeCitiesSet = new Set();

    demandAgg.forEach(item => {
      const city = item._id.city;
      const bg = item._id.bloodGroup;
      const dem = Math.max(0, item.demand);
      if (dem > 0) {
        demandMap.set(`${city}|${bg}`, dem);
        activeCitiesSet.add(city);
      }
    });

    // 2. Calculate Exact Donor Supply per (city, bloodGroup)
    const supplyMatch = {
      available: true,
      $or: [
        { nextEligibleDate: null },
        { nextEligibleDate: { $lte: new Date() } }
      ]
    };
    if (filterCity) {
      supplyMatch.city = new RegExp(`^${filterCity}$`, "i");
    }

    const supplyAgg = await Donor.aggregate([
      { $match: supplyMatch },
      {
        $group: {
          _id: { city: "$city", bloodGroup: "$bloodGroup" },
          count: { $sum: 1 }
        }
      }
    ]);

    const exactSupplyMap = new Map(); // key: "city|bloodGroup" -> count
    supplyAgg.forEach(item => {
      const city = item._id.city;
      const bg = item._id.bloodGroup;
      exactSupplyMap.set(`${city}|${bg}`, item.count);
      activeCitiesSet.add(city);
    });

    const activeCities = Array.from(activeCitiesSet).sort();

    // 3. Build Heatmap Cells
    const cells = [];
    const alertsCandidate = [];

    for (const city of activeCities) {
      for (const bg of BLOOD_GROUPS) {
        const demand = demandMap.get(`${city}|${bg}`) || 0;

        // Compute compatible supply for recipient group `bg`
        const compatibleBgs = donorsFor(bg);
        let supply = 0;
        for (const compBg of compatibleBgs) {
          supply += exactSupplyMap.get(`${city}|${compBg}`) || 0;
        }

        let ratio = 0;
        let level = "none";

        if (demand > 0) {
          ratio = supply > 0 ? Math.round((demand / supply) * 100) / 100 : demand;
          if (supply === 0 || demand / supply >= 2) {
            level = "critical";
          } else if (demand / supply >= 1) {
            level = "low";
          } else {
            level = "ok";
          }

          if (level === "critical" || level === "low") {
            const donorText = supply === 1 ? "1 eligible donor" : `${supply} eligible donors`;
            alertsCandidate.push({
              city,
              bloodGroup: bg,
              level,
              demand,
              supply,
              message: `${bg} in ${city}: ${demand} units needed, ${donorText}`
            });
          }
        }

        cells.push({
          city,
          bloodGroup: bg,
          demand,
          supply,
          ratio,
          level
        });
      }
    }

    // Sort Alerts: critical first, then highest demand
    alertsCandidate.sort((a, b) => {
      if (a.level !== b.level) {
        return a.level === "critical" ? -1 : 1;
      }
      return b.demand - a.demand;
    });

    const alerts = alertsCandidate.slice(0, 5).map(a => ({
      city: a.city,
      bloodGroup: a.bloodGroup,
      level: a.level,
      message: a.message
    }));

    return res.json({
      generatedAt: new Date().toISOString(),
      groups: BLOOD_GROUPS,
      cities: activeCities,
      cells,
      alerts
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
