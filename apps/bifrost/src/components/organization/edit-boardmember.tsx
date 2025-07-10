"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@workspace/ui/components/button";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { boardMemberSchema } from "@/constants/schemas/boardmember-form-schema";
import { getBoardMember, updateBoardMember } from "@/lib/queries/organization";
import BoardMemberForm from "./board-member-form";

export default function EditBoardMember({
  className,
  organisationId,
}: {
  organisationId: number;
  className?: string;
}) {
  const { data: boardMember, isLoading } = useQuery({
    queryKey: ["boardMember", organisationId],
    queryFn: () => getBoardMember(organisationId),
    enabled: !!organisationId,
  });

  const [openDialog, setOpenDialog] = useState(false);

  const queryClient = useQueryClient();
  const { mutate } = useMutation({
    mutationKey: ["addBoardMember"],
    mutationFn: (data: boardMemberSchema) => updateBoardMember(organisationId, data),
    onSuccess: () => {
      toast.success("Styremedlemmet ble lagt til!");
      queryClient.invalidateQueries({ queryKey: ["boardMembers"] });
      queryClient.invalidateQueries({ queryKey: ["boardMember", organisationId] });
      setOpenDialog(false);
    },
    onError: (error) => {
      console.error(error);
      toast.error("Hmm... Det skjedde en feil. Prøv igjen senere.");
    },
  });

  const onSubmit = (data: boardMemberSchema) => {
    mutate(data);
  };

  if (isLoading)
    return (
      <Button variant='outline' size='sm' className={className} disabled>
        <Pencil /> Rediger
      </Button>
    );

  if (!boardMember)
    return (
      <Button variant='outline' size='sm' className={className} disabled>
        <Pencil /> Rediger
      </Button>
    );

  return (
    <BoardMemberForm
      defaultValues={{
        userID: boardMember.user_id,
        role: boardMember.position,
        group: boardMember.group_name,
      }}
      onSubmit={onSubmit}
      title='Rediger styremedlem'
      description='Gjør endringer på styremedlemet'
      openDialog={openDialog}
      setOpenDialog={setOpenDialog}
      button={
        <>
          <Pencil /> Rediger
        </>
      }
      className={className}
    />
  );
}
