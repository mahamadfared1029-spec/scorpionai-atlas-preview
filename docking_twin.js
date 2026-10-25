/**
 * SCORPION X — MOD-11: Docking Case Study & Educational Digital Twin
 * Interactive Bilingual 3D Structural Explorer & Epistemic Evaluation Engine
 * Powered by Three.js (WebGL)
 */

import * as THREE from './assets/vendor/three.module.js';

// Standard 3-letter to 1-letter amino acid dictionary
const AA3_TO_1 = {
  ALA: 'A', CYS: 'C', ASP: 'D', GLU: 'E', PHE: 'F',
  GLY: 'G', HIS: 'H', ILE: 'I', LYS: 'K', LEU: 'L',
  MET: 'M', ASN: 'N', PRO: 'P', GLN: 'Q', ARG: 'R',
  SER: 'S', THR: 'T', VAL: 'V', TRP: 'W', TYR: 'Y'
};

// Color palettes for multi-chain digital twin
const PALETTE = {
  targetChannel: 0x38bdf8,   // Cyan/Sky blue for receptor channel
  targetBackbone: 0x475569,  // Muted slate for non-active target regions
  peptideToxin: 0xf59e0b,    // Amber/Gold for scorpion peptide toxin
  saltBridge: 0xef4444,      // Crimson for ionic salt-bridge interactions
  aromaticPore: 0x10b981,    // Emerald for hydrophobic/pore coordination
  contactDotted: 0xf43f5e,   // Rose red for interaction contact vectors
  decoyPose: 0xa855f7        // Purple for misdocked decoy pose
};

class DockingTwinManager {
  constructor() {
    this.caseStudies = [];
    this.workflowMetadata = null;
    this.activeCase = null;
    this.activePoseId = 'pose_empirical';
    this.activeStep = 1;
    this.currentPdbData = null;

    // Three.js primitives
    this.canvas = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.molGroup = new THREE.Group();
    this.contactsGroup = new THREE.Group();

    // Interaction vars
    this.isDragging = false;
    this.isPanning = false;
    this.isSpinning = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.cameraDistance = 45;
    this.minDistance = 10;
    this.maxDistance = 160;
    this.cameraTarget = new THREE.Vector3(0, 0, 0);

    // Reduced motion preference
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.currentLang = (window.i18n ? window.i18n.getLanguage() : 'ar');
  }

  async init() {
    this.canvas = document.getElementById('docking-canvas');
    if (!this.canvas) return;

    this.initThree();
    this.bindControls();
    await this.loadData();
    this.renderLoop();
  }

  initThree() {
    const wrapper = document.getElementById('docking-canvas-wrapper');
    const width = wrapper ? wrapper.clientWidth || 700 : 700;
    const height = Math.max(440, Math.min(560, window.innerHeight * 0.55));

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, this.cameraDistance);

    // Illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    const dirLight1 = new THREE.DirectionalLight(0xfff5e6, 1.3);
    dirLight1.position.set(25, 35, 30);
    const dirLight2 = new THREE.DirectionalLight(0xd9ebff, 0.9);
    dirLight2.position.set(-25, -20, -25);
    const backLight = new THREE.PointLight(0xffffff, 0.6);
    backLight.position.set(0, 0, -40);

    this.scene.add(ambientLight);
    this.scene.add(dirLight1);
    this.scene.add(dirLight2);
    this.scene.add(backLight);

    this.scene.add(this.molGroup);
    this.scene.add(this.contactsGroup);

    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    if (!this.renderer || !this.canvas) return;
    const wrapper = document.getElementById('docking-canvas-wrapper');
    const width = wrapper ? wrapper.clientWidth : 700;
    const height = Math.max(440, Math.min(560, window.innerHeight * 0.55));
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  bindControls() {
    // Language change listener (MOD-13)
    window.addEventListener('scorpionai:languageChanged', (e) => {
      this.currentLang = e.detail.lang;
      this.populateCaseDropdown();
      if (this.activeCase) {
        this.renderCaseHeader();
        this.renderPoseSelector();
        this.renderContactsTable();
        this.renderWorkflowStepper();
      }
    });

    // Mouse rotate & pan
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.isDragging = true;
      if (e.button === 2) this.isPanning = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.isPanning = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging && !this.isPanning) return;
      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      if (this.isDragging) {
        this.molGroup.rotation.y += deltaX * 0.008;
        this.molGroup.rotation.x += deltaY * 0.008;
        this.contactsGroup.rotation.y += deltaX * 0.008;
        this.contactsGroup.rotation.x += deltaY * 0.008;
      } else if (this.isPanning) {
        const factor = this.cameraDistance * 0.001;
        this.cameraTarget.x -= deltaX * factor;
        this.cameraTarget.y += deltaY * factor;
        this.camera.position.x = this.cameraTarget.x;
        this.camera.position.y = this.cameraTarget.y;
      }
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    // Zoom via wheel
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
      this.cameraDistance = Math.max(this.minDistance, Math.min(this.maxDistance, this.cameraDistance * zoomFactor));
      this.camera.position.z = this.cameraDistance;
    }, { passive: false });

    // Touch controls for mobile responsiveness
    let touchStartDist = 0;
    this.canvas.addEventListener('touchstart', (e) => {
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
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isDragging) {
        const deltaX = e.touches[0].clientX - this.previousMousePosition.x;
        const deltaY = e.touches[0].clientY - this.previousMousePosition.y;
        this.molGroup.rotation.y += deltaX * 0.01;
        this.molGroup.rotation.x += deltaY * 0.01;
        this.contactsGroup.rotation.y += deltaX * 0.01;
        this.contactsGroup.rotation.x += deltaY * 0.01;
        this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2 && touchStartDist > 0) {
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = touchStartDist / currentDist;
        this.cameraDistance = Math.max(this.minDistance, Math.min(this.maxDistance, this.cameraDistance * factor));
        this.camera.position.z = this.cameraDistance;
        touchStartDist = currentDist;
      }
    }, { passive: true });

    this.canvas.addEventListener('touchend', () => {
      this.isDragging = false;
      touchStartDist = 0;
    });

    // Reset, Spin, Snapshot buttons
    document.getElementById('btn-docking-reset')?.addEventListener('click', () => {
      this.molGroup.rotation.set(0, 0, 0);
      this.contactsGroup.rotation.set(0, 0, 0);
      this.cameraTarget.set(0, 0, 0);
      this.camera.position.set(0, 0, this.cameraDistance);
    });

    document.getElementById('btn-docking-spin')?.addEventListener('click', () => {
      this.isSpinning = !this.isSpinning;
      const btn = document.getElementById('btn-docking-spin');
      if (btn) btn.classList.toggle('active', this.isSpinning);
    });

    document.getElementById('btn-docking-snapshot')?.addEventListener('click', () => {
      this.takeSnapshot();
    });

    // Case Study Dropdown
    const caseSelect = document.getElementById('docking-case-select');
    caseSelect?.addEventListener('change', (e) => {
      const selected = this.caseStudies.find(c => c.case_id === e.target.value);
      if (selected) {
        this.selectCase(selected);
      }
    });

    // Export Buttons
    document.getElementById('btn-export-docking-json')?.addEventListener('click', () => this.exportJson());
    document.getElementById('btn-export-docking-report')?.addEventListener('click', () => this.exportReport());
  }

  async loadData() {
    try {
      const [caseResp, wfResp] = await Promise.all([
        fetch('data/docking_case_studies.json'),
        fetch('data/docking_workflow_metadata.json')
      ]);
      this.caseStudies = await caseResp.json();
      this.workflowMetadata = await wfResp.json();

      this.populateCaseDropdown();
      if (this.caseStudies.length > 0) {
        // Select Flagship Case by default (DCS-001)
        const flagship = this.caseStudies.find(c => c.is_flagship) || this.caseStudies[0];
        this.selectCase(flagship);
      }
    } catch (e) {
      console.error('Failed to load docking data:', e);
    }
  }

  populateCaseDropdown() {
    const select = document.getElementById('docking-case-select');
    if (!select) return;
    select.innerHTML = '';
    this.caseStudies.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.case_id;
      const flagPrefix = c.is_flagship ? '⭐ ' : '';
      const cTitle = this.currentLang === "ckb" ? (c.title_ckb || c.title_en) : (this.currentLang === "en" ? c.title_en : c.title_ar);
      opt.textContent = `${flagPrefix}${c.case_id}: ${cTitle} (${c.peptide.peptide_name})`;
      select.appendChild(opt);
    });
  }

  selectCase(caseObj) {
    this.activeCase = caseObj;
    this.activePoseId = caseObj.docking_workflow.poses[0]?.pose_id || 'pose_empirical';
    this.renderCaseHeader();
    this.renderPoseSelector();
    this.renderContactsTable();
    this.renderWorkflowStepper();
    this.renderInterpretationPillars();
    this.renderMetricsComparison();
    this.renderCrossLinks();

    // Load active structure
    const initialPose = caseObj.docking_workflow.poses[0];
    const fileToLoad = initialPose?.file || caseObj.structural_evidence.complex_structure_file;
    this.loadPdbFile(fileToLoad, initialPose);
  }

  renderCaseHeader() {
    if (!this.activeCase) return;
    const pill = document.getElementById('docking-evidence-pill');
    if (pill) {
      const isClassA = this.activeCase.structural_evidence.evidence_class.startsWith('Class A');
      const badgeClass = isClassA ? 'badge measured' : 'badge warning';
      pill.innerHTML = `
        <span class="${badgeClass}">
          ${this.activeCase.structural_evidence.evidence_badge_ar}
        </span>
      `;
    }

    const legendTarget = document.getElementById('legend-target-label');
    const legendPeptide = document.getElementById('legend-peptide-label');
    const tName = this.currentLang === "ckb" ? (this.activeCase.target_name_ckb || this.activeCase.target.target_name_en) : (this.currentLang === "en" ? this.activeCase.target.target_name_en : this.activeCase.target.target_name_ar);
    if (legendTarget) legendTarget.textContent = tName;
    if (legendPeptide) legendPeptide.textContent = `${this.activeCase.peptide.peptide_name}`;
  }

  renderPoseSelector() {
    const group = document.getElementById('docking-pose-selector-group');
    if (!group || !this.activeCase) return;
    group.innerHTML = '<span class="text-xs text-muted" style="align-self:center; margin-left:4px;">الوضعية البنيوية:</span>';

    const poses = this.activeCase.docking_workflow.poses || [];
    poses.forEach(p => {
      const btn = document.createElement('button');
      btn.className = `docking-pose-pill ${p.pose_id === this.activePoseId ? 'active' : ''}`;
      const rmsdTxt = p.rmsd_angstrom !== null ? ` [RMSD ${p.rmsd_angstrom.toFixed(2)} Å]` : '';
      btn.textContent = `${p.label_ar}${rmsdTxt}`;
      btn.addEventListener('click', () => {
        this.activePoseId = p.pose_id;
        group.querySelectorAll('.docking-pose-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.loadPdbFile(p.file, p);
      });
      group.appendChild(btn);
    });
  }

  async loadPdbFile(filePath, poseObj) {
    try {
      const resp = await fetch(filePath);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const pdbText = await resp.text();
      this.currentPdbData = this.parsePDB(pdbText);
      this.buildComplexRepresentation(this.currentPdbData, poseObj);

      // Update floating overlay badge
      const badge = document.getElementById('docking-pose-badge');
      if (badge && poseObj) {
        const rmsdStr = poseObj.rmsd_angstrom !== null ? ` | RMSD: ${poseObj.rmsd_angstrom.toFixed(2)} Å` : '';
        const scoreStr = poseObj.vina_score_kcal_mol !== null ? ` | طاقة استعراضية: ${poseObj.vina_score_kcal_mol} kcal/mol (تعليمية)` : '';
        badge.textContent = `${poseObj.label_ar}${rmsdStr}${scoreStr}`;
      }
    } catch (e) {
      console.error('Failed to load PDB:', filePath, e);
    }
  }

  parsePDB(pdbText) {
    const atoms = [];
    const residues = {};
    const chains = {};
    const lines = pdbText.split('\n');

    for (let line of lines) {
      if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
        const atomName = line.substring(12, 16).trim();
        const resName = line.substring(17, 20).trim();
        const chainID = line[21];
        const resSeq = parseInt(line.substring(22, 26).trim(), 10);
        const x = parseFloat(line.substring(30, 38).trim());
        const y = parseFloat(line.substring(38, 46).trim());
        const z = parseFloat(line.substring(46, 54).trim());

        const atom = {
          atomName, resName, chainID, resSeq,
          pos: new THREE.Vector3(x, y, z),
          aa1: AA3_TO_1[resName] || 'X'
        };
        atoms.push(atom);

        const resKey = `${chainID}_${resSeq}`;
        if (!residues[resKey]) {
          residues[resKey] = { chainID, resSeq, resName, ca: null, atoms: [] };
        }
        residues[resKey].atoms.push(atom);
        if (atomName === 'CA') {
          residues[resKey].ca = atom;
        }

        if (!chains[chainID]) chains[chainID] = [];
        chains[chainID].push(atom);
      }
    }

    // Compute center of mass
    const center = new THREE.Vector3();
    atoms.forEach(a => center.add(a.pos));
    if (atoms.length > 0) center.divideScalar(atoms.length);

    // Center coordinates
    atoms.forEach(a => a.pos.sub(center));

    return { atoms, residues, chains, center };
  }

  buildComplexRepresentation(pdbData, poseObj) {
    // Clear previous geometries
    while (this.molGroup.children.length > 0) {
      const obj = this.molGroup.children[0];
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
      this.molGroup.remove(obj);
    }
    while (this.contactsGroup.children.length > 0) {
      const obj = this.contactsGroup.children[0];
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
      this.contactsGroup.remove(obj);
    }

    if (!pdbData || pdbData.atoms.length === 0) return;

    const peptideChain = this.activeCase?.structural_evidence?.peptide_chain || 'B';
    const targetChain = this.activeCase?.structural_evidence?.target_chain || 'A';

    // Build backbone / ribbon spline per chain
    Object.keys(pdbData.chains).forEach(chainId => {
      const chainAtoms = pdbData.chains[chainId];
      const caAtoms = chainAtoms.filter(a => a.atomName === 'CA');
      const isPeptide = chainId === peptideChain || chainId === 'Y' || chainId === 'I';
      const isDecoy = poseObj?.pose_id === 'pose_docked_decoy';

      let chainColor = isPeptide
        ? (isDecoy ? PALETTE.decoyPose : PALETTE.peptideToxin)
        : PALETTE.targetChannel;

      // Draw CA spline / tube
      if (caAtoms.length > 2) {
        const points = caAtoms.map(a => a.pos);
        const curve = new THREE.CatmullRomCurve3(points);
        const tubeGeo = new THREE.TubeGeometry(curve, points.length * 4, isPeptide ? 0.9 : 0.65, 8, false);
        const tubeMat = new THREE.MeshStandardMaterial({
          color: chainColor,
          roughness: 0.35,
          metalness: 0.2
        });
        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        this.molGroup.add(tubeMesh);
      }

      // Draw Key Contact Residue Spheres
      caAtoms.forEach(ca => {
        const isKeyPeptide = isPeptide && this.isKeyResidue(ca.resSeq, true);
        const isKeyTarget = !isPeptide && this.isKeyResidue(ca.resSeq, false);

        if (isKeyPeptide || isKeyTarget) {
          const sphereGeo = new THREE.SphereGeometry(isKeyPeptide ? 1.6 : 1.3, 16, 16);
          const sphereMat = new THREE.MeshStandardMaterial({
            color: isKeyPeptide ? PALETTE.saltBridge : PALETTE.aromaticPore,
            emissive: isKeyPeptide ? 0x7f1d1d : 0x064e3b,
            emissiveIntensity: 0.45,
            roughness: 0.3
          });
          const sphere = new THREE.Mesh(sphereGeo, sphereMat);
          sphere.position.copy(ca.pos);
          this.molGroup.add(sphere);
        }
      });
    });

    // Draw Contact Distance Lines between closest key atoms
    this.drawContactVectors(pdbData);
  }

  isKeyResidue(resSeq, isPeptide) {
    if (!this.activeCase) return false;
    const list = isPeptide
      ? this.activeCase.molecular_interactions.key_peptide_residues
      : this.activeCase.molecular_interactions.key_target_residues;
    return list.some(r => r.resSeq === resSeq);
  }

  drawContactVectors(pdbData) {
    if (!this.activeCase) return;
    const pepKeys = this.activeCase.molecular_interactions.key_peptide_residues;
    const tgtKeys = this.activeCase.molecular_interactions.key_target_residues;

    const pepAtoms = pdbData.atoms.filter(a => pepKeys.some(k => k.resSeq === a.resSeq && a.atomName === 'CA'));
    const tgtAtoms = pdbData.atoms.filter(a => tgtKeys.some(k => k.resSeq === a.resSeq && a.atomName === 'CA'));

    // Find closest pairs
    const lineMat = new THREE.LineDashedMaterial({
      color: PALETTE.contactDotted,
      dashSize: 0.8,
      gapSize: 0.4,
      linewidth: 2
    });

    pepAtoms.forEach(pa => {
      let closest = null;
      let minD = 12.0; // Distance cutoff for visual vector
      tgtAtoms.forEach(ta => {
        const d = pa.pos.distanceTo(ta.pos);
        if (d < minD) {
          minD = d;
          closest = ta;
        }
      });

      if (closest) {
        const points = [pa.pos, closest.pos];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geo, lineMat);
        line.computeLineDistances();
        this.contactsGroup.add(line);
      }
    });
  }

  renderContactsTable() {
    const tbody = document.getElementById('docking-contacts-tbody');
    if (!tbody || !this.activeCase) return;
    tbody.innerHTML = '';

    const pepKeys = this.activeCase.molecular_interactions.key_peptide_residues;
    const tgtKeys = this.activeCase.molecular_interactions.key_target_residues;
    const contactTypes = this.activeCase.molecular_interactions.contact_types || [];

    const rowsCount = Math.max(pepKeys.length, tgtKeys.length);
    for (let i = 0; i < rowsCount; i++) {
      const p = pepKeys[i] || { resSeq: '—', resName: '—', role: '—' };
      const t = tgtKeys[i] || { resSeq: '—', resName: '—', role: '—' };
      const cType = contactTypes[i] || (i === 0 ? 'تجاذب كهروسكوني وتوافق سطحي' : 'تلامس هيدروفوبي نوعي');

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong class="mono text-gold">${p.resName}${p.resSeq}</strong></td>
        <td><strong class="mono text-cyan">${t.resName}${t.resSeq}</strong></td>
        <td><span class="badge" style="font-size:10px;">${cType}</span></td>
        <td class="mono text-xs">~2.8 - 3.8 Å</td>
        <td class="text-xs text-muted">${p.role || t.role}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  renderWorkflowStepper() {
    const stepper = document.getElementById('docking-stepper');
    const detailCard = document.getElementById('docking-step-detail-card');
    if (!stepper || !this.workflowMetadata) return;
    stepper.innerHTML = '';

    const stages = this.workflowMetadata.docking_stages || [];
    stages.forEach(s => {
      const stepItem = document.createElement('div');
      stepItem.className = `docking-step-item ${s.stage === this.activeStep ? 'active' : ''}`;
      stepItem.innerHTML = `
        <div class="step-num">${s.stage}</div>
        <div class="step-label">${s.name_ar}</div>
      `;
      stepItem.addEventListener('click', () => {
        this.activeStep = s.stage;
        stepper.querySelectorAll('.docking-step-item').forEach(el => el.classList.remove('active'));
        stepItem.classList.add('active');
        if (detailCard) {
          detailCard.innerHTML = `
            <h5>المرحلة ${s.stage}: ${s.name_ar} (${s.name_en})</h5>
            <p>${s.description_ar}</p>
            <div class="step-meta-box">
              <small class="mono text-2xs text-muted">${s.description_en}</small>
            </div>
          `;
        }
      });
      stepper.appendChild(stepItem);
    });

    // Initialize first step
    if (stages.length > 0 && detailCard) {
      const s = stages[0];
      detailCard.innerHTML = `
        <h5>المرحلة 1: ${s.name_ar} (${s.name_en})</h5>
        <p>${s.description_ar}</p>
        <div class="step-meta-box">
          <small class="mono text-2xs text-muted">${s.description_en}</small>
        </div>
      `;
    }
  }

  renderInterpretationPillars() {
    const container = document.getElementById('interpretation-pillars');
    const targetBadge = document.getElementById('interp-target-badge');
    if (!container || !this.activeCase) return;
    if (targetBadge) targetBadge.textContent = this.activeCase.target.target_id;

    const p = this.activeCase.scientific_interpretation_5_pillars;
    container.innerHTML = `
      <div class="pillar-item">
        <div class="pillar-tag pillar-shown">1. ما توضحه البنية مباشرة (Directly Shown)</div>
        <p>${p.directly_shows}</p>
      </div>
      <div class="pillar-item">
        <div class="pillar-tag pillar-hypo">2. ما يتم افتراضه حسابياً (Computationally Hypothesized)</div>
        <p>${p.computationally_hypothesized}</p>
      </div>
      <div class="pillar-item">
        <div class="pillar-tag pillar-meas">3. ما تم قياسه مخبرياً (Experimentally Measured)</div>
        <p>${p.experimentally_measured}</p>
      </div>
      <div class="pillar-item">
        <div class="pillar-tag pillar-unknown">4. ما لا يزال مجهولاً (Remains Unknown)</div>
        <p>${p.remains_unknown}</p>
      </div>
      <div class="pillar-item">
        <div class="pillar-tag pillar-exp">5. التجربة المخبرية المقترحة (Falsification Experiment)</div>
        <p>${p.falsification_experiment}</p>
      </div>
    `;
  }

  renderMetricsComparison() {
    const grid = document.getElementById('docking-metrics-grid');
    if (!grid || !this.activeCase) return;

    const wf = this.activeCase.docking_workflow;
    const exp = this.activeCase.experimental_reality_check;

    grid.innerHTML = `
      <div class="metric-box">
        <span class="metric-title">طاقة الإرساء الحاسوبي (Docking Score)</span>
        <span class="metric-value text-gold mono">${wf.scores.top_pose_vina_kcal_mol} kcal/mol</span>
        <small class="metric-sub">AutoDock Vina (دالة تقييم هندسية استدلالية)</small>
      </div>
      <div class="metric-box">
        <span class="metric-title">ألفة الارتباط المقاسة مخبرياً (Affinity Kd)</span>
        <span class="metric-value text-emerald mono">${exp.radioligand_binding_kd}</span>
        <small class="metric-sub">${exp.assay_system}</small>
      </div>
      <div class="metric-box">
        <span class="metric-title">الفاعلية الفسيولوجية (Electrophysiology)</span>
        <span class="metric-value text-cyan mono">${exp.electrophysiology_endpoint}</span>
        <small class="metric-sub">تخطيط الجهد الكهربائي للخلية الكاملة (Patch Clamp)</small>
      </div>
      <div class="metric-box metric-note-box">
        <span class="metric-title">الفصل الإبستمولوجي الحاسم</span>
        <p class="text-xs">${exp.docking_score_separation_note}</p>
      </div>
    `;
  }

  renderCrossLinks() {
    const container = document.getElementById('docking-cross-links');
    if (!container || !this.activeCase) return;

    const candId = this.activeCase.peptide.canonical_id;
    const tgtId = this.activeCase.target.target_id;

    container.innerHTML = `
      <a href="#venomlab" class="docking-link-pill">مختبر البنى 3D (MOD-03) 🧬</a>
      <a href="#target-explorer" class="docking-link-pill">مستكشف الأهداف (${tgtId}) 🎯</a>
      <a href="#translation-explorer" class="docking-link-pill">المسار الترجمي (MOD-09) 🧭</a>
      <a href="#xai" class="docking-link-pill">تفسير الذكاء الاصطناعي (MOD-10) 🧠</a>
    `;
  }

  takeSnapshot() {
    if (!this.canvas) return;
    const dataURL = this.canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `docking_twin_${this.activeCase?.case_id || 'case'}_${this.activePoseId}.png`;
    link.href = dataURL;
    link.click();
  }

  exportJson() {
    if (!this.activeCase) return;
    const jsonStr = JSON.stringify(this.activeCase, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `docking_case_${this.activeCase.case_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportReport() {
    if (!this.activeCase) return;
    const c = this.activeCase;
    const md = `# SCORPION X — تقرير دراسة حالة الإرساء والتوأم الرقمي
## المعرف: ${c.case_id} — ${c.title_ar}
- **الببتيد المرتبط:** ${c.peptide.peptide_name} (${c.peptide.parent_species})
- **التسلسل:** \`${c.peptide.mature_sequence}\`
- **المستقبل المستهدف:** ${c.target.target_name_ar} (${c.target.target_family})
- **فئة الدليل البنيوي:** ${c.structural_evidence.evidence_class}
- **معرف PDB:** ${c.structural_evidence.pdb_id}
- **طاقة الإرساء (AutoDock Vina):** ${c.docking_workflow.scores.top_pose_vina_kcal_mol} kcal/mol
- **ألفة الارتباط الحقيقية (Kd):** ${c.experimental_reality_check.radioligand_binding_kd}
- **الفاعلية المقاسة:** ${c.experimental_reality_check.electrophysiology_endpoint}

### ركائز التفسير العلمي الخمس:
1. ما توضحه البنية مباشرة: ${c.scientific_interpretation_5_pillars.directly_shows}
2. ما يتم افتراضه حسابياً: ${c.scientific_interpretation_5_pillars.computationally_hypothesized}
3. ما تم قياسه مخبرياً: ${c.scientific_interpretation_5_pillars.experimentally_measured}
4. ما لا يزال مجهولاً: ${c.scientific_interpretation_5_pillars.remains_unknown}
5. التجربة المخبرية المقترحة: ${c.scientific_interpretation_5_pillars.falsification_experiment}
`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `docking_report_${c.case_id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  renderLoop() {
    requestAnimationFrame(() => this.renderLoop());
    if (this.isSpinning && !this.reducedMotion) {
      this.molGroup.rotation.y += 0.005;
      this.contactsGroup.rotation.y += 0.005;
    }
    this.renderer.render(this.scene, this.camera);
  }
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
  const twin = new DockingTwinManager();
  twin.init();
  window.dockingTwinManager = twin;
});
