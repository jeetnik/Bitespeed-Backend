import "dotenv/config";
import express from "express";
import cors from "cors";
import identifyRoute from "./routes/identify";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.get("/", (_req, res) => {
    res.json({ status: "ok", message: "Bitespeed Identity Reconciliation Service" });
});
app.use("/identify", identifyRoute);
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});