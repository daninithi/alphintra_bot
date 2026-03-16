"use client";
import { SidebarItemType } from "./types";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

interface Props {
  item: SidebarItemType;
  collapsed?: boolean;
}

const SidebarItem = ({ item, collapsed = false }: Props) => {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = pathname === item.url;
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <li
      className={`rounded-md transition ${
        isActive && item.id !== 'logout'
          ? "bg-gradient-to-r from-yellow-500/10 to-transparent border-l-4 border-yellow-500 text-yellow-500"
          : "hover:bg-gradient-to-r hover:from-yellow-500/10 hover:to-transparent hover:border-l-4 hover:border-yellow-500 hover:text-yellow-500"
      }`}
    >
      {item.id === 'logout' ? (
        <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-2 w-full text-left">
          <Icon icon={item.icon} width="20" />
          {!collapsed && <span className="text-[15px] font-semibold">{item.name}</span>}
        </button>
      ) : (
        <Link href={item.url} className="flex items-center gap-3 px-4 py-2 w-full">
          <Icon icon={item.icon} width="20" />
          {!collapsed && <span className="text-[15px] font-semibold">{item.name}</span>}
        </Link>
      )}
    </li>
  );
};

export default SidebarItem;
