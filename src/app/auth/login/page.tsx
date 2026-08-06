"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AGENCY } from "@/config/agency.config";


export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-block bg-green-950 border border-green-800 rounded-lg px-4 py-1 text-green-400 text-xs tracking-widest mb-4">
            FCCPC
          </div>
          <h1 className="text-2xl font-semibold text-white">Performance Intelligence</h1>
          <p className="text-slate-500 text-sm mt-2">Sign in to your account</p>
        </div>

        <div className="bg-[#13151e] border border-[#1e2130] rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0a0c12] border border-[#1e2130] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-green-700 transition-colors"
                placeholder="you@fccpc.gov.ng"
                required
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0a0c12] border border-[#1e2130] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-green-700 transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <p className="text-red-400 text-xs bg-red-950 border border-red-900 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-700 hover:bg-green-600 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Federal Competition and Consumer Protection Commission
        </p>
      </div>
    </div>
  );
}