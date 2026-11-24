"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CalendarClock,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  FolderKanban,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Sparkles,
  User as UserIcon,
  X,
} from "lucide-react";
import type { UserRecord, UserSettingsRecord } from "@/lib/auth";
import type { DocumentItem, NotificationItem } from "@/lib/documents";
import type { DocumentCategory } from "@/lib/constants";
import { DocumentModal } from "./DocumentModal";
import { CategoryIcon } from "./CategoryIcon";
import { StatusBadge } from "./StatusBadge";

interface WorkspaceContextValue {
  user: UserRecord;
  settings: UserSettingsRecord;
  openCreateModal: (initialCategory?: DocumentCategory) => void;
  openEditModal: (doc: DocumentItem) => void;
  refreshHeaderState: () => Promise<void>;
  updateLocalUser: (u: UserRecord) => void;
  updateLocalSettings: (s: UserSettingsRecord) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used inside AppShell");
  }
  return ctx;
}

interface NavGroup {
  label: string;
  items: Array<{
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    accent?: boolean;
    badge?: number;
  }>;
}

function SidebarContent({
  isMobile = false,
  collapsed,
  navGroups,
  pathname,
  onToggleCollapse,
  onCloseMobile,
  onOpenUpload,
}: {
  isMobile?: boolean;
  collapsed: boolean;
  navGroups: NavGroup[];
  pathname: string;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onOpenUpload: () => void;
}) {
  const isActiveRoute = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));

  return (
    <div className="flex h-full flex-col bg-white border-r border-[#E5E7EB]">
      <div
        className={`flex h-16 shrink-0 items-center border-b border-[#E5E7EB] px-4 ${
          collapsed && !isMobile ? "justify-center" : "justify-between"
        }`}
      >
        <Link
          href="/dashboard"
          onClick={() => isMobile && onCloseMobile()}
          className="flex items-center gap-2.5 min-w-0"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#243B64] text-white">
            <svg
              width="17"
              height="17"
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
          {(!collapsed || isMobile) && (
            <div className="min-w-0">
              <span className="block font-display text-[15px] font-bold tracking-tight text-[#111827]">
                DocuMind
              </span>
              <span className="block truncate text-[11px] text-[#667085]">
                Document workspace
              </span>
            </div>
          )}
        </Link>

        {isMobile ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-md p-1.5 text-[#667085] hover:bg-[#F3F4F6]"
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        ) : (
          !collapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="rounded-md p-1.5 text-[#667085] hover:bg-[#F3F4F6] hover:text-[#111827]"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={16} />
            </button>
          )
        )}
      </div>

      {!isMobile && collapsed && (
        <div className="flex justify-center border-b border-[#E5E7EB] py-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded-md p-1.5 text-[#667085] hover:bg-[#F3F4F6] hover:text-[#111827]"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Main navigation">
        {navGroups.map((group) => (
          <div key={group.label}>
            {(!collapsed || isMobile) && (
              <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActiveRoute(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => isMobile && onCloseMobile()}
                    title={collapsed && !isMobile ? item.label : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                      collapsed && !isMobile ? "justify-center px-0" : ""
                    } ${
                      active
                        ? "bg-[#EEF2FB] text-[#243B64]"
                        : "text-[#667085] hover:bg-[#F7F8FC] hover:text-[#111827]"
                    }`}
                  >
                    <Icon
                      size={17}
                      strokeWidth={1.85}
                      className="shrink-0"
                      style={{
                        color: active
                          ? item.accent
                            ? "#8B7AE8"
                            : "#4568C7"
                          : item.accent
                            ? "#8B7AE8"
                            : "currentColor",
                      }}
                    />
                    {(!collapsed || isMobile) && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge !== undefined && (
                          <span className="rounded-md bg-[#F3F4F6] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[#243B64]">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-[#E5E7EB] p-3">
        {!collapsed || isMobile ? (
          <button
            type="button"
            onClick={() => {
              if (isMobile) onCloseMobile();
              onOpenUpload();
            }}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#243B64] px-3 text-sm font-medium text-white transition-colors hover:bg-[#1C2F50]"
          >
            <Plus size={16} />
            <span>Upload document</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenUpload}
            title="Upload document"
            aria-label="Upload document"
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-[#243B64] text-white transition-colors hover:bg-[#1C2F50]"
          >
            <Plus size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

interface AppShellProps {
  initialUser: UserRecord;
  initialSettings: UserSettingsRecord;
  initialUnreadNotifications: number;
  initialPendingReminders: number;
  children: React.ReactNode;
}

export function AppShell({
  initialUser,
  initialSettings,
  initialUnreadNotifications,
  initialPendingReminders,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<UserRecord>(initialUser);
  const [settings, setSettings] = useState<UserSettingsRecord>(initialSettings);
  const [collapsed, setCollapsed] = useState<boolean>(initialSettings.sidebar_collapsed);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(initialUnreadNotifications);
  const [pendingReminders, setPendingReminders] = useState(initialPendingReminders);
  const notifRef = useRef<HTMLDivElement | null>(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DocumentItem[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docModalMode, setDocModalMode] = useState<"create" | "edit">("create");
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null);
  const [modalCategory, setModalCategory] = useState<DocumentCategory | undefined>(
    undefined
  );

  const refreshHeaderState = useCallback(async () => {
    try {
      const [notifRes, dashRes] = await Promise.all([
        fetch("/api/notifications", { cache: "no-store" }),
        fetch("/api/dashboard", { cache: "no-store" }),
      ]);
      if (notifRes.ok) {
        const nd = await notifRes.json();
        setNotifications(nd.notifications || []);
        setUnreadCount(nd.unreadCount || 0);
      }
      if (dashRes.ok) {
        const dd = await dashRes.json();
        setPendingReminders(dd.pendingRemindersCount || 0);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [notifRes, dashRes] = await Promise.all([
          fetch("/api/notifications", { cache: "no-store" }),
          fetch("/api/dashboard", { cache: "no-store" }),
        ]);
        if (!active) return;
        if (notifRes.ok) {
          const nd = await notifRes.json();
          if (active) {
            setNotifications(nd.notifications || []);
            setUnreadCount(nd.unreadCount || 0);
          }
        }
        if (dashRes.ok) {
          const dd = await dashRes.json();
          if (active) {
            setPendingReminders(dd.pendingRemindersCount || 0);
          }
        }
      } catch {
        // ignore
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (window.innerWidth < 768) {
          setMobileSearchOpen(true);
        } else {
          searchInputRef.current?.focus();
          setSearchOpen(true);
        }
      } else if (e.key === "Escape") {
        setSearchOpen(false);
        setNotifOpen(false);
        setProfileOpen(false);
        setMobileMenuOpen(false);
        setMobileSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/documents?search=${encodeURIComponent(trimmed)}`,
          { cache: "no-store" }
        );
        if (res.ok && active) {
          const data = await res.json();
          setSearchResults((data.documents || []).slice(0, 6));
        }
      } finally {
        if (active) setSearching(false);
      }
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const toggleSidebar = async () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sidebar_collapsed: next }),
      });
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    if (res.ok) {
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    }
  };

  const handleMarkSingleRead = async (id: string, docId: string | null) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setNotifOpen(false);
    if (docId) {
      router.push(`/documents/${docId}`);
    } else {
      router.push("/reminders");
    }
  };

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const openCreateModal = useCallback((initialCat?: DocumentCategory) => {
    setDocModalMode("create");
    setEditingDoc(null);
    setModalCategory(initialCat);
    setDocModalOpen(true);
  }, []);

  const openEditModal = useCallback((doc: DocumentItem) => {
    setDocModalMode("edit");
    setEditingDoc(doc);
    setModalCategory(undefined);
    setDocModalOpen(true);
  }, []);

  const navGroups = useMemo<NavGroup[]>(
    () => [
      {
        label: "Workspace",
        items: [
          { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
          { href: "/documents", label: "My Documents", icon: FileText },
          { href: "/assistant", label: "AI Assistant", icon: Sparkles, accent: true },
          { href: "/calendar", label: "Expiry Calendar", icon: CalendarClock },
          {
            href: "/reminders",
            label: "Reminders",
            icon: Clock,
            badge: pendingReminders > 0 ? pendingReminders : undefined,
          },
        ],
      },
      {
        label: "Organise",
        items: [
          { href: "/categories", label: "Categories", icon: FolderKanban },
          { href: "/activity", label: "Activity History", icon: History },
        ],
      },
      {
        label: "Account",
        items: [
          { href: "/settings", label: "Settings", icon: Settings },
          { href: "/profile", label: "User Profile", icon: UserIcon },
        ],
      },
    ],
    [pendingReminders]
  );

  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");

  const contextValue = useMemo<WorkspaceContextValue>(
    () => ({
      user,
      settings,
      openCreateModal,
      openEditModal,
      refreshHeaderState,
      updateLocalUser: setUser,
      updateLocalSettings: setSettings,
    }),
    [user, settings, openCreateModal, openEditModal, refreshHeaderState]
  );

  return (
    <WorkspaceContext.Provider value={contextValue}>
      <div className="flex min-h-screen bg-[#F7F8FC] text-[#111827]">
        <aside
          className={`hidden lg:block shrink-0 transition-[width] duration-200 ${
            collapsed ? "w-[68px]" : "w-[248px]"
          }`}
        >
          <div className="sticky top-0 h-screen">
            <SidebarContent
              collapsed={collapsed}
              navGroups={navGroups}
              pathname={pathname}
              onToggleCollapse={toggleSidebar}
              onCloseMobile={() => setMobileMenuOpen(false)}
              onOpenUpload={() => openCreateModal()}
            />
          </div>
        </aside>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-[#111827]/40"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative z-10 w-72 max-w-[82vw] h-full">
              <SidebarContent
                isMobile
                collapsed={false}
                navGroups={navGroups}
                pathname={pathname}
                onToggleCollapse={toggleSidebar}
                onCloseMobile={() => setMobileMenuOpen(false)}
                onOpenUpload={() => openCreateModal()}
              />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 sm:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#111827] hover:bg-[#F7F8FC] lg:hidden"
                aria-label="Open navigation menu"
              >
                <Menu size={18} />
              </button>

              <Link href="/dashboard" className="flex items-center gap-2 lg:hidden shrink-0">
                <span className="font-display text-sm font-bold text-[#243B64]">
                  DocuMind
                </span>
              </Link>

              <div ref={searchRef} className="relative hidden md:block w-full max-w-md">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-2.5 text-[#667085]"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onFocus={() => setSearchOpen(true)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchQuery(val);
                    if (!val.trim()) setSearchResults([]);
                    setSearchOpen(true);
                  }}
                  placeholder="Search documents, issuers, policy numbers..."
                  className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-[#F7F8FC] pl-9 pr-14 text-sm text-[#111827] placeholder:text-[#667085] focus:border-[#4568C7] focus:bg-white focus:outline-none"
                />
                <span className="pointer-events-none absolute right-2.5 top-2 rounded border border-[#E5E7EB] bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#667085]">
                  Ctrl K
                </span>

                {searchOpen && searchQuery.trim() && (
                  <div className="absolute left-0 right-0 top-11 z-40 rounded-xl border border-[#E5E7EB] bg-white p-2 shadow-lg">
                    {searching ? (
                      <div className="px-3 py-4 text-center text-xs text-[#667085]">
                        Searching your workspace...
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="px-3 py-4 text-center text-xs text-[#667085]">
                        No matching documents for &ldquo;{searchQuery}&rdquo;
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {searchResults.map((doc) => (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={() => {
                              setSearchOpen(false);
                              setSearchQuery("");
                              setSearchResults([]);
                              router.push(`/documents/${doc.id}`);
                            }}
                            className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-[#F7F8FC]"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <CategoryIcon category={doc.category} size={15} withTile />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-[#111827]">
                                  {doc.name}
                                </p>
                                <p className="truncate text-xs text-[#667085]">
                                  {doc.category}
                                  {doc.issuer ? ` · ${doc.issuer}` : ""}
                                </p>
                              </div>
                            </div>
                            <StatusBadge
                              status={doc.expiry_status}
                              daysUntilExpiry={doc.days_until_expiry}
                              compact
                            />
                          </button>
                        ))}
                        <div className="border-t border-[#E5E7EB] pt-1 mt-1">
                          <button
                            type="button"
                            onClick={() => {
                              const q = searchQuery.trim();
                              setSearchOpen(false);
                              setSearchQuery("");
                              setSearchResults([]);
                              router.push(`/documents?search=${encodeURIComponent(q)}`);
                            }}
                            className="w-full rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-[#4568C7] hover:bg-[#EEF2FB]"
                          >
                            View all results in My Documents
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setMobileSearchOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#667085] hover:bg-[#F7F8FC] md:hidden"
                aria-label="Search documents"
              >
                <Search size={17} />
              </button>

              <button
                type="button"
                onClick={() => openCreateModal()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#4568C7] px-3 text-sm font-medium text-white transition-colors hover:bg-[#3756AC]"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Quick Upload</span>
              </button>

              <div ref={notifRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    const next = !notifOpen;
                    setNotifOpen(next);
                    if (next) refreshHeaderState();
                  }}
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#667085] hover:bg-[#F7F8FC] hover:text-[#111827]"
                  aria-label="Notifications"
                >
                  <Bell size={17} />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#DC5252] px-1 text-[10px] font-bold text-white tabular-nums">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="fixed inset-x-3 top-16 z-50 sm:absolute sm:inset-auto sm:right-0 sm:top-11 sm:w-96 rounded-xl border border-[#E5E7EB] bg-white shadow-lg">
                    <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-[#111827]">
                          Notifications
                        </p>
                        <p className="text-xs text-[#667085]">
                          {unreadCount} unread alert{unreadCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#4568C7] hover:underline"
                        >
                          <CheckCheck size={13} />
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-[#E5E7EB]">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-xs text-[#667085]">
                          No alerts right now. Expiry warnings and due reminders appear here.
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => handleMarkSingleRead(n.id, n.document_id)}
                            className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[#F7F8FC] ${
                              n.is_read ? "opacity-70" : "bg-[#FAFBFD]"
                            }`}
                          >
                            <span
                              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                              style={{
                                backgroundColor: n.is_read
                                  ? "#D0D5DD"
                                  : n.type === "error"
                                    ? "#DC5252"
                                    : n.type === "warning"
                                      ? "#E6A23C"
                                      : "#4568C7",
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-[#111827]">
                                {n.title}
                              </p>
                              <p className="mt-0.5 text-xs text-[#667085]">
                                {n.message}
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>

                    <div className="border-t border-[#E5E7EB] px-4 py-2.5">
                      <Link
                        href="/reminders"
                        onClick={() => setNotifOpen(false)}
                        className="block text-center text-xs font-medium text-[#4568C7] hover:underline"
                      >
                        Manage all reminders
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <div ref={profileRef} className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex h-9 items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white pl-1.5 pr-2.5 hover:bg-[#F7F8FC]"
                  aria-label="Account menu"
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white"
                    style={{ backgroundColor: user.avatar_color || "#4568C7" }}
                  >
                    {initials || "U"}
                  </span>
                  <span className="hidden max-w-[120px] truncate text-sm font-medium text-[#111827] sm:inline">
                    {user.name}
                  </span>
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-11 z-50 w-56 rounded-xl border border-[#E5E7EB] bg-white p-1.5 shadow-lg">
                    <div className="border-b border-[#E5E7EB] px-3 py-2">
                      <p className="truncate text-sm font-semibold text-[#111827]">
                        {user.name}
                      </p>
                      <p className="truncate text-xs text-[#667085]">{user.email}</p>
                    </div>
                    <div className="py-1">
                      <Link
                        href="/profile"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#111827] hover:bg-[#F7F8FC]"
                      >
                        <UserIcon size={15} className="text-[#667085]" />
                        User Profile
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#111827] hover:bg-[#F7F8FC]"
                      >
                        <Settings size={15} className="text-[#667085]" />
                        Settings
                      </Link>
                    </div>
                    <div className="border-t border-[#E5E7EB] pt-1">
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#DC5252] hover:bg-[#FEF0F0]"
                      >
                        <LogOut size={15} />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {mobileSearchOpen && (
            <div className="fixed inset-0 z-50 bg-[#111827]/40 p-3 md:hidden">
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-lg">
                <div className="flex items-center gap-2">
                  <Search size={16} className="text-[#667085]" />
                  <input
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSearchQuery(val);
                      if (!val.trim()) setSearchResults([]);
                    }}
                    placeholder="Search documents, issuers, policy #..."
                    className="h-9 flex-1 text-sm text-[#111827] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setMobileSearchOpen(false)}
                    className="rounded-md p-1.5 text-[#667085] hover:bg-[#F3F4F6]"
                  >
                    <X size={16} />
                  </button>
                </div>
                {searchQuery.trim() && (
                  <div className="mt-2 max-h-72 overflow-y-auto border-t border-[#E5E7EB] pt-2 space-y-1">
                    {searchResults.length === 0 ? (
                      <p className="py-4 text-center text-xs text-[#667085]">
                        No matching documents found.
                      </p>
                    ) : (
                      searchResults.map((doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => {
                            setMobileSearchOpen(false);
                            setSearchQuery("");
                            setSearchResults([]);
                            router.push(`/documents/${doc.id}`);
                          }}
                          className="flex w-full items-center justify-between gap-2 rounded-lg p-2 text-left hover:bg-[#F7F8FC]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[#111827]">
                              {doc.name}
                            </p>
                            <p className="truncate text-xs text-[#667085]">
                              {doc.category}
                            </p>
                          </div>
                          <StatusBadge
                            status={doc.expiry_status}
                            daysUntilExpiry={doc.days_until_expiry}
                            compact
                          />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-[1360px]">{children}</div>
          </main>
        </div>
      </div>

      {docModalOpen && (
        <DocumentModal
          key={`${docModalMode}-${editingDoc?.id || "new"}-${modalCategory || "default"}`}
          open={docModalOpen}
          mode={docModalMode}
          initialDocument={editingDoc}
          defaultCurrency={settings.currency}
          initialCategory={modalCategory}
          onClose={() => setDocModalOpen(false)}
          onSaved={(doc) => {
            refreshHeaderState();
            window.dispatchEvent(
              new CustomEvent("documind:document-changed", { detail: doc })
            );
            router.refresh();
          }}
        />
      )}
    </WorkspaceContext.Provider>
  );
}
