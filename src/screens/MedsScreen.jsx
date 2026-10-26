import React, { useState } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';

export default function MedsScreen({ activeProfile }) {
  const medicines = useLiveQuery(
    () => (activeProfile?.id ? db.medicines.where('profileId').equals(activeProfile.id).toArray() : []),
    [activeProfile?.id]
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState(null);
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [times, setTimes] = useState(['08:00']);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  const openAddModal = () => {
    setEditingMed(null);
    setName('');
    setDose('');
    setTimes(['08:00']);
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (med) => {
    setEditingMed(med);
    setName(med.name || '');
    setDose(med.dose || '');
    setTimes(Array.isArray(med.times) && med.times.length > 0 ? med.times : ['08:00']);
    setStartDate(med.startDate || '');
    setEndDate(med.endDate || '');
    setNotes(med.notes || '');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMed(null);
  };

  const addTimeSlot = () => {
    setTimes([...times, '12:00']);
  };

  const updateTimeSlot = (index, value) => {
    const updated = [...times];
    updated[index] = value;
    setTimes(updated);
  };

  const removeTimeSlot = (index) => {
    if (times.length <= 1) return;
    setTimes(times.filter((_, i) => i !== index));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim() || !activeProfile?.id) return;

    const cleanTimes = times.filter((t) => t && t.trim()).sort();

    const payload = {
      profileId: activeProfile.id,
      name: name.trim(),
      dose: dose.trim(),
      times: cleanTimes.length > 0 ? cleanTimes : ['08:00'],
      startDate: startDate || new Date().toISOString().split('T')[0],
      endDate: endDate || '',
      notes: notes.trim()
    };

    if (editingMed) {
      await db.medicines.update(editingMed.id, payload);
    } else {
      await db.medicines.add(payload);
    }
    closeModal();
  };

  const handleDelete = async (medId) => {
    if (window.confirm('Delete this medication and remove associated dose logs?')) {
      await db.medicines.delete(medId);
      await db.doseLogs.where('medicineId').equals(medId).delete();
    }
  };

  if (!activeProfile) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="alert alert-warning">
            Please create or select an active profile in the Profiles tab first.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="screen-header">
        <div>
          <h2 className="screen-title">Medicines</h2>
          <span className="badge badge-primary">{activeProfile.name}</span>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={openAddModal}>
          + Add Medicine
        </button>
      </div>

      {!medicines || medicines.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💊</div>
          <h3 className="empty-state-title">No Medications Configured</h3>
          <p className="empty-state-text">
            Add medicines with dosage schedules to track daily doses on the Today screen.
          </p>
          <button type="button" className="btn btn-primary" onClick={openAddModal}>
            Add First Medicine
          </button>
        </div>
      ) : (
        medicines.map((med) => (
          <div key={med.id} className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">{med.name}</h3>
                {med.dose && <span className="badge badge-primary">{med.dose}</span>}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => openEditModal(med)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(med.id)}
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="card-body">
              <div>
                <span className="form-label">Scheduled Times (HH:mm)</span>
                <div className="times-list">
                  {med.times && med.times.map((t, idx) => (
                    <span key={idx} className="time-tag">
                      ⏰ {t}
                    </span>
                  ))}
                </div>
              </div>

              {(med.startDate || med.endDate) && (
                <div style={{ marginTop: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  Duration: {med.startDate || 'Start'} to {med.endDate || 'Ongoing'}
                </div>
              )}

              {med.notes && (
                <div style={{ marginTop: 'var(--space-2)', fontSize: '0.85rem' }}>
                  <strong>Notes:</strong> {med.notes}
                </div>
              )}
            </div>
          </div>
        ))
      )}

      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSave}>
              <div className="modal-header">
                <h3 className="modal-title">
                  {editingMed ? 'Edit Medicine' : 'Add Medicine'}
                </h3>
                <button type="button" className="btn btn-outline btn-sm" onClick={closeModal}>
                  ✕
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Medicine Name *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Paracetamol, Amoxicillin"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Dose *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. 500mg, 1 tablet, 5ml"
                    value={dose}
                    onChange={(e) => setDose(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                    <label className="form-label" style={{ margin: 0 }}>
                      Scheduled Times (HH:mm) *
                    </label>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={addTimeSlot}
                    >
                      + Add Time
                    </button>
                  </div>
                  {times.map((time, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                      <input
                        type="time"
                        required
                        className="form-control"
                        value={time}
                        onChange={(e) => updateTimeSlot(idx, e.target.value)}
                      />
                      {times.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => removeTimeSlot(idx)}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">End Date (Optional)</label>
                    <input
                      type="date"
                      className="form-control"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Notes & Instructions</label>
                  <textarea
                    rows="2"
                    className="form-textarea"
                    placeholder="e.g. Take with water after breakfast"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingMed ? 'Save Changes' : 'Add Medicine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
