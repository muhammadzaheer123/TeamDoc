"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import {
  AlignLeft,
  Bold,
  Check,
  ChevronDown,
  Clock3,
  FilePlus2,
  FileText,
  FolderOpen,
  Italic,
  List,
  ListOrdered,
  LoaderCircle,
  LogOut,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  Type,
  Underline as UnderlineIcon,
  Upload,
  Users,
  X,
  Trash2,
  UserRound,
  ChevronRight,
} from "lucide-react";
import {
  API_URL,
  Doc,
  User,
  emptyContent,
  plainTextToContent,
  request,
} from "@/lib/api";

type AuthResponse = { token: string; user: User };
const initialUser = { name: "", email: "", password: "" };
function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Just now"
    : new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
        date,
      );
}
function getError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

export default function Workspace() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState(initialUser);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [activeId, setActiveId] = useState("");
  const [title, setTitle] = useState("Untitled document");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"all" | "owned" | "shared">("all");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState<"viewer" | "editor">("editor");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Doc | null>(null);
  const [docMenuOpenId, setDocMenuOpenId] = useState("");
  const activeDoc = docs.find((doc) => doc._id === activeId) || null;
  const editor = useEditor(
    {
      extensions: [StarterKit, Underline],
      content: emptyContent,
      immediatelyRender: false,
      editable: activeDoc?.accessRole !== "viewer",
      onUpdate: () => {
        setSaving(true);
      },
    },
    [activeId],
  );
  const refreshDocs = useCallback(
    async (authToken: string, selectedId?: string) => {
      const result = await request<{ documents: Doc[] }>(
        "/documents",
        authToken,
      );
      setDocs(result.documents);
      const nextId =
        selectedId && result.documents.some((d) => d._id === selectedId)
          ? selectedId
          : result.documents[0]?._id || "";
      setActiveId(nextId);
    },
    [],
  );
  useEffect(() => {
    const savedToken = window.localStorage.getItem("teamdocs_token");
    const savedUser = window.localStorage.getItem("teamdocs_user");
    if (savedToken && savedUser) {
      try {
        const parsed = JSON.parse(savedUser) as User;
        setToken(savedToken);
        setUser(parsed);
        refreshDocs(savedToken).catch((e) => {
          setError(getError(e));
          window.localStorage.removeItem("teamdocs_token");
          window.localStorage.removeItem("teamdocs_user");
          setToken("");
          setUser(null);
        });
      } catch {
        window.localStorage.removeItem("teamdocs_user");
      }
    }
  }, [refreshDocs]);
  useEffect(() => {
    if (!activeDoc || !editor) return;
    setTitle(activeDoc.title);
    editor.setEditable(activeDoc.accessRole !== "viewer");
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(activeDoc.content))
      editor.commands.setContent(activeDoc.content || emptyContent, false);
    setSavedAt(activeDoc.updatedAt);
    setSaving(false);
  }, [activeId, activeDoc?._id, editor]);
  useEffect(() => {
    if (
      !saving ||
      !token ||
      !activeDoc ||
      !editor ||
      activeDoc.accessRole === "viewer"
    )
      return;
    const timer = window.setTimeout(async () => {
      try {
        const updated = await request<{ document: Doc }>(
          `/documents/${activeDoc._id}`,
          token,
          {
            method: "PATCH",
            body: JSON.stringify({ title, content: editor.getJSON() }),
          },
        );
        setDocs((current) =>
          current.map((doc) =>
            doc._id === updated.document._id
              ? { ...updated.document, accessRole: doc.accessRole }
              : doc,
          ),
        );
        setSavedAt(updated.document.updatedAt);
        setSaving(false);
        setError("");
      } catch (e) {
        setError(getError(e));
        setSaving(false);
      }
    }, 850);
    return () => window.clearTimeout(timer);
  }, [saving, title, token, activeDoc, editor]);
  const visibleDocs = useMemo(
    () =>
      docs.filter((doc) => {
        const matches = doc.title.toLowerCase().includes(query.toLowerCase());
        const kind =
          view === "all" ||
          (view === "owned"
            ? doc.accessRole === "owner"
            : doc.accessRole !== "owner");
        return matches && kind;
      }),
    [docs, query, view],
  );
  async function authenticate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const route = authMode === "login" ? "/auth/login" : "/auth/register";
      const data = await fetch(`${API_URL}${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm),
      });
      const result = await data.json();
      if (!data.ok) throw new Error(result.message || "Unable to sign in.");
      const auth = result as AuthResponse;
      setToken(auth.token);
      setUser(auth.user);
      window.localStorage.setItem("teamdocs_token", auth.token);
      window.localStorage.setItem("teamdocs_user", JSON.stringify(auth.user));
      await refreshDocs(auth.token);
    } catch (e) {
      setError(getError(e));
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      if (token)
        await request<{ message: string }>("/auth/logout", token, {
          method: "POST",
        });
    } catch {
      /* Clear the local session even if the network is unavailable. */
    }
    window.localStorage.removeItem("teamdocs_token");
    window.localStorage.removeItem("teamdocs_user");
    setToken("");
    setUser(null);
    setDocs([]);
    setActiveId("");
    setError("");
    setNotice("");
    setLogoutConfirmOpen(false);
    setUserMenuOpen(false);
    setProfileOpen(false);
  }
  async function deleteDocument() {
    if (!deleteTarget || !token) return;
    setBusy(true);
    setError("");
    try {
      await request<{ message: string }>(
        `/documents/${deleteTarget._id}`,
        token,
        { method: "DELETE" },
      );
      const deletedTitle = deleteTarget.title || "Untitled document";
      const nextSelection =
        activeId === deleteTarget._id ? undefined : activeId;
      setDeleteTarget(null);
      await refreshDocs(token, nextSelection);
      setNotice(`“${deletedTitle}” deleted`);
      window.setTimeout(() => setNotice(""), 2600);
    } catch (e) {
      setError(getError(e));
    } finally {
      setBusy(false);
    }
  }
  async function createDocument(
    content = emptyContent,
    fileTitle = "Untitled document",
  ) {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const result = await request<{ document: Doc }>("/documents", token, {
        method: "POST",
        body: JSON.stringify({ title: fileTitle, content }),
      });
      await refreshDocs(token, result.document._id);
      setNotice("Document created");
      window.setTimeout(() => setNotice(""), 2400);
    } catch (e) {
      setError(getError(e));
    } finally {
      setBusy(false);
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["txt", "md"].includes(ext)) {
      setError("Supported formats are .txt and .md files.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Please choose a file smaller than 2 MB.");
      return;
    }
    try {
      const text = await file.text();
      const name =
        file.name.replace(/\.(txt|md)$/i, "").trim() || "Imported document";
      await createDocument(plainTextToContent(text), name);
    } catch {
      setError("The file could not be read. Please try another file.");
    }
  }
  async function shareDocument(event: React.FormEvent) {
    event.preventDefault();
    if (!activeDoc) return;
    setBusy(true);
    setError("");
    try {
      await request(`/documents/${activeDoc._id}/shares`, token, {
        method: "POST",
        body: JSON.stringify({ email: shareEmail, role: shareRole }),
      });
      await refreshDocs(token, activeDoc._id);
      setShareEmail("");
      setNotice("Access updated");
      setShareOpen(false);
      window.setTimeout(() => setNotice(""), 2400);
    } catch (e) {
      setError(getError(e));
    } finally {
      setBusy(false);
    }
  }
  async function removeShare(email: string) {
    if (!activeDoc) return;
    try {
      await request(`/documents/${activeDoc._id}/shares`, token, {
        method: "DELETE",
        body: JSON.stringify({ email }),
      });
      await refreshDocs(token, activeDoc._id);
    } catch (e) {
      setError(getError(e));
    }
  }
  if (!user)
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <div className="brand-mark">
            t<span>.</span>
          </div>
          <p className="eyebrow">A QUIETER WAY TO WORK TOGETHER</p>
          <h1>Your work, in good order.</h1>
          <p className="auth-copy">
            Create thoughtful documents and share them with your team. No
            clutter, just the work.
          </p>
          <form className="auth-form" onSubmit={authenticate}>
            {authMode === "register" && (
              <label>
                Full name
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  value={authForm.name}
                  onChange={(e) =>
                    setAuthForm({ ...authForm, name: e.target.value })
                  }
                  placeholder="Alex Morgan"
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                required
                maxLength={254}
                value={authForm.email}
                onChange={(e) =>
                  setAuthForm({ ...authForm, email: e.target.value })
                }
                placeholder="you@company.com"
                autoComplete="email"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                required
                minLength={8}
                maxLength={72}
                value={authForm.password}
                onChange={(e) =>
                  setAuthForm({ ...authForm, password: e.target.value })
                }
                placeholder="At least 8 characters"
                autoComplete={
                  authMode === "login" ? "current-password" : "new-password"
                }
              />
            </label>
            {error && <p className="inline-error">{error}</p>}
            <button className="primary-button full-button" disabled={busy}>
              {busy ? <LoaderCircle size={16} className="spin" /> : null}
              {authMode === "login"
                ? "Sign in to TeamDocs"
                : "Create your account"}
            </button>
          </form>
          <p className="auth-switch">
            {authMode === "login"
              ? "New to TeamDocs?"
              : "Already have an account?"}{" "}
            <button
              onClick={() => {
                setAuthMode(authMode === "login" ? "register" : "login");
                setError("");
              }}
            >
              {authMode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
          <p className="auth-foot">
            <ShieldCheck size={14} /> Your documents stay yours. Access is
            checked on every request.
          </p>
        </div>
        <div className="auth-side-note">
          A little more clarity, in every collaboration.
        </div>
      </main>
    );
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark small">
            t<span>.</span>
          </div>
          <span className="brand-name">teamdocs</span>
          <span className="brand-divider" />
          <span className="workspace-label">Personal workspace</span>
        </div>
        <div className="topbar-actions">
          <div className="save-status">
            {saving ? (
              <>
                <LoaderCircle size={14} className="spin" /> Saving changes…
              </>
            ) : (
              <>
                <Check size={14} /> Saved{" "}
                {savedAt ? `· ${dateLabel(savedAt)}` : ""}
              </>
            )}
          </div>
          <div className="avatar" title={user.name}>
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          <button
            className="icon-button"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => setLogoutConfirmOpen(true)}
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>
      <div className={`workspace ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
        {sidebarOpen && (
          <aside className="sidebar">
            <button
              className="new-document-button"
              onClick={() => createDocument()}
              disabled={busy}
            >
              <Plus size={17} /> New document <span>⌘ N</span>
            </button>
            <label className="import-sidebar-button">
              <Upload size={15} /> Import .txt or .md
              <input
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                onChange={(e) => {
                  importFile(e.target.files?.[0]);
                  e.currentTarget.value = "";
                }}
                hidden
              />
            </label>
            <div className="sidebar-search">
              <Search size={15} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents"
                aria-label="Search documents"
              />
            </div>
            <div className="nav-label">WORKSPACE</div>
            <button
              className={`nav-item ${view === "all" ? "active" : ""}`}
              onClick={() => setView("all")}
            >
              <FolderOpen size={16} /> All documents <span>{docs.length}</span>
            </button>
            <button
              className={`nav-item ${view === "owned" ? "active" : ""}`}
              onClick={() => setView("owned")}
            >
              <FileText size={16} /> Created by me
            </button>
            <button
              className={`nav-item ${view === "shared" ? "active" : ""}`}
              onClick={() => setView("shared")}
            >
              <Users size={16} /> Shared with me
            </button>
            <div className="documents-heading">
              <span>RECENT DOCUMENTS</span>
              <span>{visibleDocs.length}</span>
            </div>
            <div className="document-list">
              {visibleDocs.map((doc) => (
                <div
                  key={doc._id}
                  className={`document-row ${doc._id === activeId ? "selected" : ""}`}
                >
                  <button
                    className="document-row-open"
                    onClick={() => setActiveId(doc._id)}
                    aria-label={`Open ${doc.title || "Untitled document"}`}
                  >
                    <FileText size={16} />
                    <span className="document-row-text">
                      <span className="document-row-title">
                        {doc.title || "Untitled document"}
                      </span>
                      <span className="document-row-meta">
                        {doc.accessRole === "owner"
                          ? "Owned by you"
                          : `Shared by ${doc.owner.name}`}
                      </span>
                    </span>
                  </button>
                  <button
                    className="document-row-menu-button"
                    aria-label={`Options for ${doc.title || "Untitled document"}`}
                    title="Document options"
                    onClick={() =>
                      setDocMenuOpenId(docMenuOpenId === doc._id ? "" : doc._id)
                    }
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {docMenuOpenId === doc._id && (
                    <div className="document-row-menu">
                      {doc.accessRole === "owner" ? (
                        <button
                          className="delete-menu-item"
                          onClick={() => {
                            setDeleteTarget(doc);
                            setDocMenuOpenId("");
                          }}
                        >
                          <Trash2 size={14} /> Delete document
                        </button>
                      ) : (
                        <p>Shared with you</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {visibleDocs.length === 0 && (
                <p className="empty-list">No documents here yet.</p>
              )}
            </div>
            <div className="sidebar-bottom">
              <div className="user-card">
                <div className="avatar muted">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="user-card-text">
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                </div>
                <div className="user-menu-wrap">
                  <button
                    className="icon-button compact"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    aria-label="Account menu"
                    aria-expanded={userMenuOpen}
                  >
                    <MoreHorizontal size={17} />
                  </button>
                  {userMenuOpen && (
                    <div className="account-menu">
                      <button
                        onClick={() => {
                          setProfileOpen(true);
                          setUserMenuOpen(false);
                        }}
                      >
                        <UserRound size={15} /> Profile{" "}
                        <ChevronRight size={13} />
                      </button>
                      <button
                        className="account-logout"
                        onClick={() => {
                          setLogoutConfirmOpen(true);
                          setUserMenuOpen(false);
                        }}
                      >
                        <LogOut size={15} /> Log out
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <p>Made for focused work.</p>
            </div>
          </aside>
        )}
        <section className="editor-area">
          <div className="editor-topline">
            <button
              className="icon-button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle sidebar"
            >
              <PanelLeftClose size={17} />
            </button>
            <div className="breadcrumb">
              <span>Documents</span>
              <span>/</span>
              <strong>{activeDoc?.title || "No document selected"}</strong>
            </div>
            <div className="editor-top-actions">
              {activeDoc && activeDoc.accessRole === "owner" && (
                <button
                  className="secondary-button share-button"
                  onClick={() => setShareOpen(true)}
                >
                  <Share2 size={15} /> Share
                </button>
              )}
              <button
                className="icon-button"
                aria-label="More options"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <MoreHorizontal size={18} />
              </button>
              {menuOpen && (
                <div className="floating-menu">
                  <button
                    onClick={() => {
                      if (activeDoc)
                        navigator.clipboard.writeText(activeDoc.title);
                      setMenuOpen(false);
                      setNotice("Document title copied");
                    }}
                  >
                    Copy title
                  </button>
                  <button
                    onClick={() => {
                      if (activeDoc)
                        createDocument(
                          activeDoc.content,
                          `${activeDoc.title} copy`,
                        );
                      setMenuOpen(false);
                    }}
                  >
                    Make a copy
                  </button>
                </div>
              )}
            </div>
          </div>
          {activeDoc && editor ? (
            <>
              <div
                className="toolbar"
                role="toolbar"
                aria-label="Text formatting"
              >
                <div className="toolbar-group">
                  <button
                    className="toolbar-select"
                    onClick={() =>
                      editor.chain().focus().toggleHeading({ level: 1 }).run()
                    }
                    title="Toggle heading"
                  >
                    <Type size={15} /> <span>Text style</span>
                    <ChevronDown size={13} />
                  </button>
                </div>
                <span className="toolbar-separator" />
                <div className="toolbar-group">
                  <button
                    className={`tool-button ${editor.isActive("bold") ? "tool-active" : ""}`}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    aria-label="Bold"
                    title="Bold"
                  >
                    <Bold size={16} />
                  </button>
                  <button
                    className={`tool-button ${editor.isActive("italic") ? "tool-active" : ""}`}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    aria-label="Italic"
                    title="Italic"
                  >
                    <Italic size={16} />
                  </button>
                  <button
                    className={`tool-button ${editor.isActive("underline") ? "tool-active" : ""}`}
                    onClick={() =>
                      editor.chain().focus().toggleUnderline().run()
                    }
                    aria-label="Underline"
                    title="Underline"
                  >
                    <UnderlineIcon size={16} />
                  </button>
                </div>
                <span className="toolbar-separator" />
                <div className="toolbar-group">
                  <button
                    className={`tool-button ${editor.isActive("bulletList") ? "tool-active" : ""}`}
                    onClick={() =>
                      editor.chain().focus().toggleBulletList().run()
                    }
                    aria-label="Bulleted list"
                    title="Bulleted list"
                  >
                    <List size={17} />
                  </button>
                  <button
                    className={`tool-button ${editor.isActive("orderedList") ? "tool-active" : ""}`}
                    onClick={() =>
                      editor.chain().focus().toggleOrderedList().run()
                    }
                    aria-label="Numbered list"
                    title="Numbered list"
                  >
                    <ListOrdered size={17} />
                  </button>
                  <button
                    className={`tool-button ${editor.isActive("heading", { level: 2 }) ? "tool-active" : ""}`}
                    onClick={() =>
                      editor.chain().focus().toggleHeading({ level: 2 }).run()
                    }
                    aria-label="Heading 2"
                    title="Heading 2"
                  >
                    <AlignLeft size={16} />
                  </button>
                </div>
                <span className="toolbar-spacer" />
                <span className="toolbar-hint">
                  Formatting is saved automatically
                </span>
              </div>
              {activeDoc.accessRole === "viewer" && (
                <div className="read-only-notice">
                  You have view-only access to this document.
                </div>
              )}
              <div className="document-scroll">
                <article className="paper">
                  <input
                    className="document-title-input"
                    value={title}
                    maxLength={160}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setSaving(true);
                    }}
                    disabled={activeDoc.accessRole === "viewer"}
                    aria-label="Document title"
                  />
                  <div className="document-subtitle">
                    Last edited {savedAt ? dateLabel(savedAt) : "just now"} ·{" "}
                    {activeDoc.accessRole === "owner"
                      ? "Private to you"
                      : `Shared by ${activeDoc.owner.name}`}
                  </div>
                  <EditorContent editor={editor} />
                </article>
              </div>
              <div className="editor-footer">
                <span>
                  <Clock3 size={13} /> Changes save automatically
                </span>
                <span>
                  {activeDoc.accessRole === "owner"
                    ? "Only people you share with can access this document"
                    : `Access: ${activeDoc.accessRole}`}
                </span>
              </div>
            </>
          ) : (
            <div className="welcome-state">
              <div className="welcome-icon">
                <FileText size={25} />
              </div>
              <p className="eyebrow">YOUR WORKSPACE</p>
              <h1>A clear space to think.</h1>
              <p>
                Create a document, bring in a text file, or open something you
                have already written.
              </p>
              <div className="welcome-actions">
                <button
                  className="primary-button"
                  onClick={() => createDocument()}
                >
                  <Plus size={16} /> Create a document
                </button>
                <label className="secondary-button upload-button">
                  <Upload size={16} /> Import .txt or .md
                  <input
                    type="file"
                    accept=".txt,.md,text/plain,text/markdown"
                    onChange={(e) => {
                      importFile(e.target.files?.[0]);
                      e.currentTarget.value = "";
                    }}
                    hidden
                  />
                </label>
              </div>
              <div className="welcome-tip">
                <span>QUICK TIP</span>
                <p>
                  Use the Share button to invite a teammate by email and choose
                  whether they can edit or only view.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
      {error && (
        <div className="toast error-toast" role="alert">
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div className="toast success-toast">
          <Check size={16} />
          {notice}
        </div>
      )}
      {profileOpen && user && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setProfileOpen(false);
          }}
        >
          <section
            className="share-modal compact-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-title"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">YOUR ACCOUNT</p>
                <h2 id="profile-title">Profile</h2>
                <p>Your TeamDocs account details.</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setProfileOpen(false)}
                aria-label="Close profile"
              >
                <X size={18} />
              </button>
            </div>
            <div className="profile-summary">
              <div className="avatar profile-avatar">
                {user.name.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>
            </div>
            <div className="profile-note">
              <ShieldCheck size={15} /> Signed in to your personal workspace.
            </div>
            <div className="dialog-actions">
              <button
                className="secondary-button"
                onClick={() => setProfileOpen(false)}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
      {logoutConfirmOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setLogoutConfirmOpen(false);
          }}
        >
          <section
            className="share-modal compact-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="logout-title"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">END SESSION</p>
                <h2 id="logout-title">Log out of TeamDocs?</h2>
                <p>
                  You will return to the sign-in screen. Your saved documents
                  will remain in your workspace.
                </p>
              </div>
              <button
                className="icon-button"
                onClick={() => setLogoutConfirmOpen(false)}
                aria-label="Cancel logout"
              >
                <X size={18} />
              </button>
            </div>
            <div className="dialog-actions">
              <button
                className="secondary-button"
                onClick={() => setLogoutConfirmOpen(false)}
              >
                Stay signed in
              </button>
              <button className="danger-button" onClick={() => void logout()}>
                <LogOut size={15} /> Log out
              </button>
            </div>
          </section>
        </div>
      )}
      {deleteTarget && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <section
            className="share-modal compact-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">DOCUMENT MANAGEMENT</p>
                <h2 id="delete-title">Delete this document?</h2>
                <p>
                  <strong>“{deleteTarget.title || "Untitled document"}”</strong>{" "}
                  will be permanently removed from your workspace and from
                  everyone it was shared with. This cannot be undone.
                </p>
              </div>
              <button
                className="icon-button"
                onClick={() => setDeleteTarget(null)}
                aria-label="Cancel deletion"
              >
                <X size={18} />
              </button>
            </div>
            {deleteTarget.accessRole !== "owner" ? (
              <p className="inline-error">
                You can only delete documents you own.
              </p>
            ) : (
              <div className="dialog-actions">
                <button
                  className="secondary-button"
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancel
                </button>
                <button
                  className="danger-button"
                  disabled={busy}
                  onClick={() => void deleteDocument()}
                >
                  <Trash2 size={15} />
                  {busy ? "Deleting…" : "Delete document"}
                </button>
              </div>
            )}
            {deleteTarget.accessRole !== "owner" && (
              <div className="dialog-actions">
                <button
                  className="secondary-button"
                  onClick={() => setDeleteTarget(null)}
                >
                  Close
                </button>
              </div>
            )}
          </section>
        </div>
      )}
      {shareOpen && activeDoc && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShareOpen(false);
          }}
        >
          <section
            className="share-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-title"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">COLLABORATION</p>
                <h2 id="share-title">Share document</h2>
                <p>Invite someone to work on “{activeDoc.title}”.</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setShareOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={shareDocument}>
              <label className="field-label">
                Add people by email
                <input
                  type="email"
                  required
                  maxLength={254}
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  placeholder="teammate@company.com"
                />
              </label>
              <div className="share-role-row">
                <label className="field-label">
                  Permission
                  <select
                    value={shareRole}
                    onChange={(e) =>
                      setShareRole(e.target.value as "viewer" | "editor")
                    }
                  >
                    <option value="editor">Can edit</option>
                    <option value="viewer">Can view</option>
                  </select>
                </label>
                <button
                  className="primary-button invite-button"
                  disabled={busy}
                >
                  {busy ? "Sharing…" : "Share"}
                </button>
              </div>
            </form>
            <div className="people-heading">
              People with access <span>{activeDoc.shares.length + 1}</span>
            </div>
            <div className="people-list">
              <div className="person-row">
                <div className="avatar muted">
                  {activeDoc.owner.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="person-details">
                  <strong>{activeDoc.owner.name} (you)</strong>
                  <span>{activeDoc.owner.email}</span>
                </div>
                <span className="permission-pill">Owner</span>
              </div>
              {activeDoc.shares.map((share) => (
                <div className="person-row" key={share.user.email}>
                  <div className="avatar muted">
                    {share.user.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="person-details">
                    <strong>{share.user.name}</strong>
                    <span>{share.user.email}</span>
                  </div>
                  <span className="permission-pill">
                    {share.role === "editor" ? "Can edit" : "Can view"}
                  </span>
                  <button
                    className="remove-share"
                    onClick={() => removeShare(share.user.email)}
                    aria-label={`Remove ${share.user.name}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="modal-note">
              <ShieldCheck size={15} /> Only invited accounts can access this
              document.
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
