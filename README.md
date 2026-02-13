# Artemis Portfolio Tracker

A comprehensive portfolio tracking application with advanced analytics, Plaid integration, and multi-provider authentication.

## Features

- **Multi-Source Portfolio Tracking**: Import holdings via CSV or connect brokerage accounts through Plaid
- **Real-Time Price Data**: Live prices for stocks, ETFs, and cryptocurrencies
- **Advanced Analytics**: Factor analysis, sector allocation, and portfolio insights
- **Secure Authentication**: Powered by Privy with support for Email, X (Twitter), and Web3 Wallets
- **Database**: Supabase PostgreSQL with Row Level Security

## Tech Stack

- **Frontend**: React, TypeScript, Vite, TailwindCSS, shadcn-ui
- **Backend**: Supabase (PostgreSQL, Edge Functions)
- **Authentication**: Privy (multi-provider social login)
- **Data Sources**: Plaid API, Yahoo Finance, Artemis API (crypto), Coinbase API
- **Analytics**: Custom factor models and portfolio optimization

## Setup

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Privy account (sign up at https://dashboard.privy.io)
- Plaid account (for brokerage integration)

### Installation

1. Clone the repository:
```sh
git clone <YOUR_GIT_URL>
cd artemis-portfolio-tracker
```

2. Install dependencies:
```sh
npm install
```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Add your Supabase credentials
   - Add your Privy App ID from https://dashboard.privy.io
   - (Optional) Add Artemis API key for enhanced crypto analytics

```env
VITE_SUPABASE_PROJECT_ID="your_project_id"
VITE_SUPABASE_PUBLISHABLE_KEY="your_publishable_key"
VITE_SUPABASE_URL="https://your_project_id.supabase.co"
VITE_PRIVY_APP_ID="your_privy_app_id"
```

4. Set up Supabase database:
```sh
# Push database migrations
supabase db push
```

5. Configure Privy Dashboard:
   - Create a new app at https://dashboard.privy.io (name it "Artemis Portfolio Tracker")
   - Enable login methods: Email, X (Twitter), Wallet
   - Add redirect URLs:
     - Development: `http://localhost:5173`
     - Production: `https://your-domain.com`
   - Copy your App ID to `.env`

6. Start the development server:
```sh
npm run dev
```

## Authentication Architecture

This app uses a hybrid authentication approach:

- **Privy**: Handles all user-facing authentication (login UI, OAuth flows, session management)
- **Supabase**: Maintains user records and enforces Row Level Security (RLS) on data

When a user signs in via Privy:
1. Privy issues a JWT token
2. The frontend sets this token in the Supabase client
3. The `current_user_id()` function maps Privy user IDs to Supabase user records
4. RLS policies use `current_user_id()` to filter data by user

This architecture provides:
- ✅ Best-in-class authentication UX via Privy
- ✅ Secure data isolation via Supabase RLS
- ✅ Zero downtime migration from Supabase Auth
- ✅ Support for Email, X (Twitter), and Web3 Wallets (MetaMask, WalletConnect, etc.)

## Deployment

### Database

```sh
# Deploy database migrations
supabase db push

# Deploy edge functions
supabase functions deploy plaid-create-link-token
supabase functions deploy plaid-exchange-token
supabase functions deploy get-24h-prices
```

### Frontend

```sh
# Build for production
npm run build

# Deploy to your hosting provider (Vercel, Netlify, etc.)
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT
