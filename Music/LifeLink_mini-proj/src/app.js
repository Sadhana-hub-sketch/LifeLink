import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import donorsRouter from "./routes/donors.js";
import requestsRouter from "./routes/requests.js";
import donationsRouter from "./routes/donations.js";
import shortageRouter from "./routes/shortage.js";
import reportsRouter from "./routes/reports.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, "../public");

const app = express();

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(publicPath));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "LifeLink Blood Donor Finder", timestamp: new Date().toISOString() });
});

// API Routes
app.use("/api/donors", donorsRouter);
app.use("/api/requests", requestsRouter);
app.use("/api/donations", donationsRouter);
app.use("/api/shortage", shortageRouter);
app.use("/api/reports", reportsRouter);

// 404 handler for unknown API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "API endpoint not found" });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Internal Server Error" });
});

export default app;
