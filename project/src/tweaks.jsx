/* Tweaks panel — runtime knobs for color, font, density, sidebar, stat card, table/card view */

const { useState: TW_us, useEffect: TW_ue } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "brandColor": "coral",
  "displayFont": "recoleta",
  "density": "comfy",
  "sidebarStyle": "pill",
  "sidebarDark": false,
  "statStrip": true,
  "statAnim": true,
  "eventsView": "table"
}/*EDITMODE-END*/;

const COLOR_OPTIONS = [
  { id: 'coral',   hex: '#E8473F', hover: '#D03B33', soft: '#FEF2F1' },
  { id: 'teal',    hex: '#1ABCB0', hover: '#138F85', soft: '#E6F9F8' },
  { id: 'pink',    hex: '#FF4D8B', hover: '#E13F77', soft: '#FFE7EF' },
  { id: 'ochre',   hex: '#D97706', hover: '#B45309', soft: '#FEF3C7' },
  { id: 'ink',     hex: '#0A0A0A', hover: '#2A2A2A', soft: '#F1F5F9' },
];

const FONT_OPTIONS = [
  { id: 'recoleta', label: 'Recoleta', stack: "'Recoleta','Fraunces',Georgia,serif" },
  { id: 'fraunces', label: 'Fraunces', stack: "'Fraunces',Georgia,serif" },
  { id: 'playfair', label: 'Playfair', stack: "'Playfair Display',Georgia,serif" },
];

function applyTweaks(t) {
  const root = document.documentElement;
  const c = COLOR_OPTIONS.find(c => c.id === t.brandColor) || COLOR_OPTIONS[0];
  root.style.setProperty('--brand', c.hex);
  root.style.setProperty('--brand-hover', c.hover);
  root.style.setProperty('--brand-soft', c.soft);
  const f = FONT_OPTIONS.find(f => f.id === t.displayFont) || FONT_OPTIONS[0];
  root.style.setProperty('--font-display', f.stack);
  document.body.classList.toggle('density-compact', t.density === 'compact');
}

function useTweaks() {
  const [tweaks, setTweaks] = TW_us(TWEAK_DEFAULTS);
  TW_ue(() => { applyTweaks(tweaks); }, [tweaks]);
  const set = (k, v) => setTweaks(t => ({ ...t, [k]: v }));
  return [tweaks, set];
}

function TweaksPanel({ tweaks, set, onClose }) {
  return (
    <div className="tweaks-panel" role="dialog" aria-label="Tweaks">
      <div className="tweaks-head">
        <h3>Tweaks</h3>
        <button className="icon-btn" aria-label="Close tweaks panel" style={{ width: 32, height: 32, border: 0 }} onClick={onClose}><window.Icons.X size={14} /></button>
      </div>
      <div className="tweaks-body">
        <TweakSection label="Brand color">
          <div className="tw-swatches">
            {COLOR_OPTIONS.map(c => (
              <button key={c.id} className={`tw-swatch ${tweaks.brandColor === c.id ? 'on' : ''}`} style={{ background: c.hex }} onClick={() => set('brandColor', c.id)} title={c.id} />
            ))}
          </div>
        </TweakSection>

        <TweakSection label="Display font">
          <div className="tw-radio">
            {FONT_OPTIONS.map(f => <button key={f.id} className={tweaks.displayFont === f.id ? 'on' : ''} onClick={() => set('displayFont', f.id)} style={{ fontFamily: f.stack }}>{f.label}</button>)}
          </div>
        </TweakSection>

        <TweakSection label="Density">
          <div className="tw-radio">
            <button className={tweaks.density === 'comfy' ? 'on' : ''} onClick={() => set('density', 'comfy')}>Comfy</button>
            <button className={tweaks.density === 'compact' ? 'on' : ''} onClick={() => set('density', 'compact')}>Compact</button>
          </div>
        </TweakSection>

        <TweakSection label="Sidebar style">
          <div className="tw-radio">
            <button className={tweaks.sidebarStyle === 'pill' ? 'on' : ''} onClick={() => set('sidebarStyle', 'pill')}>Filled</button>
            <button className={tweaks.sidebarStyle === 'bar' ? 'on' : ''} onClick={() => set('sidebarStyle', 'bar')}>Bar</button>
            <button className={tweaks.sidebarStyle === 'subtle' ? 'on' : ''} onClick={() => set('sidebarStyle', 'subtle')}>Subtle</button>
          </div>
        </TweakSection>

        <div className="tw-toggle-row">
          <span className="tw-label-inline">Dark sidebar</span>
          <span className={`toggle ${tweaks.sidebarDark ? 'on' : ''}`} onClick={() => set('sidebarDark', !tweaks.sidebarDark)} />
        </div>

        <TweakSection label="Stat card">
          <div className="tw-toggle-row">
            <span className="tw-label-inline">Yellow date strip</span>
            <span className={`toggle ${tweaks.statStrip ? 'on' : ''}`} onClick={() => set('statStrip', !tweaks.statStrip)} />
          </div>
          <div className="tw-toggle-row">
            <span className="tw-label-inline">Count-up animation</span>
            <span className={`toggle ${tweaks.statAnim ? 'on' : ''}`} onClick={() => set('statAnim', !tweaks.statAnim)} />
          </div>
        </TweakSection>

        <TweakSection label="Events listing">
          <div className="tw-radio">
            <button className={tweaks.eventsView === 'table' ? 'on' : ''} onClick={() => set('eventsView', 'table')}>Table</button>
            <button className={tweaks.eventsView === 'cards' ? 'on' : ''} onClick={() => set('eventsView', 'cards')}>Cards</button>
          </div>
        </TweakSection>
      </div>
    </div>
  );
}

function TweakSection({ label, children }) {
  return (
    <div className="tweak-section">
      <span className="tw-label">{label}</span>
      {children}
    </div>
  );
}

Object.assign(window, { useTweaks, TweaksPanel, applyTweaks });
