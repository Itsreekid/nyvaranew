'use client';

import { useState, useEffect } from 'react';
import { Loader2, Save, Home, ChevronDown, ChevronUp } from 'lucide-react';
import ImageUpload from '@/components/admin/ImageUpload';

export default function HomepageSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openSections, setOpenSections] = useState({ hero: true });
  
  const [settings, setSettings] = useState<any>({
    hero_badge: '',
    hero_title: '',
    hero_subtitle: '',
    hero_stat1_value: '',
    hero_stat1_label: '',
    hero_stat2_value: '',
    hero_stat2_label: '',
    hero_stat3_value: '',
    hero_stat3_label: '',
    hero_cta1_label: '',
    hero_cta2_label: '',
    hero_image_url: '',
    hero_image_badge: '',
  });

  useEffect(() => {
    fetch('/api/homepage-settings')
      .then(r => r.json())
      .then(settingsData => {
        setSettings((prev: any) => ({ ...prev, ...settingsData }));
        setLoading(false);
      }).catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/homepage-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (!res.ok) throw new Error('Save failed');
      alert('Paramètres enregistrés avec succès!');
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <Loader2 size={32} className="lucide-spin" style={{ color: '#C9A96E' }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#1B1B1B' }}>Paramètres Accueil</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#1A1A1A', color: '#C9A96E', border: '1px solid #C9A96E',
            padding: '12px 24px', borderRadius: '8px', fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1
          }}
        >
          {saving ? <Loader2 size={18} className="lucide-spin" /> : <Save size={18} />}
          Enregistrer
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* HERO SECTION */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpenSections(prev => ({ ...prev, hero: !prev.hero }))}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Home size={20} color="#C9A96E" /> Section Hero (Haut de page)
            </h2>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              {openSections.hero ? <ChevronUp size={20} color="#6B6B6B" /> : <ChevronDown size={20} color="#6B6B6B" />}
            </button>
          </div>
          
          {openSections.hero && (
            <div style={{ marginTop: '24px' }}>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Badge (ex: NOUVELLE COLLECTION 2026)</label>
                <input type="text" name="hero_badge" value={settings.hero_badge || ''} onChange={handleChange} style={inputStyle} />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Titre Principal</label>
                <input type="text" name="hero_title" value={settings.hero_title || ''} onChange={handleChange} style={inputStyle} />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Sous-titre (Sauts de ligne gérés via Entrée)</label>
                <textarea name="hero_subtitle" value={settings.hero_subtitle || ''} onChange={handleChange} style={{...inputStyle, minHeight: '80px'}} />
              </div>

              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '24px 0 12px 0', borderBottom: '1px solid #EEE', paddingBottom: '8px' }}>Statistiques</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Stat 1 - Valeur (ex: 200+)</label>
                  <input type="text" name="hero_stat1_value" value={settings.hero_stat1_value || ''} onChange={handleChange} style={inputStyle} />
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, margin: '8px 0 4px' }}>Stat 1 - Label (ex: MODÈLES)</label>
                  <input type="text" name="hero_stat1_label" value={settings.hero_stat1_label || ''} onChange={handleChange} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Stat 2 - Valeur (ex: 100%)</label>
                  <input type="text" name="hero_stat2_value" value={settings.hero_stat2_value || ''} onChange={handleChange} style={inputStyle} />
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, margin: '8px 0 4px' }}>Stat 2 - Label (ex: ARTISANAL)</label>
                  <input type="text" name="hero_stat2_label" value={settings.hero_stat2_label || ''} onChange={handleChange} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Stat 3 - Valeur (ex: 48h)</label>
                  <input type="text" name="hero_stat3_value" value={settings.hero_stat3_value || ''} onChange={handleChange} style={inputStyle} />
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, margin: '8px 0 4px' }}>Stat 3 - Label (ex: LIVRAISON)</label>
                  <input type="text" name="hero_stat3_label" value={settings.hero_stat3_label || ''} onChange={handleChange} style={inputStyle} />
                </div>
              </div>

              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '24px 0 12px 0', borderBottom: '1px solid #EEE', paddingBottom: '8px' }}>Boutons CTA</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Bouton 1 (ex: DÉCOUVRIR)</label>
                  <input type="text" name="hero_cta1_label" value={settings.hero_cta1_label || ''} onChange={handleChange} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Bouton 2 (ex: EXPLORER LA COLLECTION)</label>
                  <input type="text" name="hero_cta2_label" value={settings.hero_cta2_label || ''} onChange={handleChange} style={inputStyle} />
                </div>
              </div>

              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '24px 0 12px 0', borderBottom: '1px solid #EEE', paddingBottom: '8px' }}>Média</h3>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Badge sur Image (ex: COLLECTION EXCLUSIVE 2026)</label>
                <input type="text" name="hero_image_badge" value={settings.hero_image_badge || ''} onChange={handleChange} style={inputStyle} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Image Principale</label>
                <ImageUpload
                  value={settings.hero_image_url || ''}
                  onChange={(url) => setSettings({ ...settings, hero_image_url: url })}
                  onUploading={() => {}}
                  folder="gallery"
                  requireSquare={false}
                />
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid #E5E7EB',
  fontSize: '14px',
  outline: 'none',
  fontFamily: 'inherit',
  backgroundColor: '#FAFAFA'
};
