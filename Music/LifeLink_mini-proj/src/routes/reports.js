import express from "express";
import { Donor } from "../models/Donor.js";
import { Request } from "../models/Request.js";
import { Donation } from "../models/Donation.js";

const router = express.Router();

router.get("/summary", async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. Totals
    const totalDonors = await Donor.countDocuments();
    const eligibleNow = await Donor.countDocuments({
      available: true,
      $or: [
        { nextEligibleDate: null },
        { nextEligibleDate: { $lte: now } }
      ]
    });
    const activeRequests = await Request.countDocuments({
      status: "open",
      expiresAt: { $gt: now }
    });
    const donationsLast30Days = await Donation.countDocuments({
      donatedAt: { $gte: thirtyDaysAgo }
    });

    // 2. Donors by Blood Group
    const donorsByGroupAgg = await Donor.aggregate([
      { $group: { _id: "$bloodGroup", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const donorsByGroup = donorsByGroupAgg.map(item => ({
      bloodGroup: item._id,
      count: item.count
    }));

    // 3. Donors by City
    const donorsByCityAgg = await Donor.aggregate([
      { $group: { _id: "$city", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const donorsByCity = donorsByCityAgg.map(item => ({
      city: item._id,
      count: item.count
    }));

    // 4. Requests by Blood Group (Most requested)
    const requestsByGroupAgg = await Request.aggregate([
      { $group: { _id: "$bloodGroup", count: { $sum: 1 }, totalUnits: { $sum: "$units" } } },
      { $sort: { count: -1 } }
    ]);
    const requestsByGroup = requestsByGroupAgg.map(item => ({
      bloodGroup: item._id,
      count: item.count,
      totalUnits: item.totalUnits
    }));

    // 5. Top Donors (Top 5)
    const topDonorsAgg = await Donation.aggregate([
      { $group: { _id: "$donorId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "donors",
          localField: "_id",
          foreignField: "_id",
          as: "donorDetails"
        }
      },
      { $unwind: "$donorDetails" },
      {
        $project: {
          _id: 0,
          donorId: "$_id",
          name: "$donorDetails.name",
          bloodGroup: "$donorDetails.bloodGroup",
          city: "$donorDetails.city",
          count: 1
        }
      }
    ]);

    return res.json({
      totals: {
        donors: totalDonors,
        eligibleNow,
        activeRequests,
        donationsLast30Days
      },
      donorsByGroup,
      donorsByCity,
      requestsByGroup,
      topDonors: topDonorsAgg
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
