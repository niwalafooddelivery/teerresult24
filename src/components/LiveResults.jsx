'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LiveResults({ initialData = [], currentDateStr = '' }) {
  const [results, setResults] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const fetchLatest = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/results/today');
      const data = await res.json();
      if (data.success && data.results) {
        setResults(data.results);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error('Error fetching live data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Polling interval: 45 seconds
    const interval = setInterval(fetchLatest, 45000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="live-section">
      <div className="section-head">
        <div>
          <h2 className="section-title">
            Today&apos;s Official Results
          </h2>
          <p className="section-sub" suppressHydrationWarning>
            Daily archery session updates • Last checked at {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>

        <button
          onClick={fetchLatest}
          disabled={loading}
          className="btn-secondary"
          title="Refresh results now"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="live-results-grid">
        {results.map((item) => {
          const isFeatured = item.slug === 'shillong-teer';
          const isDeclared = Boolean(item.round1 && item.round2);
          const isPartial = Boolean(item.round1 && !item.round2);

          let badgeClass = 'waiting';
          let statusText = 'Awaiting Result';

          if (isDeclared) {
            badgeClass = 'completed';
            statusText = 'Declared';
          } else if (isPartial) {
            badgeClass = 'live';
            statusText = '1st Round Declared';
          } else if (item.status === 'CANCELLED') {
            badgeClass = 'completed';
            statusText = 'Cancelled';
          }

          const gameHref = item.slug === 'shillong-night-teer' ? '/shillong-night-teer/' : `/${item.slug}-result/`;

          return (
            <div
              key={item.id || item.slug}
              id={item.slug}
              className={`teer-card ${isFeatured ? 'featured' : ''}`}
            >
              <div className="card-top">
                <div>
                  <h3 className="card-title">{item.name}</h3>
                  <span className="card-location">{item.location}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`status-badge ${badgeClass}`}>
                    {statusText}
                  </span>
                </div>
              </div>

              <div className="rounds-container">
                {/* 1st Round */}
                <div className="round-box">
                  <div className="round-header">1st Round (FR)</div>
                  <div className="round-time">{item.round1Time}</div>
                  <div className={`round-score ${item.round1 ? 'score-green' : 'score-waiting'}`}>
                    {item.round1 ? item.round1 : '--'}
                  </div>
                </div>

                {/* 2nd Round */}
                <div className="round-box">
                  <div className="round-header">2nd Round (SR)</div>
                  <div className="round-time">{item.round2Time}</div>
                  <div className={`round-score ${item.round2 ? 'score-gold' : 'score-waiting'}`}>
                    {item.round2 ? item.round2 : '--'}
                  </div>
                </div>
              </div>

              <div className="card-footer">
                <span title={`Source: ${item.sourceInfo || 'Official Field Record'}`}>
                  {item.round1 || item.round2 ? (item.isVerified ? 'Verified Bulletin' : 'Field Declaration') : 'Awaiting Result'}
                </span>
                <Link
                  href={gameHref}
                  style={{
                    color: 'var(--primary-color)',
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  Game Details &rarr;
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
