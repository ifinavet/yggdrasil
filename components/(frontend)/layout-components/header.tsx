import Link from "next/link";

export default function Header() {
    return (
        <header className="flex-col items-center justify-center w-full px-4 py-2 bg-gray-800 text-white">
            <h1 className="text-2xl font-bold">Navet</h1>
            <nav>
                <ul className="flex space-x-4">
                    <li>
                        <Link href="/" className="hover:text-gray-400">Arrangementer</Link>
                    </li>
                    <li>
                        <Link href="/" className="hover:text-gray-400">Stillingsanonse</Link>
                    </li>
                    <li>
                        <Link href="/" className="hover:text-gray-400">For bedrifter</Link>
                    </li>
                    <li>
                        <Link href="/" className="hover:text-gray-400">For studenter</Link>
                    </li>
                    <li>
                        <Link href="/" className="hover:text-gray-400">For bedrifter</Link>
                    </li>
                </ul>
            </nav>
        </header>);
}