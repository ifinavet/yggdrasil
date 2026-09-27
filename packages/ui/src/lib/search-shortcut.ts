const MAC_PLATFORM = /mac/i;

export function searchShortcutKeys(platform: string) {
	return MAC_PLATFORM.test(platform) ? ["⌘", "K"] : ["Ctrl", "K"];
}

export function currentPlatform() {
	const navigatorWithUserAgentData = navigator as Navigator & {
		userAgentData?: { platform: string };
	};
	return navigatorWithUserAgentData.userAgentData?.platform ?? navigator.platform;
}
