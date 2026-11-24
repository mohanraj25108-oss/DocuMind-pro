"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";

function BrandHeader() {
  return (
    <Link href="/" className="mb-6 inline-flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#243B64] text-white">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M9 14l2 2 4-4" />
        </svg>
      </div>
      <div>
        <span className="block font-display text-base font-bold text-[#111827]">
          DocuMind
        </span>
        <span className="block text-[11px] text-[#667085]">
          Your documents, understood and organised.
        </span>
      </div>
    </Link>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign in failed.");
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next");
      const safeNext = next && next.startsWith("/") ? next : "/dashboard";
      router.push(safeNext);
      router.refresh();
    } catch {
      setError("Network error while signing in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F8FC] px-4 py-10">
      <div className="w-full max-w-md">
        <BrandHeader />

        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-xs sm:p-8">
          <h1 className="font-display text-xl font-bold text-[#111827]">
            Sign in to DocuMind
          </h1>
          <p className="mt-1 text-sm text-[#667085]">
            Enter your email and password to access your document vault.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-[#F7CACA] bg-[#FEF0F0] px-3.5 py-2.5 text-xs font-medium text-[#DC5252]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-xs font-medium text-[#111827]"
              >
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#4568C7] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-xs font-medium text-[#111827]"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white pl-3 pr-10 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#4568C7] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-[#667085] hover:text-[#111827]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#243B64] text-sm font-semibold text-white transition-colors hover:bg-[#1C2F50] disabled:opacity-50"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Sign in
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-[#667085]">
            New to DocuMind?{" "}
            <Link href="/register" className="font-semibold text-[#4568C7] hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, timezone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create account.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error while creating account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F8FC] px-4 py-10">
      <div className="w-full max-w-md">
        <BrandHeader />

        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-xs sm:p-8">
          <h1 className="font-display text-xl font-bold text-[#111827]">
            Create your DocuMind account
          </h1>
          <p className="mt-1 text-sm text-[#667085]">
            Start organising your warranties, policies, receipts, and agreements.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-[#F7CACA] bg-[#FEF0F0] px-3.5 py-2.5 text-xs font-medium text-[#DC5252]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="reg-name"
                className="mb-1.5 block text-xs font-medium text-[#111827]"
              >
                Full name
              </label>
              <input
                id="reg-name"
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Morgan"
                className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#4568C7] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="reg-email"
                className="mb-1.5 block text-xs font-medium text-[#111827]"
              >
                Email address
              </label>
              <input
                id="reg-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#4568C7] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="reg-password"
                className="mb-1.5 block text-xs font-medium text-[#111827]"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white pl-3 pr-10 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#4568C7] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-[#667085] hover:text-[#111827]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#4568C7] text-sm font-semibold text-white transition-colors hover:bg-[#3756AC] disabled:opacity-50"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Create account
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-[#667085]">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-[#4568C7] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
