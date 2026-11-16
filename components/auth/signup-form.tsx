"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { TextField } from "@/components/shared/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { api, errorMessage } from "@/lib/http/client";
import { signupSchema } from "@/lib/validators/auth";

export function SignupForm() {
  const router = useRouter();
  const form = useForm<z.input<typeof signupSchema>, unknown, z.output<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { businessName: "", name: "", email: "", password: "" },
  });

  async function onSubmit(values: z.output<typeof signupSchema>) {
    try {
      await api("/api/auth/signup", { body: values });
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Create your business account</CardTitle>
        <CardDescription>You&apos;ll be the owner and can add your team next.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <TextField
              control={form.control}
              name="businessName"
              label="Business name"
              autoComplete="organization"
            />
            <TextField control={form.control} name="name" label="Your name" autoComplete="name" />
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
              label="Password (at least 8 characters)"
              type="password"
              autoComplete="new-password"
            />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Creating account..." : "Create account"}
            </Button>
          </FieldGroup>
        </form>
        <p className="text-muted-foreground mt-4 text-center text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-foreground underline">
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
