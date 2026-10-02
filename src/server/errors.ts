/**
 * An error whose message is safe and useful to show the merchant.
 * Anything else is logged and replaced with a generic message.
 */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}
