import React, { useState, useEffect } from 'react';
import firstAidTopics from '../data/firstaid.json';
import FirstAidCard from '../components/FirstAidCard';

export default function FirstAidScreen({ selectedTopicProp, onClearTopic }) {
  const resolveTopic = (prop) => {
    if (!prop) return null;
    if (typeof prop === 'string') {
      return firstAidTopics.find((t) => t.id === prop) || null;
    }
    return prop;
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState(() => resolveTopic(selectedTopicProp));

  useEffect(() => {
    if (selectedTopicProp) {
      setSelectedTopic(resolveTopic(selectedTopicProp));
    }
  }, [selectedTopicProp]);

  const filteredTopics = firstAidTopics.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      t.title.toLowerCase().includes(q) ||
      t.steps.some((s) => s.toLowerCase().includes(q)) ||
      t.do.some((d) => d.toLowerCase().includes(q)) ||
      t.dont.some((d) => d.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      <div className="screen-header">
        <h2 className="screen-title">First Aid Guide</h2>
        <span className="badge badge-primary">Offline 100%</span>
      </div>

      <div className="alert alert-warning" style={{ fontSize: '0.85rem' }}>
        ⚠️ <strong>Disclaimer:</strong> Basic guidance, not a substitute for professional care.
      </div>

      {selectedTopic ? (
        <FirstAidCard
          topic={selectedTopic}
          onBack={() => {
            setSelectedTopic(null);
            if (onClearTopic) onClearTopic();
          }}
        />
      ) : (
        <>
          <div className="form-group">
            <input
              type="text"
              className="form-control"
              placeholder="🔍 Search symptoms, emergencies (e.g. burn, CPR, stroke)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {filteredTopics.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <h3 className="empty-state-title">No Matching Topics Found</h3>
              <p className="empty-state-text">
                Try searching for CPR, bleeding, burns, choking, or fainting.
              </p>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setSearchQuery('')}
              >
                Clear Search
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {filteredTopics.map((topic) => (
                <div
                  key={topic.id}
                  className="card card-accent-primary"
                  style={{
                    margin: 0,
                    cursor: 'pointer',
                    transition: 'transform 0.1s ease'
                  }}
                  onClick={() => setSelectedTopic(topic)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h3 className="card-title" style={{ fontSize: '1.05rem', margin: 0 }}>
                        {topic.title}
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                        {topic.steps[0]}
                      </p>
                    </div>
                    <span style={{ fontSize: '1.25rem', color: 'var(--color-primary)' }}>➔</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
