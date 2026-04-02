const auth = require("./middleware/auth");

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// initialize express app FIRST
const app = express();

// middleware
app.use(cors());
app.use(express.json());

// routes (import AFTER app is created)
const authRoutes = require("./routes/auth");
app.use("/auth", authRoutes);

// Connect to MongoDB (local or Atlas free tier)
mongoose.connect("mongodb://127.0.0.1:27017/itsm_demo")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// Ticket Schema
const TicketSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  status: { type: String, default: "Open" }, // Open, In Progress, Resolved, Closed
  priority: { type: String, default: "Medium" }, // Low, Medium, High, Critical
  assignedTo: String,
  createdAt: { type: Date, default: Date.now },
});

const Ticket = mongoose.model("Ticket", TicketSchema);

// Create Ticket
app.post("/tickets", async (req, res) => {
  try {
    const { title, description, assignedTo, priority } = req.body;
    const ticket = new Ticket({ title, description, assignedTo, priority });
    await ticket.save();
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Tickets
app.get("/tickets", async (req, res) => {
  try {
    const tickets = await Ticket.find();
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Ticket
app.put("/tickets/:id", async (req, res) => {
  try {
    const { status, assignedTo, priority } = req.body;
    const ticket = await Ticket.findByIdAndUpdate(
      req.params.id,
      { status, assignedTo, priority },
      { new: true }
    );
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Ticket
app.delete("/tickets/:id", auth, async (req, res) => {
  if (req.user.role !== "Admin") {
    return res.status(403).json({ error: "Only Admins can delete tickets" });
  }
  try {
    await Ticket.findByIdAndDelete(req.params.id);
    res.json({ message: "Ticket deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Start Server
const PORT = 5000;
app.listen(PORT, "0.0.0.0", () => console.log(`ITSM backend running on port ${PORT}`));
