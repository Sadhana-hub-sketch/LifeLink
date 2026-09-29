import dotenv from "dotenv";
import mongoose from "mongoose";
import dns from "dns";
import app from "./src/app.js";

dotenv.config();

// Ensure public DNS servers (Google/Cloudflare) are used for SRV resolution on Windows
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // Ignore if environment overrides dns
}

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/blood_donor_finder";

async function startServer() {
  try {
    console.log(`Connecting to MongoDB at ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Successfully connected to MongoDB.");

    app.listen(PORT, () => {
      console.log(`🚀 LifeLink server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB:", err.message);
    console.error("\nPlease make sure MongoDB is running locally on port 27017, or set MONGODB_URI in your .env file.");
    process.exit(1);
  }
}

startServer();
