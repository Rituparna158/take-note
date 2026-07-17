import { createHash, randomInt } from "node:crypto";

const OTP_LENGTH = 6;
const OTP_MAX_EXCLUSIVE = 10 ** OTP_LENGTH;

export function generateOtp(): string {
  return String(randomInt(0, OTP_MAX_EXCLUSIVE)).padStart(OTP_LENGTH, "0");
}

export function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}
