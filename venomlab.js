/**
 * SCORPION X — VenomLab 3D (MOD-03)
 * Evidence-Grounded Molecular Visualization Module
 * High-performance WebGL renderer powered by Three.js
 */

import * as THREE from './assets/vendor/three.module.js';

// Residue definitions and color palettes
const AA3_TO_1 = {
  ALA: 'A', CYS: 'C', ASP: 'D', GLU: 'E', PHE: 'F',
  GLY: 'G', HIS: 'H', ILE: 'I', LYS: 'K', LEU: 'L',
  MET: 'M', ASN: 'N', PRO: 'P', GLN: 'Q', ARG: 'R',
  SER: 'S', THR: 'T', VAL: 'V', TRP: 'W', TYR: 'Y'
};

const AA1_NAMES = {
  A: 'Alanine (Ala)', C: 'Cysteine (Cys)', D: 'Aspartate (Asp)', E: 'Glutamate (Glu)',
  F: 'Phenylalanine (Phe)', G: 'Glycine (Gly)', H: 'Histidine (His)', I: 'Isoleucine (Ile)',
  K: 'Lysine (Lys)', L: 'Leucine (Leu)', M: 'Methionine (Met)', N: 'Asparagine (Asn)',
  P: 'Proline (Pro)', Q: 'Glutamine (Gln)', R: 'Arginine (Arg)', S: 'Serine (Ser)',
  T: 'Threonine (Thr)', V: 'Valine (Val)', W: 'Tryptophan (Trp)', Y: 'Tyrosine (Tyr)'
};

const PROPERTY_COLORS = {
  hydrophobic: 0xf59e0b, // Amber
  polar: 0x06b6d4,       // Cyan
  basic: 0x3b82f6,       // Blue
  acidic: 0xef4444,      // Crimson
  cysteine: 0xeab308,    // Yellow
  glycine: 0x10b981      // Emerald
};

const CPK_COLORS = {
  C: 0x90a4ae,
  N: 0x3b82f6,
  O: 0xef4444,
  S: 0xfacc15,
  H: 0xf8fafc,
  DEFAULT: 0xa855f7
};

function getResidueProperty(aa1) {
  if (['A', 'V', 'I', 'L', 'M', 'F', 'W', 'P'].includes(aa1)) return 'hydrophobic';
  if (['S', 'T', 'Y', 'N', 'Q'].includes(aa1)) return 'polar';
  if (['K', 'R', 'H'].includes(aa1)) return 'basic';
  if (['D', 'E'].includes(aa1)) return 'acidic';
  if (aa1 === 'C') return 'cysteine';
  return 'glycine';
}

function getPlddtColor(plddt) {
  if (plddt === null || plddt === undefined) return 0x10b981; // Experimental default emerald
  if (plddt > 90) return 0x0053d6; // Very high confidence (Deep blue)
  if (plddt > 70) return 0x65cbf3; // Confident (Sky blue)
  if (plddt > 50) return 0xffdb13; // Low (Yellow)
  return 0xff7d45;                 // Very low (Orange/Red)
}

function getPlddtCategory(plddt) {
  if (plddt === null || plddt === undefined) return 'Experimental Coordinates (100% Confirmed)';
  if (plddt > 90) return 'Very High Confidence (pLDDT > 90)';
  if (plddt > 70) return 'Confident (70 < pLDDT ≤ 90)';
  if (plddt > 50) return 'Low Confidence (50 < pLDDT ≤ 70)';
  return 'Very Low Confidence (pLDDT ≤ 50)';
}

// Module State
class VenomLabManager {
  constructor() {
    this.registry = [];
    this.currentEntry = null;
    this.currentPdbData = null;
    this.repMode = 'cartoon';     // 'cartoon' | 'sticks' | 'surface'
    this.colorMode = 'property';  // 'property' | 'chain' | 'confidence'
    this.selectedResidue = null;
    this.hoveredResidue = null;
    this.isSpinning = false;
    this.showingIllustrative = false;

    // Three.js primitives
    this.canvas = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.molGroup = new THREE.Group();
    this.highlightGroup = new THREE.Group();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Interaction vars
    this.isDragging = false;
    this.isPanning = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.targetRotation = { x: 0, y: 0 };
    this.cameraDistance = 35;
    this.minDistance = 8;
    this.maxDistance = 120;
    this.cameraTarget = new THREE.Vector3(0, 0, 0);

    // Reduced motion preference
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  async init() {
    this.canvas = document.getElementById('venomlab-canvas');
    if (!this.canvas) return;

    this.initThree();
    this.bindControls();
    await this.loadRegistry();
    this.renderLoop();
  }

  initThree() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const width = rect.width || 800;
    const height = Math.max(480, Math.min(640, window.innerHeight * 0.65));

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true // Required for high-res export
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, this.cameraDistance);

    // Illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    const dirLight1 = new THREE.DirectionalLight(0xfff5e6, 1.4);
    dirLight1.position.set(20, 30, 25);
    const dirLight2 = new THREE.DirectionalLight(0xd9ebff, 0.9);
    dirLight2.position.set(-20, -20, -20);
    const backLight = new THREE.PointLight(0xffffff, 0.5);
    backLight.position.set(0, 0, -30);

    this.scene.add(ambientLight);
    this.scene.add(dirLight1);
    this.scene.add(dirLight2);
    this.scene.add(backLight);

    this.scene.add(this.molGroup);
    this.scene.add(this.highlightGroup);

    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    if (!this.renderer || !this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const width = rect.width;
    const height = Math.max(480, Math.min(640, window.innerHeight * 0.65));
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  bindControls() {
    const canvas = this.canvas;

    // Mouse / Touch Interaction
    canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.isPanning = e.button === 2 || e.shiftKey;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.isPanning = false;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (this.isDragging) {
        const deltaX = e.clientX - this.previousMousePosition.x;
        const deltaY = e.clientY - this.previousMousePosition.y;

        if (this.isPanning) {
          const panSpeed = this.cameraDistance * 0.0015;
          this.cameraTarget.x -= deltaX * panSpeed;
          this.cameraTarget.y += deltaY * panSpeed;
        } else {
          this.molGroup.rotation.y += deltaX * 0.008;
          this.molGroup.rotation.x += deltaY * 0.008;
        }
        this.previousMousePosition = { x: e.clientX, y: e.clientY };
      } else {
        this.checkRaycastHover();
      }
    });

    canvas.addEventListener('click', () => {
      this.checkRaycastClick();
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY * 0.04;
      this.cameraDistance = Math.max(this.minDistance, Math.min(this.maxDistance, this.cameraDistance + zoomFactor));
      this.updateCameraPosition();
    }, { passive: false });

    // Touch support
    let touchStartDist = 0;
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    });

    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isDragging) {
        const deltaX = e.touches[0].clientX - this.previousMousePosition.x;
        const deltaY = e.touches[0].clientY - this.previousMousePosition.y;
        this.molGroup.rotation.y += deltaX * 0.01;
        this.molGroup.rotation.x += deltaY * 0.01;
        this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const diff = (touchStartDist - dist) * 0.05;
        this.cameraDistance = Math.max(this.minDistance, Math.min(this.maxDistance, this.cameraDistance + diff));
        touchStartDist = dist;
        this.updateCameraPosition();
      }
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
      this.isDragging = false;
    });

    // Keyboard support for accessibility
    canvas.setAttribute('tabindex', '0');
    canvas.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { this.molGroup.rotation.y -= 0.1; e.preventDefault(); }
      else if (e.key === 'ArrowRight') { this.molGroup.rotation.y += 0.1; e.preventDefault(); }
      else if (e.key === 'ArrowUp') { this.molGroup.rotation.x -= 0.1; e.preventDefault(); }
      else if (e.key === 'ArrowDown') { this.molGroup.rotation.x += 0.1; e.preventDefault(); }
      else if (e.key === '+' || e.key === '=') { this.cameraDistance = Math.max(this.minDistance, this.cameraDistance - 2); this.updateCameraPosition(); e.preventDefault(); }
      else if (e.key === '-' || e.key === '_') { this.cameraDistance = Math.min(this.maxDistance, this.cameraDistance + 2); this.updateCameraPosition(); e.preventDefault(); }
      else if (e.key === 'r' || e.key === 'R' || e.key === 'Escape') { this.resetCamera(); e.preventDefault(); }
    });

    // UI Buttons
    document.getElementById('vl-rotate-left')?.addEventListener('click', () => { this.molGroup.rotation.y -= 0.3; });
    document.getElementById('vl-rotate-right')?.addEventListener('click', () => { this.molGroup.rotation.y += 0.3; });
    document.getElementById('vl-zoom-in')?.addEventListener('click', () => {
      this.cameraDistance = Math.max(this.minDistance, this.cameraDistance - 4);
      this.updateCameraPosition();
    });
    document.getElementById('vl-zoom-out')?.addEventListener('click', () => {
      this.cameraDistance = Math.min(this.maxDistance, this.cameraDistance + 4);
      this.updateCameraPosition();
    });
    document.getElementById('vl-reset-view')?.addEventListener('click', () => this.resetCamera());
    
    const spinBtn = document.getElementById('vl-spin-toggle');
    spinBtn?.addEventListener('click', () => {
      this.isSpinning = !this.isSpinning;
      spinBtn.setAttribute('aria-pressed', String(this.isSpinning));
      spinBtn.classList.toggle('active', this.isSpinning);
      spinBtn.innerHTML = this.isSpinning ? '<span>⏸</span> إيقاف الدوران' : '<span>⏵</span> دوران تلقائي';
    });

    // Representation Switcher
    ['cartoon', 'sticks', 'surface'].forEach(rep => {
      const btn = document.getElementById(`vl-rep-${rep}`);
      btn?.addEventListener('click', () => {
        this.repMode = rep;
        document.querySelectorAll('.vl-rep-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.buildRepresentation();
      });
    });

    // Color Mode Switcher
    ['property', 'chain', 'confidence'].forEach(cm => {
      const btn = document.getElementById(`vl-color-${cm}`);
      btn?.addEventListener('click', () => {
        this.colorMode = cm;
        document.querySelectorAll('.vl-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.buildRepresentation();
      });
    });

    // Export Image Button
    document.getElementById('vl-export-image')?.addEventListener('click', () => this.exportImage());

    // Peptide Dropdown Selector
    const select = document.getElementById('venomlab-peptide-select');
    select?.addEventListener('change', (e) => {
      this.showingIllustrative = false;
      this.selectPeptide(e.target.value);
    });

    // Illustrative Model View Button (for Class C)
    document.getElementById('vl-load-illustrative-btn')?.addEventListener('click', () => {
      this.showingIllustrative = true;
      this.loadStructureForEntry(this.currentEntry);
    });

    // Expose global helper for inter-module navigation
    window.openInVenomLab = (peptideId) => {
      const sec = document.getElementById('venomlab');
      if (sec) sec.scrollIntoView({ behavior: 'smooth' });
      const sel = document.getElementById('venomlab-peptide-select');
      if (sel) {
        sel.value = peptideId;
        this.showingIllustrative = false;
        this.selectPeptide(peptideId);
      }
    };
  }

  updateCameraPosition() {
    this.camera.position.set(this.cameraTarget.x, this.cameraTarget.y, this.cameraDistance);
    this.camera.lookAt(this.cameraTarget);
  }

  resetCamera() {
    this.molGroup.rotation.set(0, 0, 0);
    this.cameraTarget.set(0, 0, 0);
    if (this.currentPdbData) {
      this.cameraDistance = Math.max(14, this.currentPdbData.maxDim * 2.2);
    } else {
      this.cameraDistance = 35;
    }
    this.updateCameraPosition();
  }

  async loadRegistry() {
    try {
      const resp = await fetch('data/structure_registry.json');
      const data = await resp.json();
      this.registry = data.registry || [];
      this.populateSelect();
      if (this.registry.length > 0) {
        // Default to IsCT1 (Class A Experimental) or Stigmurin
        const defaultEntry = this.registry.find(e => e.candidate_id === 'SCA-PEP-012') || this.registry[0];
        const sel = document.getElementById('venomlab-peptide-select');
        if (sel) sel.value = defaultEntry.candidate_id;
        this.selectPeptide(defaultEntry.candidate_id);
      }
    } catch (e) {
      console.error('Failed to load structure registry:', e);
      this.showStatusError('تعذّر تحميل سجل البنى ثلاثية الأبعاد.');
    }
  }

  populateSelect() {
    const sel = document.getElementById('venomlab-peptide-select');
    if (!sel) return;
    sel.innerHTML = '';

    const groups = {
      'Class A: Experimentally Determined': document.createElement('optgroup'),
      'Class B: Computationally Predicted': document.createElement('optgroup'),
      'Class C: Illustrative Representation': document.createElement('optgroup')
    };

    groups['Class A: Experimentally Determined'].label = '🔬 فئة A: بنى معملية تجريبية مؤكدة (PDB Experimental)';
    groups['Class B: Computationally Predicted'].label = '🤖 فئة B: نماذج حسابية متنبأ بها (AlphaFold DB)';
    groups['Class C: Illustrative Representation'].label = '📐 فئة C: مشتقات غير محلولة / تمثيل توضيحي (Illustrative)';

    this.registry.forEach(entry => {
      const opt = document.createElement('option');
      opt.value = entry.candidate_id;
      const statusIcon = entry.structure_available ? (entry.provenance_class.includes('Class A') ? '🔬' : '🤖') : '📐';
      opt.textContent = `${statusIcon} ${entry.candidate_id} | ${entry.peptide_name} (${entry.sequence_length} aa)`;
      
      const pClass = entry.provenance_class;
      if (groups[pClass]) {
        groups[pClass].appendChild(opt);
      } else {
        groups['Class A: Experimentally Determined'].appendChild(opt);
      }
    });

    Object.values(groups).forEach(g => {
      if (g.children.length > 0) sel.appendChild(g);
    });
  }

  selectPeptide(candidateId) {
    const entry = this.registry.find(e => e.candidate_id === candidateId);
    if (!entry) return;
    this.currentEntry = entry;
    this.selectedResidue = null;
    this.hoveredResidue = null;

    this.updateProvenanceCard(entry);
    this.renderSequenceBar(entry);
    this.loadStructureForEntry(entry);
  }

  updateProvenanceCard(entry) {
    const card = document.getElementById('vl-provenance-card');
    if (!card) return;

    // Badges
    const badgeEl = document.getElementById('vl-provenance-tier-badge');
    let tierClass = 'tier-c';
    let tierText = '📐 فئة C: تمثيل توضيحي هندسي';
    let dotColor = '#f59e0b';

    if (entry.provenance_class.includes('Class A')) {
      tierClass = 'tier-a';
      tierText = '🔬 فئة A: بنية تجريبية محددة معملياً (PDB Verified)';
      dotColor = '#10b981';
    } else if (entry.provenance_class.includes('Class B')) {
      tierClass = 'tier-b';
      tierText = '🤖 فئة B: بنية متنبأ بها حسابياً (AlphaFold DB)';
      dotColor = '#3b82f6';
    }

    if (badgeEl) {
      badgeEl.className = `vl-tier-badge ${tierClass}`;
      badgeEl.innerHTML = `<span class="vl-tier-dot" style="background:${dotColor}"></span> ${tierText}`;
    }

    // Epistemic Watermark & Overlay
    const overlayBadge = document.getElementById('vl-canvas-overlay-badge');
    if (overlayBadge) {
      overlayBadge.className = `vl-canvas-overlay ${tierClass}`;
      overlayBadge.textContent = entry.provenance_class;
    }

    // Fill metadata fields
    const setText = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt || '—';
    };

    setText('vl-meta-name', `${entry.peptide_name} (${entry.candidate_id})`);
    setText('vl-meta-master', entry.master_atlas_id);
    setText('vl-meta-source', entry.structure_source || 'غير متاح في قواعد البيانات');
    setText('vl-meta-method', entry.experimental_method);
    setText('vl-meta-res', entry.resolution_angstrom ? `${entry.resolution_angstrom} Å` : 'غير منطبق (NMR / نموذج حسابي)');
    setText('vl-meta-chain', `Chain ${entry.chain_id || 'A'} (${entry.structure_residue_range || '1..' + entry.sequence_length})`);
    setText('vl-meta-coverage', `${entry.sequence_coverage_pct}% ${entry.sequence_coverage_pct === 100.0 ? '(تغطية كاملة 100%)' : '(تغطية جزئية)'}`);
    setText('vl-meta-construction', entry.model_construction_type || '—');
    setText('vl-meta-amidation', entry.is_c_terminally_amidated ? 'مأمّد كيميائياً (-CONH₂)' : 'كربوكسيل حر (-COOH)');
    
    // Mass fields with distinguished definitions
    setText('vl-meta-avg-mw', `${entry.average_molecular_weight_da?.toFixed(2)} Da (الكتلة الذرية المتوسطة IUPAC)`);
    setText('vl-meta-mono-mw', `${entry.monoisotopic_molecular_weight_da?.toFixed(2)} Da (كتلة النظائر الأكثر وفرة ¹²C, ¹H, ¹⁴N, ¹⁶O)`);
    setText('vl-meta-formula', entry.chemical_formula || '—');

    // Disulfide bonds
    const ssEl = document.getElementById('vl-meta-disulfides');
    if (ssEl) {
      if (entry.disulfide_bonds && entry.disulfide_bonds.length > 0) {
        const isExp = entry.provenance_class.includes('Class A') || entry.disulfide_bonds.some(b => b.experimental_source);
        const tagText = isExp ? '[مثبت تجريبياً بـ NMR]' : '[تقارب هندسي بـ AlphaFold]';
        ssEl.innerHTML = entry.disulfide_bonds.map(b => `<span class="vl-ss-tag"> جسر ${b.bond || 'Cys-Cys'}: Cys${b.res1}–Cys${b.res2} ${tagText}</span>`).join(' ') +
          `<div class="vl-ss-note" style="margin-top:6px;font-size:0.75rem;color:var(--text-muted);">${entry.disulfide_provenance || ''}</div>`;
      } else {
        ssEl.textContent = entry.disulfide_provenance || 'لا توجد (ببتيد خطي)';
      }
    }

    // Confidence / pLDDT
    const confEl = document.getElementById('vl-meta-confidence');
    if (confEl) {
      if (entry.global_confidence_score !== null && entry.global_confidence_score !== undefined) {
        const cat = getPlddtCategory(entry.global_confidence_score);
        confEl.innerHTML = `<b>${entry.global_confidence_score}</b> / 100 <span class="vl-conf-pill">${cat}</span>`;
      } else if (entry.provenance_class.includes('Class A')) {
        confEl.innerHTML = `<span class="vl-conf-pill exp">إحداثيات ذرية معملية حقيقية (100% Experimental)</span>`;
      } else {
        confEl.textContent = 'غير منطبق (تمثيل توضيحي هندسي)';
      }
    }

    // Epistemic warning
    setText('vl-epistemic-text', entry.epistemic_warning);

    // External Link
    const linkEl = document.getElementById('vl-meta-link');
    if (linkEl) {
      if (entry.source_url) {
        linkEl.href = entry.source_url;
        linkEl.hidden = false;
        linkEl.textContent = entry.structure_source?.includes('PDB') ? 'افتح سجل PDB الرسمي ↗' : 'افتح سجل AlphaFold DB الرسمي ↗';
      } else {
        linkEl.hidden = true;
      }
    }
  }

  renderSequenceBar(entry) {
    const track = document.getElementById('vl-sequence-track');
    if (!track) return;
    track.innerHTML = '';

    const seq = entry.canonical_mature_sequence || '';
    for (let i = 0; i < seq.length; i++) {
      const aa = seq[i];
      const resNum = i + 1;
      const pill = document.createElement('button');
      pill.className = 'vl-seq-res-btn';
      pill.dataset.resNum = String(resNum);
      pill.dataset.aa = aa;
      
      const prop = getResidueProperty(aa);
      pill.classList.add(`prop-${prop}`);

      // Check pLDDT if available
      if (entry.per_residue_confidence && entry.per_residue_confidence[i] !== undefined) {
        const plddt = entry.per_residue_confidence[i];
        pill.title = `${resNum}: ${aa} (${AA1_NAMES[aa] || aa}) | pLDDT: ${plddt.toFixed(1)}`;
      } else {
        pill.title = `${resNum}: ${aa} (${AA1_NAMES[aa] || aa})`;
      }

      pill.innerHTML = `<span class="vl-res-num">${resNum}</span><span class="vl-res-aa">${aa}</span>`;
      pill.addEventListener('click', () => {
        this.selectResidue(resNum, aa);
      });

      track.appendChild(pill);
    }
  }

  async loadStructureForEntry(entry) {
    this.showSpinner(true);
    const unavailableBox = document.getElementById('vl-unavailable-state');

    // Check if atomic structure is available or if user requested illustrative
    let fileToLoad = entry.structure_file;
    if (!entry.structure_available) {
      if (this.showingIllustrative && entry.illustrative_file) {
        fileToLoad = entry.illustrative_file;
        if (unavailableBox) unavailableBox.hidden = true;
      } else {
        this.showSpinner(false);
        this.clearStructure();
        if (unavailableBox) unavailableBox.hidden = false;
        return;
      }
    } else {
      if (unavailableBox) unavailableBox.hidden = true;
    }

    try {
      const resp = await fetch(fileToLoad);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const pdbText = await resp.text();
      this.currentPdbData = this.parsePDB(pdbText);
      this.buildRepresentation();
      this.resetCamera();
      this.showSpinner(false);
    } catch (e) {
      console.error('Error loading PDB file:', e);
      this.showSpinner(false);
      this.showStatusError(`تعذّر تحميل ملف البنية (${fileToLoad}).`);
    }
  }

  parsePDB(pdbText) {
    const lines = pdbText.split('\n');
    const atoms = [];
    const residues = {};
    const chains = {};
    let modelDone = false;

    for (const line of lines) {
      if (line.startsWith('ENDMDL')) {
        modelDone = true; // Use first model for NMR
        break;
      }
      if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
        const altLoc = line.length > 16 ? line[16] : ' ';
        if (altLoc !== ' ' && altLoc !== 'A') continue;
        const atomName = line.substring(12, 16).trim();
        const resName = line.substring(17, 20).trim();
        const chainID = line[21].trim() || 'A';
        const resSeq = parseInt(line.substring(22, 26).trim(), 10);
        const x = parseFloat(line.substring(30, 38).trim());
        const y = parseFloat(line.substring(38, 46).trim());
        const z = parseFloat(line.substring(46, 54).trim());
        const bFactor = line.length >= 66 ? parseFloat(line.substring(60, 66).trim()) : null;
        const element = (line.length >= 78 ? line.substring(76, 78).trim() : atomName[0]).toUpperCase();

        const atom = {
          atomName, resName, chainID, resSeq,
          pos: new THREE.Vector3(x, y, z),
          bFactor, element,
          aa1: AA3_TO_1[resName] || 'X'
        };
        atoms.push(atom);

        const resKey = `${chainID}_${resSeq}`;
        if (!residues[resKey]) {
          residues[resKey] = {
            chainID, resSeq, resName,
            aa1: AA3_TO_1[resName] || 'X',
            ca: null,
            atoms: [],
            bFactor: bFactor
          };
        }
        residues[resKey].atoms.push(atom);
        if (atomName === 'CA') {
          residues[resKey].ca = atom;
        }

        if (!chains[chainID]) chains[chainID] = [];
        chains[chainID].push(atom);
      }
    }

    // Calculate center of mass and bounding dimensions
    const center = new THREE.Vector3();
    let minCoord = new THREE.Vector3(Infinity, Infinity, Infinity);
    let maxCoord = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

    atoms.forEach(a => {
      center.add(a.pos);
      minCoord.min(a.pos);
      maxCoord.max(a.pos);
    });
    if (atoms.length > 0) center.divideScalar(atoms.length);

    // Center coordinates
    atoms.forEach(a => a.pos.sub(center));

    const size = new THREE.Vector3().subVectors(maxCoord, minCoord);
    const maxDim = Math.max(size.x, size.y, size.z);

    return { atoms, residues, chains, maxDim, center };
  }

  clearStructure() {
    // Clean memory and geometries
    while (this.molGroup.children.length > 0) {
      const obj = this.molGroup.children[0];
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
      this.molGroup.remove(obj);
    }
    this.clearHighlight();
  }

  clearHighlight() {
    while (this.highlightGroup.children.length > 0) {
      const obj = this.highlightGroup.children[0];
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
      this.highlightGroup.remove(obj);
    }
  }

  buildRepresentation() {
    if (!this.currentPdbData) return;
    this.clearStructure();

    const data = this.currentPdbData;

    if (this.repMode === 'cartoon') {
      this.buildCartoon(data);
    } else if (this.repMode === 'sticks') {
      this.buildSticks(data);
    } else if (this.repMode === 'surface') {
      this.buildSurface(data);
    }

    // Always render disulfide bonds if present
    this.buildDisulfideBonds(data);

    // Reapply residue selection if any
    if (this.selectedResidue) {
      this.highlightResidueIn3D(this.selectedResidue);
    }
  }

  getAtomColor(atom) {
    if (this.colorMode === 'property') {
      const prop = getResidueProperty(atom.aa1);
      return PROPERTY_COLORS[prop] || 0x90a4ae;
    } else if (this.colorMode === 'chain') {
      if (atom.chainID === 'A') return 0x10b981;
      if (atom.chainID === 'B') return 0x38bdf8;
      if (atom.chainID === 'I') return 0xa855f7;
      return 0xeab308;
    } else if (this.colorMode === 'confidence') {
      return getPlddtColor(atom.bFactor);
    }
    return 0x90a4ae;
  }

  buildCartoon(data) {
    // For each chain, build a CatmullRom spline through CA atoms
    Object.keys(data.chains).forEach(chainID => {
      const chainRes = Object.values(data.residues)
        .filter(r => r.chainID === chainID && r.ca)
        .sort((a, b) => a.resSeq - b.resSeq);

      if (chainRes.length < 2) return;

      const points = chainRes.map(r => r.ca.pos);
      const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
      const tubularSegments = points.length * 6;
      const radius = 0.36;
      const radialSegments = 10;

      const geom = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
      
      // Vertex colors according to color mode
      const posCount = geom.attributes.position.count;
      const colors = new Float32Array(posCount * 3);

      for (let i = 0; i < posCount; i++) {
        const u = i / (tubularSegments * (radialSegments + 1));
        const resIdx = Math.min(chainRes.length - 1, Math.floor(u * chainRes.length));
        const res = chainRes[resIdx];
        const hex = this.getAtomColor(res.ca);
        const col = new THREE.Color(hex);
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
      }
      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.32,
        metalness: 0.15
      });

      const tubeMesh = new THREE.Mesh(geom, mat);
      tubeMesh.userData = { isBackbone: true, chainID };
      this.molGroup.add(tubeMesh);

      // Add clickable sphere nodes for CA atoms for raycasting
      chainRes.forEach(r => {
        const sphereGeom = new THREE.SphereGeometry(0.55, 8, 8);
        const sphereMat = new THREE.MeshBasicMaterial({
          color: this.getAtomColor(r.ca),
          transparent: true,
          opacity: 0.0 // invisible hit target
        });
        const hitMesh = new THREE.Mesh(sphereGeom, sphereMat);
        hitMesh.position.copy(r.ca.pos);
        hitMesh.userData = { residue: r };
        this.molGroup.add(hitMesh);
      });
    });
  }

  buildSticks(data) {
    const atoms = data.atoms;
    const bondDistSqMin = 1.1 * 1.1;
    const bondDistSqMax = 1.95 * 1.95;

    // Build bonds
    for (let i = 0; i < atoms.length; i++) {
      const a1 = atoms[i];
      for (let j = i + 1; j < atoms.length; j++) {
        const a2 = atoms[j];
        if (a1.chainID !== a2.chainID) continue;
        if (Math.abs(a1.resSeq - a2.resSeq) > 1) continue;

        const dSq = a1.pos.distanceToSquared(a2.pos);
        if (dSq >= bondDistSqMin && dSq <= bondDistSqMax) {
          this.createBondCylinder(a1.pos, a2.pos, this.getAtomColor(a1), this.getAtomColor(a2));
        }
      }

      // Atom sphere
      const sphereGeom = new THREE.SphereGeometry(0.32, 10, 10);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: this.getAtomColor(a1),
        roughness: 0.35,
        metalness: 0.2
      });
      const atomMesh = new THREE.Mesh(sphereGeom, sphereMat);
      atomMesh.position.copy(a1.pos);
      atomMesh.userData = { residue: data.residues[`${a1.chainID}_${a1.resSeq}`], atom: a1 };
      this.molGroup.add(atomMesh);
    }
  }

  createBondCylinder(p1, p2, col1, col2) {
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    const halfLen = len * 0.5;
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

    const geom = new THREE.CylinderGeometry(0.12, 0.12, len, 8);
    const mat = new THREE.MeshStandardMaterial({
      color: col1,
      roughness: 0.35
    });

    const cyl = new THREE.Mesh(geom, mat);
    cyl.position.copy(mid);
    cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    this.molGroup.add(cyl);
  }

  buildSurface(data) {
    // Approximate van der Waals sphere representation
    const radiusMap = { C: 1.25, N: 1.15, O: 1.10, S: 1.40, H: 0.9 };

    data.atoms.forEach(a => {
      const r = radiusMap[a.element] || 1.2;
      const sphereGeom = new THREE.SphereGeometry(r, 12, 12);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: this.getAtomColor(a),
        roughness: 0.45,
        metalness: 0.1
      });
      const mesh = new THREE.Mesh(sphereGeom, sphereMat);
      mesh.position.copy(a.pos);
      mesh.userData = { residue: data.residues[`${a.chainID}_${a.resSeq}`], atom: a };
      this.molGroup.add(mesh);
    });
  }

  buildDisulfideBonds(data) {
    // Find all Cysteine SG atoms
    const sgAtoms = data.atoms.filter(a => a.resName === 'CYS' && a.atomName === 'SG');
    for (let i = 0; i < sgAtoms.length; i++) {
      for (let j = i + 1; j < sgAtoms.length; j++) {
        const d = sgAtoms[i].pos.distanceTo(sgAtoms[j].pos);
        if (d >= 1.8 && d <= 2.6) {
          // Genuine disulfide covalent link
          const dir = new THREE.Vector3().subVectors(sgAtoms[j].pos, sgAtoms[i].pos);
          const len = dir.length();
          const mid = new THREE.Vector3().addVectors(sgAtoms[i].pos, sgAtoms[j].pos).multiplyScalar(0.5);

          const geom = new THREE.CylinderGeometry(0.22, 0.22, len, 8);
          const mat = new THREE.MeshStandardMaterial({
            color: 0xfacc15, // Golden yellow
            emissive: 0x854d0e,
            roughness: 0.2
          });
          const cyl = new THREE.Mesh(geom, mat);
          cyl.position.copy(mid);
          cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
          this.molGroup.add(cyl);
        }
      }
    }
  }

  checkRaycastHover() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.molGroup.children);
    const tooltip = document.getElementById('vl-hover-tooltip');

    if (intersects.length > 0) {
      const obj = intersects[0].object;
      const res = obj.userData?.residue;
      if (res) {
        this.hoveredResidue = res;
        if (tooltip) {
          const rect = this.canvas.getBoundingClientRect();
          const screenX = ((this.mouse.x + 1) * 0.5) * rect.width;
          const screenY = ((-this.mouse.y + 1) * 0.5) * rect.height;

          const plddtInfo = res.bFactor !== null ? ` | pLDDT: ${res.bFactor.toFixed(1)}` : '';
          tooltip.style.left = `${screenX + 15}px`;
          tooltip.style.top = `${screenY - 25}px`;
          tooltip.innerHTML = `<b>${res.resSeq}: ${res.aa1} (${res.resName})</b> · Chain ${res.chainID}${plddtInfo}`;
          tooltip.hidden = false;
        }
        return;
      }
    }

    this.hoveredResidue = null;
    if (tooltip) tooltip.hidden = true;
  }

  checkRaycastClick() {
    if (this.hoveredResidue) {
      const offset = this.currentEntry?.mature_cleavage_offset || 0;
      const matureResSeq = this.hoveredResidue.resSeq - offset;
      if (this.currentEntry && matureResSeq >= 1 && matureResSeq <= this.currentEntry.sequence_length) {
        this.selectResidue(matureResSeq, this.hoveredResidue.aa1);
      } else {
        this.selectResidue(this.hoveredResidue.resSeq, this.hoveredResidue.aa1);
      }
    }
  }

  selectResidue(resNum, aa) {
    this.selectedResidue = resNum;

    // Update sequence bar active styles
    document.querySelectorAll('.vl-seq-res-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.resNum, 10) === resNum);
    });

    // Update details card
    const card = document.getElementById('vl-residue-detail-card');
    if (card && this.currentEntry) {
      const plddt = this.currentEntry.per_residue_confidence?.[resNum - 1];
      const plddtText = plddt !== undefined ? `${plddt.toFixed(1)} / 100 (${getPlddtCategory(plddt)})` : (this.currentEntry.provenance_class.includes('Class A') ? 'إحداثيات ذرية مؤكدة معملياً' : 'غير منطبق');

      document.getElementById('vl-res-title').textContent = `الثمالة ${resNum}: ${aa} — ${AA1_NAMES[aa] || aa}`;
      document.getElementById('vl-res-prop').textContent = `الخاصية: ${getResidueProperty(aa)} · الشحنة: ${['K', 'R'].includes(aa) ? '+1' : (['D', 'E'].includes(aa) ? '-1' : '0')}`;
      document.getElementById('vl-res-plddt').textContent = plddtText;
      card.hidden = false;
    }

    // Highlight in 3D
    this.highlightResidueIn3D(resNum);
  }

  highlightResidueIn3D(resNum) {
    this.clearHighlight();
    if (!this.currentPdbData) return;

    // Translate mature residue number (1..N) to PDB residue sequence number via cleavage offset
    const offset = this.currentEntry?.mature_cleavage_offset || 0;
    const pdbResSeq = resNum + offset;

    // Find residue CA
    const res = Object.values(this.currentPdbData.residues).find(r => r.resSeq === pdbResSeq);
    if (res && res.ca) {
      const ringGeom = new THREE.RingGeometry(0.8, 1.05, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.copy(res.ca.pos);
      this.highlightGroup.add(ring);

      const sphereGeom = new THREE.SphereGeometry(0.65, 16, 16);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        roughness: 0.2
      });
      const sphere = new THREE.Mesh(sphereGeom, sphereMat);
      sphere.position.copy(res.ca.pos);
      this.highlightGroup.add(sphere);
    }
  }

  exportImage() {
    if (!this.renderer || !this.currentEntry) return;

    // Render current frame
    this.renderer.render(this.scene, this.camera);
    const srcData = this.canvas.toDataURL('image/png');

    // Draw watermark provenance banner onto temporary canvas
    const img = new Image();
    img.onload = () => {
      const outCanvas = document.createElement('canvas');
      outCanvas.width = img.width;
      outCanvas.height = img.height + 80;
      const ctx = outCanvas.getContext('2d');

      // Draw background
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);

      // Draw 3D scene
      ctx.drawImage(img, 0, 80);

      // Draw Header Watermark Banner
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, outCanvas.width, 80);

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('SCORPIONAI ATLAS — VENOM-LAB 3D', 24, 34);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const provText = `Peptide: ${this.currentEntry.peptide_name} (${this.currentEntry.candidate_id}) | Provenance: ${this.currentEntry.provenance_class}`;
      ctx.fillText(provText, 24, 60);

      // Watermark Stamp at Bottom Right
      ctx.fillStyle = '#475569';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('Evidence-Grounded Molecular Provenance · SCORPION X v1.5', outCanvas.width - 24, outCanvas.height - 18);

      // Download
      const link = document.createElement('a');
      link.download = `venomlab_${this.currentEntry.candidate_id}_${this.currentEntry.peptide_name}.png`;
      link.href = outCanvas.toDataURL('image/png');
      link.click();
    };
    img.src = srcData;
  }

  showSpinner(show) {
    const sp = document.getElementById('vl-loading-spinner');
    if (sp) sp.hidden = !show;
  }

  showStatusError(msg) {
    const errEl = document.getElementById('vl-status-error');
    if (errEl) {
      errEl.textContent = msg;
      errEl.hidden = false;
      setTimeout(() => { errEl.hidden = true; }, 6000);
    }
  }

  renderLoop() {
    requestAnimationFrame(() => this.renderLoop());

    if (this.isSpinning && !this.reducedMotion && !this.isDragging) {
      this.molGroup.rotation.y += 0.006;
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

// Instantiate on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  const manager = new VenomLabManager();
  manager.init();
});
