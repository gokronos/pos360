"use client";
import { useEffect, useState } from "react";
import { readJson } from "./api-client";
import SyncCenter from "./sync-center";
type Company = {
  id: string;
  name: string;
  country: string;
  status: string;
  role: string;
  branchCount: number;
  userCount: number;
};
type User = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  active: number;
  branches: string;
};
type Branch = { id: string; name: string };
const roleNames: { [key: string]: string } = {
  owner: "Propietario",
  admin: "Administrador",
  cashier: "Cajero",
  warehouse: "Bodeguero",
  accountant: "Contador",
};
const rolePerms: { [key: string]: string[] } = {
  owner: ["Todos los módulos", "Usuarios", "Configuración"],
  admin: ["Operación completa", "Usuarios", "Reportes"],
  cashier: ["Ventas", "Caja", "Clientes"],
  warehouse: ["Inventario", "Compras", "Recepciones"],
  accountant: ["Reportes", "Cartera", "Cuentas por pagar"],
};

export default function AdminSettings({
  notify,
}: {
  notify: (s: string) => void;
}) {
  const [tab, setTab] = useState<
      "companies" | "users" | "branches" | "audit" | "sync"
    >("users"),
    [tenantId, setTenantId] = useState(""),
    [companies, setCompanies] = useState<Company[]>([]),
    [users, setUsers] = useState<User[]>([]),
    [branches, setBranches] = useState<Branch[]>([]),
    [logs, setLogs] = useState<
      {
        action: string;
        entityType: string;
        details: string;
        createdAt: string;
        userName: string;
      }[]
    >([]),
    [modal, setModal] = useState<"company" | "user" | "branch" | null>(null),
    [company, setCompany] = useState({ name: "", country: "CO" }),
    [branch, setBranch] = useState({ name: "" }),
    [user, setUser] = useState({
      displayName: "",
      email: "",
      role: "cashier",
      branchId: "",
    });
  const load = async (next?: string) => {
    await fetch("/api/bootstrap");
    const id = next || tenantId,
      r = await fetch(`/api/admin${id ? `?tenantId=${id}` : ""}`),
      d = await readJson<any>(r);
    if (!r.ok) return notify(d.error);
    setCompanies(d.companies || []);
    setTenantId(d.tenantId);
    setUsers(d.users || []);
    setBranches(d.branches || []);
    setLogs(d.logs || []);
  };
  useEffect(() => {
    load();
  }, []);
  const create = async () => {
    const payload =
      modal === "company"
        ? { action: "company", ...company }
        : modal === "branch"
          ? { action: "branch", tenantId, ...branch }
          : { action: "user", tenantId, ...user };
    const r = await fetch("/api/admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
      d = await readJson<any>(r);
    if (!r.ok) return notify(d.error);
    setModal(null);
    notify(
      modal === "company"
        ? "Empresa creada con su sede principal"
        : modal === "branch"
          ? "Sede creada correctamente"
          : "Usuario y permisos asignados",
    );
    load(modal === "company" ? d.tenantId : tenantId);
  };
  const update = async (
    u: User,
    change: { role?: string; active?: boolean },
  ) => {
    const r = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId, userId: u.id, ...change }),
      }),
      d = await readJson<any>(r);
    if (!r.ok) return notify(d.error);
    notify("Permisos del usuario actualizados");
    load();
  };
  const current = companies.find((c) => c.id === tenantId);
  return (
    <>
      <div className="page-intro">
        <div>
          <h2>Empresas, usuarios y seguridad</h2>
          <p>Administre cada negocio, sus sedes y el acceso de su equipo.</p>
        </div>
        <button className="primary" onClick={() => setModal("company")}>
          + Nueva empresa
        </button>
      </div>
      <div className="tenant-switch">
        <div>
          <span>Empresa activa</span>
          <select value={tenantId} onChange={(e) => load(e.target.value)}>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="tenant-meta">
          <b>{current?.name || "POS360"}</b>
          <span>
            {current?.branchCount || 0} sedes · {current?.userCount || 0}{" "}
            usuarios · {current?.country || "CO"}
          </span>
        </div>
        <span className="status ok">Datos separados</span>
      </div>
      <div className="admin-tabs">
        <button
          className={tab === "users" ? "active" : ""}
          onClick={() => setTab("users")}
        >
          Usuarios y permisos
        </button>
        <button
          className={tab === "branches" ? "active" : ""}
          onClick={() => setTab("branches")}
        >
          Sedes
        </button>
        <button
          className={tab === "companies" ? "active" : ""}
          onClick={() => setTab("companies")}
        >
          Empresas
        </button>
        <button
          className={tab === "sync" ? "active" : ""}
          onClick={() => setTab("sync")}
        >
          Sincronización
        </button>
        <button
          className={tab === "audit" ? "active" : ""}
          onClick={() => setTab("audit")}
        >
          Auditoría
        </button>
      </div>
      {tab === "users" && (
        <article className="panel table-panel">
          <div className="filters">
            <b>Equipo de trabajo</b>
            <button
              className="primary compact"
              onClick={() => setModal("user")}
            >
              + Invitar usuario
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Sede asignada</th>
                <th>Permisos principales</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <b>{u.displayName}</b>
                    <small className="cell-sub">{u.email}</small>
                  </td>
                  <td>
                    <select
                      className="inline-select"
                      value={u.role}
                      disabled={u.role === "owner"}
                      onChange={(e) => update(u, { role: e.target.value })}
                    >
                      {Object.entries(roleNames).map(([v, n]) => (
                        <option key={v} value={v}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{u.branches || "Todas las sedes"}</td>
                  <td>
                    <div className="permission-tags">
                      {(rolePerms[u.role] || []).map((p) => (
                        <span key={p}>{p}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span
                      className={u.active ? "status ok" : "status inactive"}
                    >
                      {u.active ? "Activo" : "Suspendido"}
                    </span>
                  </td>
                  <td>
                    {u.role !== "owner" && (
                      <button
                        className="table-action"
                        onClick={() => update(u, { active: !u.active })}
                      >
                        {u.active ? "Suspender" : "Activar"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      )}
      {tab === "branches" && (
        <>
          <div className="tab-heading">
            <div>
              <h3>Sedes de {current?.name}</h3>
              <p>Cada usuario puede limitarse a una sede específica.</p>
            </div>
            <button className="primary" onClick={() => setModal("branch")}>
              + Nueva sede
            </button>
          </div>
          <div className="branch-grid">
            {branches.map((b, i) => (
              <article className="panel branch-card" key={b.id}>
                <span>⌂</span>
                <div>
                  <b>{b.name}</b>
                  <small>
                    {i === 0 ? "Sede principal" : "Sucursal activa"}
                  </small>
                </div>
                <i className="status ok">Activa</i>
              </article>
            ))}
          </div>
        </>
      )}
      {tab === "companies" && (
        <div className="company-grid">
          {companies.map((c) => (
            <button
              key={c.id}
              className={
                c.id === tenantId
                  ? "panel company-card selected"
                  : "panel company-card"
              }
              onClick={() => load(c.id)}
            >
              <div className="company-logo">
                {c.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <b>{c.name}</b>
                <small>
                  {c.country} · {roleNames[c.role] || c.role}
                </small>
                <span>
                  {c.branchCount} sedes · {c.userCount} usuarios
                </span>
              </div>
              <i className="status ok">
                {c.status === "active" ? "Activa" : c.status}
              </i>
            </button>
          ))}
        </div>
      )}
      {tab === "sync" && <SyncCenter notify={notify} />}
      {tab === "audit" && (
        <article className="panel table-panel">
          <div className="filters">
            <b>Registro de actividad</b>
            <span className="db-badge">● Trazabilidad activa</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Tipo</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {logs.length ? (
                logs.map((l, i) => (
                  <tr key={i}>
                    <td>{new Date(l.createdAt).toLocaleString("es-CO")}</td>
                    <td>{l.userName}</td>
                    <td>{l.action}</td>
                    <td>{l.entityType}</td>
                    <td>{l.details}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    Las nuevas acciones administrativas aparecerán aquí.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </article>
      )}
      {modal && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <section
            className="modal compact-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3>
                  {modal === "company"
                    ? "Registrar nueva empresa"
                    : modal === "branch"
                      ? "Crear una sede"
                      : "Invitar usuario"}
                </h3>
                <p>
                  {modal === "company"
                    ? "Se creará con datos totalmente independientes"
                    : current?.name}
                </p>
              </div>
              <button onClick={() => setModal(null)}>×</button>
            </div>
            <div className="payment-body">
              {modal === "company" ? (
                <>
                  <label>
                    Nombre comercial
                    <input
                      value={company.name}
                      onChange={(e) =>
                        setCompany({ ...company, name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    País
                    <select
                      value={company.country}
                      onChange={(e) =>
                        setCompany({ ...company, country: e.target.value })
                      }
                    >
                      <option value="CO">Colombia</option>
                      <option value="MX">México</option>
                      <option value="PE">Perú</option>
                      <option value="EC">Ecuador</option>
                      <option value="PA">Panamá</option>
                    </select>
                  </label>
                </>
              ) : modal === "branch" ? (
                <label>
                  Nombre de la sede
                  <input
                    value={branch.name}
                    onChange={(e) => setBranch({ name: e.target.value })}
                    placeholder="Ej. Sede Norte"
                  />
                </label>
              ) : (
                <>
                  <label>
                    Nombre completo
                    <input
                      value={user.displayName}
                      onChange={(e) =>
                        setUser({ ...user, displayName: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Correo electrónico
                    <input
                      type="email"
                      value={user.email}
                      onChange={(e) =>
                        setUser({ ...user, email: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Rol
                    <select
                      value={user.role}
                      onChange={(e) =>
                        setUser({ ...user, role: e.target.value })
                      }
                    >
                      {Object.entries(roleNames)
                        .filter(([r]) => r !== "owner")
                        .map(([v, n]) => (
                          <option key={v} value={v}>
                            {n}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Sede
                    <select
                      value={user.branchId}
                      onChange={(e) =>
                        setUser({ ...user, branchId: e.target.value })
                      }
                    >
                      <option value="">Todas las sedes</option>
                      {branches.map((b) => (
                        <option value={b.id} key={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="permission-preview">
                    <b>Permisos que recibirá</b>
                    {(rolePerms[user.role] || []).map((p) => (
                      <span key={p}>✓ {p}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button className="primary" onClick={create}>
                {modal === "company"
                  ? "Crear empresa"
                  : modal === "branch"
                    ? "Crear sede"
                    : "Crear usuario"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
