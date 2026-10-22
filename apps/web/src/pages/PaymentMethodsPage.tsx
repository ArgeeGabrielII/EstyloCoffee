import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";

type Method = { id: string; name: string; active: boolean };
function MethodRow({ method, refresh }: { method: Method; refresh: () => Promise<void> }) {
  const [name, setName] = useState(method.name);
  const [active, setActive] = useState(method.active);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true); setError("");
    try {
      await api(`/payment-methods/${method.id}`, {
        method: "PATCH", body: JSON.stringify({ name: name.trim(), active })
      });
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }
  return <tr>
    <td><input className="form-control" aria-label="Payment method name" value={name} onChange={e => setName(e.target.value)} /></td>
    <td><label className="d-flex gap-2 align-items-center"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> {active ? "Active" : "Inactive"}</label></td>
    <td><button className="btn btn-estylo" disabled={busy || !name.trim()} onClick={save}>{busy ? "Saving..." : "Save"}</button>{error && <p className="text-danger small">{error}</p>}</td>
  </tr>;
}
export function PaymentMethodsPage() {
  const [methods, setMethods] = useState<Method[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() { setMethods(await api<Method[]>("/payment-methods")); }
  useEffect(() => { load().catch(e => setError(e instanceof Error ? e.message : "Unable to load")); }, []);
  async function create(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setSuccess("");
    try {
      await api("/payment-methods", { method: "POST", body: JSON.stringify({ name: name.trim(), active: true }) });
      setName(""); await load(); setSuccess("Payment method added.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to add payment method"); }
    finally { setBusy(false); }
  }
  return <div className="page">
    <div className="page-title"><div><h1>Payment Methods</h1><p>Maintain the payment methods available when marking orders paid.</p></div></div>
    {error && <div className="alert alert-danger">{error}</div>}
    {success && <div className="alert alert-success">{success}</div>}
    <form className="card-estylo mb-4" onSubmit={create}>
      <h2 className="h5">Add Payment Method</h2>
      <div className="d-flex gap-2 align-items-end flex-wrap">
        <label>Name<input className="form-control" maxLength={80} required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cash, GCash" /></label>
        <button className="btn btn-estylo" disabled={busy || !name.trim()}>{busy ? "Adding..." : "Add Method"}</button>
      </div>
    </form>
    <div className="card-estylo"><h2 className="h5">Available Payment Methods</h2>
      <div className="table-responsive"><table className="table align-middle">
        <thead><tr><th>Method</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{methods.map(m => <MethodRow key={m.id + m.name + m.active} method={m} refresh={load} />)}</tbody>
      </table></div>
    </div>
  </div>;
}
