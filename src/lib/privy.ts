import { PrivyClientConfig } from '@privy-io/react-auth';

export const privyConfig: PrivyClientConfig = {
  appId: import.meta.env.VITE_PRIVY_APP_ID || '',
  config: {
    loginMethods: ['email', 'twitter', 'wallet'],
    appearance: {
      theme: 'dark',
      accentColor: '#6366f1', // Artemis purple
      logo: '/logo.png',
    },
    embeddedWallets: {
      createOnLogin: 'users-without-wallets', // Enable embedded wallets for users without external wallets
    },
  },
};
