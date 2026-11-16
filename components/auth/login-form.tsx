"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { DemoButtons } from "@/components/auth/demo-buttons";
import { TextField } from "@/components/shared/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup, FieldSeparator } from "@/components/ui/field";
import { homeFor } from "@/lib/auth/route-access";
import { api, errorMessage } from "@/lib/http/client";
import type { UserDto } from "@/lib/services/auth";
import { loginSchema } from "@/lib/validators/auth";

export function LoginForm() {
  const router = useRouter();
  const form = useForm<z.input<typeof loginSchema>, unknown, z.output<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: z.output<typeof loginSchema>) {
    try {
      const { user } = await api<{ user: UserDto }>("/api/auth/login", { body: values });
      router.replace(homeFor(user.role));
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Log in to FieldOps</CardTitle>
        <CardDescription>Enter your email and password.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 space-y-2">
          <p className="text-muted-foreground text-sm">Just looking? Try the demo business:</p>
          <DemoButtons />
        </div>
        <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card mb-4">
          or log in
        </FieldSeparator>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <TextField
              control={form.control}
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
            />
            <TextField
              control={form.control}
              name="password"
              label="Password"
              type="password"
              autoComplete="current-password"
            />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Logging in..." : "Log in"}
            </Button>
          </FieldGroup>
        </form>
        <p className="text-muted-foreground mt-4 text-center text-sm">
          New to FieldOps?{" "}
          <Link href="/signup" className="text-foreground underline">
            Create a business account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
