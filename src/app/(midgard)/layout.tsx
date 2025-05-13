export default async function Layout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <main className='flex flex-col items-center'>
                <div className='flex flex-col gap-20 max-w-5xl p-5'>{children}</div>
            </main>
            <footer className='w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16'>
                <div>
                    <h2>IFI-Navet</h2>
                    <p>Postboks 1080 Blindern</p>
                    <p>Institutt for informatikk</p>
                    <p>0316 Oslo, Norway </p>
                </div>
            </footer>
        </>
    );
}
