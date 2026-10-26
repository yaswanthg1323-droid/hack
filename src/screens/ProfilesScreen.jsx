import React, { useState } from 'react';
import { db, setActiveProfileId } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';

const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function ProfilesScreen({ profiles = [], activeProfileId, onActiveChange }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);

  const doseLogs = useLiveQuery(() => db.doseLogs.toArray(), []) || [];
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    bloodGroup: '',
    allergies: '',
    conditions: '',
    nomineeName: '',
    nomineePhone: '',
    nomineeRelation: ''
  });

  const openAddModal = () => {
    setEditingProfile(null);
    setFormData({
      name: '',
      age: '',
      bloodGroup: '',
      allergies: '',
      conditions: '',
      nomineeName: '',
      nomineePhone: '',
      nomineeRelation: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (profile) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name || '',
      age: profile.age || '',
      bloodGroup: profile.bloodGroup || '',
      allergies: profile.allergies || '',
      conditions: profile.conditions || '',
      nomineeName: profile.nomineeName || '',
      nomineePhone: profile.nomineePhone || '',
      nomineeRelation: profile.nomineeRelation || ''
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProfile(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const payload = {
      name: formData.name.trim(),
      age: formData.age ? Number(formData.age) : null,
      bloodGroup: formData.bloodGroup,
      allergies: formData.allergies.trim(),
      conditions: formData.conditions.trim(),
      nomineeName: formData.nomineeName.trim(),
      nomineePhone: formData.nomineePhone.trim(),
      nomineeRelation: formData.nomineeRelation.trim()
    };

    if (editingProfile) {
      await db.profiles.update(editingProfile.id, payload);
    } else {
      const newId = await db.profiles.add(payload);
      if (!activeProfileId || profiles.length === 0) {
        await setActiveProfileId(newId);
        if (onActiveChange) onActiveChange(newId);
      }
    }
    closeModal();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this profile and its associated data?')) {
      await db.profiles.delete(id);
      await db.medicines.where('profileId').equals(id).delete();
      await db.doseLogs.where('profileId').equals(id).delete();
      await db.alerts.where('profileId').equals(id).delete();

      if (activeProfileId === id) {
        const remaining = await db.profiles.toCollection().first();
        const nextId = remaining ? remaining.id : null;
        if (nextId) {
          await setActiveProfileId(nextId);
          if (onActiveChange) onActiveChange(nextId);
        } else {
          await db.settings.delete('activeProfileId');
          if (onActiveChange) onActiveChange(null);
        }
      }
    }
  };

  const handleSetActive = async (id) => {
    await setActiveProfileId(id);
    if (onActiveChange) onActiveChange(id);
  };

  return (
    <div>
      <div className="screen-header">
        <h2 className="screen-title">Profiles</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={openAddModal}>
          + Add Profile
        </button>
      </div>

      {profiles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👤</div>
          <h3 className="empty-state-title">No Profiles Found</h3>
          <p className="empty-state-text">
            Create a profile to start tracking medicines, doses, and emergency contacts.
          </p>
          <button type="button" className="btn btn-primary" onClick={openAddModal}>
            Add First Profile
          </button>
        </div>
      ) : (
        profiles.map((profile) => {
          const isActive = profile.id === activeProfileId;
          return (
            <div key={profile.id} className={`card profile-card ${isActive ? 'active-profile' : ''}`}>
              <div className="card-header">
                <div>
                  <h3 className="card-title">{profile.name}</h3>
                  <div style={{ display: 'flex', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
                    {isActive && <span className="badge badge-success">Active Profile</span>}
                    {profile.sample && <span className="badge badge-warning">Sample</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  {!isActive && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleSetActive(profile.id)}
                    >
                      Set Active
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => openEditModal(profile)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(profile.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="card-body">
                <div className="profile-meta-grid">
                  <div className="meta-item">
                    <span className="meta-label">Age</span>
                    <span className="meta-value">{profile.age || '—'}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Blood Group</span>
                    <span className="meta-value">{profile.bloodGroup || '—'}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Allergies</span>
                    <span className="meta-value">{profile.allergies || 'None'}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Conditions</span>
                    <span className="meta-value">{profile.conditions || 'None'}</span>
                  </div>
                </div>

                {(() => {
                  const pLogs = doseLogs.filter(
                    (l) => l.profileId === profile.id && l.scheduledAt >= sevenDaysAgoIso
                  );
                  const takenCount = pLogs.filter((l) => l.takenAt || l.status === 'taken').length;
                  const pct = pLogs.length > 0 ? Math.round((takenCount / pLogs.length) * 100) : 100;
                  return (
                    <div style={{ marginTop: 'var(--space-2)', fontSize: '0.85rem' }}>
                      <span className="meta-label">7-Day Adherence:</span>{' '}
                      <strong style={{ color: pct >= 80 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                        {pct}% ({takenCount}/{pLogs.length} doses taken)
                      </strong>
                    </div>
                  );
                })()}

                <div className="nominee-box">
                  <span className="meta-label">Emergency Nominee (Alerts recipient)</span>
                  <div className="meta-value">
                    {profile.nomineeName ? (
                      <>
                        {profile.nomineeName}{' '}
                        {profile.nomineeRelation ? `(${profile.nomineeRelation})` : ''} —{' '}
                        {profile.nomineePhone || 'No phone'}
                      </>
                    ) : (
                      'No nominee configured'
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}

      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSave}>
              <div className="modal-header">
                <h3 className="modal-title">
                  {editingProfile ? 'Edit Profile' : 'Add New Profile'}
                </h3>
                <button type="button" className="btn btn-outline btn-sm" onClick={closeModal}>
                  ✕
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div className="form-group">
                    <label className="form-label">Age</label>
                    <input
                      type="number"
                      min="0"
                      max="150"
                      className="form-control"
                      placeholder="e.g. 45"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Blood Group</label>
                    <select
                      className="form-select"
                      value={formData.bloodGroup}
                      onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                    >
                      {BLOOD_GROUPS.map((bg) => (
                        <option key={bg} value={bg}>
                          {bg || 'Select blood group'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Known Allergies</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Penicillin, Peanuts"
                    value={formData.allergies}
                    onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Medical Conditions</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Diabetes, Hypertension"
                    value={formData.conditions}
                    onChange={(e) => setFormData({ ...formData, conditions: e.target.value })}
                  />
                </div>

                <div className="divider-top">
                  <h4 style={{ fontSize: '0.9rem', marginBottom: 'var(--space-2)', color: 'var(--color-primary)' }}>
                    Nominee Details (Alert Contact)
                  </h4>
                  <div className="form-group">
                    <label className="form-label">Nominee Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Jane Doe"
                      value={formData.nomineeName}
                      onChange={(e) => setFormData({ ...formData, nomineeName: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div className="form-group">
                      <label className="form-label">Relationship</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Spouse, Son"
                        value={formData.nomineeRelation}
                        onChange={(e) => setFormData({ ...formData, nomineeRelation: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Phone Number</label>
                      <input
                        type="tel"
                        className="form-control"
                        placeholder="e.g. +1 555-0192"
                        value={formData.nomineePhone}
                        onChange={(e) => setFormData({ ...formData, nomineePhone: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingProfile ? 'Save Changes' : 'Create Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
