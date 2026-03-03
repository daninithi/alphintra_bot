'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProfileCard from '@/components/ui/profile/profileCard';
import { ChangePasswordModal } from '@/components/ui/profile/ChangePasswordModal';
import { useAuth } from '@/components/auth/auth-provider';
import { authServiceApiClient } from '@/lib/api/auth-service-api';

interface AdminUser {
  id: string;
  email: string;
  username: string;
  role: 'ADMIN';
  createdAt?: string;
  updatedAt?: string;
}

export default function AdminProfile() {
  const router = useRouter();
  const { user: authUser, logout } = useAuth();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [username, setUsername] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);

  useEffect(() => {
    if (authUser) {
      const adminUser: AdminUser = {
        id: authUser.id,
        email: authUser.email,
        username: authUser.username || '',
        role: 'ADMIN',
        createdAt: authUser.createdAt,
        updatedAt: authUser.updatedAt
      };
      setUser(adminUser);
      setUsername(adminUser.username);
    }
  }, [authUser]);

  const profileName = user ? user.username : 'Admin User';

  const handleUpdateProfile = () => {
    if (user) {
      const updatedUser = {
        ...user,
        username,
      };
      setUser(updatedUser);
      
      const storedUser = localStorage.getItem('alphintra_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        localStorage.setItem('alphintra_user', JSON.stringify({
          ...parsed,
          username
        }));
      }
      
      setIsEditingProfile(false);
      alert('Profile updated successfully!');
    }
  };

  const handleCancelEdit = () => {
    setUsername(user?.username || '');
    setIsEditingProfile(false);
  };

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
      
      // Clear all localStorage and logout
      localStorage.clear();
      logout();
      router.push('/');
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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-foreground text-xl">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <ProfileCard avatarUrl={null} nickname={profileName} />
      <div className="mt-6 bg-card border border-border rounded-xl p-6 shadow-sm">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">Profile Information</h2>
            {!isEditingProfile && (
              <button onClick={() => setIsEditingProfile(true)} className="px-4 py-2 text-sm font-medium bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors">
                Edit Profile
              </button>
            )}
          </div>
          {isEditingProfile ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Username</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-foreground" placeholder="Enter username" />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={handleCancelEdit} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors">Cancel</button>
                <button onClick={handleUpdateProfile} className="px-4 py-2 text-sm font-medium bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors">Save Changes</button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1"><dt className="text-sm font-medium text-muted-foreground">Email</dt><dd className="text-base text-foreground">{user.email}</dd></div>
              <div className="space-y-1"><dt className="text-sm font-medium text-muted-foreground">Username</dt><dd className="text-base text-foreground">{user.username}</dd></div>
              <div className="space-y-1"><dt className="text-sm font-medium text-muted-foreground">Role</dt><dd className="text-base text-foreground"><span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-sm font-medium">{user.role}</span></dd></div>
              {user.createdAt && (<div className="space-y-1"><dt className="text-sm font-medium text-muted-foreground">Member Since</dt><dd className="text-base text-foreground">{new Date(user.createdAt).toLocaleDateString()}</dd></div>)}
            </div>
          )}
        </section>
        <section className="mt-8 pt-6 border-t border-border space-y-4">
          <h2 className="text-xl font-bold text-foreground">Security</h2>
          <div className="rounded-lg border border-border bg-muted/10 p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground">Change Password</h3>
                <p className="text-sm text-muted-foreground">Update your password to keep your account secure</p>
              </div>
              <button onClick={() => setShowChangePassword(true)} className="px-4 py-2 text-sm font-medium bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors">Change Password</button>
            </div>
          </div>
        </section>
        <section className="mt-8 pt-6 border-t border-border space-y-4">
          <h2 className="text-xl font-bold text-red-500">Danger Zone</h2>
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1"><h3 className="font-semibold text-foreground">Delete Account</h3><p className="text-sm text-muted-foreground">Permanently delete your admin account and all associated data</p></div>
              <button onClick={handleDeleteAccount} className="px-4 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">Delete Account</button>
            </div>
          </div>
        </section>
      </div>
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        onSubmit={handleChangePassword}
      />
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full space-y-4">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground">Delete Account?</h3>
              <p className="text-sm text-muted-foreground">This action cannot be undone. All your admin data will be permanently deleted.</p>
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
              <button onClick={cancelDeleteAccount} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors">Cancel</button>
              <button onClick={confirmDeleteAccount} className="px-4 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">Yes, Delete My Account</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
