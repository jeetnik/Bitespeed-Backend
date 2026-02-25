/**
 * Custom error class for application-level errors.
 * Extends the built-in Error with an HTTP status code and optional error details.
 */
export class CustomError extends Error {
    public statusCode: number;
    public errors: any[];

    constructor(
        statusCode: number,
        message = "Something went wrong",
        errors: any[] = [],
        stack = ""
    ) {
        super(message);
        this.statusCode = statusCode;
        this.errors = errors;

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
