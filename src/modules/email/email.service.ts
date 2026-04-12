import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMailModule from '@sendgrid/mail';

// Handle both ESM default and CJS module export
const sgMail: typeof sgMailModule =
  (sgMailModule as unknown as { default?: typeof sgMailModule }).default ?? sgMailModule;

import { PrismaService } from '../../common/prisma/prisma.service';

export type EmailTemplate =
  | 'welcome'
  | 'email_verified'
  | 'password_reset'
  | 'password_changed'
  | 'new_device_login'
  | 'account_suspended'
  | 'account_activated'
  | 'kyc_submitted'
  | 'kyc_approved'
  | 'kyc_rejected'
  | 'deposit_pending'
  | 'deposit_approved'
  | 'deposit_rejected'
  | 'withdrawal_requested'
  | 'withdrawal_approved'
  | 'withdrawal_rejected'
  | 'first_trade'
  | 'margin_call'
  | 'stop_out'
  | 'copy_started'
  | 'copy_stopped'
  | 'copy_provider_alert';

interface EmailParams {
  to: string;
  template: EmailTemplate;
  variables: Record<string, string | number | undefined>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;
  private readonly fromName = 'AutovestAI';
  private readonly enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {
    const apiKey = this.configService.get<string>('email.sendgridApiKey') ?? '';
    this.fromEmail =
      this.configService.get<string>('email.sendgridFromEmail') ??
      'noreply@autovestai.com';

    let ready = false;
    if (apiKey.length > 0) {
      try {
        sgMail.setApiKey(apiKey);
        ready = true;
      } catch (error) {
        this.logger.error(
          `Failed to initialise SendGrid: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.enabled = ready;

    if (!this.enabled) {
      this.logger.warn(
        'SENDGRID_API_KEY is not configured or failed to initialise — transactional emails are disabled',
      );
    }
  }

  async send(params: EmailParams): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(
        `Email skipped (no SendGrid key): ${params.template} → ${params.to}`,
      );
      return;
    }

    const { subject, html } = this.renderTemplate(
      params.template,
      params.variables,
    );

    try {
      await sgMail.send({
        to: params.to,
        from: { email: this.fromEmail, name: this.fromName },
        subject,
        html,
      });

      this.logger.log(`Email sent: ${params.template} → ${params.to}`);
    } catch (error) {
      this.logger.error(
        `Email failed: ${params.template} → ${params.to}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  // --- Convenience methods per trigger ---

  async sendWelcome(userId: string, verifyLink: string): Promise<void> {
    const user = await this.resolveUser(userId);
    if (!user) return;

    await this.send({
      to: user.email,
      template: 'welcome',
      variables: {
        accountNumber: user.accountNumber,
        verifyLink,
      },
    });
  }

  async sendEmailVerified(userId: string): Promise<void> {
    const user = await this.resolveUser(userId);
    if (!user) return;

    await this.send({
      to: user.email,
      template: 'email_verified',
      variables: { accountNumber: user.accountNumber },
    });
  }

  async sendPasswordReset(userId: string, resetLink: string): Promise<void> {
    const user = await this.resolveUser(userId);
    if (!user) return;

    await this.send({
      to: user.email,
      template: 'password_reset',
      variables: { accountNumber: user.accountNumber, resetLink },
    });
  }

  async sendPasswordChanged(userId: string): Promise<void> {
    const user = await this.resolveUser(userId);
    if (!user) return;

    await this.send({
      to: user.email,
      template: 'password_changed',
      variables: { accountNumber: user.accountNumber },
    });
  }

  async sendNewDeviceLogin(
    userId: string,
    ip: string,
    userAgent: string,
  ): Promise<void> {
    const user = await this.resolveUser(userId);
    if (!user) return;

    await this.send({
      to: user.email,
      template: 'new_device_login',
      variables: { accountNumber: user.accountNumber, ip, userAgent },
    });
  }

  async sendAccountSuspended(userId: string): Promise<void> {
    const user = await this.resolveUser(userId);
    if (!user) return;

    await this.send({
      to: user.email,
      template: 'account_suspended',
      variables: { accountNumber: user.accountNumber },
    });
  }

  async sendAccountActivated(userId: string): Promise<void> {
    const user = await this.resolveUser(userId);
    if (!user) return;

    await this.send({
      to: user.email,
      template: 'account_activated',
      variables: { accountNumber: user.accountNumber },
    });
  }

  async sendKycSubmitted(userId: string): Promise<void> {
    const user = await this.resolveUser(userId);
    if (!user) return;

    await this.send({
      to: user.email,
      template: 'kyc_submitted',
      variables: { accountNumber: user.accountNumber },
    });
  }

  async sendKycApproved(userId: string): Promise<void> {
    const user = await this.resolveUser(userId);
    if (!user) return;

    await this.send({
      to: user.email,
      template: 'kyc_approved',
      variables: { accountNumber: user.accountNumber },
    });
  }

  async sendKycRejected(userId: string, reason: string): Promise<void> {
    const user = await this.resolveUser(userId);
    if (!user) return;

    await this.send({
      to: user.email,
      template: 'kyc_rejected',
      variables: { accountNumber: user.accountNumber, reason },
    });
  }

  async sendDepositPending(userId: string, amount: string): Promise<void> {
    const user = await this.resolveUser(userId);
    if (!user) return;

    await this.send({
      to: user.email,
      template: 'deposit_pending',
      variables: { accountNumber: user.accountNumber, amount },
    });
  }

  async sendDepositApproved(userId: string, amount: string): Promise<void> {
    const user = await this.resolveUser(userId);
    if (!user) return;

    await this.send({
      to: user.email,
      template: 'deposit_approved',
      variables: { accountNumber: user.accountNumber, amount },
    });
  }

  async sendDepositRejected(
    userId: string,
    amount: string,
    reason: string,
  ): Promise<void> {
    const user = await this.resolveUser(userId);
    if (!user) return;

    await this.send({
      to: user.email,
      template: 'deposit_rejected',
      variables: { accountNumber: user.accountNumber, amount, reason },
    });
  }

  async sendWithdrawalRequested(
    userId: string,
    amount: string,
  ): Promise<void> {
    const user = await this.resolveUser(userId);
    if (!user) return;

    await this.send({
      to: user.email,
      template: 'withdrawal_requested',
      variables: { accountNumber: user.accountNumber, amount },
    });
  }

  async sendWithdrawalApproved(
    userId: string,
    amount: string,
  ): Promise<void> {
    const user = await this.resolveUser(userId);
    if (!user) return;

    await this.send({
      to: user.email,
      template: 'withdrawal_approved',
      variables: { accountNumber: user.accountNumber, amount },
    });
  }

  async sendWithdrawalRejected(
    userId: string,
    amount: string,
    reason: string,
  ): Promise<void> {
    const user = await this.resolveUser(userId);
    if (!user) return;

    await this.send({
      to: user.email,
      template: 'withdrawal_rejected',
      variables: { accountNumber: user.accountNumber, amount, reason },
    });
  }

  async sendFirstTrade(userId: string, symbol: string): Promise<void> {
    const user = await this.resolveUser(userId);
    if (!user) return;

    await this.send({
      to: user.email,
      template: 'first_trade',
      variables: { accountNumber: user.accountNumber, symbol },
    });
  }

  async sendMarginCall(
    userId: string,
    marginLevel: string,
  ): Promise<void> {
    const user = await this.resolveUser(userId);
    if (!user) return;

    await this.send({
      to: user.email,
      template: 'margin_call',
      variables: { accountNumber: user.accountNumber, marginLevel },
    });
  }

  async sendStopOut(userId: string, marginLevel: string): Promise<void> {
    const user = await this.resolveUser(userId);
    if (!user) return;

    await this.send({
      to: user.email,
      template: 'stop_out',
      variables: { accountNumber: user.accountNumber, marginLevel },
    });
  }

  async sendCopyStarted(
    userId: string,
    providerName: string,
  ): Promise<void> {
    const user = await this.resolveUser(userId);
    if (!user) return;

    await this.send({
      to: user.email,
      template: 'copy_started',
      variables: { accountNumber: user.accountNumber, providerName },
    });
  }

  async sendCopyStopped(
    userId: string,
    providerName: string,
  ): Promise<void> {
    const user = await this.resolveUser(userId);
    if (!user) return;

    await this.send({
      to: user.email,
      template: 'copy_stopped',
      variables: { accountNumber: user.accountNumber, providerName },
    });
  }

  async sendCopyProviderAlert(
    userId: string,
    providerName: string,
    message: string,
  ): Promise<void> {
    const user = await this.resolveUser(userId);
    if (!user) return;

    await this.send({
      to: user.email,
      template: 'copy_provider_alert',
      variables: { accountNumber: user.accountNumber, providerName, message },
    });
  }

  // --- Internals ---

  private async resolveUser(
    userId: string,
  ): Promise<{ email: string; accountNumber: string } | null> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { email: true, accountNumber: true },
    });

    if (!user) {
      this.logger.warn(`Email target user not found: ${userId}`);
    }

    return user;
  }

  private renderTemplate(
    template: EmailTemplate,
    vars: Record<string, string | number | undefined>,
  ): { subject: string; html: string } {
    const config = TEMPLATES[template];
    const body = config.body(vars);

    return {
      subject: config.subject(vars),
      html: this.wrapInLayout(body),
    };
  }

  private wrapInLayout(body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>AutovestAI</title>
</head>
<body style="margin:0;padding:0;background-color:#0A0E1A;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0E1A;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#111827;border-radius:16px;border:1px solid rgba(255,255,255,0.08);">

<!-- Header -->
<tr><td style="padding:32px 32px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
<span style="font-size:20px;font-weight:700;letter-spacing:0.32em;color:#FFFFFF;text-transform:uppercase;">AUTOVESTAI</span>
</td></tr>

<!-- Body -->
<tr><td style="padding:32px;color:#D1D5DB;font-size:14px;line-height:24px;">
${body}
</td></tr>

<!-- Footer -->
<tr><td style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.06);color:#6B7280;font-size:12px;line-height:20px;">
<p style="margin:0 0 8px;">Need help? Contact us at <a href="mailto:support@autovestai.com" style="color:#F5A623;text-decoration:none;">support@autovestai.com</a></p>
<p style="margin:0 0 8px;color:#4B5563;">CFDs are complex instruments and carry a high risk of losing money due to leverage. You should consider whether you understand how CFDs work and whether you can afford to take the high risk of losing your money.</p>
<p style="margin:0;color:#4B5563;">You are receiving this email because you have an account with AutovestAI. If you wish to unsubscribe from non-essential communications, please contact support.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
  }
}

// --- Template definitions ---

const v = (
  vars: Record<string, string | number | undefined>,
  key: string,
): string => String(vars[key] ?? '');

const greeting = (vars: Record<string, string | number | undefined>) =>
  `<p style="margin:0 0 16px;color:#F9FAFB;">Hello ${v(vars, 'accountNumber')},</p>`;

const cta = (href: string, label: string) =>
  `<p style="margin:24px 0;"><a href="${href}" style="display:inline-block;padding:12px 28px;background-color:#F5A623;color:#0A0E1A;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;">${label}</a></p>`;

type TemplateConfig = {
  subject: (vars: Record<string, string | number | undefined>) => string;
  body: (vars: Record<string, string | number | undefined>) => string;
};

const TEMPLATES: Record<EmailTemplate, TemplateConfig> = {
  welcome: {
    subject: () => 'Welcome to AutovestAI',
    body: (vars) =>
      `${greeting(vars)}
<p>Thank you for creating your AutovestAI account. We're excited to have you on board.</p>
<p>To get started, please verify your email address:</p>
${cta(v(vars, 'verifyLink'), 'Verify Email Address')}
<p>This link expires in 24 hours. If you did not create an account, you can safely ignore this email.</p>`,
  },

  email_verified: {
    subject: () => 'Email Verified — AutovestAI',
    body: (vars) =>
      `${greeting(vars)}
<p>Your email address has been successfully verified.</p>
<p>You can now complete your KYC verification to unlock deposits, trading, and withdrawals on the platform.</p>
${cta('#', 'Go to Dashboard')}`,
  },

  password_reset: {
    subject: () => 'Password Reset Request — AutovestAI',
    body: (vars) =>
      `${greeting(vars)}
<p>We received a request to reset your password. Click the button below to set a new password:</p>
${cta(v(vars, 'resetLink'), 'Reset Password')}
<p>This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email. Your account remains secure.</p>`,
  },

  password_changed: {
    subject: () => 'Password Changed — AutovestAI',
    body: (vars) =>
      `${greeting(vars)}
<p>Your password has been successfully changed.</p>
<p>If you did not make this change, please contact our support team immediately at <a href="mailto:support@autovestai.com" style="color:#F5A623;text-decoration:none;">support@autovestai.com</a>.</p>`,
  },

  new_device_login: {
    subject: () => 'New Device Login — AutovestAI',
    body: (vars) =>
      `${greeting(vars)}
<p>We detected a login to your account from a new device or location:</p>
<table role="presentation" style="margin:16px 0;border:1px solid rgba(255,255,255,0.08);border-radius:8px;width:100%;">
<tr><td style="padding:8px 16px;color:#9CA3AF;font-size:13px;">IP Address</td><td style="padding:8px 16px;color:#F9FAFB;font-size:13px;">${v(vars, 'ip')}</td></tr>
<tr><td style="padding:8px 16px;color:#9CA3AF;font-size:13px;border-top:1px solid rgba(255,255,255,0.06);">Device</td><td style="padding:8px 16px;color:#F9FAFB;font-size:13px;border-top:1px solid rgba(255,255,255,0.06);">${v(vars, 'userAgent')}</td></tr>
</table>
<p>If this was you, no action is needed. If you don't recognise this activity, please change your password immediately and contact support.</p>`,
  },

  account_suspended: {
    subject: () => 'Account Suspended — AutovestAI',
    body: (vars) =>
      `${greeting(vars)}
<p>Your AutovestAI account has been suspended. Trading, deposits, and withdrawals are temporarily disabled.</p>
<p>If you believe this is an error, please contact our compliance team at <a href="mailto:support@autovestai.com" style="color:#F5A623;text-decoration:none;">support@autovestai.com</a> for further information.</p>`,
  },

  account_activated: {
    subject: () => 'Account Activated — AutovestAI',
    body: (vars) =>
      `${greeting(vars)}
<p>Your AutovestAI account has been activated. You now have full access to trading, deposits, and withdrawals.</p>
${cta('#', 'Go to Dashboard')}`,
  },

  kyc_submitted: {
    subject: () => 'KYC Documents Received — AutovestAI',
    body: (vars) =>
      `${greeting(vars)}
<p>We have received your identity verification documents. Our compliance team is reviewing your submission.</p>
<p>You can expect a decision within <strong style="color:#F9FAFB;">24–48 hours</strong>. We will notify you by email once the review is complete.</p>
<p>If we require any additional information, we will reach out to you directly.</p>`,
  },

  kyc_approved: {
    subject: () => 'Identity Verified — AutovestAI',
    body: (vars) =>
      `${greeting(vars)}
<p>Congratulations! Your identity verification (KYC) has been <strong style="color:#4ADE80;">approved</strong>.</p>
<p>You now have full access to the AutovestAI platform, including deposits, live trading, and withdrawals.</p>
${cta('#', 'Start Trading')}`,
  },

  kyc_rejected: {
    subject: () => 'KYC Review Update — AutovestAI',
    body: (vars) =>
      `${greeting(vars)}
<p>Unfortunately, your identity verification (KYC) submission could not be approved at this time.</p>
<p><strong style="color:#F9FAFB;">Reason:</strong> ${v(vars, 'reason')}</p>
<p>Please review the feedback above and resubmit your documents through the client portal. If you have questions, contact our support team.</p>
${cta('#', 'Resubmit Documents')}`,
  },

  deposit_pending: {
    subject: () => 'Deposit Received — AutovestAI',
    body: (vars) =>
      `${greeting(vars)}
<p>We have received your deposit of <strong style="color:#F9FAFB;">$${v(vars, 'amount')} USDT</strong>.</p>
<p>Your deposit is now pending admin review. Once approved, the funds will be credited to your trading account. This typically takes less than 24 hours during business days.</p>`,
  },

  deposit_approved: {
    subject: () => 'Deposit Credited — AutovestAI',
    body: (vars) =>
      `${greeting(vars)}
<p>Your deposit of <strong style="color:#4ADE80;">$${v(vars, 'amount')} USDT</strong> has been approved and credited to your trading account.</p>
<p>Your updated balance is now available in your wallet. You can start trading immediately.</p>
${cta('#', 'Go to Wallet')}`,
  },

  deposit_rejected: {
    subject: () => 'Deposit Not Approved — AutovestAI',
    body: (vars) =>
      `${greeting(vars)}
<p>Your deposit of <strong style="color:#F9FAFB;">$${v(vars, 'amount')} USDT</strong> was not approved.</p>
<p><strong style="color:#F9FAFB;">Reason:</strong> ${v(vars, 'reason')}</p>
<p>If you believe this is an error, please contact our support team with your transaction details.</p>`,
  },

  withdrawal_requested: {
    subject: () => 'Withdrawal Request Received — AutovestAI',
    body: (vars) =>
      `${greeting(vars)}
<p>Your withdrawal request of <strong style="color:#F9FAFB;">$${v(vars, 'amount')} USDT</strong> has been received and is pending review.</p>
<p>Withdrawal requests are typically reviewed and processed within 1–24 hours during business days. You will receive a confirmation email once your withdrawal has been sent.</p>`,
  },

  withdrawal_approved: {
    subject: () => 'Withdrawal Approved — AutovestAI',
    body: (vars) =>
      `${greeting(vars)}
<p>Your withdrawal of <strong style="color:#4ADE80;">$${v(vars, 'amount')} USDT</strong> has been approved and is being processed for on-chain transfer.</p>
<p>You will receive a final confirmation once the transaction is broadcast to the blockchain.</p>`,
  },

  withdrawal_rejected: {
    subject: () => 'Withdrawal Declined — AutovestAI',
    body: (vars) =>
      `${greeting(vars)}
<p>Your withdrawal request of <strong style="color:#F9FAFB;">$${v(vars, 'amount')} USDT</strong> was declined.</p>
<p><strong style="color:#F9FAFB;">Reason:</strong> ${v(vars, 'reason')}</p>
<p>The funds remain in your trading account. If you have questions, please contact our support team.</p>`,
  },

  first_trade: {
    subject: () => 'Your First Trade — AutovestAI',
    body: (vars) =>
      `${greeting(vars)}
<p>Congratulations on executing your first trade on AutovestAI!</p>
<p>You opened a position on <strong style="color:#F5A623;">${v(vars, 'symbol')}</strong>. You can monitor your positions and P&L in real time through the trading terminal.</p>
<p>Remember: CFDs carry a high risk of loss due to leverage. Always trade responsibly and use stop-loss orders to manage risk.</p>
${cta('#', 'Open Terminal')}`,
  },

  margin_call: {
    subject: () => '⚠ Margin Call Warning — AutovestAI',
    body: (vars) =>
      `${greeting(vars)}
<p style="color:#FBBF24;font-weight:600;">Your account margin level has dropped to ${v(vars, 'marginLevel')}%.</p>
<p>This is below the margin call threshold of 100%. To avoid automatic liquidation of your positions, please take immediate action:</p>
<ul style="margin:16px 0;padding-left:20px;color:#D1D5DB;">
<li>Deposit additional funds to increase your margin</li>
<li>Close some positions to free up margin</li>
<li>Reduce your position sizes</li>
</ul>
<p>If your margin level falls below 50%, a stop-out will be triggered and positions will be automatically liquidated starting with the largest loss.</p>`,
  },

  stop_out: {
    subject: () => '🔴 Stop Out Executed — AutovestAI',
    body: (vars) =>
      `${greeting(vars)}
<p style="color:#F87171;font-weight:600;">A stop-out has been executed on your account.</p>
<p>Your margin level fell to ${v(vars, 'marginLevel')}%, which is below the stop-out threshold of 50%. Positions have been automatically liquidated starting with the largest loss to restore your margin level.</p>
<p>Please review your account balance and open positions in the trading terminal. Consider depositing additional funds or adjusting your trading strategy to prevent future stop-outs.</p>
${cta('#', 'View Account')}`,
  },

  copy_started: {
    subject: () => 'Copy Trading Activated — AutovestAI',
    body: (vars) =>
      `${greeting(vars)}
<p>You are now copying <strong style="color:#F5A623;">${v(vars, 'providerName')}</strong>.</p>
<p>New trades from this provider will be automatically mirrored in your account based on your allocation and copy ratio settings. You can monitor performance and adjust settings at any time from the Copy Trading section.</p>
${cta('#', 'View Copy Trading')}`,
  },

  copy_stopped: {
    subject: () => 'Copy Trading Stopped — AutovestAI',
    body: (vars) =>
      `${greeting(vars)}
<p>You have stopped copying <strong style="color:#F9FAFB;">${v(vars, 'providerName')}</strong>.</p>
<p>No new trades from this provider will be mirrored in your account. Existing copied positions remain open until you close them manually.</p>`,
  },

  copy_provider_alert: {
    subject: () => 'Copy Trading Alert — AutovestAI',
    body: (vars) =>
      `${greeting(vars)}
<p>An alert has been triggered for your copy trading subscription with <strong style="color:#F5A623;">${v(vars, 'providerName')}</strong>:</p>
<p style="padding:12px 16px;background-color:rgba(245,166,35,0.1);border:1px solid rgba(245,166,35,0.2);border-radius:8px;color:#FBBF24;">${v(vars, 'message')}</p>
<p>Please review your copy trading settings and take any necessary action.</p>
${cta('#', 'Review Settings')}`,
  },
};
