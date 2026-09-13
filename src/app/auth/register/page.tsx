"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, ArrowLeft } from "lucide-react";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  username: z.string().min(3, "Username must be at least 3 characters").max(30).regex(/^[a-z0-9_-]+$/, "Only lowercase letters, numbers, hyphens, underscores"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(data: z.infer<typeof registerSchema>) {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || "Registration failed");
        return;
      }

      // Auto sign in after registration
      const signInResult = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (signInResult?.error) {
        toast.error("Registered but could not sign in. Please login manually.");
        router.push("/auth/login");
      } else {
        toast.success("Account created! Let's set up your profile.");
        router.push("/auth/onboarding");
        router.refresh();
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen relative">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-b from-ink-900/[0.06] to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 md:px-24 relative z-10">
        <Link href="/" className="absolute top-8 left-8 flex items-center gap-2 text-sm text-text-secondary hover:text-ink-900 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <Link href="/" className="absolute top-8 right-8 flex items-center gap-2 font-bold text-sm tracking-tight font-display">
          <div className="w-7 h-7 rounded-[var(--r-sm)] bg-ink-900 flex items-center justify-center">
            <Zap className="h-3.5 w-3.5 text-paper-0" />
          </div>
          IdeaSpace
        </Link>

        <div className="max-w-[400px] w-full mx-auto">
          <div className="mb-10 text-center">
            <div className="w-14 h-14 rounded-[var(--r-md)] bg-ink-900 flex items-center justify-center mx-auto mb-6">
              <Zap className="h-7 w-7 text-paper-0" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-ink-900 mb-2 font-display">Create Account</h1>
            <p className="text-text-secondary">Join the campus innovation platform</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              {...register("name")}
              label="Full Name"
              placeholder="Harshith Kumar"
              error={!!errors.name}
              helperText={errors.name?.message}
            />
            <Input
              {...register("email")}
              label="College Email"
              type="email"
              placeholder="rollnumber@lendi.org"
              error={!!errors.email}
              helperText={errors.email?.message}
            />
            <Input
              {...register("username")}
              label="Username"
              placeholder="harshith"
              error={!!errors.username}
              helperText={errors.username?.message}
            />
            <Input
              {...register("password")}
              label="Password"
              type="password"
              placeholder="••••••••"
              error={!!errors.password}
              helperText={errors.password?.message}
            />

            <Button type="submit" className="w-full mt-6 h-11" variant="gradient" loading={isLoading}>
              Create Account
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-text-muted">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-medium text-stamp-verified hover:text-stamp-verified transition-colors">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
