const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(
  cors({
    origin: true, // Allow all origins for now
    credentials: true,
  })
);
app.use(express.json());

// MongoDB Connection
mongoose.connect(
  process.env.MONGODB_URI || "mongodb://localhost:27017/norton-users",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
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
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
});

const User = mongoose.model("User", userSchema);

// API Routes
app.post("/api/users", async (req, res) => {
  try {
    const { name, email, phone, product } = req.body;

    // Validation
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and phone are required",
      });
    }

    // Get client info
    const ipAddress =
      req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];

    // Create new user
    const newUser = new User({
      name,
      email,
      phone,
      product: product || "Norton 360",
      ipAddress,
      userAgent,
    });

    // Save to database
    const savedUser = await newUser.save();

    res.status(201).json({
      success: true,
      message: "User data saved successfully",
      userId: savedUser._id,
    });
  } catch (error) {
    console.error("Error saving user:", error);

    // Handle duplicate email error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get all users (for admin)
app.get("/api/users", async (req, res) => {
  try {
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

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running on Vercel" });
});

// Root route
app.get("/", (req, res) => {
  res.json({ message: "Norton Backend API is running on Vercel!" });
});

// For Vercel, export the app
module.exports = app;
