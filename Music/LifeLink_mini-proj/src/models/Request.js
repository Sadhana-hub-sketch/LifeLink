import mongoose from "mongoose";
import crypto from "crypto";
import { BLOOD_GROUPS, REQUEST_HOURS } from "../constants.js";
import { isValidCity } from "../utils/cities.js";

const acceptanceSchema = new mongoose.Schema({
  donorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Donor",
    required: true
  },
  acceptedAt: {
    type: Date,
    default: Date.now
  },
  donated: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const requestSchema = new mongoose.Schema({
  patientName: {
    type: String,
    required: [true, "Patient name is required"],
    trim: true
  },
  hospital: {
    type: String,
    required: [true, "Hospital name is required"],
    trim: true
  },
  contactName: {
    type: String,
    required: [true, "Contact name is required"],
    trim: true
  },
  contactPhone: {
    type: String,
    required: [true, "Contact phone is required"],
    match: [/^\+?\d{10,13}$/, "Contact phone must be 10-13 digits"]
  },
  bloodGroup: {
    type: String,
    enum: BLOOD_GROUPS,
    required: [true, "Blood group is required"]
  },
  units: {
    type: Number,
    required: [true, "Units required"],
    min: [1, "Units must be at least 1"],
    max: [10, "Units cannot exceed 10"]
  },
  unitsFulfilled: {
    type: Number,
    default: 0,
    min: 0
  },
  city: {
    type: String,
    required: [true, "City is required"],
    validate: {
      validator: function(val) {
        return isValidCity(val);
      },
      message: "City must be a valid city from the predefined list"
    }
  },
  location: {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
      default: "Point"
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true
    }
  },
  urgency: {
    type: String,
    enum: ["normal", "urgent", "critical"],
    default: "urgent"
  },
  status: {
    type: String,
    enum: ["open", "fulfilled", "cancelled"],
    default: "open"
  },
  acceptedBy: [acceptanceSchema],
  manageKey: {
    type: String,
    select: false
  },
  expiresAt: {
    type: Date
  }
}, { timestamps: true });

requestSchema.index({ location: "2dsphere" });
requestSchema.index({ status: 1, city: 1, bloodGroup: 1 });
requestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }); // TTL: 30 days after expiry

requestSchema.pre("save", function(next) {
  if (this.isNew) {
    if (!this.manageKey) {
      this.manageKey = crypto.randomBytes(16).toString("hex");
    }
    if (!this.expiresAt) {
      const hours = REQUEST_HOURS[this.urgency] || 24;
      const exp = new Date();
      exp.setHours(exp.getHours() + hours);
      this.expiresAt = exp;
    }
  }
  next();
});

export const Request = mongoose.model("Request", requestSchema);
