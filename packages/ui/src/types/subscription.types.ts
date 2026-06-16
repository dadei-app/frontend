export interface SubscriptionLimitsView {
  max_devices: number | null;
  max_persons: number | null;
  memory_retention_days: number | null;
  daily_command_limit: number | null;
}

export interface SubscriptionView {
  tier: string;
  display_name: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  commands_remaining_today: number | null;
  limits: SubscriptionLimitsView;
}

export type BillingClient = 'web' | 'desktop';
