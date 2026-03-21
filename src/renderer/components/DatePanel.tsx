import React, { useEffect, useMemo, useState } from "react";
import AppPickerModal from "./AppPickerModal";

function IconEdit() {
  return (
    <svg
      className="iconBtnSvg"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
      />
    </svg>
  );
}

function IconDelete() {
  return (
    <svg
      className="iconBtnSvg"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
      />
    </svg>
  );
}

type EventItem = {
  id: string;
  title: string;
  time: string;
  link?: string;
};

type TodoItem = {
  id: string;
  title: string;
  attachedAppName?: string;
  attachedAppId?: string; // Windows AppID for launching
  completed: boolean;
};

type DateData = {
  events: EventItem[];
  todos: TodoItem[];
};

type Props = {
  open: boolean;
  dateKey: string; // YYYY-MM-DD
  initialData: DateData;
  onClose: () => void;
  onPersist: (
    dateKey: string,
    payload: { events?: EventItem[]; todos?: TodoItem[] }
  ) => Promise<void>;
};

function formatDateLabel(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map((x) => Number(x));
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(dt);
}

function normalizeForDisplay(s: string) {
  return s.trim();
}

export default function DatePanel({
  open,
  dateKey,
  initialData,
  onClose,
  onPersist
}: Props) {
  const api = (window as any).api as
    | undefined
    | {
        resolveAppName?: (typedName: string) => Promise<
          Array<{ displayName: string; exePath: string }>
        >;
        openExternal?: (url: string) => Promise<void>;
        openPath?: (p: string) => Promise<void>;
        launchAppById?: (appId: string) => Promise<{ success: boolean; error?: string }>;
      };

  const [events, setEvents] = useState<EventItem[]>(initialData.events);
  const [todos, setTodos] = useState<TodoItem[]>(initialData.todos);

  useEffect(() => {
    setEvents(initialData.events);
    setTodos(initialData.todos);
  }, [initialData.events, initialData.todos]);

  // Add Event state
  const [eventTitle, setEventTitle] = useState("");
  const [eventTime, setEventTime] = useState("09:00");
  const [eventLink, setEventLink] = useState("");

  // Add Todo state
  const [todoTitle, setTodoTitle] = useState("");
  const [attachQuery, setAttachQuery] = useState("");
  const [attachCandidates, setAttachCandidates] = useState<
    Array<{ displayName: string; exePath: string }>
  >([]);
  const [attachedAppName, setAttachedAppName] = useState<string | undefined>(
    undefined
  );

  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolveCandidates, setResolveCandidates] = useState<
    Array<{ displayName: string; exePath: string }>
  >([]);

  // Collapsible add form states
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);

  // Edit todo state
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editTodoTitle, setEditTodoTitle] = useState("");
  const [editTodoApp, setEditTodoApp] = useState<string | undefined>();
  const [editAttachQuery, setEditAttachQuery] = useState("");
  const [editAttachCandidates, setEditAttachCandidates] = useState<
    Array<{ displayName: string; exePath: string }>
  >([]);

  // Edit event state
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editEventTitle, setEditEventTitle] = useState("");
  const [editEventTime, setEditEventTime] = useState("");
  const [editEventLink, setEditEventLink] = useState("");

  // App picker modal state
  const [appPickerOpen, setAppPickerOpen] = useState(false);
  const [appPickerMode, setAppPickerMode] = useState<"add" | "edit">("add");
  const [attachedAppId, setAttachedAppId] = useState<string | undefined>();
  const [editTodoAppId, setEditTodoAppId] = useState<string | undefined>();

  const attachedLabel = useMemo(
    () => (attachedAppName ? normalizeForDisplay(attachedAppName) : undefined),
    [attachedAppName]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const q = attachQuery.trim();
      if (!open) return;
      if (q.length < 1) {
        setAttachCandidates([]);
        return;
      }
      if (!api?.resolveAppName) return;
      const candidates = await api.resolveAppName(q);
      if (!cancelled) setAttachCandidates(candidates);
    })();
    return () => {
      cancelled = true;
    };
  }, [attachQuery, open]);

  // Edit attach query resolver
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const q = editAttachQuery.trim();
      if (!open || !editingTodoId) return;
      if (q.length < 1) {
        setEditAttachCandidates([]);
        return;
      }
      if (!api?.resolveAppName) return;
      const candidates = await api.resolveAppName(q);
      if (!cancelled) setEditAttachCandidates(candidates);
    })();
    return () => {
      cancelled = true;
    };
  }, [editAttachQuery, open, editingTodoId]);

  async function saveEvents(nextEvents: EventItem[]) {
    setEvents(nextEvents);
    await onPersist(dateKey, { events: nextEvents });
  }

  async function saveTodos(nextTodos: TodoItem[]) {
    setTodos(nextTodos);
    await onPersist(dateKey, { todos: nextTodos });
  }

  async function joinEvent(link?: string) {
    if (!link) return;
    await api?.openExternal?.(link);
  }

  async function launchApp(todo: TodoItem) {
    // Prefer AppID if available (more reliable)
    if (todo.attachedAppId && api?.launchAppById) {
      const result = await api.launchAppById(todo.attachedAppId);
      if (result.success) return;
      // Fall through to name-based launch if AppID fails
    }

    // Fallback to name-based resolution
    const appName = todo.attachedAppName;
    if (!appName) return;
    if (!api?.resolveAppName || !api.openPath) return;
    const candidates = await api.resolveAppName(appName);
    if (candidates.length === 1) {
      await api.openPath(candidates[0].exePath);
      return;
    }
    if (candidates.length === 0) {
      alert(`No installed app found for "${appName}".`);
      return;
    }

    setResolveCandidates(candidates);
    setResolveModalOpen(true);
  }

  async function confirmResolveAndLaunch(candidateIndex: number) {
    const candidate = resolveCandidates[candidateIndex];
    setResolveModalOpen(false);
    setResolveCandidates([]);
    if (candidate?.exePath) {
      await api?.openPath?.(candidate.exePath);
    }
  }

  function resetAddForms() {
    setEventTitle("");
    setEventTime("09:00");
    setEventLink("");
    setTodoTitle("");
    setAttachQuery("");
    setAttachCandidates([]);
    setAttachedAppName(undefined);
    setAttachedAppId(undefined);
    setShowTodoForm(false);
    setShowEventForm(false);
  }

  // Todo edit/delete functions
  function startEditTodo(todo: TodoItem) {
    setEditingTodoId(todo.id);
    setEditTodoTitle(todo.title);
    setEditTodoApp(todo.attachedAppName);
    setEditTodoAppId(todo.attachedAppId);
    setEditAttachQuery(todo.attachedAppName || "");
  }

  async function saveEditTodo() {
    if (!editTodoTitle.trim()) return;
    const next = todos.map(t => 
      t.id === editingTodoId 
        ? { ...t, title: editTodoTitle.trim(), attachedAppName: editTodoApp, attachedAppId: editTodoAppId }
        : t
    );
    await saveTodos(next);
    setEditingTodoId(null);
    setEditTodoTitle("");
    setEditTodoApp(undefined);
    setEditTodoAppId(undefined);
    setEditAttachQuery("");
    setEditAttachCandidates([]);
  }

  function cancelEditTodo() {
    setEditingTodoId(null);
    setEditTodoTitle("");
    setEditTodoApp(undefined);
    setEditTodoAppId(undefined);
    setEditAttachQuery("");
    setEditAttachCandidates([]);
  }

  async function deleteTodo(id: string) {
    if (!confirm("Delete this task?")) return;
    const next = todos.filter(t => t.id !== id);
    await saveTodos(next);
  }

  // Event edit/delete functions
  function startEditEvent(event: EventItem) {
    setEditingEventId(event.id);
    setEditEventTitle(event.title);
    setEditEventTime(event.time);
    setEditEventLink(event.link || "");
  }

  async function saveEditEvent() {
    if (!editEventTitle.trim()) return;
    const next = events.map(e => 
      e.id === editingEventId 
        ? { ...e, title: editEventTitle.trim(), time: editEventTime, link: editEventLink.trim() || undefined }
        : e
    );
    await saveEvents(next);
    setEditingEventId(null);
    setEditEventTitle("");
    setEditEventTime("");
    setEditEventLink("");
  }

  function cancelEditEvent() {
    setEditingEventId(null);
    setEditEventTitle("");
    setEditEventTime("");
    setEditEventLink("");
  }

  async function deleteEvent(id: string) {
    if (!confirm("Delete this event?")) return;
    const next = events.filter(e => e.id !== id);
    await saveEvents(next);
  }

  useEffect(() => {
    if (open) resetAddForms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, open]);

  if (!open) {
    return null;
  }

  return (
    <aside
      className="datePanelInline"
      data-wallpaper-interactive
      role="dialog"
      aria-modal="true"
    >
        <div className="datePanelTop">
          <div className="datePanelTitle">{formatDateLabel(dateKey)}</div>
          <button className="datePanelCloseBtn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="datePanelBody">
          <div className="dateColumns">
            {/* TODO BLOCK - Top */}
            <div className="dateColumn">
              <div className="dateSection">
                <div className="blockHeader">To-Dos</div>
                <div className="dateList">
                  {todos.length === 0 ? (
                    <div className="emptyState">No to-dos yet.</div>
                  ) : (
                    todos.map((td) => (
                      <div key={td.id} className="listRow">
                        {editingTodoId === td.id ? (
                          <div className="editForm">
                            <input
                              className="textInput"
                              value={editTodoTitle}
                              onChange={(e) => setEditTodoTitle(e.target.value)}
                              placeholder="Task title"
                            />
                            <div className="attachBlock">
                              <div className="attachLabel">Attach app</div>
                              <button
                                className="attachAppBtn"
                                type="button"
                                onClick={() => {
                                  setAppPickerMode("edit");
                                  setAppPickerOpen(true);
                                }}
                              >
                                <span className="attachAppIcon">📱</span>
                                {editTodoApp ? `Change: ${editTodoApp}` : "Select App"}
                              </button>
                            </div>
                            <div className="editFormActions">
                              <button className="saveBtn" onClick={saveEditTodo}>Save</button>
                              <button onClick={cancelEditTodo}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <label className="todoCheck">
                              <input
                                type="checkbox"
                                checked={td.completed}
                                onChange={async () => {
                                  const next = todos.map((t) =>
                                    t.id === td.id
                                      ? { ...t, completed: !t.completed }
                                      : t
                                  );
                                  await saveTodos(next);
                                }}
                              />
                              <span
                                className={[
                                  "todoTitle",
                                  td.completed ? "todoTitleDone" : ""
                                ].join(" ")}
                              >
                                {td.title}
                              </span>
                            </label>

                            <div className="todoApp">
                              {td.attachedAppName ? (
                                <button
                                  className="appLaunchBtn"
                                  onClick={() => launchApp(td)}
                                  title={td.attachedAppName}
                                >
                                  {td.attachedAppName}
                                </button>
                              ) : (
                                <div className="listRowMeta">No app</div>
                              )}
                            </div>

                            <div className="listRowActions">
                              <button
                                type="button"
                                className="iconBtn"
                                onClick={() => startEditTodo(td)}
                                title="Edit"
                              >
                                <IconEdit />
                              </button>
                              <button
                                type="button"
                                className="iconBtn iconBtnDelete"
                                onClick={() => deleteTodo(td.id)}
                                title="Delete"
                              >
                                <IconDelete />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {!showTodoForm && (
                  <button
                    className="addToggleBtn"
                    onClick={() => setShowTodoForm(true)}
                  >
                    + Add Task
                  </button>
                )}

                {showTodoForm && (
                  <div className="addCard">
                    <div className="addCardTitle">Add To-Do</div>
                    <input
                      className="textInput"
                      value={todoTitle}
                      onChange={(e) => setTodoTitle(e.target.value)}
                      placeholder="Task title"
                    />

                    <div className="attachBlock">
                      <div className="attachLabel">Attach app</div>
                      <button
                        className="attachAppBtn"
                        type="button"
                        onClick={() => {
                          setAppPickerMode("add");
                          setAppPickerOpen(true);
                        }}
                      >
                        <span className="attachAppIcon">📱</span>
                        {attachedLabel ? `Change: ${attachedLabel}` : "Select App"}
                      </button>

                      {attachedLabel && (
                        <div className="attachSelected">
                          Selected: {attachedLabel}
                        </div>
                      )}
                    </div>

                    <button
                      className="primaryBtn"
                      onClick={async () => {
                        const title = todoTitle.trim();
                        if (!title) return;
                        const nextTodo: TodoItem = {
                          id: crypto.randomUUID(),
                          title,
                          attachedAppName: attachedAppName,
                          attachedAppId: attachedAppId,
                          completed: false
                        };
                        await saveTodos([...todos, nextTodo]);
                        resetAddForms();
                      }}
                    >
                      Add To-Do
                    </button>
                    <button
                      className="secondaryBtn"
                      onClick={() => setShowTodoForm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* EVENTS BLOCK - Bottom */}
            <div className="dateColumn">
              <div className="dateSection">
                <div className="blockHeader">Events</div>
                <div className="dateList">
                  {events.length === 0 ? (
                    <div className="emptyState">No events yet.</div>
                  ) : (
                    events.map((ev) => (
                      <div key={ev.id} className="listRow">
                        {editingEventId === ev.id ? (
                          <div className="editForm">
                            <input
                              className="textInput"
                              value={editEventTitle}
                              onChange={(e) => setEditEventTitle(e.target.value)}
                              placeholder="Title"
                            />
                            <input
                              className="textInput"
                              type="time"
                              value={editEventTime}
                              onChange={(e) => setEditEventTime(e.target.value)}
                            />
                            <input
                              className="textInput"
                              value={editEventLink}
                              onChange={(e) => setEditEventLink(e.target.value)}
                              placeholder="Optional link (Zoom/Meet URL)"
                            />
                            <div className="editFormActions">
                              <button className="saveBtn" onClick={saveEditEvent}>Save</button>
                              <button onClick={cancelEditEvent}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="listRowMain">
                              <div className="listRowTitle">{ev.title}</div>
                              <div className="listRowMeta">{ev.time}</div>
                            </div>
                            {ev.link ? (
                              <button
                                className="primaryBtn"
                                onClick={() => joinEvent(ev.link)}
                              >
                                Join
                              </button>
                            ) : (
                              <div className="listRowMeta">No link</div>
                            )}
                            <div className="listRowActions">
                              <button
                                type="button"
                                className="iconBtn"
                                onClick={() => startEditEvent(ev)}
                                title="Edit"
                              >
                                <IconEdit />
                              </button>
                              <button
                                type="button"
                                className="iconBtn iconBtnDelete"
                                onClick={() => deleteEvent(ev.id)}
                                title="Delete"
                              >
                                <IconDelete />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {!showEventForm && (
                  <button
                    className="addToggleBtn"
                    onClick={() => setShowEventForm(true)}
                  >
                    + Add Event
                  </button>
                )}

                {showEventForm && (
                  <div className="addCard">
                    <div className="addCardTitle">Add Event</div>
                    <input
                      className="textInput"
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      placeholder="Title"
                    />
                    <input
                      className="textInput"
                      type="time"
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                    />
                    <input
                      className="textInput"
                      value={eventLink}
                      onChange={(e) => setEventLink(e.target.value)}
                      placeholder="Optional link (Zoom/Meet URL)"
                    />
                    <button
                      className="primaryBtn"
                      onClick={async () => {
                        const title = eventTitle.trim();
                        if (!title) return;
                        const next: EventItem = {
                          id: crypto.randomUUID(),
                          title,
                          time: eventTime,
                          link: eventLink.trim() ? eventLink.trim() : undefined
                        };
                        await saveEvents([...events, next]);
                        resetAddForms();
                      }}
                    >
                      Add Event
                    </button>
                    <button
                      className="secondaryBtn"
                      onClick={() => setShowEventForm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {resolveModalOpen && (
          <div
            className="resolveModalOverlay"
            data-wallpaper-interactive
            onClick={() => setResolveModalOpen(false)}
          >
            <div
              className="resolveModal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="resolveModalTitle">Select the correct app</div>
              <div className="resolveModalList">
                {resolveCandidates.map((c, idx) => (
                  <button
                    key={`${c.displayName}-${c.exePath}-${idx}`}
                    className="resolveCandidate"
                    onClick={() => confirmResolveAndLaunch(idx)}
                  >
                    {c.displayName}
                  </button>
                ))}
              </div>
              <button className="secondaryBtn" onClick={() => setResolveModalOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <AppPickerModal
          open={appPickerOpen}
          onClose={() => setAppPickerOpen(false)}
          onSelect={(app) => {
            if (appPickerMode === "add") {
              setAttachedAppName(app.Name);
              setAttachedAppId(app.AppID);
              setAttachQuery(app.Name);
            } else {
              setEditTodoApp(app.Name);
              setEditTodoAppId(app.AppID);
              setEditAttachQuery(app.Name);
            }
          }}
        />
    </aside>
  );
}

