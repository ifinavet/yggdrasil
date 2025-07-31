"use client";

import { api } from "@workspace/backend/convex/api";
import { useMutation } from "convex/react";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { boardMemberSchema } from "@/constants/schemas/boardmember-form-schema";
import BoardMemberForm from "./board-member-form";

export default function AddBoardMember({ className }: { className?: string }) {
  const defaultValues = {
    userID: "",
    role: "",
    group: "",
  };

  const [openDialog, setOpenDialog] = useState(false);

  const createBoardMember = useMutation(api.internals.createBoardMember);
  const onSubmit = (data: boardMemberSchema) => {
    createBoardMember({
      externalId: data.userID,
      position: data.role,
      group: data.group,
      positionEmail: data.positionEmail,
    }).then(() => {
      toast.success("Styremedlemmet ble lagt til!");
      setOpenDialog(false);
    }).catch(error => {
      console.error(error);
      toast.error("Hmm... Det skjedde en feil. Prøv igjen senere.");
    })
  };

  return (
    <BoardMemberForm
      defaultValues={defaultValues}
      onSubmitAction={onSubmit}
      title='Legg til et nytt styremedlem'
      description='Velg et medlem som skal være det nye styremedlemet, og hva rollen skal være, samt hva gruppen deres heter.'
      openDialog={openDialog}
      setOpenDialogAction={setOpenDialog}
      button={
        <>
          <Plus /> Legg til nytt styremedlem
        </>
      }
      className={className}
    />
  );
}
