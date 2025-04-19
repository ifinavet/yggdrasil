import {cookies} from "next/headers";
import {NextResponse} from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get("url");

    if (imageUrl) {
        (await cookies()).set("profileImageUrl", imageUrl, {
            maxAge: 3600,
            path: "/",
        });
    }

    return NextResponse.json({ success: true });
}
