"use client";
import { useEffect, useState } from "react";
import { getDeviceId } from "./offline-sync";
import { apiJson, readJson } from "./api-client";
export default function SyncCenter({
  notify,
}: {
  notify: (s: string) => void;
}) {
  const [data, setData] = useState<{
    summary?: { totalEvents: number; devices: number; lastSync: string };
    events?: {
      eventType: string;
      entityId: string;
      deviceId: string;
      status: string;
      createdAt: string;
    }[];
    conflicts?: {
      id: string;
      entityType: string;
      entityId: string;
      deviceId: string;
      localVersion: number;
      serverVersion: number;
      status: string;
      resolution: string;
      createdAt: string;
    }[];
  }>({});
  const load = () => apiJson<typeof data>("/api/sync-status").then(setData);
  useEffect(() => {
    load();
  }, []);
  const resolve = async (id: string, resolution: "server" | "local") => {
    const r = await fetch("/api/sync-status", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, resolution }),
      }),
      d = await readJson<{ resolved: boolean }>(r);
    if (!r.ok) return notify(d.error);
    notify(
      resolution === "server"
        ? "Se conservó la versión central"
        : "Se aplicó el cambio de la sede",
    );
    load();
  };
  const pending = (data.conflicts || []).filter((x) => x.status === "pending");
  return (
    <>
      <div className="sync-summary">
        <div>
          <span>Este equipo</span>
          <b>{typeof window !== "undefined" ? getDeviceId() : "POS360"}</b>
        </div>
        <div>
          <span>Equipos sincronizados</span>
          <b>{data.summary?.devices || 0}</b>
        </div>
        <div>
          <span>Eventos procesados</span>
          <b>{data.summary?.totalEvents || 0}</b>
        </div>
        <div>
          <span>Conflictos pendientes</span>
          <b className={pending.length ? "debt" : "green"}>{pending.length}</b>
        </div>
      </div>
      {pending.length > 0 && (
        <article className="panel table-panel">
          <div className="filters">
            <b>Conflictos que requieren decisión</b>
            <span className="status low">{pending.length} pendiente(s)</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Registro</th>
                <th>Equipo</th>
                <th>Versión local</th>
                <th>Versión central</th>
                <th>Fecha</th>
                <th>Resolver</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((c) => (
                <tr key={c.id}>
                  <td>
                    <b>{c.entityType}</b>
                    <small className="cell-sub">{c.entityId}</small>
                  </td>
                  <td>{c.deviceId}</td>
                  <td>{c.localVersion}</td>
                  <td>{c.serverVersion}</td>
                  <td>{new Date(c.createdAt).toLocaleString("es-CO")}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="table-action"
                        onClick={() => resolve(c.id, "server")}
                      >
                        Conservar central
                      </button>
                      <button
                        className="table-action"
                        onClick={() => resolve(c.id, "local")}
                      >
                        Aplicar sede
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      )}
      <article className="panel table-panel sync-events">
        <div className="filters">
          <b>Historial de sincronización</b>
          <span className="db-badge">● Cola automática activa</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Evento</th>
              <th>Equipo</th>
              <th>Registro</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {(data.events || []).length ? (
              (data.events || []).map((e, i) => (
                <tr key={i}>
                  <td>{new Date(e.createdAt).toLocaleString("es-CO")}</td>
                  <td>{e.eventType}</td>
                  <td>{e.deviceId}</td>
                  <td>{e.entityId}</td>
                  <td>
                    <span className="status ok">{e.status}</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>
                  Las operaciones sincronizadas aparecerán aquí.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </article>
    </>
  );
}
