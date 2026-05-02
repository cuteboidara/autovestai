import { Injectable } from '@nestjs/common';
import { OTP } from 'otplib';
import * as QRCode from 'qrcode';

@Injectable()
export class TotpService {
  private readonly otp = new OTP();

  generateSecret(): string {
    return this.otp.generateSecret(20);
  }

  async generateQrCodeDataUrl(email: string, secret: string): Promise<string> {
    const otpAuthUrl = this.otp.generateURI({ issuer: 'AutovestAI', label: email, secret });
    return QRCode.toDataURL(otpAuthUrl);
  }

  verify(secret: string, token: string): boolean {
    try {
      const result = this.otp.verifySync({ token, secret });
      return result.valid;
    } catch {
      return false;
    }
  }
}
