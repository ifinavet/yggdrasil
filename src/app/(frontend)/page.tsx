import Link from "next/link";

export default async function Home() {
    return (
        <>
            <main className='flex-1 flex flex-col gap-6 px-4'>
                <h1>Welcome to Navet</h1>
                <Link href='/sign-in'>Logg inn</Link>
            </main>
        </>
    );
}
