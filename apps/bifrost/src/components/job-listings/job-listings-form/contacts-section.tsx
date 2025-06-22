"use client";

import { Button } from "@workspace/ui/components//button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components//form";
import { Input } from "@workspace/ui/components//input";
import { useCallback, useMemo, useState } from "react";
import type { Control } from "react-hook-form";
import { toast } from "sonner";
import type { JobListingFormValues } from "@/constants/schemas/job-listing-form-schema";
import { createColumns, type JobListingContact } from "../job-listing-contacts-table/columns";
import { ContactsTable } from "../job-listing-contacts-table/contacts-table";

interface ContactsSectionProps {
  control: Control<JobListingFormValues>;
  contacts: JobListingFormValues["contacts"];
  onContactsChangeAction: (contacts: JobListingFormValues["contacts"]) => void;
}

export default function ContactsSection({
  control,
  contacts,
  onContactsChangeAction,
}: ContactsSectionProps) {
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const contactsData: JobListingContact[] = useMemo(
    () =>
      contacts.map((contact) => ({
        name: contact.name,
        email: contact.email || "",
        phone: contact.phone || "",
      })),
    [contacts],
  );

  const addContact = () => {
    if (!contactName.trim()) {
      toast.error("Navn på kontaktpersonen er påkrevd");
      return;
    }

    if (!contactEmail.trim() && !contactPhone.trim()) {
      toast.error("Enten e-post eller telefon til kontaktpersonen må fylles ut");
      return;
    }

    const newContact = {
      name: contactName,
      email: contactEmail,
      phone: contactPhone,
    };

    onContactsChangeAction([...contacts, newContact]);

    // Reset form fields
    setContactName("");
    setContactEmail("");
    setContactPhone("");
  };

  const deleteContact = useCallback(
    (index: number) => {
      const updatedContacts = contacts.filter((_, i) => i !== index);
      onContactsChangeAction(updatedContacts);
    },
    [contacts, onContactsChangeAction],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addContact();
    }
  };

  const columns = useMemo(() => createColumns(deleteContact), [deleteContact]);

  return (
    <FormField
      control={control}
      name='contacts'
      render={() => (
        <FormItem>
          <FormLabel>Kontakter</FormLabel>
          <FormControl>
            <div className='flex flex-col gap-4'>
              <div className='flex gap-4'>
                <Input
                  placeholder='eks. Ole Hansen'
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <Input
                  type='email'
                  placeholder='eks. ole@hansen.no'
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <Input
                  type='tel'
                  placeholder='eks. +47 123 456 789'
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <Button type='button' onClick={addContact}>
                  Legg til
                </Button>
              </div>
              <ContactsTable columns={columns} data={contactsData} />
            </div>
          </FormControl>
          <FormDescription>Dette er en liste over kontakter for stillingsannonsen.</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
