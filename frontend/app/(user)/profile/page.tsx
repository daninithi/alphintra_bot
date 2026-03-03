'use client';

import { useEffect, useMemo, useState } from 'react';
import ProfileCard from '@/components/ui/user/profile/profileCard';
import { ChangePasswordModal } from '@/components/ui/user/profile/ChangePasswordModal';
import { authServiceApiClient } from '@/lib/api/auth-service-api';

const USER_STORAGE_KEY = 'alphintra_jwt_user';

interface StoredUser {
  id: number;
  email: string;
  username?: string | null;
  roles?: string[];
  role?: string;
}

export default function Profile() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedUser = localStorage.getItem(USER_STORAGE_KEY);
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as StoredUser;
        setUser(parsedUser);
      } catch (error) {
        console.warn('Failed to parse stored user', error);
        setUser(null);
      }
    }
  }, []);

  const profileName = useMemo(() => {
    if (!user) return 'Guest Trader';
    return user.username || user.email.split('@')[0] || 'Alphintra User';
  }, [user]);

  const handleChangePassword = async (currentPassword: string, newPassword: string) => {
    await authServiceApiClient.changePassword({
      currentPassword,
      newPassword
    });
    alert('Password changed successfully!');
  };

  const handleDeleteAccount = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteAccount = async () => {
    if (!user) return;
    setDeleteError('');

    if (!deletePassword) {
      setDeleteError('Password is required to delete your account');
      return;
    }

    try {
      await authServiceApiClient.deleteAccount({
        email: user.email,
        password: deletePassword
      });
      
      console.log('✅ Account deleted successfully');
      
      // Clear all localStorage and redirect to landing page
      localStorage.clear();
      window.location.href = '/';
    } catch (error: any) {
      console.error('❌ Failed to delete account:', error);
      const errorMsg = error.response?.data?.error || 'Failed to delete account. Please try again.';
      setDeleteError(errorMsg);
    }
  };

  const cancelDeleteAccount = () => {
    setShowDeleteConfirm(false);
    setDeletePassword('');
    setDeleteError('');
    setShowDeletePassword(false);
  };

  return (
    <div className="min-h-screen flex flex-col gap-6 px-4 py-6 md:px-8 lg:px-14">
      <ProfileCard
        avatarUrl={null}
        nickname={profileName}
      />

      <div className="md:rounded-3xl rounded-2xl border border-border bg-card p-6 md:ml-4 md:mr-7 mx-6 space-y-6">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Profile Details</h2>
          {user && (
            <div className="rounded-xl border border-muted/40 bg-muted/10 p-4">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-foreground">Email</dt>
                  <dd className="text-muted-foreground">{user.email}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Username</dt>
                  <dd className="text-muted-foreground">{user.username || '—'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Role</dt>
                  <dd className="text-muted-foreground">
                    <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-xs font-medium">
                      {user.role || 'USER'}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </section>

        {/* Security Section */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Security</h2>
          <div className="rounded-xl border border-muted/40 bg-muted/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground">Password</h3>
                <p className="text-sm text-muted-foreground">
                  Reset your password to secure your account
                </p>
              </div>
              <button
                onClick={() => setShowChangePassword(true)}
                className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                Change Password
              </button>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-red-500">Danger Zone</h2>
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground">Delete Account</h3>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <button
                onClick={handleDeleteAccount}
                className="px-4 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                Delete Account
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        onSubmit={handleChangePassword}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full space-y-4">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground">Delete Account?</h3>
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. All your data, including trading history, bots, and wallet connections will be permanently deleted.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Enter your password to confirm
              </label>
              <div className="relative">
                <input
                  type={showDeletePassword ? "text" : "password"}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-foreground"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowDeletePassword(!showDeletePassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showDeletePassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 bg-red-500/10 border border-red-500/40 rounded-lg">
                <p className="text-sm text-red-500">{deleteError}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDeleteAccount}
                className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteAccount}
                className="px-4 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                Yes, Delete My Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
