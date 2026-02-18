"use client";
import { SidebarItemType } from "./types";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { usePathname, useRouter } from "next/navigation";
import { useSubscriptionModal } from "@/contexts/SubscriptionModalContext";
import { useAuth } from "@/components/auth/auth-provider";

interface Props {
  item: SidebarItemType;
  collapsed?: boolean;
}

const SidebarItem = ({ item, collapsed = false }: Props) => {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = pathname === item.url;
  const { openModal } = useSubscriptionModal();
  const { logout } = useAuth();

  const handleClick = (e: React.MouseEvent) => {
    if (item.isModal) {
      e.preventDefault();
      openModal();
    } else if (item.id === 'logout') {
      e.preventDefault();
      handleLogout();
    }
  };

  const handleLogout = () => {
    try {
      // Call the auth provider's logout to clear auth state
      logout();
      
      // Clear additional session data
      if (typeof window !== 'undefined') {
        localStorage.removeItem('alphintra_wallet_credentials');
        sessionStorage.clear();
        
        console.log('✅ User logged out successfully');
        
        // Redirect to home/login page
        router.push('/');
      }
    } catch (error) {
      console.error('Logout failed:', error);
      // Fallback: clear manually
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
        router.push('/');
      }
    }
  };

  return (
    <li
      className={`rounded-md transition ${
        isActive && !item.external && !item.isModal && item.id !== 'logout'
          ? "bg-gradient-to-r from-yellow-500/10 to-transparent border-l-4 border-yellow-500 text-yellow-500"
          : "hover:bg-gradient-to-r hover:from-yellow-500/10 hover:to-transparent hover:border-l-4 hover:border-yellow-500 hover:text-yellow-500"
      }`}
    >
      {item.external ? (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-2 w-full"
        >
          <Icon icon={item.icon} width="20" />
          {!collapsed && <span className="text-[15px] font-semibold">{item.name}</span>}
          {!collapsed && <Icon icon="solar:external-link-line-duotone" width="14" className="ml-auto opacity-60" />}
        </a>
      ) : item.isModal || item.id === 'logout' ? (
        <button
          onClick={handleClick}
          className="flex items-center gap-3 px-4 py-2 w-full text-left"
        >
          <Icon icon={item.icon} width="20" />
          {!collapsed && <span className="text-[15px] font-semibold">{item.name}</span>}
        </button>
      ) : (
        <Link
          href={item.url}
          className="flex items-center gap-3 px-4 py-2 w-full"
        >
          <Icon icon={item.icon} width="20" />
          {!collapsed && <span className="text-[15px] font-semibold">{item.name}</span>}
        </Link>
      )}
    </li>
  );
};

export default SidebarItem;