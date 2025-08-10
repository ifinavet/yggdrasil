import posthog from 'posthog-js'
import { cookieConsentGiven } from './components/common/consent';

if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || !process.env.NEXT_PUBLIC_POSTHOG_HOST) {
  throw new Error('PostHog environment variables are not set');
}

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
  api_host: "/relay-aXgZ",
  ui_host: "https://eu.posthog.com",
  defaults: '2025-05-24',
  persistence: cookieConsentGiven() === "yes" ? 'localStorage+cookie' : 'memory',
});
