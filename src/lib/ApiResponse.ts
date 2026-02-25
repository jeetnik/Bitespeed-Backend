/**
 * Standardised API response wrapper.
 * Ensures every response from the server follows the same format.
 */
export class ApiResponse<T = any> {
    public statusCode: number;
    public data: T | null;
    public message: string;
    public success: boolean;

    constructor(statusCode: number, data: T | null, message = "Success") {
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = statusCode < 400;
    }
}
