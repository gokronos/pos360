"use client";

import { useState } from "react";
import type { Session } from "./access-control";
import { readJson } from "./api-client";

const countryOptions = {
  CO: { name: "Colombia", currency: "COP", timezone: "America/Bogota" },
  MX: { name: "México", currency: "MXN", timezone: "America/Mexico_City" },
  PE: { name: "Perú", currency: "PEN", timezone: "America/Lima" },
  EC: { name: "Ecuador", currency: "USD", timezone: "America/Guayaquil" },
  US: { name: "Estados Unidos", currency: "USD", timezone: "America/New_York" },
};
const steps = ["Negocio", "Operación", "Impuestos", "Recibo", "Administrador"];

export default function BusinessSetupWizard({ session }: { session: Session }) {
  const initialCountry = (
      session.tenant.country in countryOptions ? session.tenant.country : "CO"
    ) as keyof typeof countryOptions,
    [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [form, setForm] = useState({
      name: session.tenant.name || "",
      nit: "",
      sector: "retail",
      country: initialCountry,
      currency: countryOptions[initialCountry].currency,
      timezone: countryOptions[initialCountry].timezone,
      branchName: session.branch.name || "Sede Principal",
      warehouseName: "Bodega Principal",
      registerName: "Caja 1",
      taxName: "IVA",
      taxRate: "19",
      taxIncluded: true,
      allowNegativeStock: false,
      receiptFormat: "thermal_80",
      adminName: session.user.name || "Administrador",
      adminEmail: session.user.email || "",
    });
  const set = (key: string, value: string | boolean) =>
      setForm((current) => ({ ...current, [key]: value })),
    selectCountry = (country: keyof typeof countryOptions) =>
      setForm((current) => ({
        ...current,
        country,
        currency: countryOptions[country].currency,
        timezone: countryOptions[country].timezone,
      }));
  const next = () => {
    const requiredByStep = [
      [form.name, form.nit, form.sector, form.country],
      [form.branchName, form.warehouseName, form.registerName],
      [form.taxName, form.taxRate],
      [form.receiptFormat],
      [form.adminName, form.adminEmail],
    ][step];
    if (requiredByStep.some((value) => !String(value).trim())) {
      setError("Complete los campos obligatorios para continuar.");
      return;
    }
    setError("");
    setStep((current) => Math.min(steps.length - 1, current + 1));
  };
  const finish = async () => {
    setBusy(true);
    setError("");
    const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, taxRate: Number(form.taxRate) }),
      }),
      data = await readJson<{ error?: string }>(response);
    setBusy(false);
    if (!response.ok) {
      setError(data.error || "No fue posible completar la configuración.");
      return;
    }
    window.location.reload();
  };
  return (
    <main className="setup-shell">
      <section className="setup-card">
        <header className="setup-header">
          <div className="setup-brand">P</div>
          <div>
            <span>CONFIGURACIÓN INICIAL POS360</span>
            <h1>Preparemos su negocio para vender</h1>
            <p>
              Solo tomará unos minutos. Podrá modificar estos datos después.
            </p>
          </div>
        </header>
        <div className="setup-progress">
          {steps.map((label, index) => (
            <div className={index <= step ? "active" : ""} key={label}>
              <i>{index < step ? "✓" : index + 1}</i>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="setup-content">
          {step === 0 && (
            <>
              <SetupTitle
                title="Identidad del negocio"
                text="Información legal y regional de su empresa."
              />
              <div className="setup-grid">
                <Field
                  label="Nombre comercial"
                  value={form.name}
                  onChange={(v) => set("name", v)}
                />
                <Field
                  label="NIT o identificación fiscal"
                  value={form.nit}
                  onChange={(v) => set("nit", v)}
                  placeholder="Ej. 901234567-1"
                />
                <label>
                  Sector comercial
                  <select
                    value={form.sector}
                    onChange={(e) => set("sector", e.target.value)}
                  >
                    <option value="retail">Minimercado y comercio</option>
                    <option value="restaurant">Restaurante</option>
                    <option value="hardware">Ferretería</option>
                    <option value="pharmacy">Droguería</option>
                    <option value="fashion">Ropa y calzado</option>
                    <option value="services">Servicios</option>
                    <option value="other">Otro</option>
                  </select>
                </label>
                <label>
                  País
                  <select
                    value={form.country}
                    onChange={(e) =>
                      selectCountry(
                        e.target.value as keyof typeof countryOptions,
                      )
                    }
                  >
                    {Object.entries(countryOptions).map(([code, option]) => (
                      <option value={code} key={code}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Moneda
                  <select
                    value={form.currency}
                    onChange={(e) => set("currency", e.target.value)}
                  >
                    {[
                      ["COP", "Peso colombiano (COP)"],
                      ["USD", "Dólar estadounidense (USD)"],
                      ["MXN", "Peso mexicano (MXN)"],
                      ["PEN", "Sol peruano (PEN)"],
                      ["EUR", "Euro (EUR)"],
                    ].map(([code, label]) => (
                      <option value={code} key={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Zona horaria
                  <select
                    value={form.timezone}
                    onChange={(e) => set("timezone", e.target.value)}
                  >
                    {[
                      "America/Bogota",
                      "America/Mexico_City",
                      "America/Lima",
                      "America/Guayaquil",
                      "America/New_York",
                      "America/Los_Angeles",
                    ].map((timezone) => (
                      <option value={timezone} key={timezone}>
                        {timezone}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <SetupTitle
                title="Estructura para operar"
                text="Crearemos los recursos mínimos de la sede principal."
              />
              <div className="setup-grid one">
                <Field
                  label="Sede principal"
                  value={form.branchName}
                  onChange={(v) => set("branchName", v)}
                />
                <Field
                  label="Bodega principal"
                  value={form.warehouseName}
                  onChange={(v) => set("warehouseName", v)}
                />
                <Field
                  label="Primera caja"
                  value={form.registerName}
                  onChange={(v) => set("registerName", v)}
                />
              </div>
              <div className="setup-summary">
                <span>✓</span>
                <div>
                  <b>Todo quedará conectado</b>
                  <small>
                    La bodega y la caja pertenecerán a la sede principal.
                  </small>
                </div>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <SetupTitle
                title="Impuestos e inventario"
                text="Defina la regla fiscal inicial y el control de existencias."
              />
              <div className="setup-grid">
                <Field
                  label="Nombre del impuesto"
                  value={form.taxName}
                  onChange={(v) => set("taxName", v)}
                />
                <Field
                  label="Tarifa (%)"
                  type="number"
                  value={form.taxRate}
                  onChange={(v) => set("taxRate", v)}
                />
              </div>
              <Toggle
                checked={form.taxIncluded}
                onChange={(v) => set("taxIncluded", v)}
                title="Impuesto incluido en el precio"
                text="Los precios registrados ya contienen este impuesto."
              />
              <Toggle
                checked={form.allowNegativeStock}
                onChange={(v) => set("allowNegativeStock", v)}
                title="Permitir inventario negativo"
                text="Autoriza vender aunque la existencia llegue por debajo de cero."
                warning
              />
            </>
          )}
          {step === 3 && (
            <>
              <SetupTitle
                title="Formato del recibo"
                text="Elija la presentación predeterminada para sus comprobantes."
              />
              <div className="receipt-options">
                {[
                  { id: "thermal_58", label: "Térmico 58 mm", icon: "▯" },
                  { id: "thermal_80", label: "Térmico 80 mm", icon: "▤" },
                  { id: "letter", label: "Carta / PDF", icon: "▱" },
                ].map((option) => (
                  <button
                    key={option.id}
                    className={
                      form.receiptFormat === option.id ? "selected" : ""
                    }
                    onClick={() => set("receiptFormat", option.id)}
                  >
                    <i>{option.icon}</i>
                    <b>{option.label}</b>
                    <small>
                      {option.id === "thermal_80"
                        ? "Recomendado para POS"
                        : "Formato disponible"}
                    </small>
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 4 && (
            <>
              <SetupTitle
                title="Usuario administrador"
                text="Este usuario podrá configurar y operar la empresa."
              />
              <div className="setup-grid one">
                <Field
                  label="Nombre completo"
                  value={form.adminName}
                  onChange={(v) => set("adminName", v)}
                />
                <Field
                  label="Correo electrónico"
                  type="email"
                  value={form.adminEmail}
                  onChange={(v) => set("adminEmail", v)}
                />
              </div>
              <div className="ready-box">
                <span>✓</span>
                <div>
                  <b>Su empresa quedará lista</b>
                  <small>
                    Podrá registrar productos, abrir{" "}
                    {form.registerName || "la caja"} y realizar la primera
                    venta.
                  </small>
                </div>
              </div>
            </>
          )}
          {error && <div className="setup-error">{error}</div>}
        </div>
        <footer className="setup-actions">
          <button
            className="secondary"
            disabled={step === 0 || busy}
            onClick={() => {
              setError("");
              setStep((current) => current - 1);
            }}
          >
            Atrás
          </button>
          <span>
            Paso {step + 1} de {steps.length}
          </span>
          {step < steps.length - 1 ? (
            <button className="primary" onClick={next}>
              Continuar
            </button>
          ) : (
            <button className="primary" disabled={busy} onClick={finish}>
              {busy ? "Configurando…" : "Finalizar y comenzar"}
            </button>
          )}
        </footer>
      </section>
    </main>
  );
}

function SetupTitle({ title, text }: { title: string; text: string }) {
  return (
    <div className="setup-title">
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
function Toggle({
  checked,
  onChange,
  title,
  text,
  warning = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  text: string;
  warning?: boolean;
}) {
  return (
    <label className={warning ? "setup-toggle warning" : "setup-toggle"}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <i />
      <div>
        <b>{title}</b>
        <small>{text}</small>
      </div>
    </label>
  );
}
