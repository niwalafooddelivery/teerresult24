'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

function getGameUrl(slug) {
  if (slug === 'shillong-night-teer') return '/shillong-night-teer/';
  if (slug === 'shillong-morning-teer') return '/shillong-morning-teer-result/';
  if (slug === 'welcome-morning-teer') return '/welcome-morning-teer-result/';
  return `/${slug}-result/`;
}

function formatCardDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parts[2].padStart(2, '0');
  const monthName = months[monthIdx] || parts[1];
  return `${day} ${monthName} ${parts[0]}`;
}

function formatUpdateTime(isoString) {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return null;
  }
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
    }, 30000);

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

  const displayDate = formatCardDate(currentDateStr);

  return (
    <section className="live-section">
      <div className="section-head">
        <div>
          <h2 className="section-title">
            Today&apos;s Official Teer Results
          </h2>
          <p className="section-sub" suppressHydrationWarning>
            Live traditional archery announcements across Meghalaya and Assam • Last checked at{' '}
            {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>

        <button
          onClick={fetchLatest}
          disabled={loading}
          className="btn-secondary refresh-btn"
          title="Retrieve live verified published data from database"
          aria-label="Refresh results now"
        >
          {loading ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span className="spinner-icon" aria-hidden="true">↻</span> Fetching...
            </span>
          ) : (
            '↻ Refresh Results'
          )}
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
          } else if (isDeclared && !isVerified) {
            badgeClass = 'pending';
            statusText = 'Pending Approval';
            showLiveDot = false;
          } else if (isPartial && !isVerified) {
            badgeClass = 'pending';
            statusText = 'FR Under Review';
            showLiveDot = false;
          } else if (item.status === 'CANCELLED') {
            badgeClass = 'completed';
            statusText = 'Cancelled';
            showLiveDot = false;
          }

          const gameHref = getGameUrl(item.slug);
          const pastHref = `/previous-results/?category=${item.slug}`;
          const updatedTimeStr = formatUpdateTime(item.updatedAt);

          return (
            <div
              key={item.id || item.slug}
              id={item.slug}
              className={`teer-card ${isFeatured ? 'featured' : ''}`}
            >
              <div className="card-top">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 className="card-title">
                    <Link href={gameHref} style={{ color: 'inherit', textDecoration: 'none' }}>
                      {item.name}
                    </Link>
                  </h3>
                  <div className="card-meta-line">
                    <span className="card-location">{item.location}</span>
                    {displayDate && (
                      <span className="card-date-badge">• {displayDate}</span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
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
                  <div
                    className={`round-score ${item.round1 ? 'score-green' : 'score-waiting'}`}
                    aria-label={`First Round Score: ${item.round1 || 'Not declared'}`}
                  >
                    {item.round1 ? item.round1 : '--'}
                  </div>
                  <div className="round-schedule-tag">Schedule: {item.round1Time} IST</div>
                </div>

                {/* 2nd Round */}
                <div className="round-box">
                  <div className="round-header">2nd Round (SR)</div>
                  <div className="round-time">{item.round2Time}</div>
                  <div
                    className={`round-score ${item.round2 ? 'score-gold' : 'score-waiting'}`}
                    aria-label={`Second Round Score: ${item.round2 || 'Not declared'}`}
                  >
                    {item.round2 ? item.round2 : '--'}
                  </div>
                  <div className="round-schedule-tag">Schedule: {item.round2Time} IST</div>
                </div>
              </div>

              {/* Timestamp & Verification Provenance */}
              <div className="card-timestamp-bar">
                <span className="card-provenance" title={`Source: ${item.sourceInfo || 'Official Field Record'}`}>
                  {item.round1 || item.round2
                    ? item.isVerified
                      ? '✓ Verified Official Record'
                      : 'Field Declaration (Pending Review)'
                    : 'Awaiting Match Declaration'}
                </span>
                {updatedTimeStr && (
                  <span className="card-updated-time">Updated: {updatedTimeStr} IST</span>
                )}
              </div>

              {/* Action Links */}
              <div className="card-footer">
                <Link
                  href={pastHref}
                  className="card-archive-link"
                  title={`View historical archive for ${item.name}`}
                >
                  Previous Results
                </Link>
                <Link
                  href={gameHref}
                  className="card-details-link"
                  title={`View complete details and rules for ${item.name}`}
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