// ========== Subscription Types ==========

export type SubscriptionTier = 'free' | 'premium' | 'vip';

export interface SubscriptionPlan {
  id: SubscriptionTier;
  name: string;
  price: number;
  priceUnit: string;
  features: string[];
  popular?: boolean;
}

export interface UserSubscription {
  tier: SubscriptionTier;
  expiresAt: Date | null;
  skipsToday: number;
  lastSkipReset: Date;
}

// ========== Feature Limits by Tier ==========

export const SUBSCRIPTION_LIMITS = {
  free: {
    skipsPerDay: 20,
    priorityMatching: false,
    genderFilter: false,
    regionFilter: false,
    interestsFilter: false,
    hdVideo: false,
    adFree: false,
    reconnectPrevious: false,
    favorites: false,
    premiumBadge: false,
    profileEnhancements: false,
    queueBoost: 1,
  },
  premium: {
    skipsPerDay: 100,
    priorityMatching: true,
    genderFilter: true,
    regionFilter: true,
    interestsFilter: false,
    hdVideo: true,
    adFree: true,
    reconnectPrevious: true,
    favorites: false,
    premiumBadge: true,
    profileEnhancements: true,
    queueBoost: 2,
  },
  vip: {
    skipsPerDay: Infinity,
    priorityMatching: true,
    genderFilter: true,
    regionFilter: true,
    interestsFilter: true,
    hdVideo: true,
    adFree: true,
    reconnectPrevious: true,
    favorites: true,
    premiumBadge: true,
    profileEnhancements: true,
    queueBoost: 5,
  },
} as const;

// ========== Subscription Plans for UI ==========

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    priceUnit: 'forever',
    features: [
      '20 skips per day',
      'Basic video chat',
      'Text messaging',
      'Standard matching',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 9.99,
    priceUnit: 'month',
    popular: true,
    features: [
      '100 skips per day',
      'Priority matching (2x faster)',
      'Gender & region filters',
      'HD video quality',
      'Ad-free experience',
      'Reconnect with previous users',
      'Premium badge',
      'Profile customization',
    ],
  },
  {
    id: 'vip',
    name: 'VIP',
    price: 19.99,
    priceUnit: 'month',
    features: [
      'Unlimited skips',
      'Priority matching (5x faster)',
      'All filters (gender, region, interests)',
      'HD video quality',
      'Ad-free experience',
      'Reconnect with previous users',
      'VIP badge',
      'Profile customization',
      'Save favorite users',
      'Priority support',
    ],
  },
];

// ========== Feature Comparison Table ==========

export interface FeatureComparison {
  feature: string;
  free: string | boolean;
  premium: string | boolean;
  vip: string | boolean;
  category: 'matching' | 'video' | 'social' | 'experience';
}

export const FEATURE_COMPARISON: FeatureComparison[] = [
  // Matching
  { feature: 'Daily Skips', free: '20', premium: '100', vip: 'Unlimited', category: 'matching' },
  { feature: 'Queue Priority', free: 'Standard', premium: '2x Faster', vip: '5x Faster', category: 'matching' },
  { feature: 'Gender Filter', free: false, premium: true, vip: true, category: 'matching' },
  { feature: 'Region Filter', free: false, premium: true, vip: true, category: 'matching' },
  { feature: 'Interests Filter', free: false, premium: false, vip: true, category: 'matching' },
  
  // Video
  { feature: 'Video Quality', free: 'SD', premium: 'HD', vip: 'HD', category: 'video' },
  
  // Social
  { feature: 'Reconnect Previous', free: false, premium: true, vip: true, category: 'social' },
  { feature: 'Save Favorites', free: false, premium: false, vip: true, category: 'social' },
  { feature: 'Premium Badge', free: false, premium: true, vip: true, category: 'social' },
  { feature: 'Profile Enhancements', free: false, premium: true, vip: true, category: 'social' },
  
  // Experience
  { feature: 'Ad-Free', free: false, premium: true, vip: true, category: 'experience' },
  { feature: 'Priority Support', free: false, premium: false, vip: true, category: 'experience' },
];

// ========== Helper Functions ==========

export function canUseFeature(
  tier: SubscriptionTier,
  feature: keyof typeof SUBSCRIPTION_LIMITS.free
): boolean {
  const limits = SUBSCRIPTION_LIMITS[tier];
  const value = limits[feature];
  return typeof value === 'boolean' ? value : true;
}

export function getSkipsRemaining(subscription: UserSubscription): number {
  const limit = SUBSCRIPTION_LIMITS[subscription.tier].skipsPerDay;
  if (limit === Infinity) return Infinity;
  return Math.max(0, limit - subscription.skipsToday);
}

export function isPremiumOrHigher(tier: SubscriptionTier): boolean {
  return tier === 'premium' || tier === 'vip';
}

export function isVIP(tier: SubscriptionTier): boolean {
  return tier === 'vip';
}
