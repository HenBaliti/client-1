import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { UserSubscription, SubscriptionTier } from '../types/subscription';
import { SUBSCRIPTION_PLANS } from '../types/subscription';

interface AccountPageProps {
  subscription: UserSubscription;
  onUpdateSubscription: (tier: SubscriptionTier) => void;
  onBack: () => void;
}

type Tab = 'profile' | 'subscription' | 'security';

export function AccountPage({ subscription, onUpdateSubscription, onBack }: AccountPageProps) {
  const { user, updateProfile, deleteAccount, logout, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!user) return null;

  const handleSaveProfile = async () => {
    try {
      await updateProfile({ displayName });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      // Error handled by context
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount();
      onBack();
    } catch {
      // Error handled by context
    }
  };

  const handleCancelSubscription = () => {
    onUpdateSubscription('free');
  };

  return (
    <div className="account-page">
      <header className="account-header">
        <button className="back-button" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1>Account Settings</h1>
      </header>

      <div className="account-content">
        <nav className="account-nav">
          <button
            className={`nav-tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Profile
          </button>
          <button
            className={`nav-tab ${activeTab === 'subscription' ? 'active' : ''}`}
            onClick={() => setActiveTab('subscription')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Subscription
          </button>
          <button
            className={`nav-tab ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            Security
          </button>
        </nav>

        <div className="account-panel">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="profile-section">
              <h2>Profile Information</h2>
              
              <div className="profile-avatar">
                {user.photoUrl ? (
                  <img src={user.photoUrl} alt={user.displayName} />
                ) : (
                  <div className="avatar-placeholder">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="avatar-info">
                  <h3>{user.displayName}</h3>
                  <p>{user.email}</p>
                  {user.provider === 'google' && (
                    <span className="provider-badge">
                      <svg viewBox="0 0 24 24" width="14" height="14">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Google Account
                    </span>
                  )}
                </div>
              </div>

              <div className="form-section">
                <div className="form-group">
                  <label htmlFor="profile-name">Display Name</label>
                  <input
                    id="profile-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your display name"
                  />
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    className="disabled"
                  />
                  <span className="form-hint">Email cannot be changed</span>
                </div>

                <button 
                  className="save-btn"
                  onClick={handleSaveProfile}
                  disabled={isLoading || displayName === user.displayName}
                >
                  {isLoading ? 'Saving...' : saveSuccess ? '✓ Saved!' : 'Save Changes'}
                </button>
              </div>

              <div className="account-stats">
                <div className="stat-item">
                  <span className="stat-label">Member Since</span>
                  <span className="stat-value">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Account Type</span>
                  <span className={`stat-value tier-${subscription.tier}`}>
                    {subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Subscription Tab */}
          {activeTab === 'subscription' && (
            <div className="subscription-section">
              <h2>Subscription Management</h2>

              <div className="current-plan">
                <div className="plan-info">
                  <h3>Current Plan</h3>
                  <div className={`plan-badge tier-${subscription.tier}`}>
                    {subscription.tier === 'free' && '🆓 Free'}
                    {subscription.tier === 'premium' && '⭐ Premium'}
                    {subscription.tier === 'vip' && '👑 VIP'}
                  </div>
                </div>
                {subscription.tier !== 'free' && subscription.expiresAt && (
                  <div className="renewal-info">
                    <p>
                      Next billing date:{' '}
                      <strong>{new Date(subscription.expiresAt).toLocaleDateString()}</strong>
                    </p>
                  </div>
                )}
              </div>

              <div className="plans-list">
                {SUBSCRIPTION_PLANS.map((plan) => (
                  <div
                    key={plan.id}
                    className={`plan-option ${subscription.tier === plan.id ? 'current' : ''}`}
                  >
                    <div className="plan-header">
                      <h4>{plan.name}</h4>
                      <div className="plan-price">
                        {plan.price === 0 ? 'Free' : `$${plan.price}/mo`}
                      </div>
                    </div>
                    <ul className="plan-features-list">
                      {plan.features.slice(0, 4).map((feature, idx) => (
                        <li key={idx}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {subscription.tier === plan.id ? (
                      <button className="plan-btn current" disabled>
                        Current Plan
                      </button>
                    ) : plan.id === 'free' ? (
                      <button
                        className="plan-btn downgrade"
                        onClick={handleCancelSubscription}
                      >
                        Downgrade
                      </button>
                    ) : (
                      <button
                        className="plan-btn upgrade"
                        onClick={() => onUpdateSubscription(plan.id)}
                      >
                        Upgrade
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {subscription.tier !== 'free' && (
                <div className="cancel-section">
                  <h3>Cancel Subscription</h3>
                  <p>
                    If you cancel, you'll still have access to premium features until{' '}
                    {subscription.expiresAt
                      ? new Date(subscription.expiresAt).toLocaleDateString()
                      : 'the end of your billing period'}
                    .
                  </p>
                  <button className="cancel-btn" onClick={handleCancelSubscription}>
                    Cancel Subscription
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="security-section">
              <h2>Security & Privacy</h2>

              <div className="security-item">
                <div className="security-info">
                  <h3>Password</h3>
                  <p>
                    {user.provider === 'google'
                      ? 'You signed up with Google. No password is set.'
                      : 'Change your account password'}
                  </p>
                </div>
                {user.provider === 'email' && (
                  <button className="security-btn">Change Password</button>
                )}
              </div>

              <div className="security-item">
                <div className="security-info">
                  <h3>Email Verification</h3>
                  <p>
                    {user.emailVerified
                      ? 'Your email is verified'
                      : 'Verify your email for enhanced security'}
                  </p>
                </div>
                {!user.emailVerified && (
                  <button className="security-btn">Send Verification</button>
                )}
                {user.emailVerified && (
                  <span className="verified-badge">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    Verified
                  </span>
                )}
              </div>

              <div className="security-item">
                <div className="security-info">
                  <h3>Active Sessions</h3>
                  <p>Manage devices that are logged into your account</p>
                </div>
                <button className="security-btn">View Sessions</button>
              </div>

              <div className="danger-zone">
                <h3>Danger Zone</h3>
                
                <div className="danger-item">
                  <div className="danger-info">
                    <h4>Log Out</h4>
                    <p>Sign out of your account on this device</p>
                  </div>
                  <button className="logout-btn" onClick={logout}>
                    Log Out
                  </button>
                </div>

                <div className="danger-item">
                  <div className="danger-info">
                    <h4>Delete Account</h4>
                    <p>Permanently delete your account and all data</p>
                  </div>
                  <button
                    className="delete-btn"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon danger">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3>Delete Account?</h3>
            <p>
              This action cannot be undone. All your data, subscription, and chat history
              will be permanently deleted.
            </p>
            <div className="confirm-actions">
              <button
                className="modal-btn secondary"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="modal-btn danger"
                onClick={handleDeleteAccount}
                disabled={isLoading}
              >
                {isLoading ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
