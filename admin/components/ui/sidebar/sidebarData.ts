// components/sidebar/sidebarData.ts

import { SidebarItemType } from "./types";

export const mainSidebarItems: SidebarItemType[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    icon: "solar:widget-add-line-duotone",
    url: "/dashboard",
  },
  {
    id: "users",
    name: "Users",
    icon: "solar:user-line-duotone",
    url: "/users",
  },
  {
    id: "strategies",
    name: "Strategies",
    icon: "solar:target-line-duotone",
    url: "/strategies",
  },
    {
    id: "market",
    name: "Market",
    icon: "solar:chart-line-duotone",
    url: "/trades",
  },
  {
    id: "support",
    name: "Support Team",
    icon: "solar:help-line-duotone",
    url: "/support",
  },
    {
    id: "Ticketing",
    name: "Ticketing",
    icon: "solar:ticket-line-duotone",
      url: "/ticketing",
  },
  {
    id: "system-health",
    name: "System Monitoring",
    icon: "solar:shield-check-line-duotone",
    url: "/system-health",
  },
];

export const footerSidebarItems: SidebarItemType[] = [
  {
    id: "settings",
    name: "Settings",
    icon: "solar:settings-line-duotone",
    url: "/profile",
  },
  {
    id: "logout",
    name: "Logout",
    icon: "solar:logout-line-duotone",
    url: "/",
  },
];