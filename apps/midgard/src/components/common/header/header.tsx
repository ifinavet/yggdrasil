import DesktopHeader from "./desktop";
import MobileHeader from "./mobile";

export default async function Header() {
	return (
		<>
			<MobileHeader className='md:hidden' />
			<DesktopHeader className='hidden md:grid' />
		</>
	);
}
