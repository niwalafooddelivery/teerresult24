'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import TeerLogo from '@/components/TeerLogo';

function getClientTodayIST() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

export default function AdminDashboardPage() {
  const router = useRouter();

  // Categories & dropdown state
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  // Results & Current Status Summary state
  const [todayResults, setTodayResults] = useState([]);
  const [statusDateStr, setStatusDateStr] = useState(getClientTodayIST());
  const [statusError, setStatusError] = useState('');
  const [fetching, setFetching] = useState(true);

  // Score Declaration Editor form state
  const [dateStr, setDateStr] = useState(getClientTodayIST());
  const [round1, setRound1] = useState('');
  const [round2, setRound2] = useState('');
  const [sourceInfo, setSourceInfo] = useState('');
  const [sourceEvidenceUrl, setSourceEvidenceUrl] = useState('');
  const [actionType, setActionType] = useState('submit'); // 'submit' or 'approve_and_verify'
  const [correctionReason, setCorrectionReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Reviews Queue state
  const [pendingReviews, setPendingReviews] = useState([]);
  const [reviewActionLoading, setReviewActionLoading] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);

  const checkAuthAndLoad = useCallback(async () => {
    try {
      setFetching(true);
      setCategoriesLoading(true);
      setCategoriesError('');
      setStatusError('');

      // 1. Verify Authentication
      const authRes = await fetch('/api/admin/me');
      const authData = await authRes.json();
      if (!authRes.ok || !authData.authenticated) {
        router.push('/admin/login');
        return;
      }

      // 2. Fetch categories from dedicated endpoint /api/admin/categories
      let cats = [];
      try {
        const catRes = await fetch('/api/admin/categories');
        const catData = await catRes.json();
        if (catData.success && Array.isArray(catData.categories) && catData.categories.length > 0) {
          cats = catData.categories;
        }
      } catch (catErr) {
        console.warn('Failed to fetch from /api/admin/categories:', catErr);
      }

      // 3. Load today results
      try {
        const res = await fetch('/api/results/today');
        const data = await res.json();
        if (data.success && Array.isArray(data.results)) {
          setTodayResults(data.results);
          if (data.date) setStatusDateStr(data.date);

          // If /api/admin/categories didn't return, fallback to categories from results
          if (cats.length === 0 && data.results.length > 0) {
            cats = data.results.map((r) => ({
              id: r.id,
              name: r.name,
              slug: r.slug,
              round1Time: r.round1Time,
              round2Time: r.round2Time,
            }));
          }
        } else {
          setStatusError(data.error || 'Unable to load today status summary');
        }
      } catch (todayErr) {
        console.error('Failed to load today results:', todayErr);
        setStatusError(todayErr.message || 'Network error fetching status');
      }

      setCategories(cats);
      if (cats.length > 0) {
        setSelectedCategoryId((prev) => (prev && cats.some((c) => c.id === prev) ? prev : cats[0].id));
      } else {
        setCategoriesError('No competition categories found in database.');
      }

      // 4. Load pending reviews
      try {
        const reviewsRes = await fetch('/api/admin/reviews?status=PENDING');
        const reviewsData = await reviewsRes.json();
        if (reviewsData.success) {
          setPendingReviews(reviewsData.reviews || []);
        }
      } catch (revErr) {
        console.warn('Failed to load pending reviews:', revErr);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      router.push('/admin/login');
    } finally {
      setFetching(false);
      setCategoriesLoading(false);
    }
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.push('/admin/login');
    } catch {
      router.push('/admin/login');
    }
  };

  const loadData = checkAuthAndLoad;

  useEffect(() => {
    checkAuthAndLoad();
  }, [checkAuthAndLoad]);

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

    if (!selectedCategoryId) {
      setMessage({ text: 'Please select a competition category before publishing.', type: 'error' });
      return;
    }

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
        text: `Sync executed: ${data.recordsRead ?? 0} read, ${data.recordsSaved ?? 0} processed.`,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <TeerLogo size={40} />
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              TeerResult Editorial Desk
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px', margin: 0 }}>
              Authorized editorial verification and score management
            </p>
          </div>
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
                    Source: {rev.sourceName} |{' '}
                    <a href={rev.sourceUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                      View Evidence
                    </a>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          `Publish ${rev.category?.name || 'game'} as UNVERIFIED live scores?\n\nThis will publish scores to the public scoreboard with an explicit "Unverified Live Score" label without official ground verification.`
                        )
                      ) {
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

              {categoriesLoading ? (
                <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Loading competition categories...
                </div>
              ) : categoriesError ? (
                <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 'var(--radius-md)', border: '1px solid #fecaca', fontSize: '0.85rem', color: '#b91c1c' }}>
                  {categoriesError}{' '}
                  <button type="button" onClick={loadData} style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontWeight: 600 }}>
                    Retry
                  </button>
                </div>
              ) : categories.length === 0 ? (
                <div style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: 'var(--radius-md)', border: '1px solid #fde68a', fontSize: '0.85rem', color: '#b45309' }}>
                  No competition categories available. Please seed categories.
                </div>
              ) : (
                <select
                  className="search-input"
                  style={{ width: '100%', background: '#fff' }}
                  value={selectedCategoryId}
                  onChange={(e) => handleSelectGame(e.target.value)}
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.round1Time && c.round2Time ? `(${c.round1Time} / ${c.round2Time})` : ''}
                    </option>
                  ))}
                </select>
              )}
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
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '').slice(0, 2);
                    setRound1(clean);
                  }}
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
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '').slice(0, 2);
                    setRound2(clean);
                  }}
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
              disabled={loading || categoriesLoading || categories.length === 0}
              className="btn-primary"
              style={{ width: '100%', padding: '12px', marginTop: '10px' }}
            >
              {loading ? 'Processing...' : actionType === 'approve_and_verify' ? 'Approve & Mark Verified' : 'Save as Pending'}
            </button>
          </form>
        </div>

        {/* Current Status Overview */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Current Status Summary
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {statusDateStr ? `Date: ${statusDateStr} (Asia/Kolkata)` : 'Asia/Kolkata Live Board'}
              </p>
            </div>
            <button
              onClick={loadData}
              disabled={fetching}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              {fetching ? '...' : 'Refresh'}
            </button>
          </div>

          {fetching && todayResults.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Loading today result statuses...
            </div>
          ) : statusError && todayResults.length === 0 ? (
            <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', color: '#b91c1c', fontSize: '0.85rem' }}>
              Failed to load current status: {statusError}
              <div style={{ marginTop: '8px' }}>
                <button type="button" onClick={loadData} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                  Retry
                </button>
              </div>
            </div>
          ) : todayResults.length === 0 ? (
            <div style={{ padding: '20px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', color: '#b45309', fontSize: '0.85rem' }}>
              No competition records found for today. Use the editor to declare results or click &quot;Trigger Source Check&quot;.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {todayResults.map((r) => {
                const frDisplay = r.round1 ? `FR: ${r.round1}` : 'FR: Awaiting Result';
                const srDisplay = r.round2 ? `SR: ${r.round2}` : 'SR: Awaiting Result';
                const isSelected = selectedCategoryId === r.id;

                let badgeLabel = 'Awaiting Result';
                let badgeStyle = { background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' };

                if (r.isVerified) {
                  badgeLabel = 'Verified Official';
                  badgeStyle = { background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' };
                } else if (r.round1 || r.round2) {
                  badgeLabel = r.status === 'CORRECTED' ? 'Corrected' : 'Pending Verification';
                  badgeStyle = { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' };
                }

                return (
                  <div
                    key={r.id}
                    onClick={() => handleSelectGame(r.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
                      border: isSelected ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      boxShadow: isSelected ? '0 2px 6px rgba(5, 150, 105, 0.15)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                        {r.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {r.round1Time} | {r.round2Time}
                      </div>
                      <div style={{ fontSize: '0.82rem', marginTop: '4px', fontWeight: 600 }}>
                        <span style={{ color: r.round1 ? '#047857' : '#94a3b8' }}>{frDisplay}</span>
                        {' · '}
                        <span style={{ color: r.round2 ? '#047857' : '#94a3b8' }}>{srDisplay}</span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          display: 'inline-block',
                          ...badgeStyle,
                        }}
                      >
                        {badgeLabel}
                      </span>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                        {isSelected ? '● Selected' : 'Click to edit'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
