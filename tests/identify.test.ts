import request from "supertest";
import express from "express";
import cors from "cors";
import { prisma } from "../src/db";
import identifyRoute from "../src/routes/identify";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/identify", identifyRoute);

// clean up the contacts table before running tests so they always pass
beforeAll(async () => {
    await prisma.contact.deleteMany();
});

afterAll(async () => {
    await prisma.$disconnect();
});

describe("POST /identify", () => {
    let primaryId: number;
    let secondaryId: number;

    it("should create a new primary contact when no match found", async () => {
        const res = await request(app)
            .post("/identify")
            .send({ email: "lorraine@hillvalley.edu", phoneNumber: "123456" });

        expect(res.status).toBe(200);
        expect(res.body.contact.emails).toEqual(["lorraine@hillvalley.edu"]);
        expect(res.body.contact.phoneNumbers).toEqual(["123456"]);
        expect(res.body.contact.secondaryContactIds).toEqual([]);

        primaryId = res.body.contact.primaryContatctId;
    });

    it("should create a secondary when same phone but new email", async () => {
        const res = await request(app)
            .post("/identify")
            .send({ email: "mcfly@hillvalley.edu", phoneNumber: "123456" });

        expect(res.status).toBe(200);
        expect(res.body.contact.primaryContatctId).toBe(primaryId);
        expect(res.body.contact.emails).toEqual([
            "lorraine@hillvalley.edu",
            "mcfly@hillvalley.edu",
        ]);
        expect(res.body.contact.phoneNumbers).toEqual(["123456"]);
        expect(res.body.contact.secondaryContactIds).toHaveLength(1);

        secondaryId = res.body.contact.secondaryContactIds[0];
    });

    it("should return consolidated contact on phone-only lookup", async () => {
        const res = await request(app)
            .post("/identify")
            .send({ phoneNumber: "123456" });

        expect(res.status).toBe(200);
        expect(res.body.contact.primaryContatctId).toBe(primaryId);
        expect(res.body.contact.emails).toEqual([
            "lorraine@hillvalley.edu",
            "mcfly@hillvalley.edu",
        ]);
        expect(res.body.contact.secondaryContactIds).toEqual([secondaryId]);
    });

    it("should return consolidated contact on secondary email lookup", async () => {
        const res = await request(app)
            .post("/identify")
            .send({ email: "mcfly@hillvalley.edu" });

        expect(res.status).toBe(200);
        expect(res.body.contact.primaryContatctId).toBe(primaryId);
        expect(res.body.contact.emails).toEqual([
            "lorraine@hillvalley.edu",
            "mcfly@hillvalley.edu",
        ]);
        expect(res.body.contact.secondaryContactIds).toEqual([secondaryId]);
    });

    it("should return consolidated contact on primary email lookup", async () => {
        const res = await request(app)
            .post("/identify")
            .send({ email: "lorraine@hillvalley.edu" });

        expect(res.status).toBe(200);
        expect(res.body.contact.primaryContatctId).toBe(primaryId);
        expect(res.body.contact.emails).toContain("lorraine@hillvalley.edu");
        expect(res.body.contact.emails).toContain("mcfly@hillvalley.edu");
    });

    it("should not create duplicate rows on repeated identical request", async () => {
        const res = await request(app)
            .post("/identify")
            .send({ email: "lorraine@hillvalley.edu", phoneNumber: "123456" });

        expect(res.status).toBe(200);
        expect(res.body.contact.secondaryContactIds).toEqual([secondaryId]);
    });

    describe("primary merging", () => {
        let georgeId: number;
        let biffId: number;

        it("should create george as a new primary", async () => {
            const res = await request(app)
                .post("/identify")
                .send({ email: "george@hillvalley.edu", phoneNumber: "919191" });

            expect(res.status).toBe(200);
            expect(res.body.contact.secondaryContactIds).toEqual([]);
            georgeId = res.body.contact.primaryContatctId;
        });

        it("should create biff as a separate primary", async () => {
            const res = await request(app)
                .post("/identify")
                .send({ email: "biffsucks@hillvalley.edu", phoneNumber: "717171" });

            expect(res.status).toBe(200);
            expect(res.body.contact.secondaryContactIds).toEqual([]);
            biffId = res.body.contact.primaryContatctId;
            expect(biffId).not.toBe(georgeId);
        });

        it("should merge two primaries — older one wins", async () => {
            const res = await request(app)
                .post("/identify")
                .send({ email: "george@hillvalley.edu", phoneNumber: "717171" });

            expect(res.status).toBe(200);
            expect(res.body.contact.primaryContatctId).toBe(georgeId);
            expect(res.body.contact.emails).toEqual([
                "george@hillvalley.edu",
                "biffsucks@hillvalley.edu",
            ]);
            expect(res.body.contact.phoneNumbers).toEqual(["919191", "717171"]);
            expect(res.body.contact.secondaryContactIds).toContain(biffId);
        });
    });

    describe("validation", () => {
        it("should return 400 for empty body", async () => {
            const res = await request(app).post("/identify").send({});
            expect(res.status).toBe(400);
        });

        it("should return 400 when both fields are null", async () => {
            const res = await request(app)
                .post("/identify")
                .send({ email: null, phoneNumber: null });
            expect(res.status).toBe(400);
        });
    });
});
