const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// middleware & utilities
const auth = require("./middleware/auth");
const sendNotification = require("./utils/mailer");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

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
app.put("/tickets/:id", auth, async (req, res) => {
  try {
    const { status, assignedTo, priority } = req.body;
    const ticket = await Ticket.findByIdAndUpdate(
      req.params.id,
      { status, assignedTo, priority },
      { new: true }
    );

    // Send notification when ticket is resolved
    if (status === "Resolved" && assignedTo) {
      await sendNotification(
        `${assignedTo}@example.com`,
        "Ticket Resolved",
        `Ticket "${ticket.title}" has been resolved.`
      );
    }

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

// Weekly Report Route
app.get("/reports/weekly", auth, async (req, res) => {
  try {
    const today = new Date();

    // Calculate start (Sunday) and end (Saturday) of current week
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    // Format dates as DD/MM/YYYY
    const formatDate = (date) =>
      `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;

    const weekRange = `${formatDate(startOfWeek)} - ${formatDate(endOfWeek)}`;

    // Aggregate tickets
    const statusSummary = await Ticket.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const prioritySummary = await Ticket.aggregate([
      { $group: { _id: "$priority", count: { $sum: 1 } } }
    ]);

    const totalTickets = await Ticket.countDocuments();

    res.json({
      week: weekRange,
      totalTickets,
      statusSummary,
      prioritySummary
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Excel report generation
app.get("/reports/weekly/excel", auth, async (req, res) => {
  try {
    const tickets = await Ticket.find();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Weekly Report");

    worksheet.columns = [
      { header: "Title", key: "title", width: 30 },
      { header: "Status", key: "status", width: 15 },
      { header: "Priority", key: "priority", width: 15 },
      { header: "Assigned To", key: "assignedTo", width: 20 },
      { header: "Created At", key: "createdAt", width: 20 }
    ];

    tickets.forEach(ticket => {
      worksheet.addRow({
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        assignedTo: ticket.assignedTo,
        createdAt: ticket.createdAt
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=weekly-report.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PDF report generation
app.get("/reports/weekly/pdf", auth, async (req, res) => {
  try {
    const tickets = await Ticket.find();

    const doc = new PDFDocument();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=weekly-report.pdf");

    doc.pipe(res);

    doc.fontSize(18).text("Weekly Ticket Report", { align: "center" });
    doc.moveDown();

    tickets.forEach(ticket => {
      doc.fontSize(12).text(
        `Title: ${ticket.title} | Status: ${ticket.status} | Priority: ${ticket.priority} | Assigned To: ${ticket.assignedTo} | Created At: ${ticket.createdAt}`
      );
      doc.moveDown();
    });

    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
const PORT = 5000;
app.listen(PORT, "0.0.0.0", () => console.log(`ITSM backend running on port ${PORT}`));
