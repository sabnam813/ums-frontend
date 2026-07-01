import React, { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import './CountryModal.css';

const COUNTRY_FLAGS = {
  'Australia': '🇦🇺', 'United Kingdom': '🇬🇧', 'Canada': '🇨🇦',
  'United States': '🇺🇸', 'New Zealand': '🇳🇿', 'Germany': '🇩🇪',
  'France': '🇫🇷', 'Ireland': '🇮🇪', 'Netherlands': '🇳🇱',
  'Sweden': '🇸🇪', 'Denmark': '🇩🇰', 'Finland': '🇫🇮',
  'Norway': '🇳🇴', 'Switzerland': '🇨🇭', 'Japan': '🇯🇵',
  'South Korea': '🇰🇷', 'Singapore': '🇸🇬', 'Malaysia': '🇲🇾',
  'Nepal': '🇳🇵', 'India': '🇮🇳', 'China': '🇨🇳',
};

const MAX_DIMENSION = 160; 
const MAX_OUTPUT_BYTES = 350 * 1024; 

function fileToCompressedDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read image'));
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.92;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > MAX_OUTPUT_BYTES && quality > 0.3) {
          quality -= 0.12;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function CountryModal({ country, onSave, onClose }) {
  const isEdit = !!country;
  const [form, setForm] = useState({
    name: country?.name || '',
    flag: country?.flag || '',
    flagImage: country?.flagImage || '',
  });
  const [errors, setErrors] = useState({});
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Country name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      name: form.name.trim(),
      flag: form.flag || COUNTRY_FLAGS[form.name] || '',
      flagImage: form.flagImage || '',
    });
  };

  const handleNameChange = (name) => {
    setForm(f => ({ ...f, name, flag: COUNTRY_FLAGS[name] || f.flag }));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setForm(f => ({ ...f, flagImage: dataUrl }));
    } catch {
      toast.error('Could not process that image — try a different file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = () => setForm(f => ({ ...f, flagImage: '' }));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-fade">
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
            </div>
            <div>
              <h3>{isEdit ? 'Edit Country' : 'Add New Country'}</h3>
              <p>Assign users to this country from the Users page</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-section">
            <h4>Country Details</h4>
            <div className="form-row">
              <div className={`field ${errors.name ? 'has-error' : ''}`}>
                <label>Country Name *</label>
                <div className="field-wrap">
                  <input
                    type="text"
                    placeholder="e.g. Australia"
                    value={form.name}
                    onChange={e => handleNameChange(e.target.value)}
                    list="country-suggestions"
                    style={{ paddingLeft: (form.flagImage || form.flag) ? '36px' : '12px' }}
                  />
                  <datalist id="country-suggestions">
                    {Object.keys(COUNTRY_FLAGS).map(c => <option key={c} value={c} />)}
                  </datalist>
                  {form.flagImage ? (
                    <img src={form.flagImage} alt="" className="name-input-flag-img" />
                  ) : form.flag && (
                    <span style={{ position: 'absolute', left: 10, fontSize: 18, pointerEvents: 'none' }}>
                      {form.flag}
                    </span>
                  )}
                </div>
                {errors.name && <span className="field-error">{errors.name}</span>}
              </div>
              <div className="field">
                <label>Flag Emoji (fallback)</label>
                <input
                  type="text"
                  placeholder="e.g. paste flag emoji"
                  value={form.flag}
                  onChange={e => setForm(f => ({ ...f, flag: e.target.value }))}
                  maxLength={4}
                />
              </div>
            </div>

                        <div className="field">
              <label>Flag Picture</label>
              <div className="flag-upload-row">
                <div className="flag-upload-preview">
                  {form.flagImage ? (
                    <img src={form.flagImage} alt="Flag preview" />
                  ) : form.flag ? (
                    <span className="flag-upload-emoji">{form.flag}</span>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="2" y1="12" x2="22" y2="12"/>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                  )}
                </div>
                <div className="flag-upload-actions">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    id="flag-image-input"
                    onChange={handleFileChange}
                    hidden
                  />
                  <button
                    type="button"
                    className="flag-upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    {uploading ? 'Processing…' : form.flagImage ? 'Replace Picture' : 'Upload Picture'}
                  </button>
                  {form.flagImage && (
                    <button type="button" className="flag-remove-btn" onClick={removeImage}>
                      Remove
                    </button>
                  )}
                  <p className="flag-upload-hint">
                    Used everywhere this country's flag appears, including the small collapsed sidebar icon. If no picture is set, the emoji above is used instead.
                  </p>
                </div>
              </div>
            </div>

            <p className="section-hint" style={{ marginTop: 8 }}>
              After adding the country, go to Users to assign access.
            </p>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-save" disabled={uploading}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                {isEdit
                  ? <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>
                  : <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></>
                }
              </svg>
              {isEdit ? 'Save Changes' : 'Add Country'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
