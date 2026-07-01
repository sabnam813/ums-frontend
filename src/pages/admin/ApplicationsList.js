import React, { useState, useEffect, useCallback } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import CountryModal from '../../components/admin/CountryModal';
import CountryFlag from '../../components/shared/CountryFlag';
import './ApplicationsList.css';

export default function ApplicationsList() {
  const outletCtx = useOutletContext() || {};

  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCountry, setEditCountry] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchCountries = useCallback(async () => {
    setLoading(true);

    try {
      const res = await axios.get('/countries');
      setCountries(res.data.countries || []);
    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Failed to load countries'
      );
      setCountries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCountries();
  }, [fetchCountries]);


  const handleSave = async (data) => {
    setSaving(true);

    try {
      if (editCountry) {
        await axios.put(`/countries/${editCountry._id}`, data);
        toast.success('Country updated');
      } else {
        await axios.post('/countries', data);
        toast.success('Country added');
      }

      setShowModal(false);
      setEditCountry(null);

      await fetchCountries();

      outletCtx.refetchCountries?.();

    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Failed to save country'
      );
    } finally {
      setSaving(false);
    }
  };


  const handleDelete = async (id) => {
    if (
      !window.confirm(
        'Delete this country? All associated applications will also be removed.'
      )
    ) {
      return;
    }

    try {
      await axios.delete(`/countries/${id}`);

      setCountries(prev =>
        prev.filter(c => c._id !== id)
      );

      toast.success('Country deleted');

      outletCtx.refetchCountries?.();

    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Failed to delete country'
      );
    }
  };


  if (loading) {
    return (
      <div className="dt-loading">
        <div className="dt-spinner" />
        <p>Loading countries…</p>
      </div>
    );
  }


  return (
    <div className="apps-list animate-fade">

      <div className="page-header">
        <div>
          <h2>Applications</h2>
          <p>
            Manage country applications. Assign users from the Users page
          </p>
        </div>

        <button
          className="btn-add"
          onClick={() => {
            setEditCountry(null);
            setShowModal(true);
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>

          Add Country
        </button>
      </div>


      <div className="countries-grid">

        {countries.map(c => (

          <div className="country-card" key={c._id}>

            <div className="cc-header">

              <span className="cc-flag">
                <CountryFlag
                  country={c}
                  size={34}
                  rounded={6}
                />
              </span>


              <div className="cc-actions">

                <button
                  className="icon-btn edit"
                  onClick={() => {
                    setEditCountry(c);
                    setShowModal(true);
                  }}
                  title="Edit"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>


                <button
                  className="icon-btn danger"
                  onClick={() => handleDelete(c._id)}
                  title="Delete"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/>
                    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>

              </div>

            </div>


            <h3 className="cc-name">
              {c.name}
            </h3>


            <div className="cc-stats">

              <div className="cc-stat">
                <span className="ccs-val">
                  {c.total ?? c.count ?? 0}
                </span>
                <span className="ccs-lbl">
                  Applications
                </span>
              </div>


              <div className="cc-stat">
                <span className="ccs-val">
                  {c.offered ?? 0}
                </span>
                <span className="ccs-lbl">
                  Received
                </span>
              </div>


              <div className="cc-stat">
                <span className="ccs-val">
                  {c.paid ?? 0}
                </span>
                <span className="ccs-lbl">
                  Paid
                </span>
              </div>

            </div>


            <Link
              to={`/admin/applications/${c._id}`}
              className="cc-open-btn"
            >
              Open Applications

              <svg width="14" height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5">

                <path d="M5 12h14M12 5l7 7-7 7"/>

              </svg>

            </Link>

          </div>

        ))}


        <button
          className="country-card add-card"
          onClick={() => {
            setEditCountry(null);
            setShowModal(true);
          }}
        >

          <div className="add-icon">
            <svg width="28" height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2">

              <path d="M12 5v14M5 12h14"/>

            </svg>
          </div>

          <span>
            Add New Country
          </span>

        </button>

      </div>


      {countries.length === 0 && (
        <div className="apps-empty-hint">
          No countries yet — click "Add New Country" to get started.
        </div>
      )}


      {showModal && (
        <CountryModal
          country={editCountry}
          onSave={handleSave}
          onClose={() => {
            if (!saving) {
              setShowModal(false);
              setEditCountry(null);
            }
          }}
        />
      )}

    </div>
  );
}