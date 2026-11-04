# Barber platform API

## Setup

Run `npm install` from the project root. For a local MongoDB server, make sure
MongoDB is installed and running, then copy `.env.example` to `.env` and set
`MONGODB_URI` to `mongodb://127.0.0.1:27017/barber-platform`. In PowerShell:

```powershell
Copy-Item .env.example .env
```

The app connects to the database named `barber-platform` on the local MongoDB
instance; MongoDB creates the database when the app first writes data. You can
use a different local URI or a MongoDB Atlas URI by changing `MONGODB_URI`.
Set `FIREBASE_STORAGE_BUCKET` and a `JWT_SECRET` of at least 32 characters. Set
`FIREBASE_SERVICE_ACCOUNT_JSON`
with a Firebase service account key, or configure Google Application Default
Credentials in the hosting environment. `PORT` defaults to `3000`;
`JWT_EXPIRES_IN` defaults to `1h`. Start locally with `npm run dev`, or use
`npm start` for the same root `server.js` entry point.

Application code lives under `src/` (`routes`, `controllers`, `models`,
`middleware`, `services`, `realtime`, and `public`); the root `server.js` is
the only server entry point. Tests remain in the root `tests/` directory.

## Azure App Settings

In the Azure App Service portal, open **Settings → Environment variables**
and add the following application settings. Azure exposes App Settings to the
Node.js process as environment variables; do not put secret values in source
control or share them in chat.

| Name | Value |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string (Atlas for production) |
| `JWT_SECRET` | Random secret of at least 32 characters |
| `FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket name |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase service account JSON, stored as a secret |
| `PAYSTACK_SECRET_KEY` | Production Paystack secret key |
| `FLUTTERWAVE_SECRET_KEY` | Production Flutterwave secret key |
| `STRIPE_SECRET_KEY` | Production Stripe secret key |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key used by the customer card form |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | Sender address on a verified Resend domain |
| `PAYMENT_CALLBACK_URL` | Public HTTPS payment callback URL registered with Paystack and Flutterwave |
| `PAYMENT_FX_RATES_JSON` | JSON map of NGN per unit for currencies used outside Nigeria |
| `PAYOUT_ENCRYPTION_KEY` | 32-byte random key encoded as 64 hexadecimal characters |
| `NODE_ENV` | `production` |
| `PASSWORD_RESET_URL` | Public HTTPS URL of the password-reset page, if not using the default |

Use production keys only after testing the corresponding integrations with test
credentials. `PORT` is supplied by the hosting environment when applicable and
otherwise defaults to `3000`. Changes to App Settings restart the app. After
setting them, verify the deployment logs and complete payment, password-reset,
and Firebase upload tests before opening the service to customers.

### Pre-launch deployment checklist

- [ ] Configure Azure App Service to use Node.js 20 or newer.
- [ ] Confirm the public site and API are served over HTTPS.
- [ ] Deploy from the project root and confirm `npm start` starts the app.
- [ ] Confirm required App Settings are present; startup requires
  `MONGODB_URI` and a `JWT_SECRET` of at least 32 characters.
- [ ] Confirm application logs are available in Azure and review them after
  startup and test transactions.
- [ ] Verify the app can connect to MongoDB Atlas using the production URI.
- [ ] Exercise successful and failed payment and booking flows with the
  configured providers; monitor provider dashboards and app logs for failures.
- [ ] Configure verified payout destinations for test barbers, then test
  completion, scheduled transfers, full/partial dispute refunds, and held payouts.
- [ ] Enable Azure Application Insights or equivalent monitoring and review
  server errors and API response-time trends before and after launch.

The checklist items above require deployment-side verification. The app writes
unhandled server errors to its process logs, but does not currently provide
built-in response-time metrics or a dedicated payment/booking monitoring
dashboard.

## Password reset email

Configure Resend with `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. The sender
address must belong to a domain verified in Resend. The API emails links in
the form `https://barberconnect.com/reset-password/<token>`; optionally set
`PASSWORD_RESET_URL` to a different HTTPS base URL ending at the reset page.
Reset links expire after one hour, and the database stores only a hash of the
token. In non-production environments, the raw token is also returned by the
forgot-password endpoint for local testing. Password-reset requests are
limited to five per IP every 15 minutes. The static reset page posts the new
password and link token to `POST /api/reset-password`.

For booking payments, configure test-mode `PAYSTACK_SECRET_KEY`,
`FLUTTERWAVE_SECRET_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_PUBLISHABLE_KEY`.
Set `PAYMENT_CALLBACK_URL` to the HTTPS URL of the deployed
`/customer-journey.html` page registered with Paystack and Flutterwave
(localhost HTTP is permitted outside production). Configure
manual FX rates in `PAYMENT_FX_RATES_JSON`, as NGN per one unit of foreign
currency, for example `{"USD":1300,"KES":10}`. Nigeria always uses NGN at a
rate of 1. The API returns 503 if a required currency rate or provider key is
missing. The Stripe publishable key is public; never expose provider secret
keys to the browser or commit them.

Login requests to `POST /api/login` are limited to five attempts per IP address
every 15 minutes. Requests over the limit receive HTTP 429. The Express app
trusts one reverse-proxy hop for client IP detection; configure the hosting
proxy accordingly.

Keep the Firebase service account in Azure App Settings or another secrets
manager; never commit its key file. It needs permission to create and read
objects in the configured Storage bucket and to sign read URLs. Portfolio files
are stored in Firebase and returned as signed URLs that expire after one hour.
The barber profile API generates fresh signed URLs when profiles are fetched.

The welcome page is served at `/`. “Find a Barber” opens the customer booking
flow at `/customer-journey.html`: customers can register or sign in, browse
available barber profiles, book a service, pay through the configured
provider, and verify the booking confirmation. “Find Job Opportunities”
opens the visual barber career journey at `/barber-career-journey.html`.
“Hire a Barber” opens the visual employer journey at `/employer-journey.html`.
The customer flow requires the corresponding payment-provider credentials;
Stripe checkout also requires `STRIPE_PUBLISHABLE_KEY`. The barber career
page displays Starter (₦20,000/month), Professional
(₦30,000/month), and Elite (₦40,000/month) membership prices; subscription
payments are not implemented. The employer journey displays job posting prices
of ₦5,000 per job and ₦20,000 per featured job; job payments are not
implemented.

## Socket.IO

Install the backend dependencies with `npm install`. Socket.IO runs on the same
HTTP server and requires the same JWT used by REST endpoints. For browser
clients on another origin, set `SOCKET_CORS_ORIGIN` to the allowed origin or a
comma-separated list of allowed origins.

In Flutter, use the `socket_io_client` package and connect with the token:

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

final socket = IO.io(
  'http://10.0.2.2:3000',
  IO.OptionBuilder()
      .setTransports(['websocket'])
      .setAuth({'token': accessToken})
      .build(),
);

socket.on('booking:created', (booking) {
  // Refresh the customer's or barber's booking view.
});
```

Use your API host in place of `10.0.2.2` outside the Android emulator. The
server sends `booking:created` and `booking:status-updated` to the booking's
customer and barber, and `job:application-received` to the job's employer.
Sockets authenticate into private user rooms; invalidated or expired JWTs are
disconnected. Do not emit client-provided events as trusted booking or
application changes; make those changes through the authenticated REST API.

## Bookings

All booking endpoints require `Authorization: Bearer <token>`.

- `POST /api/payments/initialize`: a customer starts checkout with an
  `Idempotency-Key` header (1-128 visible ASCII characters), `barberId`
  (barber account's MongoDB ID), `serviceType`, `date` (`YYYY-MM-DD`), `time`,
  and ISO 3166-1 alpha-2 `countryCode`. The server sets the price at ₦3,000
  (₦2,500 barber share, ₦500 platform fee), ignores client-sent amounts, and
  routes Nigeria to Paystack/NGN, other African countries to
  Flutterwave/local currency, and other countries to Stripe/USD. Foreign
  currencies require a manually configured NGN-per-unit rate. The response
  includes a provider checkout URL or Stripe PaymentIntent client secret.
  Repeating the request with the same key and booking details returns the
  existing checkout instead of creating another payment. Reusing a key with
  different booking details returns HTTP 409. If initialization failed, retry
  with the same key; simultaneous initialization attempts receive HTTP 409.
- `POST /api/payments/verify`: requires the payment `reference`; Flutterwave
  additionally requires its `transactionId`, and Stripe accepts a
  `paymentIntentId`. The server checks the provider's API for successful
  status, reference, exact amount, and currency. It creates the booking and
  notifies the customer and barber only after verification. Failed, cancelled,
  or not-yet-completed checkouts do not create bookings. Explicit cancelled or
  failed provider results set payment status to `cancelled`; other
  not-yet-completed results return HTTP 402 with status `pending`.
  Provider/network errors return HTTP 502 and leave the payment available for
  verification retry.
- `POST /api/payments/:reference/refund`: admins can request a full refund for
  a completed payment. The server uses the matching Paystack, Flutterwave, or
  Stripe refund API and prevents duplicate concurrent refund submissions.
  Successful refunds set the payment status to `refunded`; provider-accepted
  refunds that are still processing return HTTP 202. If the provider request
  times out, the refund remains marked as processing to avoid issuing a
  potentially duplicate refund; reconcile that payment in the provider
  dashboard before taking further action.
- `POST /api/bookings` returns HTTP 410; create bookings through the payment
  flow so unverified payments cannot create bookings.
- `GET /api/bookings`: customers see their own bookings, barbers see bookings
  assigned to them, and admins can see all bookings.
- `PUT /api/bookings/:id`: customers can cancel their own pending bookings.
  The assigned barber can accept or cancel a pending booking, then complete
  or cancel an accepted booking. Admins can make any valid transition.
  Allowed transitions are pending → accepted/cancelled and accepted →
  completed/cancelled. The API also accepts the legacy `Confirmed` status
  spelling for compatibility. Marking a booking completed schedules the
  barber's payout for the end of the third weekday in the Africa/Lagos
  timezone; weekends are excluded, public holidays are not.

### Barber payouts and disputes

The payout processor checks for due transfers every minute and uses atomic
MongoDB claims to avoid processing the same payment on multiple app instances.
An unresolved customer dispute holds the payout. Customers can file a dispute
before a payout is submitted; admins should resolve it by the end of the third
weekday after it is filed. Admin resolution can uphold the payout, issue a full
refund, or issue a partial refund. For partial refunds, the admin supplies both
the refund amount and final barber payout in the payment currency's minor
units. These transfers use provider platform balances and are not a regulated
escrow arrangement; confirm provider terms and local requirements before
launch.

- `PUT /api/payout-accounts/:barberId/paystack` (admin):
  `{ "recipientCode": "RCP_..." }`
- `PUT /api/payout-accounts/:barberId/flutterwave` (admin):
  `{ "bankCode": "...", "accountNumber": "...", "accountName": "..." }`
- `PUT /api/payout-accounts/:barberId/stripe` (admin):
  `{ "connectedAccountId": "acct_..." }`
- `GET /api/payout-accounts/:barberId`: returns masked destination labels to
  the barber or an admin; destination details are never returned.
- `GET /api/payouts`: lets barbers view their payout status and admins monitor
  due, released, or failed payouts.
- `POST /api/disputes/:bookingId` (customer):
  `{ "reason": "..." }`
- `GET /api/disputes`: lists open disputes visible to the authenticated user.
- `PUT /api/disputes/:bookingId/resolve` (admin): use
  `{ "resolution": "upheld" }`, `{ "resolution": "full_refund" }`, or
  `{ "resolution": "partial_refund", "refundAmountMinor": 1000,
  "barberPayoutMinor": 200000 }`.
- `POST /api/disputes/:bookingId/reconcile-refund` (admin): after checking
  the provider dashboard, reconcile an asynchronous refund with
  `{ "status": "completed", "refundId": "..." }` or
  `{ "status": "failed" }` (include `refundId` if the provider returned one).

Payout destinations are configurable by admins and encrypted at rest using
`PAYOUT_ENCRYPTION_KEY`. Generate and store the key as an Azure secret; losing
or changing it makes existing destinations unreadable. Configure only
provider-created Paystack recipient codes, Flutterwave bank destinations, and
Stripe Connect accounts that are eligible for transfers. Provider payouts must
be enabled, and the platform must have available funds in the required
currency. Failed transfer requests are logged and retried after 30 minutes.
`released` means the provider accepted the transfer request; it does not
guarantee that the receiving bank has settled the funds. Provider errors,
insufficient balance, pending refunds, or incomplete payout setup can delay
the 3-working-day target and must be monitored in provider dashboards and app
logs.

The existing payment fee split remains accounting data; payout transfers are
separate provider operations. Use provider test credentials and eligible test
recipient accounts to validate checkout, refunds, and transfers before
production.

## Reviews

- `POST /api/reviews`: requires a customer bearer token, `bookingId`, an integer
  `rating` from 1 to 5, and a non-empty `comment`. The customer must own the
  completed booking. A unique compound index ensures each customer can review
  a booking only once. The barber profile's average rating is recalculated when
  a review is submitted.
- `GET /api/reviews`: lists reviews; optionally pass `?barberId=<id>` to filter
  by barber.

## Other API routes

- Authentication: `POST /api/register`, `/api/login`, `/api/logout`,
  `/api/forgot-password`, and `/api/reset-password`.
- Barber profiles: `GET /api/barbers`, `GET /api/barbers/:id`,
  `PUT /api/barbers/profile`, and `POST /api/barbers/upload-portfolio`
  (Firebase Storage).
- Jobs: `GET /api/jobs`, `POST /api/jobs`, `GET /api/jobs/:id`, and
  `POST /api/jobs/apply`.
- Employer applications: employer bearer tokens can use
  `GET /api/employer/applications` to list applications for their own jobs,
  `GET /api/employer/applications/:id` to review one application, and
  `PUT /api/employer/applications/:id/accept` or
  `PUT /api/employer/applications/:id/reject` to decide a pending application.
  List and detail responses include the job and barber profile information.
  Decisions are allowed only while an application is pending; attempts to
  change an already decided application return HTTP 409.
- Reviews: `POST /api/reviews` and `GET /api/reviews`.

Portfolio uploads use `multipart/form-data` with one or more files in the
`images` field and require a barber bearer token. The API accepts up to five
JPEG, PNG, or WebP images, each no larger than 5 MB.

## Current status and next steps

Implemented: authentication and password reset, barber profiles and portfolio
uploads, jobs and applications, bookings and reviews, payment initialization,
verification and refunds, scheduled barber payouts, dispute handling,
Socket.IO notifications, and static journey pages. Provider settlement,
transfer eligibility, and payout account setup still require live validation
with the configured provider accounts.
