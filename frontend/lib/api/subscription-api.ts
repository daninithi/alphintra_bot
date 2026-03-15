// file path: "src/frontend/lib/api/subscription-api.ts"

import axios from 'axios';
import { gatewayHttpBaseUrl } from '../config/gateway';
import { getToken, getUserId, getUserEmail } from '../auth';

export interface SubscriptionStatus {
  isSubscribed: boolean;
  plan: string;
  endDate: string;
}

export interface SubscriptionCheckoutRequest {
  userId: number;
  email: string;
  plan: 'monthly' | 'yearly';
  successUrl: string;
  cancelUrl: string;
}

export const SUBSCRIPTION_PLANS = {
  monthly: {
    label: 'Monthly',
    name: 'Pro Monthly',
    price: '$10',
    description: '$10 / month',
    amount: 10,
    interval: 'month',
    features: [
      'Unlimited strategy imports',
      'Unlimited marketplace purchases',
      'Request to publish strategies',
      'Access all default & marketplace strategies',
    ],
  },
  yearly: {
    label: 'Yearly',
    name: 'Pro Yearly',
    price: '$100',
    description: '$100 / year (save $20)',
    amount: 100,
    interval: 'year',
    features: [
      'Everything in Monthly',
      'Save $20 vs monthly billing',
      'Unlimited strategy imports',
      'Unlimited marketplace purchases',
      'Request to publish strategies',
    ],
  },
};

const api = axios.create({ baseURL: gatewayHttpBaseUrl });
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

export async function getSubscriptionStatus(userId?: number): Promise<SubscriptionStatus> {
  const id = userId ?? Number(getUserId());
  if (!id) return { isSubscribed: false, plan: 'free', endDate: '' };
  try {
    const res = await api.get(`/marketplace/subscriptions/status/${id}`);
    return res.data;
  } catch {
    return { isSubscribed: false, plan: 'free', endDate: '' };
  }
}

export async function startSubscriptionCheckout(plan: 'monthly' | 'yearly'): Promise<void> {
  const userId = Number(getUserId());
  const email = getUserEmail() ?? '';
  const successUrl = `${window.location.origin}/subscription/success?plan=${plan}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${window.location.origin}/subscription`;

  const res = await api.post('/marketplace/subscriptions/checkout', {
    userId,
    email,
    plan,
    successUrl,
    cancelUrl,
  });

  if (res.data?.checkoutUrl) {
    window.location.href = res.data.checkoutUrl;
  } else {
    throw new Error(res.data?.error ?? 'Failed to create checkout session');
  }
}

export async function activateSubscription(sessionId: string): Promise<void> {
  const userId = Number(getUserId());
  await api.post('/marketplace/subscriptions/activate', { sessionId, userId });
}

// Backward-compat export
export const subscriptionApiClient = {
  getSubscriptionStatus: () => getSubscriptionStatus(),
  startSubscriptionCheckout,
  activateSubscription,
};

