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
        queue: [],
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
              <p className="admin-brand">QueueSmart / Administration</p>
              <h1>Service management</h1>
              <p className="admin-subtitle">Add a service or update its details and priority.</p>
            </div>
            <Link className="admin-button secondary" to="/admin-dashboard">Back to overview</Link>
          </header>

          <div className="management-grid">
            <section aria-labelledby="manage-services-heading">
              <div className="service-toolbar">
                <h2 id="manage-services-heading">Services <span className="service-total">({services.length})</span></h2>
                <input
                  className="service-search"
                  aria-label="Search services"
                  type="search"
                  placeholder="Search by service name"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>

              <div className="table-scroll">
                <table className="admin-table management-table">
                  <thead>
                    <tr>
                      <th scope="col">Service</th>
                      <th scope="col">Duration</th>
                      <th scope="col">Priority</th>
                      <th scope="col">Queue</th>
                      <th scope="col"><span className="visually-hidden">Edit service</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleServices.map((service) => (
                      <tr key={service.id}>
                        <td className="service-name-cell">
                          <strong>{service.name}</strong>
                          <span>{service.description}</span>
                        </td>
                        <td>{service.duration} min</td>
                        <td>{service.priority}</td>
                        <td><span className={`queue-state ${service.isOpen ? "is-open" : "is-closed"}`}>{service.isOpen ? "Open" : "Closed"}</span></td>
                        <td className="queue-action-cell">
                          <button className="table-action" type="button" onClick={() => startEditing(service)}>Edit</button>
                        </td>
                      </tr>
                    ))}
                    {visibleServices.length === 0 && (
                      <tr><td className="table-empty" colSpan="5">No matching services.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="service-form" aria-labelledby="service-form-heading">
              <h2 id="service-form-heading">{editingId ? "Edit service" : "Add a service"}</h2>
              <p className="form-intro">Fields marked * are required.</p>
              <form onSubmit={handleSubmit}>
                <div className="service-form-fields">
                  <label htmlFor="service-name">
                    Service name *
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
                    Description *
                    <textarea
                      id="service-description"
                      name="description"
                      value={form.description}
                      onChange={updateField}
                      placeholder="Describe the service"
                      required
                    />
                  </label>
                  <label htmlFor="service-duration">
                    Expected duration (minutes) *
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
                    Priority level *
                    <select id="service-priority" name="priority" value={form.priority} onChange={updateField} required>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </label>
                  {savedMessage && <p className="save-message" role="status">{savedMessage}</p>}
                  <div className="form-actions">
                    <button className="admin-button" type="submit">{editingId ? "Save changes" : "Add service"}</button>
                    {editingId && <button className="plain-button" type="button" onClick={resetForm}>Cancel</button>}
                  </div>
                </div>
              </form>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

export default ServiceManagement;
