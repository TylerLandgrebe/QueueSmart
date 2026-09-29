import { useState } from "react";
import { Link } from "react-router-dom";
import NavigationBar from "../../components/NavigationBar";
import { getServices, saveServices } from "./adminData";
import "./AdminPages.css";

const emptyForm = { name: "", description: "", duration: "", priority: "Medium" };

function ServiceManagement() {
  const [services, setServices] = useState(getServices);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  const visibleServices = services.filter((service) =>
    service.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function updateField(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
    setSavedMessage("");
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setSavedMessage("");
  }

  function startEditing(service) {
    setEditingId(service.id);
    setForm({
      name: service.name,
      description: service.description,
      duration: String(service.duration),
      priority: service.priority,
    });
    setSavedMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSubmit(event) {
    event.preventDefault();
    const serviceDetails = {
      name: form.name.trim(),
      description: form.description.trim(),
      duration: Number(form.duration),
      priority: form.priority,
    };

    const updatedServices = editingId
      ? services.map((service) => service.id === editingId ? { ...service, ...serviceDetails } : service)
      : [...services, {
        id: `service-${Date.now()}`,
        ...serviceDetails,
        isOpen: true,
        queueLength: 0,
      }];

    setServices(updatedServices);
    saveServices(updatedServices);
    setSavedMessage(editingId ? "Service changes saved." : "Service created and queue opened.");
    setForm(emptyForm);
    setEditingId(null);
  }

  return (
    <>
      <NavigationBar userType="admin" />
      <main className="admin-page">
        <div className="admin-content">
          <header className="admin-topline">
            <div>
              <p className="admin-brand">QueueSmart · Admin Portal</p>
              <h1>Service management</h1>
              <p className="admin-subtitle">Set up the services visitors can join and keep the details current.</p>
            </div>
            <Link className="admin-button secondary" to="/admin-dashboard">← Back to dashboard</Link>
          </header>

          <div className="management-grid">
            <section aria-labelledby="manage-services-heading">
              <div className="service-toolbar">
                <h2 id="manage-services-heading">Services <span className="admin-tag">{services.length}</span></h2>
                <input
                  className="service-search"
                  aria-label="Search services"
                  type="search"
                  placeholder="⌕  Search services"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>

              <div className="management-services">
                {visibleServices.map((service) => (
                  <article className="management-service" key={service.id}>
                    <div>
                      <h3>{service.name}</h3>
                      <p>{service.description}</p>
                      <div className="management-service-meta">
                        <span className="admin-tag">◷ {service.duration} min / person</span>
                        <span className={`admin-tag priority-${service.priority.toLowerCase()}`}>{service.priority} priority</span>
                        <span className={`status-badge ${service.isOpen ? "open" : "closed"}`}>{service.isOpen ? "Queue open" : "Queue closed"}</span>
                      </div>
                    </div>
                    <div className="management-actions">
                      <span className="queue-count"><strong>{service.queueLength}</strong> waiting</span>
                      <button className="admin-button secondary small" type="button" onClick={() => startEditing(service)}>Edit</button>
                    </div>
                  </article>
                ))}
                {visibleServices.length === 0 && (
                  <div className="empty-services">No services match “{query}”. Try another search or create a new service.</div>
                )}
              </div>
            </section>

            <aside className="admin-panel service-form" aria-labelledby="service-form-heading">
              <h2 id="service-form-heading">{editingId ? "Edit service" : "Create a service"}</h2>
              <p>Visitors will see this information when they choose a queue.</p>
              <form onSubmit={handleSubmit}>
                <div className="service-form-fields">
                  <label htmlFor="service-name">
                    Service name <span aria-hidden="true">*</span>
                    <input
                      id="service-name"
                      name="name"
                      type="text"
                      value={form.name}
                      onChange={updateField}
                      placeholder="e.g. Academic Advising"
                      maxLength={100}
                      required
                    />
                    <span className="field-hint">{form.name.length}/100 characters</span>
                  </label>
                  <label htmlFor="service-description">
                    Description <span aria-hidden="true">*</span>
                    <textarea
                      id="service-description"
                      name="description"
                      value={form.description}
                      onChange={updateField}
                      placeholder="What can visitors get help with?"
                      required
                    />
                  </label>
                  <label htmlFor="service-duration">
                    Expected duration <span aria-hidden="true">*</span>
                    <input
                      id="service-duration"
                      name="duration"
                      type="number"
                      value={form.duration}
                      onChange={updateField}
                      placeholder="Minutes per visitor"
                      min="1"
                      step="1"
                      required
                    />
                  </label>
                  <label htmlFor="service-priority">
                    Priority level <span aria-hidden="true">*</span>
                    <select id="service-priority" name="priority" value={form.priority} onChange={updateField} required>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </label>
                  {savedMessage && <p className="save-message" role="status">{savedMessage}</p>}
                  <div className="form-actions">
                    <button className="admin-button" type="submit">{editingId ? "Save changes" : "Create service"}</button>
                    {editingId && <button className="admin-button secondary" type="button" onClick={resetForm}>Cancel</button>}
                  </div>
                </div>
              </form>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}

export default ServiceManagement;
