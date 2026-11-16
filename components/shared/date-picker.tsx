"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** A calendar day as "yyyy-MM-dd". The day is timezone-free; the caller decides which zone. */
const toDate = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};

interface DatePickerProps {
  id?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (day: string) => void;
  /** Adds a hidden input, so the picker works inside a plain GET form. */
  name?: string;
  placeholder?: string;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
}

export function DatePicker({
  id,
  value,
  defaultValue = "",
  onChange,
  name,
  placeholder = "Pick a date",
  ...aria
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(defaultValue);
  const day = value ?? internal;

  function select(date: Date | undefined) {
    const next = date ? format(date, "yyyy-MM-dd") : "";
    setInternal(next);
    onChange?.(next);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className="w-full justify-start font-normal"
          {...aria}
        >
          <CalendarIcon aria-hidden />
          {day ? (
            format(toDate(day), "EEE d MMM yyyy")
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={day ? toDate(day) : undefined}
          defaultMonth={day ? toDate(day) : undefined}
          onSelect={select}
        />
      </PopoverContent>
      {name && <input type="hidden" name={name} value={day} />}
    </Popover>
  );
}
