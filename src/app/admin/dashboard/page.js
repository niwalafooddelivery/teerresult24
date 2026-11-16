'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [todayResults, setTodayResults] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0]);
  const [round1, setRound1] = useState('');
  const [round2, setRound2] = useState('');
  const [sourceInfo, setSourceInfo] = useState('');
  const [sourceEvidenceUrl, setSourceEvidenceUrl] = useState('');
  const [actionType, setActionType] = useState('submit'); // 'submit' or 'approve_and_verify'
  const [correctionReason, setCorrectionReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Reviews Queue state
  const [pendingReviews, setPendingReviews] = useState([]);
  const [reviewActionLoading, setReviewActionLoading] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);

  const checkAuthAndLoad = async () => {
    try {
      setFetching(true);
      const authRes = await fetch('/api/admin/me');
      const authData = await authRes.json();
      if (!authRes.ok || !authData.authenticated) {
        router.push('/admin/login');
        return;
      }

      // Load results
      const res = await fetch('/api/results/today');
      const data = await res.json();
      if (data.success) {
        setTodayResults(data.results);
        setCategories(data.results.map((r) => ({ id: r.id, name: r.name, slug: r.slug })));
        if (data.results.length > 0 && !selectedCategoryId) {
          setSelectedCategoryId(data.results[0].id);
        }
      }

      // Load pending reviews
      const reviewsRes = await fetch('/api/admin/reviews?status=PENDING');
      const reviewsData = await reviewsRes.json();
      if (reviewsData.success) {
        setPendingReviews(reviewsData.reviews || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      router.push('/admin/login');
    } finally {
      setFetching(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.push('/admin/login');
    } catch (err) {
      router.push('/admin/login');
    }
  };

  const loadData = checkAuthAndLoad;

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const handleSelectGame = (catId) => {
    setSelectedCategoryId(catId);
    const existing = todayResults.find((r) => r.id === catId);
    if (existing) {
      setRound1(existing.round1 || '');
      setRound2(existing.round2 || '');
      setSourceInfo(existing.sourceInfo || '');
      setSourceEvidenceUrl(existing.sourceEvidenceUrl || '');
    } else {
      setRound1('');
      setRound2('');
      setSourceInfo('');
      setSourceEvidenceUrl('');
    }
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });
    setLoading(true);

    try {
      const res = await fetch('/api/admin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: selectedCategoryId,
          dateStr,
          round1: round1.trim() || null,
          round2: round2.trim() || null,
          sourceInfo: sourceInfo.trim() || 'Manual Editorial Entry',
          sourceEvidenceUrl: sourceEvidenceUrl.trim() || undefined,
          action: actionType,
          correctionReason: correctionReason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to publish result');
      }

      setMessage({ text: data.message || 'Action completed successfully.', type: 'success' });
      setCorrectionReason('');
      await loadData();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleReviewAction = async (reviewId, action, options = {}) => {
    setReviewActionLoading(reviewId);
    setMessage({ text: '', type: '' });
    try {
      const payload = { reviewId, action, ...options };
      const res = await fetch('/api/admin/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to ${action} review`);
      }
      setMessage({ text: data.message, type: 'success' });
      await loadData();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setReviewActionLoading(null);
    }
  };

  const handleManualSync = async () => {
    setSyncLoading(true);
    setMessage({ text: '', type: '' });
    try {
      const res = await fetch('/api/admin/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Sync failed');
      }
      setMessage({
        text: `Sync executed: ${data.recordsRead} read, ${data.recordsSaved} processed.`,
        type: 'success',
      });
      await loadData();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '32px 20px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '28px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>
            TeerResult2 Editorial Desk
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Authorized editorial verification and score management
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={handleManualSync}
            disabled={syncLoading}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            {syncLoading ? 'Syncing...' : 'Trigger Source Check'}
          </button>
          <button
            onClick={handleLogout}
            className="btn-secondary"
            style={{ padding: '8px 16px', fontSize: '0.85rem', color: '#b91c1c' }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {message.text && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '24px',
            backgroundColor: message.type === 'error' ? '#fef2f2' : '#f0fdf4',
            color: message.type === 'error' ? '#991b1b' : '#166534',
            border: `1px solid ${message.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
            fontSize: '0.9rem',
          }}
        >
          {message.text}
        </div>
      )}

      {/* PENDING REVIEW QUEUE SECTION */}
      {pendingReviews.length > 0 && (
        <section style={{ marginBottom: '36px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#92400e', margin: 0 }}>
              Pending Ingestion Review Queue ({pendingReviews.length})
            </h2>
            <span style={{ fontSize: '0.8rem', color: '#b45309', fontWeight: 600 }}>
              Human Verification Required
            </span>
          </div>
          <div style={{ display: 'grid', gap: '12px' }}>
            {pendingReviews.map((rev) => (
              <div
                key={rev.id}
                style={{
                  background: '#ffffff',
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  border: rev.reviewType === 'CORRECTION_CANDIDATE' ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                    {rev.category?.name || 'Teer Game'} — Date: {rev.dateStr}
                    <span
                      style={{
                        marginLeft: '8px',
                        fontSize: '0.72rem',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: rev.reviewType === 'CORRECTION_CANDIDATE' ? '#fef3c7' : '#e0f2fe',
                        color: rev.reviewType === 'CORRECTION_CANDIDATE' ? '#b45309' : '#0369a1',
                        fontWeight: 700,
                      }}
                    >
                      {rev.reviewType}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '4px' }}>
                    Proposed Scores: <strong>FR: {rev.proposedRound1 ?? '--'}</strong> | <strong>SR: {rev.proposedRound2 ?? '--'}</strong>
                    {rev.currentRound1 || rev.currentRound2 ? (
                      <span style={{ marginLeft: '12px', color: '#dc2626' }}>
                        (Current Verified: FR {rev.currentRound1 ?? '--'} | SR {rev.currentRound2 ?? '--'})
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Source: {rev.sourceName} | <a href={rev.sourceUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>View Evidence</a>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      if (window.confirm(`Publish ${rev.category?.name || 'game'} as UNVERIFIED live scores?\n\nThis will publish scores to the public scoreboard with an explicit "Unverified Live Score" label without official ground verification.`)) {
                        handleReviewAction(rev.id, 'approve', {
                          publishMode: 'unverified',
                          markVerified: false,
                        });
                      }
                    }}
                    disabled={reviewActionLoading === rev.id}
                    className="btn-secondary"
                    style={{ padding: '8px 12px', fontSize: '0.8rem', borderColor: '#d97706', color: '#b45309' }}
                  >
                    Publish Unverified
                  </button>
                  <button
                    onClick={() => {
                      const authority = window.prompt(
                        'Step 1 of 2: Enter Sanctioned Source Authority:\n(e.g., "Khasi Hills Archery Sports Association", "Polo Grounds Official Draw", "Khanapara Archery Syndicate", "Juwai Archery Association")',
                        'Khasi Hills Archery Sports Association (KHASA)'
                      );
                      if (!authority) return;

                      const identifier = window.prompt(
                        'Step 2 of 2: Enter Verifiable Document / Bulletin / Slip Reference:\n(e.g., "Official Bulletin #14", "Counter Slip #401", "Steward Sheet #8")',
                        'Official Bulletin #1'
                      );
                      if (!identifier) return;

                      handleReviewAction(rev.id, 'approve', {
                        publishMode: 'verified',
                        markVerified: true,
                        confirmedByEditor: true,
                        officialEvidence: {
                          sourceAuthority: authority.trim(),
                          evidenceIdentifier: identifier.trim(),
                          editorialNotes: 'Corroborated by editor against sanctioned ground records',
                          confirmedByEditor: true,
                        },
                      });
                    }}
                    disabled={reviewActionLoading === rev.id}
                    className="btn-primary"
                    style={{ padding: '8px 14px', fontSize: '0.82rem', background: 'var(--primary-color)' }}
                  >
                    {reviewActionLoading === rev.id ? '...' : 'Verify with Ground Evidence'}
                  </button>
                  <button
                    onClick={() => handleReviewAction(rev.id, 'reject')}
                    disabled={reviewActionLoading === rev.id}
                    className="btn-secondary"
                    style={{ padding: '8px 12px', fontSize: '0.8rem', color: '#b91c1c' }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Grid: Editor Form and Current Status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px' }}>
        {/* Editor Form */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px', color: '#0f172a' }}>
            Score Declaration Editor
          </h2>

          <form onSubmit={handlePublish} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                Select Competition Category
              </label>
              <select
                className="search-input"
                style={{ width: '100%', background: '#fff' }}
                value={selectedCategoryId}
                onChange={(e) => handleSelectGame(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                Result Date (YYYY-MM-DD in IST)
              </label>
              <input
                type="date"
                className="search-input"
                style={{ width: '100%' }}
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                  First Round (FR)
                </label>
                <input
                  type="text"
                  maxLength={2}
                  placeholder="00 - 99"
                  className="search-input"
                  style={{ width: '100%', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center' }}
                  value={round1}
                  onChange={(e) => setRound1(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                  Second Round (SR)
                </label>
                <input
                  type="text"
                  maxLength={2}
                  placeholder="00 - 99"
                  className="search-input"
                  style={{ width: '100%', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center' }}
                  value={round2}
                  onChange={(e) => setRound2(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                Source Information
              </label>
              <input
                type="text"
                placeholder="e.g. Polo Grounds Authorized Tally Board"
                className="search-input"
                style={{ width: '100%' }}
                value={sourceInfo}
                onChange={(e) => setSourceInfo(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                Source Evidence URL (Required for Official Verification)
              </label>
              <input
                type="url"
                placeholder="https://example.com/official-bulletin"
                className="search-input"
                style={{ width: '100%' }}
                value={sourceEvidenceUrl}
                onChange={(e) => setSourceEvidenceUrl(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                Verification Mode
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem' }}>
                  <input
                    type="radio"
                    name="actionType"
                    value="submit"
                    checked={actionType === 'submit'}
                    onChange={() => setActionType('submit')}
                  />
                  <span>Save as Pending Verification (Draft / Preliminary)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem' }}>
                  <input
                    type="radio"
                    name="actionType"
                    value="approve_and_verify"
                    checked={actionType === 'approve_and_verify'}
                    onChange={() => setActionType('approve_and_verify')}
                  />
                  <span style={{ fontWeight: 600, color: 'var(--primary-color)' }}>
                    Approve &amp; Mark Verified (Requires documented URL evidence)
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                Correction Reason (Required only if revising published numbers)
              </label>
              <input
                type="text"
                placeholder="e.g. Official recount adjustment by judge board"
                className="search-input"
                style={{ width: '100%' }}
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', padding: '12px', marginTop: '10px' }}
            >
              {loading ? 'Processing...' : actionType === 'approve_and_verify' ? 'Approve & Mark Verified' : 'Save as Pending'}
            </button>
          </form>
        </div>

        {/* Current Status Overview */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
              Current Status Summary
            </h2>
            <button onClick={loadData} className="btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }}>
              {fetching ? '...' : 'Refresh'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {todayResults.map((r) => (
              <div
                key={r.id}
                onClick={() => handleSelectGame(r.id)}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: selectedCategoryId === r.id ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
                  border: selectedCategoryId === r.id ? '2px solid var(--emerald-400)' : '1px solid var(--border-color)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{r.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    FR: {r.round1 || '--'} | SR: {r.round2 || '--'}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    className={`card-badge ${r.isVerified ? 'badge-live' : 'badge-done'}`}
                    style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                  >
                    {r.isVerified ? 'Verified' : 'Pending Verification'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
