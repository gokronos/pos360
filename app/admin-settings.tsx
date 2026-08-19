"use client";
import { useEffect, useState } from "react";
import { apiJson, readJson } from "./api-client";
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
  branchIds: string | null;
};
type Branch = { id: string; name: string };
type Permission = {
  role: string;
  module: string;
  canView: number;
  canCreate: number;
  canEdit: number;
  canDelete: number;
};
const modules = [
  "dashboard",
  "pos",
  "inventory",
  "purchases",
  "customers",
  "reports",
  "settings",
  "users",
];
const roleNames: { [key: string]: string } = {
  owner: "Propietario",
  admin: "Administrador",
  supervisor: "Supervisor",
  cashier: "Cajero",
  purchasing: "Compras",
  warehouse: "Bodeguero",
  auditor: "Auditor",
};
const rolePerms: { [key: string]: string[] } = {
  owner: ["Todos los módulos", "Usuarios", "Configuración"],
  admin: ["Operación completa", "Usuarios", "Reportes"],
  supervisor: ["Autorizaciones", "Operación", "Reportes"],
  cashier: ["Ventas", "Caja", "Clientes"],
  purchasing: ["Compras", "Proveedores", "Inventario"],
  warehouse: ["Inventario", "Compras", "Recepciones"],
  auditor: ["Reportes", "Cartera", "Auditoría"],
};

export default function AdminSettings({
  notify,
}: {
  notify: (s: string) => void;
}) {
  const [tab, setTab] = useState<
      | "companies"
      | "users"
      | "permissions"
      | "branches"
      | "resources"
      | "audit"
      | "sync"
    >("users"),
    [tenantId, setTenantId] = useState(""),
    [companies, setCompanies] = useState<Company[]>([]),
    [users, setUsers] = useState<User[]>([]),
    [branches, setBranches] = useState<Branch[]>([]),
    [permissions, setPermissions] = useState<Permission[]>([]),
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
    setPermissions(d.permissions || []);
    setLogs(d.logs || []);
    if (next && d.branches?.[0]?.id) {
      await apiJson("/api/context", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenantId: d.tenantId,
          branchId: d.branches[0].id,
        }),
      });
      window.location.reload();
    }
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
    change: { role?: string; active?: boolean; branchId?: string | null },
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
  const togglePermission = async (
    role: string,
    module: string,
    permission: "view" | "create" | "edit" | "delete",
    value: boolean,
  ) => {
    try {
      await apiJson("/api/admin", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "permission",
          tenantId,
          role,
          module,
          permission,
          value,
        }),
      });
      notify("Permiso actualizado y auditado");
      await load();
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "No fue posible actualizar el permiso",
      );
    }
  };
  const permissionValue = (
    role: string,
    module: string,
    key: keyof Pick<
      Permission,
      "canView" | "canCreate" | "canEdit" | "canDelete"
    >,
  ) =>
    Boolean(
      permissions.find((p) => p.role === role && p.module === module)?.[key],
    );
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
          className={tab === "permissions" ? "active" : ""}
          onClick={() => setTab("permissions")}
        >
          Matriz de permisos
        </button>
        <button
          className={tab === "companies" ? "active" : ""}
          onClick={() => setTab("companies")}
        >
          Empresas
        </button>
        <button
          className={tab === "resources" ? "active" : ""}
          onClick={() => setTab("resources")}
        >
          Bodegas, cajas y terminales
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
                  <td>
                    <select
                      className="inline-select"
                      value={u.branchIds?.split(",")[0] || ""}
                      disabled={u.role === "owner"}
                      onChange={(e) =>
                        update(u, { branchId: e.target.value || null })
                      }
                    >
                      <option value="">Todas las sedes</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                    <small className="cell-sub">
                      {u.branches || "Sin restricción por sede"}
                    </small>
                  </td>
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
      {tab === "permissions" && (
        <article className="panel table-panel">
          <div className="filters">
            <b>Permisos por rol, módulo y acción</b>
            <span className="db-badge">● Cambios auditados</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Rol</th>
                <th>Módulo</th>
                <th>Ver</th>
                <th>Crear</th>
                <th>Editar</th>
                <th>Eliminar</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(roleNames)
                .filter((role) => role !== "owner")
                .flatMap((role) =>
                  modules.map((module) => (
                    <tr key={`${role}-${module}`}>
                      <td>{roleNames[role]}</td>
                      <td>{module}</td>
                      {(["view", "create", "edit", "delete"] as const).map(
                        (action) => {
                          const key = (
                              {
                                view: "canView",
                                create: "canCreate",
                                edit: "canEdit",
                                delete: "canDelete",
                              } as const
                            )[action],
                            checked = permissionValue(role, module, key);
                          return (
                            <td key={action}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  togglePermission(
                                    role,
                                    module,
                                    action,
                                    e.target.checked,
                                  )
                                }
                              />
                            </td>
                          );
                        },
                      )}
                    </tr>
                  )),
                )}
            </tbody>
          </table>
        </article>
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
      {tab === "resources" && <OrganizationResources notify={notify} />}
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

type Resource = {
  id: string;
  name: string;
  code?: string;
  branchId: string;
  branchName: string;
  registerId?: string;
  status?: string;
};
function OrganizationResources({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const [data, setData] = useState<{
    branches: Branch[];
    warehouses: Resource[];
    registers: Resource[];
    terminals: Resource[];
  }>({ branches: [], warehouses: [], registers: [], terminals: [] });
  const [form, setForm] = useState({
    action: "warehouse",
    branchId: "",
    registerId: "",
    name: "",
    code: "",
  });
  const load = () =>
    apiJson<typeof data>("/api/organization")
      .then((next) => {
        setData(next);
        setForm((current) => ({
          ...current,
          branchId: current.branchId || next.branches[0]?.id || "",
        }));
      })
      .catch((error) =>
        notify(
          error instanceof Error
            ? error.message
            : "No fue posible cargar la organización",
        ),
      );
  useEffect(() => {
    void load();
  }, []);
  const save = async () => {
    try {
      await apiJson("/api/organization", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      notify("Recurso creado y auditado");
      setForm({ ...form, name: "", code: "" });
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : "No fue posible guardar");
    }
  };
  const rows = [
    ...data.warehouses.map((x) => ({ ...x, type: "Bodega" })),
    ...data.registers.map((x) => ({ ...x, type: "Caja" })),
    ...data.terminals.map((x) => ({ ...x, type: "Terminal" })),
  ];
  return (
    <>
      <div className="tab-heading">
        <div>
          <h3>Operación por sede</h3>
          <p>
            Bodegas, cajas registradoras y terminales vinculadas a la empresa
            activa.
          </p>
        </div>
      </div>
      <article className="panel">
        <div className="form-grid">
          <label>
            Tipo
            <select
              value={form.action}
              onChange={(e) =>
                setForm({ ...form, action: e.target.value, registerId: "" })
              }
            >
              <option value="warehouse">Bodega</option>
              <option value="register">Caja</option>
              <option value="terminal">Terminal</option>
            </select>
          </label>
          <label>
            Sede
            <select
              value={form.branchId}
              onChange={(e) => setForm({ ...form, branchId: e.target.value })}
            >
              {data.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nombre
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          {form.action !== "register" && (
            <label>
              Código
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </label>
          )}
          {form.action === "terminal" && (
            <label>
              Caja asociada
              <select
                value={form.registerId}
                onChange={(e) =>
                  setForm({ ...form, registerId: e.target.value })
                }
              >
                <option value="">Sin caja</option>
                {data.registers
                  .filter((r) => r.branchId === form.branchId)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <button className="primary" onClick={save}>
            Crear recurso
          </button>
        </div>
      </article>
      <article className="panel table-panel">
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Nombre</th>
              <th>Código</th>
              <th>Sede</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.type}-${row.id}`}>
                <td>{row.type}</td>
                <td>
                  <b>{row.name}</b>
                </td>
                <td>{row.code || "—"}</td>
                <td>{row.branchName}</td>
                <td>
                  <span className="status ok">{row.status || "Activa"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </>
  );
}
