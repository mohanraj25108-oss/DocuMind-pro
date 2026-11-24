"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Lock, Trash2 } from "lucide-react";
import { AVATAR_COLORS, formatBytes, formatDisplayDate } from "@/lib/constants";
import type { UserRecord } from "@/lib/auth";
import { useWorkspace } from "./AppShell";

export function ProfileClient({
  initialUser,
  docCount,
  totalBytes,
}: {
  initialUser: UserRecord;
  docCount: number;
  totalBytes: number;
}) {
  const router = useRouter();
  const { settings, updateLocalUser } = useWorkspace();

  const [name, setName] = useState(initialUser.name);
  const [email, setEmail] = useState(initialUser.email);
  const [timezone, setTimezone] = useState(initialUser.timezone);
  const [avatarColor, setAvatarColor] = useState(initialUser.avatar_color);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPass, setSavingPass] = useState(false);
  const [passMsg, setPassMsg] = useState("");
  const [passErr, setPassErr] = useState("");

  const [deletePassword, setDeletePassword] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAcc, setDeletingAcc] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg("");
    setProfileErr("");
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          timezone,
          avatar_color: avatarColor,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileErr(data.error || "Failed to update profile.");
        return;
      }
      updateLocalUser(data.user);
      setProfileMsg("Profile updated.");
      router.refresh();
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg("");
    setPassErr("");

    if (newPassword !== confirmPassword) {
      setPassErr("New passwords do not match.");
      return;
    }

    setSavingPass(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPassErr(data.error || "Failed to update password.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPassMsg("Password changed successfully.");
    } finally {
      setSavingPass(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteErr("");
    setDeletingAcc(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteErr(data.error || "Could not delete account.");
        return;
      }
      router.push("/login");
      router.refresh();
    } finally {
      setDeletingAcc(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#111827]">
          User Profile
        </h1>
        <p className="mt-1 text-sm text-[#667085]">
          Manage your personal details, security credentials, and account storage.
        </p>
      </div>

      {/* Account Overview Strip */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-[#E5E7EB] bg-white p-5 sm:grid-cols-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: avatarColor }}
          >
            {initials || "U"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#111827]">{name}</p>
            <p className="truncate text-xs text-[#667085]">{email}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-[#667085]">Member since</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-[#111827]">
            {formatDisplayDate(initialUser.created_at, settings.date_format)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#667085]">Vault usage</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-[#111827]">
            {docCount} document{docCount === 1 ? "" : "s"} · {formatBytes(totalBytes)}
          </p>
        </div>
      </div>

      {/* Profile Form */}
      <form
        onSubmit={handleSaveProfile}
        className="rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-4"
      >
        <h2 className="text-sm font-semibold text-[#111827]">Personal information</h2>

        {profileErr && (
          <div className="rounded-lg border border-[#F7CACA] bg-[#FEF0F0] px-3 py-2 text-xs text-[#DC5252]">
            {profileErr}
          </div>
        )}
        {profileMsg && (
          <div className="flex items-center gap-1.5 rounded-lg border border-[#CBEFD9] bg-[#ECFDF3] px-3 py-2 text-xs text-[#16A36A]">
            <Check size={14} />
            {profileMsg}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#111827]">
              Full name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 w-full rounded-lg border border-[#E5E7EB] px-3 text-sm text-[#111827]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#111827]">
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 w-full rounded-lg border border-[#E5E7EB] px-3 text-sm text-[#111827]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#111827]">
              Timezone
            </label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="h-9 w-full rounded-lg border border-[#E5E7EB] px-3 text-sm text-[#111827]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#111827]">
              Avatar badge colour
            </label>
            <div className="flex items-center gap-2 pt-1">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAvatarColor(c)}
                  aria-label={`Select color ${c}`}
                  className={`h-7 w-7 rounded-lg transition-transform ${
                    avatarColor === c ? "ring-2 ring-[#111827] ring-offset-2" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingProfile}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#243B64] px-4 text-xs font-semibold text-white hover:bg-[#1C2F50] disabled:opacity-50"
          >
            {savingProfile && <Loader2 size={14} className="animate-spin" />}
            Save profile
          </button>
        </div>
      </form>

      {/* Password Form */}
      <form
        onSubmit={handleChangePassword}
        className="rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-4"
      >
        <div className="flex items-center gap-2">
          <Lock size={15} className="text-[#4568C7]" />
          <h2 className="text-sm font-semibold text-[#111827]">Change password</h2>
        </div>

        {passErr && (
          <div className="rounded-lg border border-[#F7CACA] bg-[#FEF0F0] px-3 py-2 text-xs text-[#DC5252]">
            {passErr}
          </div>
        )}
        {passMsg && (
          <div className="flex items-center gap-1.5 rounded-lg border border-[#CBEFD9] bg-[#ECFDF3] px-3 py-2 text-xs text-[#16A36A]">
            <Check size={14} />
            {passMsg}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#111827]">
              Current password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="h-9 w-full rounded-lg border border-[#E5E7EB] px-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#111827]">
              New password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-9 w-full rounded-lg border border-[#E5E7EB] px-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#111827]">
              Confirm new password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-9 w-full rounded-lg border border-[#E5E7EB] px-3 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingPass}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-4 text-xs font-semibold text-[#111827] hover:bg-[#F7F8FC] disabled:opacity-50"
          >
            {savingPass && <Loader2 size={14} className="animate-spin" />}
            Update password
          </button>
        </div>
      </form>

      {/* Danger Zone */}
      <section className="rounded-xl border border-[#F7CACA] bg-white p-5 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#DC5252]">Delete account</h2>
            <p className="mt-0.5 text-xs text-[#667085]">
              Permanently erase your profile, uploaded files, reminders, and AI chat
              history.
            </p>
          </div>
          {!showDeleteConfirm && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#F7CACA] bg-[#FEF0F0] px-3.5 text-xs font-semibold text-[#DC5252] hover:bg-[#FCE2E2]"
            >
              <Trash2 size={14} />
              Delete account
            </button>
          )}
        </div>

        {showDeleteConfirm && (
          <form
            onSubmit={handleDeleteAccount}
            className="mt-3 space-y-3 border-t border-[#F7CACA] pt-3"
          >
            {deleteErr && (
              <p className="text-xs font-medium text-[#DC5252]">{deleteErr}</p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="password"
                required
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter your password to confirm deletion"
                className="h-9 flex-1 rounded-lg border border-[#E5E7EB] px-3 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletePassword("");
                  setDeleteErr("");
                }}
                className="h-9 rounded-lg border border-[#E5E7EB] px-3 text-xs font-medium text-[#111827]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={deletingAcc}
                className="h-9 rounded-lg bg-[#DC5252] px-4 text-xs font-semibold text-white hover:bg-[#C43E3E] disabled:opacity-50"
              >
                {deletingAcc ? "Deleting..." : "Confirm permanent deletion"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
