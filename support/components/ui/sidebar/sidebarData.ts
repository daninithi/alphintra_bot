// components/sidebar/sidebarData.ts

import { SidebarItemType } from "./types";

export const mainSidebarItems: SidebarItemType[] = [
  {
    id: "ticketing",
    name: "Ticketing",
    icon:  "solar:ticket-line-duotone",
    url: "/ticketing",
  },

];

export const footerSidebarItems: SidebarItemType[] = [
  // {
  //   id: "settings",
  //   name: "Settings",
  //   icon: "solar:settings-line-duotone",
  //   url: "/profile",
  // },
  {
    id: "logout",
    name: "Logout",
    icon: "solar:logout-line-duotone",
    url: "/",
  },
];