"use client";
import { Button } from "@/components/ui/button";

export function TryAgain() {
  return (
    <Button onClick={() => window.location.reload()} style={{ marginTop: 24 }}>
      Try again
    </Button>
  );
}
