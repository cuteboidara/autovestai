# AutovestAI Post-Deploy Checklist

## Backend (Railway)
- [ ] GET https://api.autovestai.io/health returns 200
- [ ] Railway logs show "Application is running on port 3000"
- [ ] Railway logs show "Prisma migrations applied"
- [ ] No red errors in Railway deploy logs

## Frontend (Vercel)
- [ ] https://autovestai.io loads homepage
- [ ] https://www.autovestai.io redirects correctly
- [ ] No console errors on homepage

## Auth Flows
- [ ] Register new account → verification email arrives
- [ ] Click verification link → email verified
- [ ] Login → dashboard loads
- [ ] Forgot password → reset email arrives
- [ ] Reset password → can log in with new password

## Trading
- [ ] Open /trade → TradingView chart loads
- [ ] Live prices update in watchlist
- [ ] Place a BUY order → appears in open positions
- [ ] Close position → appears in order history

## Wallet
- [ ] Deposit → enter amount → QR + address shows
- [ ] Submit withdrawal → appears in admin panel

## Admin
- [ ] https://autovestai.io/control-tower → admin login page
- [ ] Login as super admin → dashboard loads
- [ ] CRM → client list loads
- [ ] KYC queue loads
- [ ] Configure SMTP sender in /control-tower/crm/settings/email-senders

## Security
- [ ] https://autovestai.io/admin returns 404
- [ ] SSL padlock shows on all pages
- [ ] API calls use https:// not http://
