import { api } from '@dadei/ui/lib/workspace/api/http/client';
import { ENDPOINTS } from '@dadei/ui/lib/workspace/api/http/constants';
import type { BillingClient, SubscriptionView } from '@dadei/ui/types/subscription.types';

export const subscriptionApi = {
  async getSubscription(): Promise<SubscriptionView> {
    const { data } = await api.get<SubscriptionView>(ENDPOINTS.SUBSCRIPTION);
    return data;
  },

  async createCheckout(client: BillingClient): Promise<{ url: string }> {
    const { data } = await api.post<{ url: string }>(ENDPOINTS.SUBSCRIPTION_CHECKOUT, { client });
    return data;
  },

  async createPortal(client: BillingClient): Promise<{ url: string }> {
    const { data } = await api.post<{ url: string }>(ENDPOINTS.SUBSCRIPTION_PORTAL, { client });
    return data;
  },
};
