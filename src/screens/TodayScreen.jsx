import React, { useEffect, useState } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';

export default function TodayScreen({ activeProfile, onNavigateAsk }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clock every 30 seconds for accurate due/upcoming status
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const medicines = useLiveQuery(
    () => (activeProfile?.id ? db.medicines.where('profileId').equals(activeProfile.id).toArray() : []),
    [activeProfile?.id]
  );

  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

  // Generate today's dose logs if missing
  useEffect(() => {
    if (!activeProfile?.id || !medicines || medicines.length === 0) return;

    const generateDoseLogs = async () => {
      for (const med of medicines) {
        if (med.startDate && todayStr < med.startDate) continue;
        if (med.endDate && todayStr > med.endDate) continue;
        if (!Array.isArray(med.times)) continue;

        for (const time of med.times) {
          const scheduledAt = `${todayStr}T${time}:00`;
          const existing = await db.doseLogs
            .where('medicineId')
            .equals(med.id)
            .and((log) => log.profileId === activeProfile.id && log.scheduledAt === scheduledAt)
            .first();

          if (!existing) {
            await db.doseLogs.add({
              medicineId: med.id,
              profileId: activeProfile.id,
              scheduledAt,
              status: 'upcoming',
              takenAt: null
            });
          }
        }
      }
    };

    generateDoseLogs();
  }, [activeProfile?.id, medicines, todayStr]);

  const rawLogs = useLiveQuery(
    () =>
      activeProfile?.id
        ? db.doseLogs
            .where('profileId')
            .equals(activeProfile.id)
            .and((log) => log.scheduledAt.startsWith(todayStr))
            .toArray()
        : [],
    [activeProfile?.id, todayStr]
  );

  const handleMarkTaken = async (logId) => {
    const nowIso = new Date().toISOString();
    await db.doseLogs.update(logId, {
      takenAt: nowIso,
      status: 'taken'
    });
  };

  const handleUndoTaken = async (logId) => {
    await db.doseLogs.update(logId, {
      takenAt: null,
      status: 'upcoming'
    });
  };

  if (!activeProfile) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="alert alert-warning">
            Please select or create a profile to view today's medication schedule.
          </div>
        </div>
      </div>
    );
  }

  const medMap = new Map((medicines || []).map((m) => [m.id, m]));

  const enrichedLogs = (rawLogs || [])
    .map((log) => {
      const med = medMap.get(log.medicineId);
      const schedDate = new Date(log.scheduledAt);
      let dynamicStatus = log.status;

      if (log.takenAt) {
        dynamicStatus = 'taken';
      } else if (log.status === 'missed') {
        dynamicStatus = 'missed';
      } else {
        dynamicStatus = currentTime < schedDate ? 'upcoming' : 'due';
      }

      return {
        ...log,
        medName: med ? med.name : 'Unknown Medicine',
        medDose: med ? med.dose : '',
        medNotes: med ? med.notes : '',
        dynamicStatus,
        timeFormatted: schedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
      };
    })
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  return (
    <div>
      <div className="screen-header">
        <div>
          <h2 className="screen-title">Today's Schedule</h2>
          <span className="badge badge-primary">{activeProfile.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {onNavigateAsk && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onNavigateAsk}
            >
              💬 Ask AidKit
            </button>
          )}
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
            {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>

      {enrichedLogs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <h3 className="empty-state-title">No Doses Scheduled for Today</h3>
          <p className="empty-state-text">
            Add medications in the Meds tab to automatically generate daily dose schedules.
          </p>
        </div>
      ) : (
        enrichedLogs.map((log) => {
          const isTaken = !!log.takenAt;
          const isMissed = log.dynamicStatus === 'missed';
          const isDue = log.dynamicStatus === 'due';
          const isUpcoming = log.dynamicStatus === 'upcoming';

          const accentClass = isTaken
            ? 'card-accent-success'
            : (isMissed || isDue)
            ? 'card-accent-danger'
            : 'card-accent-primary';

          return (
            <div
              key={log.id}
              className={`card ${accentClass}`}
            >
              <div className="dose-card">
                <div className="dose-info">
                  <div className="dose-time">
                    <span>⏰ {log.timeFormatted}</span>
                    {isTaken && <span className="badge badge-success">Taken</span>}
                    {isMissed && <span className="badge badge-danger">Missed</span>}
                    {isDue && <span className="badge badge-warning">Due Now</span>}
                    {isUpcoming && <span className="badge badge-primary">Upcoming</span>}
                  </div>

                  <div className="dose-medicine">
                    {log.medName} {log.medDose && `• ${log.medDose}`}
                  </div>

                  {log.medNotes && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                      Note: {log.medNotes}
                    </div>
                  )}

                  {isTaken && log.takenAt && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', marginTop: 'var(--space-1)' }}>
                      Taken at {new Date(log.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>

                <div className="dose-action">
                  {!isTaken ? (
                    <button
                      type="button"
                      className={`btn ${isDue ? 'btn-danger' : 'btn-primary'} btn-lg`}
                      onClick={() => handleMarkTaken(log.id)}
                    >
                      ✓ Taken
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleUndoTaken(log.id)}
                    >
                      Undo
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
