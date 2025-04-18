import Header from "@/components/(frontend)/layout-components/header";

export default async function Home() {
    return (
        <>
            <Header />
            <main className="flex-1 flex flex-col gap-6 px-4">
                <h1>Welcome to Navet</h1>
            </main>
        </>
    );
}
