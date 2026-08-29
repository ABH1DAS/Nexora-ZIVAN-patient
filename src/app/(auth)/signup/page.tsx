"use client";

import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Heart, ShieldCheck, User, Mail, Lock, Phone, Droplet, UserPlus } from "lucide-react";

export default function SignupPage() {
  const { signup, user, loading } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("+91 98765 43210");
  const [bloodGroup, setBloodGroup] = useState("O+");
  const [emergencyContactName, setEmergencyContactName] = useState("Dr. Ananya Sharma");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("+91 98765 43210");

  const [showEmergencyFields, setShowEmergencyFields] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, router, user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await signup(name, email, password, {
      phone,
      bloodGroup,
      emergencyContactName: showEmergencyFields ? emergencyContactName : undefined,
      emergencyContactPhone: showEmergencyFields ? emergencyContactPhone : undefined,
      plan: "Free",
    });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="w-full max-w-lg rounded-[2.5rem] border border-border bg-white/95 p-7 shadow-[0_24px_60px_rgba(15,61,53,0.12)] backdrop-blur-md sm:p-9">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary shadow-xs">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
            New Member Registration
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Create your account
          </h1>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted sm:text-sm">
        Connects your health profile, emergency contacts, and smart vitals directly to Supabase cloud.
      </p>

      <form className="mt-7 space-y-4" onSubmit={onSubmit} noValidate>
        {/* Full Name */}
        <div>
          <label htmlFor="name" className="mb-1.5 block text-xs font-bold text-foreground">
            Full name *
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              placeholder="e.g. Abhijeet Das"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 w-full rounded-2xl border border-border bg-[#fbfefd] pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Email & Phone Grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-bold text-foreground">
              Email address *
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 w-full rounded-2xl border border-border bg-[#fbfefd] pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="mb-1.5 block text-xs font-bold text-foreground">
              Phone number
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12 w-full rounded-2xl border border-border bg-[#fbfefd] pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>

        {/* Password & Blood Group Grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-bold text-foreground">
              Password *
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Min 4 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 w-full rounded-2xl border border-border bg-[#fbfefd] pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div>
            <label htmlFor="bloodGroup" className="mb-1.5 block text-xs font-bold text-foreground">
              Blood group
            </label>
            <div className="relative">
              <Droplet className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-500" />
              <select
                id="bloodGroup"
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="h-12 w-full rounded-2xl border border-border bg-[#fbfefd] pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Toggle Emergency Contact Setup */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowEmergencyFields((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <UserPlus className="h-3.5 w-3.5" />
            {showEmergencyFields ? "Hide emergency contact setup" : "+ Add primary emergency contact now (optional)"}
          </button>
        </div>

        {showEmergencyFields && (
          <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-4 space-y-3 animate-in fade-in duration-200">
            <p className="text-xs font-bold text-teal-950">Primary Emergency Contact</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Doctor / Kin Name"
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
                className="h-10 w-full rounded-xl border border-teal-200 bg-white px-3 text-xs outline-none focus:ring-2 focus:ring-primary/20"
              />
              <input
                type="tel"
                placeholder="Contact Phone"
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
                className="h-10 w-full rounded-xl border border-teal-200 bg-white px-3 text-xs outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full shadow-[0_8px_25px_rgba(13,143,122,0.35)] hover:shadow-[0_12px_32px_rgba(13,143,122,0.45)]"
          size="lg"
          disabled={submitting}
        >
          {submitting ? "Provisioning Cloud Tables..." : "Create Account & Connect Data"}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-muted sm:text-sm">
        Already registered?{" "}
        <Link href="/login" className="font-bold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
