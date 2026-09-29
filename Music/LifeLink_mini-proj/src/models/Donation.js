import mongoose from "mongoose";
import { BLOOD_GROUPS } from "../constants.js";

const donationSchema = new mongoose.Schema({
  donorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Donor",
    required: true
  },
  requestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Request",
    default: null
  },
  bloodGroup: {
    type: String,
    enum: BLOOD_GROUPS,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  units: {
    type: Number,
    default: 1,
    min: 1
  },
  donatedAt: {
    type: Date,
    default: Date.now,
    validate: {
      validator: function(val) {
        if (!val) return true;
        return val <= new Date();
      },
      message: "Donation date cannot be in the future"
    }
  }
}, { timestamps: { createdAt: true, updatedAt: false } });

donationSchema.index({ donorId: 1, donatedAt: -1 });
donationSchema.index({ requestId: 1 });

export const Donation = mongoose.model("Donation", donationSchema);
