"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RequestAccessModal } from "@/components/auth/RequestAccessModal";
import {
  GitBranch,
  Mail,
  ArrowRight,
  ShieldCheck,
  Globe,
  Sparkles,
  Lock,
  UserCheck,
  HelpCircle,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { toast } from "@/components/ui/ToastSystem";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [showGoogleDevModal, setShowGoogleDevModal] = useState(false);
  const [isRequestAccessOpen, setIsRequestAccessOpen] = useState(false);
  const [requestAccessEmail, setRequestAccessEmail] = useState("");
  const [requestAccessName, setRequestAccessName] = useState("");
  const [googleDevEmail, setGoogleDevEmail] = useState("");
  const router = useRouter();

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading("credentials");
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Sign in failed", result.error);
        return;
      }

      router.push("/dashboard");
    } catch {
      toast.error("Error", "Failed to sign in");
    } finally {
      setLoading(null);
    }
  };

  const handleGitHubLogin = async () => {
    setLoading("github");
    try {
      await signIn("github", { callbackUrl: "/dashboard" });
    } catch {
      toast.error("Error", "GitHub login failed");
      setLoading(null);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading("google");
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch {
      toast.error("Error", "Google login failed");
      setLoading(null);
    }
  };

  const handleGoogleDevSubmit = async (testEmail: string) => {
    setLoading("google-dev");
    try {
      const result = await signIn("google-dev", {
        email: testEmail,
        redirect: false,
      });

      if (result?.error) {
        if (result.error.startsWith("ACCESS_REQUIRED:")) {
          const parts = result.error.split(":");
          const targetEmail = parts[1] || testEmail;
          const targetName = parts[2] || "";
          toast.error("Access Required", "This email is not registered in the roster or dumped forms. Please request access.");
          setRequestAccessEmail(targetEmail);
          setRequestAccessName(targetName);
          setShowGoogleDevModal(false);
          setIsRequestAccessOpen(true);
          return;
        }

        toast.error("Sign in error", result.error);
        return;
      }

      toast.success("Welcome!", "Recognized via dumped form/roster. Automatic login successful!");
      router.push("/dashboard");
    } catch {
      toast.error("Error", "Simulation failed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-paper-0 flex flex-col items-center justify-center p-6 relative">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-surface-raised border border-rule mb-4 shadow-xl">
            <ShieldCheck className="h-8 w-8 text-stamp-verified" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary font-display">Welcome Back</h1>
          <p className="text-text-secondary mt-2 text-sm">Sign in to IdeaSpace with Google or institutional credentials.</p>
        </div>

        <Card variant="glass" className="p-8">
          <div className="flex flex-col gap-3 mb-6">
            <Button
              variant="secondary"
              className="w-full h-12 gap-3 font-bold hover:bg-surface-overlay transition-all"
              onClick={handleGoogleLogin}
              disabled={loading !== null}
            >
              <Globe className="h-5 w-5 text-[#4285F4]" />
              {loading === "google" ? "Redirecting to Google..." : "Sign in with Google"}
            </Button>

            <Button
              variant="secondary"
              className="w-full h-12 gap-3 font-bold hover:bg-surface-overlay transition-all"
              onClick={handleGitHubLogin}
              disabled={loading !== null}
            >
              <GitBranch className="h-5 w-5" />
              {loading === "github" ? "Connecting..." : "Sign in with GitHub"}
            </Button>

            {/* Dev Google Simulation helper */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowGoogleDevModal(true)}
                className="w-full py-2 px-3 rounded-lg border border-dashed border-rule text-xs text-text-muted hover:text-stamp-verified hover:border-stamp-verified/50 flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Test Google OAuth (Auto-login vs Request Access)</span>
              </button>
            </div>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-rule"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-paper-0 px-2 text-text-muted font-bold tracking-widest">Or password sign in</span>
            </div>
          </div>

          {/* Credentials Login */}
          <form onSubmit={handleCredentialsLogin} className="space-y-4">
            <Input
              label="Institutional Email"
              type="email"
              placeholder="name@lendi.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              icon={<Mail className="h-4 w-4" />}
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              icon={<Lock className="h-4 w-4" />}
            />

            <Button
              variant="gradient"
              className="w-full h-12 font-bold mt-2"
              type="submit"
              disabled={loading !== null}
            >
              {loading === "credentials" ? (
                "Signing In..."
              ) : (
                <>
                  Sign In <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </Card>

        <div className="text-center mt-6 space-y-2 text-sm text-text-muted">
          <p>
            Email not registered or from an unlisted domain?{" "}
            <button type="button" onClick={() => setIsRequestAccessOpen(true)} className="text-stamp-verified font-bold hover:underline bg-transparent border-none p-0 cursor-pointer">
              Request Access from Admin
            </button>
          </p>
          <p className="text-xs">
            Admin or student with institutional email?{" "}
            <Link href="/auth/register" className="text-text-primary font-semibold hover:underline">
              Create Account
            </Link>
          </p>
        </div>

        <div className="mt-10 flex items-center justify-center gap-6 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">LIET Innovation Platform</div>
        </div>
      </motion.div>

      {/* Google Dev Simulation Modal */}
      <AnimatePresence>
        {showGoogleDevModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-paper-0 border border-rule rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-[#4285F4]" />
                  <h3 className="font-bold text-text-primary font-display">Test Google Sign-in</h3>
                </div>
                <button
                  onClick={() => setShowGoogleDevModal(false)}
                  className="text-text-muted hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xs text-text-secondary leading-relaxed">
                Test how Google Sign-In behaves for emails dumped in forms (automatic login) versus unknown emails (prompts request access for admin).
              </p>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-text-muted uppercase">Quick Test Options</label>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setGoogleDevEmail("harshith0@lendi.edu.in");
                      handleGoogleDevSubmit("harshith0@lendi.edu.in");
                    }}
                    className="p-2.5 text-left rounded-lg bg-paper-1/80 border border-rule hover:border-stamp-verified transition-all flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-text-primary block">Dumped Form / Seeded Student</span>
                      <span className="text-text-muted">harshith0@lendi.edu.in</span>
                    </div>
                    <Badge variant="success" className="text-[10px]">Auto-login</Badge>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setGoogleDevEmail("unregistered.user@gmail.com");
                      handleGoogleDevSubmit("unregistered.user@gmail.com");
                    }}
                    className="p-2.5 text-left rounded-lg bg-paper-1/80 border border-rule hover:border-warning transition-all flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-text-primary block">Unregistered User</span>
                      <span className="text-text-muted">unregistered.user@gmail.com</span>
                    </div>
                    <Badge variant="warning" className="text-[10px]">Request Access</Badge>
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-rule space-y-3">
                <label className="text-xs font-semibold text-text-muted uppercase">Or enter any custom Google email</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="student@gmail.com"
                    value={googleDevEmail}
                    onChange={(e) => setGoogleDevEmail(e.target.value)}
                    className="text-xs"
                  />
                  <Button
                    variant="primary"
                    disabled={!googleDevEmail || loading !== null}
                    onClick={() => handleGoogleDevSubmit(googleDevEmail)}
                    className="shrink-0 text-xs font-bold"
                  >
                    Test
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <RequestAccessModal
        isOpen={isRequestAccessOpen}
        onClose={() => setIsRequestAccessOpen(false)}
        defaultEmail={requestAccessEmail}
        defaultName={requestAccessName}
      />
    </div>
  );
}
