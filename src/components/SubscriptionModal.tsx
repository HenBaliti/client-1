import {
  type SubscriptionTier,
  type UserSubscription,
  SUBSCRIPTION_PLANS,
  FEATURE_COMPARISON,
  SUBSCRIPTION_LIMITS,
  getSkipsRemaining,
} from '../types/subscription';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSubscription: UserSubscription;
  onUpgrade: (tier: SubscriptionTier) => void;
}

export function SubscriptionModal({
  isOpen,
  onClose,
  currentSubscription,
  onUpgrade,
}: SubscriptionModalProps) {
  if (!isOpen) return null;

  const skipsRemaining = getSkipsRemaining(currentSubscription);
  const currentTier = currentSubscription.tier;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="subscription-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Upgrade Your Experience
          </h2>
          <button className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Current Status */}
        <div className="subscription-status">
          <div className="status-item">
            <span className="status-label">Current Plan</span>
            <span className={`status-value tier-${currentTier}`}>
              {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Skips Today</span>
            <span className="status-value">
              {skipsRemaining === Infinity ? '∞' : `${skipsRemaining} remaining`}
            </span>
          </div>
        </div>

        {/* Plans */}
        <div className="plans-grid">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`plan-card ${plan.popular ? 'popular' : ''} ${currentTier === plan.id ? 'current' : ''}`}
            >
              {plan.popular && <div className="popular-badge">Most Popular</div>}
              {currentTier === plan.id && <div className="current-badge">Current</div>}
              
              <h3 className="plan-name">{plan.name}</h3>
              <div className="plan-price">
                <span className="price-amount">
                  {plan.price === 0 ? 'Free' : `$${plan.price}`}
                </span>
                {plan.price > 0 && <span className="price-unit">/{plan.priceUnit}</span>}
              </div>
              
              <ul className="plan-features">
                {plan.features.map((feature, idx) => (
                  <li key={idx}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                className={`plan-button ${plan.id === 'free' ? 'secondary' : 'primary'}`}
                disabled={currentTier === plan.id || (plan.id === 'free' && currentTier !== 'free')}
                onClick={() => onUpgrade(plan.id)}
              >
                {currentTier === plan.id
                  ? 'Current Plan'
                  : plan.id === 'free'
                    ? 'Free Plan'
                    : `Upgrade to ${plan.name}`}
              </button>
            </div>
          ))}
        </div>

        {/* Feature Comparison Table */}
        <div className="comparison-section">
          <h3>Feature Comparison</h3>
          <div className="comparison-table">
            <div className="comparison-header">
              <div className="feature-name">Feature</div>
              <div className="tier-col">Free</div>
              <div className="tier-col">Premium</div>
              <div className="tier-col">VIP</div>
            </div>
            {FEATURE_COMPARISON.map((row, idx) => (
              <div key={idx} className="comparison-row">
                <div className="feature-name">{row.feature}</div>
                <div className="tier-col">
                  {typeof row.free === 'boolean' ? (
                    row.free ? (
                      <svg className="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg className="x" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    )
                  ) : (
                    row.free
                  )}
                </div>
                <div className="tier-col">
                  {typeof row.premium === 'boolean' ? (
                    row.premium ? (
                      <svg className="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg className="x" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    )
                  ) : (
                    row.premium
                  )}
                </div>
                <div className="tier-col">
                  {typeof row.vip === 'boolean' ? (
                    row.vip ? (
                      <svg className="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg className="x" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    )
                  ) : (
                    row.vip
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="subscription-note">
          💳 Secure payment processing. Cancel anytime.
        </p>
      </div>
    </div>
  );
}

// Premium Feature Lock Component
interface PremiumLockProps {
  feature: string;
  requiredTier: 'premium' | 'vip';
  currentTier: SubscriptionTier;
  onUpgrade: () => void;
  children: React.ReactNode;
}

export function PremiumLock({
  feature,
  requiredTier,
  currentTier,
  onUpgrade,
  children,
}: PremiumLockProps) {
  const isLocked =
    (requiredTier === 'premium' && currentTier === 'free') ||
    (requiredTier === 'vip' && currentTier !== 'vip');

  if (!isLocked) return <>{children}</>;

  return (
    <div className="premium-lock">
      <div className="lock-overlay">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
        <span>{requiredTier === 'vip' ? 'VIP' : 'Premium'} Feature</span>
        <button className="unlock-btn" onClick={onUpgrade}>
          Unlock {feature}
        </button>
      </div>
      <div className="locked-content">{children}</div>
    </div>
  );
}

// Premium Badge Component
export function PremiumBadge({ tier }: { tier: SubscriptionTier }) {
  if (tier === 'free') return null;

  return (
    <span className={`premium-badge badge-${tier}`}>
      {tier === 'vip' ? (
        <>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          VIP
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="7" />
            <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
          </svg>
          Premium
        </>
      )}
    </span>
  );
}

// Skip Counter Component
export function SkipCounter({
  subscription,
  onUpgrade,
}: {
  subscription: UserSubscription;
  onUpgrade: () => void;
}) {
  const skipsRemaining = getSkipsRemaining(subscription);
  const limit = SUBSCRIPTION_LIMITS[subscription.tier].skipsPerDay;
  const percentage = limit === Infinity ? 100 : (skipsRemaining / limit) * 100;

  return (
    <div className="skip-counter">
      <div className="skip-info">
        <span className="skip-label">Skips Today</span>
        <span className="skip-value">
          {skipsRemaining === Infinity ? '∞' : skipsRemaining}
          {limit !== Infinity && <span className="skip-total">/{limit}</span>}
        </span>
      </div>
      {limit !== Infinity && (
        <div className="skip-bar">
          <div className="skip-progress" style={{ width: `${percentage}%` }} />
        </div>
      )}
      {skipsRemaining <= 5 && subscription.tier === 'free' && (
        <button className="skip-upgrade" onClick={onUpgrade}>
          Get more skips →
        </button>
      )}
    </div>
  );
}
