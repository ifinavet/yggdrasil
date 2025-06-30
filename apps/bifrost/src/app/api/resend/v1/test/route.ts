import { EmailTemplate } from "@workspace/ui/components/emails/test";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST() {
  try {
    const { data, error } = await resend.emails.send({
      from: "IFI-Navet <styret@ifinavet.no>",
      to: ["chrisihe@uio.no"],
      subject: "Test mail",
      react: EmailTemplate({ firstName: "Chstoffer" }),
    });

    if (error) {
      return Response.json({ error }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    return Response.json({ error }, { status: 500 });
  }
}
