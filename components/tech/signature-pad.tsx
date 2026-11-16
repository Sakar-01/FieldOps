"use client";

import { PenLineIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { toast } from "sonner";
import { showApiError } from "@/components/shared/show-api-error";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { api } from "@/lib/http/client";
import { uploadImage } from "@/lib/uploads/client";

/** FR-FILE-02: the customer signs on the phone; it is uploaded as a PNG. */
export function SignaturePad({ jobId, signed }: { jobId: string; signed: boolean }) {
  const router = useRouter();
  const pad = useRef<SignatureCanvas>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    const canvas = pad.current;
    if (!canvas || canvas.isEmpty()) {
      toast.error("Ask the customer to sign first");
      return;
    }
    setSaving(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas
          .getCanvas()
          .toBlob(
            (b) => (b ? resolve(b) : reject(new Error("Couldn't read the signature"))),
            "image/png",
          ),
      );
      const { key } = await uploadImage(jobId, "signature", blob);
      await api(`/api/jobs/${jobId}/signature`, { method: "PUT", body: { key } });
      toast.success("Signature saved");
      setOpen(false);
      router.refresh();
    } catch (error) {
      showApiError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="lg" className="min-h-11 w-full">
          <PenLineIcon /> {signed ? "Capture signature again" : "Capture customer signature"}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90svh]">
        <SheetHeader>
          <SheetTitle>Customer signature</SheetTitle>
          <SheetDescription>Hand the phone to the customer to sign below.</SheetDescription>
        </SheetHeader>
        <div className="px-4">
          {/* White in both themes, so the saved PNG is dark ink on white. */}
          <SignatureCanvas
            ref={pad}
            penColor="#111827"
            backgroundColor="#ffffff"
            canvasProps={{
              className: "h-56 w-full touch-none rounded-md border bg-white",
              "aria-label": "Signature area",
            }}
          />
        </div>
        <SheetFooter className="flex-row gap-2">
          <Button
            variant="outline"
            size="lg"
            className="min-h-11 flex-1"
            onClick={() => pad.current?.clear()}
          >
            Clear
          </Button>
          <Button size="lg" className="min-h-11 flex-1" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save signature"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
