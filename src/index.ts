import "dotenv/config";
import express from "express";
import identifyRoute from "./routes/identify";

const app = express();
const PORT = process.env.PORT || 3000;

// parse JSON bodies
app.use(express.json());

// simple health check to make sure the server is alive
app.get("/", (_req, res) => {
    res.json({ status: "ok", message: "Bitespeed Identity Reconciliation Service" });
});

// mount the identify endpoint
app.use("/identify", identifyRoute);

// fire it up
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});