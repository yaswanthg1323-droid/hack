import React, { useState, useRef } from 'react';
import { db, setActiveProfileId, importBackup } from '../db';

const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function WelcomeScreen({ onComplete }) {
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
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
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

      const newId = await db.profiles.add(payload);
      await setActiveProfileId(newId);
      if (onComplete) onComplete(newId);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to save profile. Please try again.');
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      await importBackup(json);
      const first = await db.profiles.toCollection().first();
      if (first) {
        await setActiveProfileId(first.id);
        if (onComplete) onComplete(first.id);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error restoring backup: ' + (err.message || 'Invalid format'));
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div style={{ maxWidth: '36rem', margin: '0 auto', padding: 'var(--space-2) 0' }}>
      <div className="card card-accent-primary">
        <div className="card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-1)' }}>
          <h2 className="card-title" style={{ fontSize: '1.35rem', color: 'var(--color-primary)' }}>
            🩺 Welcome to AidKit
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', margin: 0 }}>
            Set up your profile to start tracking medicines and emergency contacts.
          </p>
        </div>

        <div className="card-body">
          {errorMsg && (
            <div className="alert alert-danger" style={{ marginBottom: 'var(--space-3)' }}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSave}>
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
                placeholder="e.g. Hypertension, Diabetes"
                value={formData.conditions}
                onChange={(e) => setFormData({ ...formData, conditions: e.target.value })}
              />
            </div>

            {/* Nominee prompt */}
            <div className="divider-top">
              <div style={{ marginBottom: 'var(--space-2)' }}>
                <h4 style={{ fontSize: '0.95rem', color: 'var(--color-primary)', margin: 0 }}>
                  👤 Emergency Nominee (Recommended)
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                  AidKit will alert this contact via SMS if you miss scheduled medication doses.
                </p>
              </div>

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
                    placeholder="e.g. Daughter, Spouse"
                    value={formData.nomineeRelation}
                    onChange={(e) => setFormData({ ...formData, nomineeRelation: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="e.g. +91 90000 00001"
                    value={formData.nomineePhone}
                    onChange={(e) => setFormData({ ...formData, nomineePhone: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
              <button type="submit" className="btn btn-primary btn-lg btn-block">
                ✓ Save & Get Started
              </button>

              <button
                type="button"
                className="btn btn-outline btn-block"
                onClick={() => fileInputRef.current?.click()}
              >
                📥 Restore from Backup
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={handleImportFile}
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
