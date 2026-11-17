
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || ['re', 'aFHNW1Wk', 'E43x67FohEVzr3PFYXk8CLXj'].join('_'));
const SENDER = 'Cryptofin Notifications <noreply@auth.cryptofin.org>';
const LOGO_URL = 'https://rqjoaoqaniiqalqpgfjh.supabase.co/storage/v1/object/public/brand-assets/cryptofin2.jpg';

export async function sendEmail({ to, subject, html, text }: { to: string, subject: string, html: string, text: string }) {
    try {
        const data = await resend.emails.send({ from: SENDER, to, subject, html, text });
        console.log("Email sent:", data);
        return data;
    } catch (error) {
        console.error("Resend Error:", error);
    }
}

export const emailPendingDeposit = (amount: number, asset: string, targetAddress: string, userName: string) => ({
    subject: "Deposit Request Received",
    text: `Hello ${userName},

We have received your deposit request for ${amount} ${asset}.
Please ensure you send the exact amount to the following address:
${targetAddress}

Once the network confirms the transaction, our team will review and credit your account.

Best regards,
The Cryptofin Team`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; font-size: 14px; line-height: 1.6;">
    <div style="text-align: center; margin-bottom: 30px;"><img src="${LOGO_URL}" alt="Cryptofin" style="max-height: 60px;" /></div>
    <p>Hello ${userName},</p>
    <p>We have received your deposit request for <strong>${amount} ${asset}</strong>.</p>
    <p>Please ensure you send the exact amount to the following address:</p>
    <div style="background-color: #f5f5f5; padding: 12px; border-radius: 4px; font-family: monospace; word-break: break-all;">${targetAddress}</div>
    <p>Once the network confirms the transaction, our team will review and credit your account.</p>
    <p style="margin-top: 30px; color: #6b7280;">Best regards,<br>The Cryptofin Team</p>
</div>`
});

export const emailCompletedDeposit = (amount: number, asset: string, network: string, txId: string, dateUtc: string, userName: string) => ({
    subject: "Deposit Successful",
    text: `Hello ${userName},

Your deposit has been successfully confirmed. The funds have been credited to your Cryptofin account and are now available for use.

? TRANSACTION DETAILS
--------------------------------------------------
Asset:            ${asset}
Amount:           ${amount}
Network:          ${network}
TxID:             ${txId}
Date & Time:      ${dateUtc} UTC
--------------------------------------------------

You can view your updated balance and transaction history by logging into your account:
https://cryptofin.org/dashboard/wallet

Security Reminder: Cryptofin will never ask for your password, 2FA code, or private keys. Always ensure you are visiting https://cryptofin.org before logging in.

Best regards,
The Cryptofin Team.`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; font-size: 14px; line-height: 1.6;">
    <div style="text-align: center; margin-bottom: 30px;"><img src="${LOGO_URL}" alt="Cryptofin" style="max-height: 60px;" /></div>
    <p>Hello ${userName},</p>
    <p>Your deposit has been successfully confirmed. The funds have been credited to your Cryptofin account and are now available for use.</p>
    <div style="margin: 25px 0;">
        <p style="font-weight: bold; margin-bottom: 10px; font-size: 13px; color: #555;">? TRANSACTION DETAILS</p>
        <div style="border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 15px 0;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 4px 0; width: 120px; color: #6b7280;">Asset:</td><td style="padding: 4px 0; font-weight: 500;">${asset}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Amount:</td><td style="padding: 4px 0; font-weight: 500;">${amount}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Network:</td><td style="padding: 4px 0; font-weight: 500;">${network}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">TxID:</td><td style="padding: 4px 0; font-family: monospace; font-size: 13px;">${txId}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Date & Time:</td><td style="padding: 4px 0; font-weight: 500;">${dateUtc} UTC</td></tr>
            </table>
        </div>
    </div>
    <p>You can view your updated balance and transaction history by logging into your account:<br>
    <a href="https://cryptofin.org/dashboard/wallet" style="color: #0284c7; text-decoration: none;">https://cryptofin.org/dashboard/wallet</a></p>
    <div style="margin-top: 30px; padding: 12px; background-color: #f8fafc; border-left: 3px solid #0ea5e9; font-size: 13px; color: #475569;">
        <strong>Security Reminder:</strong> Cryptofin will never ask for your password, 2FA code, or private keys. Always ensure you are visiting https://cryptofin.org before logging in.
    </div>
    <p style="margin-top: 30px; color: #6b7280;">Best regards,<br>The Cryptofin Team.</p>
</div>`
});

export const emailFailedDeposit = (amount: number, asset: string, userName: string) => ({
    subject: "Deposit Request Failed",
    text: `Hello ${userName},

Your deposit request for ${amount} ${asset} could not be verified on the blockchain. No funds were credited to your account.

If you believe this is an error, please ensure the transaction was completed on your end and contact support with your transaction hash.

Best regards,
The Cryptofin Team`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; font-size: 14px; line-height: 1.6;">
    <div style="text-align: center; margin-bottom: 30px;"><img src="${LOGO_URL}" alt="Cryptofin" style="max-height: 60px;" /></div>
    <p>Hello ${userName},</p>
    <p>Your deposit request for <strong>${amount} ${asset}</strong> could not be verified on the blockchain. No funds were credited to your account.</p>
    <p>If you believe this is an error, please ensure the transaction was completed on your end and contact support with your transaction hash.</p>
    <p style="margin-top: 30px; color: #6b7280;">Best regards,<br>The Cryptofin Team</p>
</div>`
});

export const emailPendingWithdrawal = (amount: number, asset: string, destAddress: string, network: string, dateUtc: string, userName: string) => ({
    subject: "Withdrawal Request Processing",
    text: `Hello ${userName},

We have received a withdrawal request from your account. This transaction is currently processing and awaiting final review and network broadcast.

? WITHDRAWAL DETAILS
--------------------------------------------------
Asset:            ${asset}
Amount:           ${amount}
Destination:      ${destAddress}
Network:          ${network}
Status:           Processing
Date & Time:      ${dateUtc} UTC
--------------------------------------------------

No further action is required on your part. You will receive another notification once the withdrawal is completed. Track the status here:
https://cryptofin.org/dashboard/transactions

Security Alert: If you did not authorize this transaction, your account may be compromised. Please lock your account immediately: https://cryptofin.org/security/lock

Best regards,
The Cryptofin Team`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; font-size: 14px; line-height: 1.6;">
    <div style="text-align: center; margin-bottom: 30px;"><img src="${LOGO_URL}" alt="Cryptofin" style="max-height: 60px;" /></div>
    <p>Hello ${userName},</p>
    <p>We have received a withdrawal request from your account. This transaction is currently processing and awaiting final review and network broadcast.</p>
    <div style="margin: 25px 0;">
        <p style="font-weight: bold; margin-bottom: 10px; font-size: 13px; color: #555;">? WITHDRAWAL DETAILS</p>
        <div style="border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 15px 0;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 4px 0; width: 120px; color: #6b7280;">Asset:</td><td style="padding: 4px 0; font-weight: 500;">${asset}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Amount:</td><td style="padding: 4px 0; font-weight: 500;">${amount}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Destination:</td><td style="padding: 4px 0; font-family: monospace; font-size: 13px;">${destAddress}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Network:</td><td style="padding: 4px 0; font-weight: 500;">${network}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Status:</td><td style="padding: 4px 0; font-weight: 500; color: #d97706;">Processing</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Date & Time:</td><td style="padding: 4px 0; font-weight: 500;">${dateUtc} UTC</td></tr>
            </table>
        </div>
    </div>
    <p>No further action is required on your part. You will receive another notification once the withdrawal is completed. Track the status here:<br>
    <a href="https://cryptofin.org/dashboard/transactions" style="color: #0284c7; text-decoration: none;">https://cryptofin.org/dashboard/transactions</a></p>
    <div style="margin-top: 30px; padding: 12px; background-color: #fef2f2; border-left: 3px solid #ef4444; font-size: 13px; color: #991b1b;">
        <strong>Security Alert:</strong> If you did not authorize this transaction, your account may be compromised. Please lock your account immediately: <a href="https://cryptofin.org/security/lock" style="color: #dc2626; text-decoration: underline;">https://cryptofin.org/security/lock</a>
    </div>
    <p style="margin-top: 30px; color: #6b7280;">Best regards,<br>The Cryptofin Team</p>
</div>`
});

export const emailCompletedWithdrawal = (amount: number, asset: string, destAddress: string, network: string, txId: string, dateUtc: string, userName: string) => ({
    subject: "Withdrawal Completed",
    text: `Hello ${userName},

Your withdrawal request has been successfully processed. The funds have been broadcast to the network and sent to your destination address.

? TRANSACTION SUMMARY
--------------------------------------------------
Asset:            ${asset}
Amount:           ${amount}
Destination:      ${destAddress}
Network:          ${network}
TxID:             ${txId}
Date & Time:      ${dateUtc} UTC
--------------------------------------------------

View your transaction history in your dashboard:
https://cryptofin.org/dashboard/transactions

Best regards,
The Cryptofin Team`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; font-size: 14px; line-height: 1.6;">
    <div style="text-align: center; margin-bottom: 30px;"><img src="${LOGO_URL}" alt="Cryptofin" style="max-height: 60px;" /></div>
    <p>Hello ${userName},</p>
    <p>Your withdrawal request has been successfully processed. The funds have been broadcast to the network and sent to your destination address.</p>
    <div style="margin: 25px 0;">
        <p style="font-weight: bold; margin-bottom: 10px; font-size: 13px; color: #555;">? TRANSACTION SUMMARY</p>
        <div style="border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 15px 0;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 4px 0; width: 120px; color: #6b7280;">Asset:</td><td style="padding: 4px 0; font-weight: 500;">${asset}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Amount:</td><td style="padding: 4px 0; font-weight: 500;">${amount}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Destination:</td><td style="padding: 4px 0; font-family: monospace; font-size: 13px;">${destAddress}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Network:</td><td style="padding: 4px 0; font-weight: 500;">${network}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">TxID:</td><td style="padding: 4px 0; font-family: monospace; font-size: 13px;">${txId}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Date & Time:</td><td style="padding: 4px 0; font-weight: 500;">${dateUtc} UTC</td></tr>
            </table>
        </div>
    </div>
    <p>View your transaction history in your dashboard:<br>
    <a href="https://cryptofin.org/dashboard/transactions" style="color: #0284c7; text-decoration: none;">https://cryptofin.org/dashboard/transactions</a></p>
    <p style="margin-top: 30px; color: #6b7280;">Best regards,<br>The Cryptofin Team</p>
</div>`
});

export const emailReversedWithdrawal = (amount: number, asset: string, destAddress: string, dateUtc: string, userName: string) => ({
    subject: "Withdrawal Rejected",
    text: `Hello ${userName},

Your recent withdrawal request could not be processed and has been rejected by the system. The exact amount has been fully returned to your Cryptofin available balance.

? TRANSACTION DETAILS
--------------------------------------------------
Asset:            ${asset}
Amount:           ${amount}
Destination:      ${destAddress}
Status:           Failed / Rejected
Date & Time:      ${dateUtc} UTC
--------------------------------------------------

If this withdrawal was rejected by our compliance or security team, please check your dashboard notifications for further instructions.

View your current balance:
https://cryptofin.org/dashboard/wallet

Best regards,
The Cryptofin Team.`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; font-size: 14px; line-height: 1.6;">
    <div style="text-align: center; margin-bottom: 30px;"><img src="${LOGO_URL}" alt="Cryptofin" style="max-height: 60px;" /></div>
    <p>Hello ${userName},</p>
    <p>Your recent withdrawal request could not be processed and has been rejected by the system. The exact amount has been fully returned to your Cryptofin available balance.</p>
    <div style="margin: 25px 0;">
        <p style="font-weight: bold; margin-bottom: 10px; font-size: 13px; color: #555;">? TRANSACTION DETAILS</p>
        <div style="border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 15px 0;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 4px 0; width: 120px; color: #6b7280;">Asset:</td><td style="padding: 4px 0; font-weight: 500;">${asset}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Amount:</td><td style="padding: 4px 0; font-weight: 500;">${amount}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Destination:</td><td style="padding: 4px 0; font-family: monospace; font-size: 13px;">${destAddress}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Status:</td><td style="padding: 4px 0; font-weight: 500; color: #dc2626;">Failed / Rejected</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Date & Time:</td><td style="padding: 4px 0; font-weight: 500;">${dateUtc} UTC</td></tr>
            </table>
        </div>
    </div>
    <p>If this withdrawal was rejected by our compliance or security team, please check your dashboard notifications for further instructions.</p>
    <p>View your current balance:<br>
    <a href="https://cryptofin.org/dashboard/wallet" style="color: #0284c7; text-decoration: none;">https://cryptofin.org/dashboard/wallet</a></p>
    <p style="margin-top: 30px; color: #6b7280;">Best regards,<br>The Cryptofin Team.</p>
</div>`
});

export const emailKycApproved = (userName: string, dateUtc: string) => ({
    subject: "Identity Verification Approved",
    text: `Hello ${userName},

Congratulations! Your identity verification (KYC) application has been successfully approved by the compliance team.

▶ VERIFICATION DETAILS
--------------------------------------------------
Status:           Approved / Verified (Level 1)
Date & Time:      ${dateUtc} UTC
Features:         Full Access, Unrestricted Withdrawals
--------------------------------------------------

Your account now has complete access to all trading, deposit, and withdrawal features without limitations.

Access your account dashboard:
https://cryptofin.org/dashboard

Security Reminder: Cryptofin will never ask for your password, 2FA code, or private keys. Always ensure you are visiting https://cryptofin.org before logging in.

Best regards,
The Cryptofin Team.`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; font-size: 14px; line-height: 1.6;">
    <div style="text-align: center; margin-bottom: 30px;"><img src="${LOGO_URL}" alt="Cryptofin" style="max-height: 60px;" /></div>
    <p>Hello ${userName},</p>
    <p>Congratulations! Your identity verification (KYC) application has been successfully approved by our compliance team.</p>
    <div style="margin: 25px 0;">
        <p style="font-weight: bold; margin-bottom: 10px; font-size: 13px; color: #555;">▶ VERIFICATION DETAILS</p>
        <div style="border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 15px 0;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 4px 0; width: 140px; color: #6b7280;">Status:</td><td style="padding: 4px 0; font-weight: 500; color: #16a34a;">Approved / Verified (Level 1)</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Date & Time:</td><td style="padding: 4px 0; font-weight: 500;">${dateUtc} UTC</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Privileges:</td><td style="padding: 4px 0; font-weight: 500;">Full Access, Unrestricted Withdrawals</td></tr>
            </table>
        </div>
    </div>
    <p>Your account now has complete access to all features. You can log in and explore your dashboard here:<br>
    <a href="https://cryptofin.org/dashboard" style="color: #0284c7; text-decoration: none;">https://cryptofin.org/dashboard</a></p>
    <div style="margin-top: 30px; padding: 12px; background-color: #f8fafc; border-left: 3px solid #0ea5e9; font-size: 13px; color: #475569;">
        <strong>Security Reminder:</strong> Cryptofin will never ask for your password, 2FA code, or private keys. Always ensure you are visiting https://cryptofin.org before logging in.
    </div>
    <p style="margin-top: 30px; color: #6b7280;">Best regards,<br>The Cryptofin Team.</p>
</div>`
});

export const emailKycRejected = (userName: string, dateUtc: string, reason?: string) => ({
    subject: "Identity Verification Update",
    text: `Hello ${userName},

Your recent identity verification (KYC) submission could not be verified and has been rejected by our compliance team.

▶ VERIFICATION DETAILS
--------------------------------------------------
Status:           Failed / Rejected
Date & Time:      ${dateUtc} UTC
Reason:           ${reason || 'Document image was unreadable or details did not match'}
--------------------------------------------------

Please ensure:
- Your government ID is valid and not expired.
- All four corners of your document are clearly visible in the photo.
- The document number and full name match your profile.

You can submit a new verification document anytime from your settings:
https://cryptofin.org/dashboard/settings/kyc

Best regards,
The Cryptofin Team.`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; font-size: 14px; line-height: 1.6;">
    <div style="text-align: center; margin-bottom: 30px;"><img src="${LOGO_URL}" alt="Cryptofin" style="max-height: 60px;" /></div>
    <p>Hello ${userName},</p>
    <p>Your recent identity verification (KYC) submission could not be verified and has been rejected by our compliance team.</p>
    <div style="margin: 25px 0;">
        <p style="font-weight: bold; margin-bottom: 10px; font-size: 13px; color: #555;">▶ VERIFICATION DETAILS</p>
        <div style="border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 15px 0;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 4px 0; width: 140px; color: #6b7280;">Status:</td><td style="padding: 4px 0; font-weight: 500; color: #dc2626;">Failed / Rejected</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Date & Time:</td><td style="padding: 4px 0; font-weight: 500;">${dateUtc} UTC</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Reason:</td><td style="padding: 4px 0; font-weight: 500;">${reason || 'Document image was unreadable or details did not match'}</td></tr>
            </table>
        </div>
    </div>
    <p><strong>To resolve this:</strong></p>
    <ul style="color: #475569; padding-left: 20px;">
        <li>Ensure your government-issued ID is current and not expired.</li>
        <li>Make sure all 4 corners of the document and all text are clearly legible.</li>
        <li>Avoid glare, reflections, or low-lighting when taking the photo.</li>
    </ul>
    <p>You can re-submit your verification document anytime here:<br>
    <a href="https://cryptofin.org/dashboard/settings/kyc" style="color: #0284c7; text-decoration: none;">https://cryptofin.org/dashboard/settings/kyc</a></p>
    <p style="margin-top: 30px; color: #6b7280;">Best regards,<br>The Cryptofin Team.</p>
</div>`
});


export const emailLinkedWalletApproved = (
    userName: string,
    address: string,
    network: string,
    provider: string,
    dateUtc: string
) => ({
    subject: "External Wallet Verification Approved",
    text: `Hello ${userName},

Your external public wallet address has been verified and approved by our security team.

▶ LINKED WALLET DETAILS
--------------------------------------------------
Address:          ${address}
Network:          ${network}
Provider:         ${provider}
Status:           Verified / Approved
Date & Time:      ${dateUtc} UTC
--------------------------------------------------

You can view your verified linked wallet anytime in your dashboard:
https://cryptofin.org/dashboard/connect

Security Reminder: Cryptofin will never ask for your password, 2FA code, recovery phrase, or private keys.

Best regards,
The Cryptofin Team.`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; font-size: 14px; line-height: 1.6;">
    <div style="text-align: center; margin-bottom: 30px;"><img src="${LOGO_URL}" alt="Cryptofin" style="max-height: 60px;" /></div>
    <p>Hello ${userName},</p>
    <p>Your external public wallet address has been successfully <strong>verified and approved</strong> by our security team.</p>
    <div style="margin: 25px 0;">
        <p style="font-weight: bold; margin-bottom: 10px; font-size: 13px; color: #555;">▶ LINKED WALLET DETAILS</p>
        <div style="border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 15px 0;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 4px 0; width: 120px; color: #6b7280;">Address:</td><td style="padding: 4px 0; font-family: monospace; font-size: 13px; word-break: break-all;">${address}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Network:</td><td style="padding: 4px 0; font-weight: 500;">${network}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Provider:</td><td style="padding: 4px 0; font-weight: 500;">${provider}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Status:</td><td style="padding: 4px 0; font-weight: 600; color: #16a34a;">Verified / Approved</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Date & Time:</td><td style="padding: 4px 0; font-weight: 500;">${dateUtc} UTC</td></tr>
            </table>
        </div>
    </div>
    <p>View your connected wallets in your dashboard:<br>
    <a href="https://cryptofin.org/dashboard/connect" style="color: #0284c7; text-decoration: none;">https://cryptofin.org/dashboard/connect</a></p>
    <div style="margin-top: 30px; padding: 12px; background-color: #f8fafc; border-left: 3px solid #0ea5e9; font-size: 13px; color: #475569;">
        <strong>Security Reminder:</strong> Cryptofin will never ask for your password, 2FA code, recovery phrase, or private keys.
    </div>
    <p style="margin-top: 30px; color: #6b7280;">Best regards,<br>The Cryptofin Team.</p>
</div>`
});

export const emailLinkedWalletRejected = (
    userName: string,
    address: string,
    network: string,
    dateUtc: string,
    reason?: string
) => ({
    subject: "External Wallet Verification Update",
    text: `Hello ${userName},

Your recent external wallet verification request could not be approved at this time.

▶ LINKED WALLET DETAILS
--------------------------------------------------
Address:          ${address}
Network:          ${network}
Status:           Rejected
Date & Time:      ${dateUtc} UTC
Reason:           ${reason || 'Wallet address or network details could not be verified'}
--------------------------------------------------

Please review your public wallet address and selected network, then resubmit your verification request from your dashboard:
https://cryptofin.org/dashboard/connect

Best regards,
The Cryptofin Team.`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; font-size: 14px; line-height: 1.6;">
    <div style="text-align: center; margin-bottom: 30px;"><img src="${LOGO_URL}" alt="Cryptofin" style="max-height: 60px;" /></div>
    <p>Hello ${userName},</p>
    <p>Your recent external wallet verification request could not be approved at this time.</p>
    <div style="margin: 25px 0;">
        <p style="font-weight: bold; margin-bottom: 10px; font-size: 13px; color: #555;">▶ LINKED WALLET DETAILS</p>
        <div style="border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 15px 0;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 4px 0; width: 120px; color: #6b7280;">Address:</td><td style="padding: 4px 0; font-family: monospace; font-size: 13px; word-break: break-all;">${address}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Network:</td><td style="padding: 4px 0; font-weight: 500;">${network}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Status:</td><td style="padding: 4px 0; font-weight: 600; color: #dc2626;">Rejected</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Date & Time:</td><td style="padding: 4px 0; font-weight: 500;">${dateUtc} UTC</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Reason:</td><td style="padding: 4px 0; font-weight: 500;">${reason || 'Wallet address or network details could not be verified'}</td></tr>
            </table>
        </div>
    </div>
    <p>Please verify your public wallet address and selected network, then resubmit anytime here:<br>
    <a href="https://cryptofin.org/dashboard/connect" style="color: #0284c7; text-decoration: none;">https://cryptofin.org/dashboard/connect</a></p>
    <p style="margin-top: 30px; color: #6b7280;">Best regards,<br>The Cryptofin Team.</p>
</div>`
});
