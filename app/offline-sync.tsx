"use client";
import { useEffect, useState } from "react";
type Queued = {
  id: string;
  url: string;
  method: string;
  body: string;
  createdAt: string;
  attempts: number;
};
const KEY = "pos360_offline_queue",
  DEVICE = "pos360_device_id";
export const getDeviceId = () => {
  let id = localStorage.getItem(DEVICE);
  if (!id) {
    id = `POS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    localStorage.setItem(DEVICE, id);
  }
  return id;
};
const read = (): Queued[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
};
const write = (q: Queued[]) => {
  localStorage.setItem(KEY, JSON.stringify(q));
  window.dispatchEvent(new Event("pos360-sync-change"));
};
export async function offlineRequest(
  url: string,
  method: string,
  body: Record<string, unknown>,
) {
  const payload = { ...body, deviceId: getDeviceId() };
  try {
    return await fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        "x-pos360-device-id": getDeviceId(),
      },
      body: JSON.stringify(payload),
    });
  } catch {
    const item = {
      id: crypto.randomUUID(),
      url,
      method,
      body: JSON.stringify(payload),
      createdAt: new Date().toISOString(),
      attempts: 0,
    };
    write([...read(), item]);
    const isSale = url === "/api/sales";
    return new Response(
      JSON.stringify({
        queued: true,
        offlineId: item.id,
        ...(isSale
          ? {
              sale: {
                number: `LOCAL-${item.id.slice(0, 6).toUpperCase()}`,
                total: Number(body.total || 0),
                method: String(body.method || "offline"),
                change: 0,
                syncStatus: "pending",
              },
            }
          : {}),
      }),
      { status: 202, headers: { "content-type": "application/json" } },
    );
  }
}
export const offlinePost = (url: string, body: unknown) =>
  offlineRequest(url, "POST", body as Record<string, unknown>);
export const offlinePatch = (url: string, body: unknown) =>
  offlineRequest(url, "PATCH", body as Record<string, unknown>);
async function flush() {
  if (!navigator.onLine) return;
  const pending = read(),
    remaining: Queued[] = [];
  for (const item of pending) {
    try {
      const r = await fetch(item.url, {
        method: item.method,
        headers: {
          "content-type": "application/json",
          "x-pos360-device-id": getDeviceId(),
          "x-pos360-operation-id": item.id,
        },
        body: item.body,
      });
      if (!r.ok && r.status !== 409)
        remaining.push({ ...item, attempts: item.attempts + 1 });
      if (r.status === 409) {
        const d = await r
          .clone()
          .json()
          .catch(() => ({}));
        if (d.conflict) continue;
      }
    } catch {
      remaining.push({ ...item, attempts: item.attempts + 1 });
    }
  }
  write(remaining);
}
export default function SyncStatus() {
  const [online, setOnline] = useState(true),
    [pending, setPending] = useState(0),
    [deviceId, setDeviceId] = useState("POS360");
  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      setPending(read().length);
      setDeviceId(getDeviceId());
    };
    update();
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
    const onOnline = () => {
        update();
        flush().then(update);
      },
      onOffline = () => update();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("pos360-sync-change", update);
    const timer = setInterval(() => flush().then(update), 30000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("pos360-sync-change", update);
    };
  }, []);
  return (
    <div
      className={online ? "sidebar-status" : "sidebar-status offline"}
      title={`Equipo ${deviceId}`}
    >
      <span className={online ? "online-dot" : "offline-dot"} />
      <div>
        <b>
          {online
            ? pending
              ? "Sincronizando"
              : "Conectado"
            : "Modo sin conexión"}
        </b>
        <small>
          {pending
            ? `${pending} operación(es) pendiente(s)`
            : online
              ? "Información sincronizada"
              : "Ventas y registros se guardarán localmente"}
        </small>
      </div>
    </div>
  );
}
