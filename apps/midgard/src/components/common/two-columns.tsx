export default function TwoColumns({
	main,
	aside,
}: {
	main: React.ReactNode;
	aside: React.ReactNode;
}) {
	return (
		<div className='grid grid-cols-1 gap-6 md:grid-cols-5'>
			<main className='gap-4 md:col-span-3'>{main}</main>
			<aside className='md:col-span-2'>{aside}</aside>
		</div>
	);
}
