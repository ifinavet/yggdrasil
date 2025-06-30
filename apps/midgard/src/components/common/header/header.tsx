"use client";

import { useIsMobile } from "@workspace/ui/hooks/use-mobile";
import DesktopHeader from "./desktop";
import MobileHeader from "./mobile";

export default function Header() {
  const isMobile = useIsMobile();

  return isMobile ? <MobileHeader /> : <DesktopHeader />;
}
