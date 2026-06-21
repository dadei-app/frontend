import { api } from '@dadei/ui/lib/workspace/api/http/client';
import { ENDPOINTS } from '@dadei/ui/lib/workspace/api/http/constants';
import type { BillingClient, SubscriptionView } from '@dadei/ui/types/subscription.types';

function webSpaOrigin(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.location.origin;
}

function subscriptionClientBody(client: BillingClient): {
  client: BillingClient;
  spa_origin?: string;
} {
  const body: { client: BillingClient; spa_origin?: string } = { client };
  if (client === 'web') {
    const origin = webSpaOrigin();
    if (origin) body.spa_origin = origin;
  }
  return body;
}

export const subscriptionApi = {
  async getSubscription(): Promise<SubscriptionView> {
    const { data } = await api.get<SubscriptionView>(ENDPOINTS.SUBSCRIPTION);
    return data;
  },

  async createCheckout(client: BillingClient): Promise<{ url: string }> {
    const { data } = await api.post<{ url: string }>(
      ENDPOINTS.SUBSCRIPTION_CHECKOUT,
      subscriptionClientBody(client),
    );
    return data;
  },

  async createPortal(client: BillingClient): Promise<{ url: string }> {
    const { data } = await api.post<{ url: string }>(
      ENDPOINTS.SUBSCRIPTION_PORTAL,
      subscriptionClientBody(client),
    );
    return data;
  },
};
