import { Router, Request, Response, NextFunction } from "express";
import { identifySchema } from "../lib/validation";
import { ApiResponse } from "../lib/ApiResponse";
import { CustomError } from "../lib/CustomError";
import { asyncHandler } from "../lib/asyncHandler";
import { identifyContact } from "../services/contactService";

const router = Router();

router.post(
    "/",
    asyncHandler(async (req: Request, res: Response) => {
        // validate the incoming payload
        const parseResult = identifySchema.safeParse(req.body);

        if (!parseResult.success) {
            throw new CustomError(400, "Validation failed", parseResult.error.issues.map((e: any) => ({
                field: e.path.join("."),
                message: e.message,
            })));
        }

        const { email, phoneNumber } = parseResult.data;

        const normalizedEmail = email || null;
        const normalizedPhone = phoneNumber || null;

        const result = await identifyContact(normalizedEmail, normalizedPhone);
        res.status(200).json(result);
    })
);

// catches errors from async routes so we don't have to try/catch everywhere
router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof CustomError) {
        res.status(err.statusCode).json(
            new ApiResponse(err.statusCode, null, err.message)
        );
        return;
    }

    console.error("Unexpected error in /identify:", err);
    res.status(500).json(
        new ApiResponse(500, null, "Internal server error")
    );
});

export default router;
