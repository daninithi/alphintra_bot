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
    id: "market",
    name: "Market",
    icon: "solar:chart-line-duotone",
    url: "/marketplace",
  },
  {
    id: "ticketing",
    name: "Ticketing",
    icon:  "solar:ticket-line-duotone",
    url: "/ticketing",
  },
  {
    id: "support",
    name: "Support",
    icon: "solar:help-line-duotone",
    url: "/support",
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