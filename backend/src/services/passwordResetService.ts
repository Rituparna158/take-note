import { generateOtp, hashOtp } from "../lib/otp.js";
import { hashPassword } from "../lib/password.js";
import { AppError } from "../middleware/errorHandler.js";
import * as userRepository from "./userRepository.js";

const OTP_TTL_MS = 15 * 60 * 1000;
const INVALID_OR_EXPIRED_OTP_MESSAGE = "Invalid or expired OTP";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function requestPasswordReset(email: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);

  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user) {
    return;
  }

  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await userRepository.setResetOtp(user.id, otpHash, expiresAt);

  console.log(`[password-reset] OTP for ${normalizedEmail}: ${otp} (expires in 15 minutes)`);
}

export async function resetPassword(
  email: string,
  otp: string,
  newPassword: string,
): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  const expectedOtpHash = hashOtp(otp);
  const passwordHash = await hashPassword(newPassword);

  const consumed = await userRepository.consumePasswordReset({
    email: normalizedEmail,
    expectedOtpHash,
    passwordHash,
    now: new Date(),
  });

  if (!consumed) {
    throw new AppError(400, "VALIDATION_ERROR", INVALID_OR_EXPIRED_OTP_MESSAGE);
  }
}
