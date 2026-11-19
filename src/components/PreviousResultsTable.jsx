'use client';

import { useState } from 'react';
import { formatCompactDate } from '@/lib/date-utils';

export default function PreviousResultsTable({
  initialResults = [],
  categories = [],
  initialTotalCount = 0,
  initialPage = 1,
  initialLimit = 25,
  initialTotalPages = 1,
}) {
  const [results, setResults] = useState(initialResults);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [page, setPage] = useState(initialPage);
  const [limit] = useState(initialLimit);
  const [totalCount, setTotalCount] = useState(initialTotalCount || initialResults.length);
  const [totalPages, setTotalPages] = useState(initialTotalPages || Math.max(1, Math.ceil(initialResults.length / initialLimit)));
  const [loading, setLoading] = useState(false);

  const fetchArchiveData = async (cat, date, targetPage) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (cat && cat !== 'all') params.append('category', cat);
      if (date) params.append('date', date);
      params.append('page', String(targetPage));
      params.append('limit', String(limit));

      const res = await fetch(`/api/results/history/?${params.toString()}`);
      if (!res.ok) return;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;
      const data = await res.json();
      if (data.success && data.results) {
        setResults(data.results);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
        setPage(data.page || targetPage);
      }
    } catch (err) {
      console.error('Error fetching archive records:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (e) => {
    const newCat = e.target.value;
    setSelectedCategory(newCat);
    setPage(1);
    fetchArchiveData(newCat, selectedDate, 1);
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    setPage(1);
    fetchArchiveData(selectedCategory, newDate, 1);
  };

  const handleReset = () => {
    setSelectedCategory('all');
    setSelectedDate('');
    setPage(1);
    fetchArchiveData('all', '', 1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== page) {
      fetchArchiveData(selectedCategory, selectedDate, newPage);
    }
  };

  return (
    <div className="section-wrapper" style={{ marginTop: '20px' }}>
      <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h2 className="section-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            Historical Results Archive
          </h2>
          <p className="section-sub" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Filter verified past winning numbers by date and archery club
          </p>
        </div>

        <div className="filter-bar" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="select-input"
            value={selectedCategory}
            onChange={handleCategoryChange}
            aria-label="Filter by Game"
          >
            <option value="all">All Games</option>
            {categories.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            className="search-input"
            value={selectedDate}
            onChange={handleDateChange}
            aria-label="Filter by Date"
          />

          {(selectedCategory !== 'all' || selectedDate) && (
            <button
              onClick={handleReset}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      <div className="data-table-container table-responsive">
        <table className="history-table data-table">
          <thead>
            <tr>
              <th>Date (IST)</th>
              <th>Archery Club</th>
              <th>1st Round (FR)</th>
              <th>2nd Round (SR)</th>
              <th>Verification Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  Loading archival records...
                </td>
              </tr>
            ) : results.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '1rem', marginBottom: '6px' }}>
                    No Historical Records Available
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                    {selectedDate || selectedCategory !== 'all'
                      ? 'No recorded outcomes match your filter criteria. Try selecting another date or club.'
                      : 'Verified archival records are added following official association bulletins.'}
                  </p>
                </td>
              </tr>
            ) : (
              results.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{formatCompactDate(item.dateStr) || item.dateStr}</td>
                  <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.category?.name || 'Teer Game'}</td>
                  <td>
                    <span className="table-score score-highlight">{item.round1 || '--'}</span>
                  </td>
                  <td>
                    <span className="table-score">{item.round2 || '--'}</span>
                  </td>
                  <td>
                    {item.isVerified ? (
                      <span className="card-badge badge-live" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                        Verified Bulletin
                      </span>
                    ) : (
                      <span className="card-badge badge-done" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                        Pending Verification
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '12px' }}>
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1 || loading}
            className="btn-secondary"
            style={{ fontSize: '0.82rem', padding: '6px 14px', opacity: page <= 1 ? 0.5 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
          >
            &larr; Previous Page
          </button>

          <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Page {page} of {totalPages} <span style={{ fontWeight: 400 }}>({totalCount} records)</span>
          </span>

          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages || loading}
            className="btn-secondary"
            style={{ fontSize: '0.82rem', padding: '6px 14px', opacity: page >= totalPages ? 0.5 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            Next Page &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
