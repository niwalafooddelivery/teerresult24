'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

function getGameUrl(slug) {
  if (slug === 'shillong-night-teer') return '/shillong-night-teer/';
  if (slug === 'shillong-morning-teer') return '/shillong-morning-teer-result/';
  if (slug === 'welcome-morning-teer') return '/welcome-morning-teer-result/';
  return `/${slug}-result/`;
}

export default function LiveResults({ initialData = [], currentDateStr = '' }) {
  const [results, setResults] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const fetchLatest = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/results/today/?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
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
    // Only poll when the tab is actively visible to save mobile battery and network data
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchLatest();
    }, 45000);

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        // Refresh immediately when returning to the tab
        fetchLatest();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
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
          const isVerified = Boolean(item.isVerified);

          let badgeClass = 'waiting';
          let statusText = 'Awaiting Result';
          let showLiveDot = false;

          if (isDeclared && isVerified) {
            badgeClass = 'live';
            statusText = 'LIVE';
            showLiveDot = true;
          } else if (isPartial && isVerified) {
            badgeClass = 'live';
            statusText = '1st Round Declared';
            showLiveDot = true;
          } else if (item.status === 'CANCELLED') {
            badgeClass = 'completed';
            statusText = 'Cancelled';
            showLiveDot = false;
          }

          const gameHref = getGameUrl(item.slug);

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
                    {showLiveDot && <span className="status-indicator-dot" aria-hidden="true" />}
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
