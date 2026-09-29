import mongoose from "mongoose";
import { BLOOD_GROUPS } from "../constants.js";
import { computeNextEligible } from "../utils/eligibility.js";
import { isValidCity } from "../utils/cities.js";

const donorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
    minlength: [2, "Name must be at least 2 characters"],
    maxlength: [60, "Name must be at most 60 characters"]
  },
  gender: {
    type: String,
    enum: ["male", "female", "other"],
    required: [true, "Gender is required"]
  },
  bloodGroup: {
    type: String,
    enum: BLOOD_GROUPS,
    required: [true, "Blood group is required"]
  },
  phone: {
    type: String,
    required: [true, "Phone number is required"],
    unique: true,
    match: [/^\+?\d{10,13}$/, "Phone number must be 10-13 digits"]
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
      type: [Number], // [longitude, latitude]
      required: true,
      validate: {
        validator: function(coords) {
          return Array.isArray(coords) && coords.length === 2 &&
            coords[0] >= -180 && coords[0] <= 180 &&
            coords[1] >= -90 && coords[1] <= 90;
        },
        message: "Coordinates must be [longitude, latitude]"
      }
    }
  },
  lastDonationDate: {
    type: Date,
    validate: {
      validator: function(val) {
        if (!val) return true;
        return val <= new Date();
      },
      message: "Last donation date cannot be in the future"
    }
  },
  nextEligibleDate: {
    type: Date,
    default: null
  },
  available: {
    type: Boolean,
    default: true
  },
  donationCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, { timestamps: true });

donorSchema.index({ location: "2dsphere" });
donorSchema.index({ bloodGroup: 1, city: 1, available: 1, nextEligibleDate: 1 });

// Compute nextEligibleDate before saving
donorSchema.pre("save", function(next) {
  if (this.isModified("lastDonationDate") || this.isModified("gender") || this.isNew) {
    if (this.lastDonationDate) {
      this.nextEligibleDate = computeNextEligible(this.lastDonationDate, this.gender);
    } else {
      this.nextEligibleDate = null;
    }
  }
  next();
});

export const Donor = mongoose.model("Donor", donorSchema);
