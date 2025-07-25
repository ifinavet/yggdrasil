"use client";

import { Scanner } from "@yudiel/react-qr-scanner";

export default function AttendeeScanner() {
  return (
    <Scanner onScan={result => console.log(result)} />
  );
}
