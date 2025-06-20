"use client";

import { getCompanyImage } from "@/lib/queries/bifrost/company/getCompanyImage";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";

export default function EditCompanyForm({
  company_id,
}: {
  company_id: number;
}) {
  const { data: company_image } = useQuery({
    queryKey: ["company_image", company_id],
    queryFn: () => getCompanyImage(company_id),
  });

  console.log(company_image);

  if (!company_image) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Edit Company Form</h1>
      <Image
        src={company_image.publicUrl}
        alt="Company Logo"
        width={100}
        height={100}
        className="w-auto h-auto"
      />
    </div>
  );
}
