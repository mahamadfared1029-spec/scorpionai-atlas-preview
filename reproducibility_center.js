/**
 * SCORPION X — MOD-12: Methods, Evidence & Reproducibility Center
 * Interactive Bilingual Scientific Documentation, Evidence Ledger & Epistemic Limitations Engine
 */

class ReproducibilityCenterManager {
  constructor() {
    this.activeTab = 'tab-dataset';
    this.dataDictionary = null;
    this.candidateCrosswalk = [];
    this.assayEvidence = [];
    this.limitations = [];
    this.structuralProvenance = [];
    this.citations = [];
    this.versionManifest = null;
    this.modelMethods = null;
    this.rankingMethodology = null;
    this.currentLang = (window.i18n ? window.i18n.getLanguage() : 'ar');

    this.init();
  }

  async init() {
    await this.loadAllManifests();
    // Support deep-linking to specific tabs via URL hash or search (e.g. #methods-center?tab=tab-limitations)
    if (window.location.hash && window.location.hash.includes('tab=')) {
      const parts = window.location.hash.split('tab=');
      if (parts[1]) this.activeTab = parts[1];
    } else if (window.location.search && window.location.search.includes('tab=')) {
      const urlParams = new URLSearchParams(window.location.search);
      const t = urlParams.get('tab');
      if (t) this.activeTab = t;
    }

    this.setupEventListeners();
    this.updateTabButtonsUi();
    this.renderCurrentTab();
    this.renderSummaryCounters();
  }

  updateTabButtonsUi() {
    const tabButtons = document.querySelectorAll('.repro-tab-btn');
    tabButtons.forEach(b => {
      const isTarget = b.getAttribute('data-tab') === this.activeTab;
      b.classList.toggle('active', isTarget);
      b.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });
  }

  async loadAllManifests() {
    const basePath = 'data/reproducibility/';
    try {
      const [
        dictResp,
        crosswalkResp,
        assayResp,
        limResp,
        structResp,
        citResp,
        verResp,
        modelResp,
        rankResp
      ] = await Promise.all([
        fetch(basePath + 'data_dictionary.json'),
        fetch(basePath + 'candidate_identity_crosswalk.json'),
        fetch(basePath + 'assay_evidence_schema.json'),
        fetch(basePath + 'scientific_limitations_registry.json'),
        fetch(basePath + 'structural_provenance_table.json'),
        fetch(basePath + 'citations_export.json'),
        fetch(basePath + 'version_manifest.json'),
        fetch(basePath + 'model_methods_definitions.json'),
        fetch(basePath + 'ranking_methodology.json')
      ]);

      if (dictResp.ok) this.dataDictionary = await dictResp.json();
      if (crosswalkResp.ok) this.candidateCrosswalk = await crosswalkResp.json();
      if (assayResp.ok) this.assayEvidence = await assayResp.json();
      if (limResp.ok) this.limitations = await limResp.json();
      if (structResp.ok) this.structuralProvenance = await structResp.json();
      if (citResp.ok) this.citations = await citResp.json();
      if (verResp.ok) this.versionManifest = await verResp.json();
      if (modelResp.ok) this.modelMethods = await modelResp.json();
      if (rankResp.ok) this.rankingMethodology = await rankResp.json();

      console.log('MOD-12: All reproducibility manifests loaded successfully.');
    } catch (err) {
      console.warn('MOD-12: Fallback loading for local/file protocol or network issue', err);
    }
  }

  setupEventListeners() {
    // Language change listener (MOD-13)
    window.addEventListener('scorpionai:languageChanged', (e) => {
      this.currentLang = e.detail.lang;
      this.renderSummaryCounters();
      this.renderCurrentTab();
    });

    const tabButtons = document.querySelectorAll('.repro-tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetTab = btn.getAttribute('data-tab');
        if (targetTab) {
          this.activeTab = targetTab;
          tabButtons.forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-selected', 'false');
          });
          btn.classList.add('active');
          btn.setAttribute('aria-selected', 'true');
          this.renderCurrentTab();
        }
      });
    });

    // Global copy buttons
    document.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('.btn-copy-manifest');
      if (copyBtn) {
        const targetType = copyBtn.getAttribute('data-copy-target');
        this.copyManifestToClipboard(targetType, copyBtn);
      }
    });
  }

  renderSummaryCounters() {
    if (!this.dataDictionary) return;
    const stats = this.dataDictionary.reconciled_statistics;
    const map = {
      'repro-stat-peptides': stats.unique_mature_peptides,
      'repro-stat-species': stats.species_count,
      'repro-stat-sources': stats.literature_sources_count,
      'repro-stat-clusters': stats.sequence_clusters_70pct_identity,
      'repro-stat-descriptors': stats.physicochemical_descriptors_count,
      'repro-stat-assays': stats.measured_assay_rows_count,
      'repro-stat-candidates': stats.prioritized_candidates_count,
      'repro-stat-limitations': 9
    };

    Object.entries(map).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val.toLocaleString();
    });
  }

  renderCurrentTab() {
    const pane = document.getElementById('repro-tab-content');
    if (!pane) return;

    switch (this.activeTab) {
      case 'tab-dataset':
        pane.innerHTML = this.renderDatasetCriteriaSection();
        break;
      case 'tab-identity':
        pane.innerHTML = this.renderPeptideIdentitySection();
        break;
      case 'tab-assays':
        pane.innerHTML = this.renderAssayEvidenceSection();
        break;
      case 'tab-descriptors':
        pane.innerHTML = this.renderDescriptorsSection();
        break;
      case 'tab-models':
        pane.innerHTML = this.renderModelsValidationSection();
        break;
      case 'tab-ranking':
        pane.innerHTML = this.renderRankingEriSection();
        break;
      case 'tab-structures':
        pane.innerHTML = this.renderStructuresDockingSection();
        break;
      case 'tab-translation':
        pane.innerHTML = this.renderTranslationSafetySection();
        break;
      case 'tab-geography':
        pane.innerHTML = this.renderGeographySection();
        break;
      case 'tab-limitations':
        pane.innerHTML = this.renderLimitationsDownloadsSection();
        break;
      default:
        pane.innerHTML = this.renderDatasetCriteriaSection();
    }
  }

  // -------------------------------------------------------------------------
  // SECTION 1: DATASET & INCLUSION CRITERIA
  // -------------------------------------------------------------------------
  renderDatasetCriteriaSection() {
    return `
      <div class="repro-section-block">
        <div class="repro-header-box">
          <span class="badge-repro">01 / معايير إدراج وتوثيق قاعدة البيانات</span>
          <h3>المجموعات المرجعية ومعايير الإدراج والاستبعاد الصارمة</h3>
          <p class="text-muted">بيان المجموعات الإحصائية المحكمة لقاعدة بيانات ScorpionAI ومطابقتها المباشرة مع ملفات المستودع الأصلية المعتمدة.</p>
        </div>

        <div class="repro-kpi-grid">
          <div class="repro-kpi-card">
            <span class="kpi-num mono">1,232</span>
            <span class="kpi-label">ببتيد ناضج فريد</span>
            <small>تسلسلات ببتيدية كاملة خالية من الرموز المبهمة</small>
          </div>
          <div class="repro-kpi-card">
            <span class="kpi-num mono">147</span>
            <span class="kpi-label">نوع عقرب موثق</span>
            <small>عبر 18 عائلة جغرافية في سجل التصنيف</small>
          </div>
          <div class="repro-kpi-card">
            <span class="kpi-num mono">907</span>
            <span class="kpi-label">مرجع أدبي وقاعدة بيانات</span>
            <small>100% موثقة بأرقام PMID أو معرفات DOI</small>
          </div>
          <div class="repro-kpi-card">
            <span class="kpi-num mono">568</span>
            <span class="kpi-label">عنقود تسلسلي (70%)</span>
            <small>عناقيد ترابط أحادي لعزل تسريب البيانات</small>
          </div>
          <div class="repro-kpi-card">
            <span class="kpi-num mono">1,047</span>
            <span class="kpi-label">تسلسل خلفية غير مفحوص</span>
            <small>تسلسلات غير مختبرة حيوياً (لا تعني غياب الفاعلية)</small>
          </div>
          <div class="repro-kpi-card">
            <span class="kpi-num mono">185</span>
            <span class="kpi-label">إيجابية موثقة</span>
            <small>183 فحص مخبري نشط + 2 للغشاء الحيوي</small>
          </div>
        </div>

        <div class="repro-card-grid">
          <div class="repro-feature-card">
            <h4>معايير الإدراج (Inclusion Criteria)</h4>
            <ul class="repro-list">
              <li>تسلسلات الببتيدات الناضجة المستخلصة من سم العقارب أو المشتقة من قراءات النسخ الجيني (Transcriptomics/cDNA).</li>
              <li>سلامة حدود التسلسل الناضج وخلوه التام من الرموز المبهمة (مثل X أو B أو Z أو أحماض أمينية غير قياسية).</li>
              <li>توثيق النوع الأبوي بدقة ضمن السجل التصنيفي وتحديد أصل الببتيد (طبيعي Natural أو نظير اصطناعي مصمم Engineered).</li>
              <li>وجود مرجع أولي موثق أو تسجيل مباشر في Swiss-Prot / UniProtKB.</li>
            </ul>
          </div>

          <div class="repro-feature-card">
            <h4>معايير الاستبعاد (Exclusion Criteria)</h4>
            <ul class="repro-list">
              <li>استبعاد الأجزاء المبتورة أو المقاطع التافهة التي تفتقر إلى النهايات الطرفية الحقيقية N-term و C-term.</li>
              <li>استبعاد الببتيدات غير المستخلصة من رتبة العقارب (Scorpiones).</li>
              <li>استبعاد التسجيلات المكررة بنسبة 100% لنفس التسلسل في نفس النوع لتجنب تضخيم العينات.</li>
              <li>استبعاد الادعاءات غير التجريبية التي تفتقر لمصدر أولي أو تسجيل معتمد.</li>
            </ul>
          </div>
        </div>

        <div class="repro-cta-bar">
          <a href="#atlas" class="button primary small">استكشف قاعدة البيانات الكاملة (MOD-01) ➔</a>
          <button class="button secondary small btn-copy-manifest" data-copy-target="data_dictionary">نسخ قاموس البيانات الموثق (JSON) 📋</button>
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // SECTION 2: PEPTIDE IDENTITY & SEQUENCE PROVENANCE
  // -------------------------------------------------------------------------
  renderPeptideIdentitySection() {
    const rows = this.candidateCrosswalk.map(c => `
      <tr>
        <td class="mono font-bold">${c.canonical_id}</td>
        <td><strong>${c.peptide_name}</strong></td>
        <td><em>${c.parent_species}</em></td>
        <td><span class="badge ${c.origin_type === 'natural' ? 'badge-natural' : 'badge-engineered'}">${c.origin_type}</span></td>
        <td class="mono sequence-cell">${c.exact_mature_sequence}</td>
        <td class="mono text-center">${c.sequence_length}</td>
        <td class="mono text-center">${c.cysteine_count}</td>
        <td>${c.is_c_terminally_amidated ? '<span class="badge-amidated">أميد طرفي (-NH2)</span>' : '<span class="badge-free">حمض حر (-COOH)</span>'}</td>
        <td class="mono text-right">${c.molecular_weight_da.toFixed(2)} Da</td>
      </tr>
    `).join('');

    return `
      <div class="repro-section-block">
        <div class="repro-header-box">
          <span class="badge-repro">02 / هوية الببتيدات وتوثيق المتتاليات</span>
          <h3>سجل المطابقة الكانوني للمرشحين العشرين (Canonical Cohort Crosswalk)</h3>
          <p class="text-muted">المرشحون العشرون المعتمدون بدقة متناهية من خط الأساس الكانوني (Reference Baseline a36050a) مع اشتقاق كيمياء النهايات الطرفية وحساب الكتل الجزيئية الدقيقة.</p>
        </div>

        <div class="table-scroll-wrap">
          <table class="repro-table">
            <thead>
              <tr>
                <th>المعرف الكانوني</th>
                <th>اسم الببتيد</th>
                <th>النوع الأبوي</th>
                <th>الأصل</th>
                <th>المتتالية الناضجة الدقيقة</th>
                <th>الطول</th>
                <th>السيستئين</th>
                <th>تعديل النهاية C</th>
                <th>الكتلة الجزيئية</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>

        <div class="repro-info-banner">
          <h4>قاعدة الكيمياء الحيوية لحساب الأميد الطرفي (-0.984 Da):</h4>
          <p>يتم تحويل نهاية الكربوكسيل الحرة (-COOH) إلى أميد طرفي (-CONH2) حيوياً عبر إنزيم PAM بانشطار ثمالة الغلايسين السابقة. يُنقص هذا التفاعل كيميائياً مجموعة هيدروكسيل (-OH) ويضيف أمين (-NH2)، مما ينتج فرقاً دقيقاً في الكتلة الجزيئية قدره: <code>ΔMW = -17.003 + 16.019 = -0.984 Da</code>. جميع أوزان المنصة الجزيئية تراعي هذا التعديل بدقة دون أي تقريب عشوائي.</p>
        </div>

        <div class="repro-cta-bar">
          <a href="#peptide-explorer" class="button primary small">فتح مستكشف الببتيدات الكانوني (MOD-02) ➔</a>
          <button class="button secondary small btn-copy-manifest" data-copy-target="candidate_identity_crosswalk">نسخ سجل المطابقة الكانوني (JSON) 📋</button>
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // SECTION 3: EXPERIMENTAL ASSAY EVIDENCE & STANDARDS
  // -------------------------------------------------------------------------
  renderAssayEvidenceSection() {
    return `
      <div class="repro-section-block">
        <div class="repro-header-box">
          <span class="badge-repro">03 / أدلة الفحص المخبري والمعايير التجريبية</span>
          <h3>معايير قياس التركيز المثبط الأدنى (MIC) والتفريق المنهجي</h3>
          <p class="text-muted">توثيق منهجية التخفيف الدقيق في المرق المغذي (Broth Microdilution) طبقاً لمعايير CLSI و EUCAST، مع الفصل الصارم بين العوالق والأغشية الحيوية.</p>
        </div>

        <div class="repro-card-grid">
          <div class="repro-feature-card">
            <h4>معايير الفحص المعتمدة (CLSI M07-A9 & EUCAST)</h4>
            <p>تم استخراج جميع قيم التركيز المثبط الأدنى (MIC) حصراً من أبحاث أولية اعتمدت طريقة التخفيف المجهري في المرق المغذي (Broth Microdilution) في صفائح 96 عيناً عند كثافة لقاح معيارية (5×10⁵ CFU/mL) وحضانة عند 37°م لمدة 18-24 ساعة.</p>
            <ul class="repro-list">
              <li><strong>Mueller-Hinton Broth (MHB):</strong> الوسط المعياري العالمي لمعظم الببتيدات (Stigmurin, Kn2-7, BmKn2).</li>
              <li><strong>LB Broth:</strong> مستخدم في دراسات ببتيد Hp1404 ونظائر StigA، وتوثيق الوسط إلزامي لأن اختلاف الأيونات يغير الترسيب.</li>
              <li><strong>RPMI-1640:</strong> وسط فحص الفطريات والببتيدات المضادة للمبيضات (ToAP1, ToAP3).</li>
            </ul>
          </div>

          <div class="repro-feature-card">
            <h4>التفريق بين العوالق والأغشية الحيوية (Planktonic vs Biofilm)</h4>
            <p>لا يجوز خلط قياسات تثبيط الخلايا العالقة مع استئصال الأغشية الحيوية:</p>
            <ul class="repro-list">
              <li><strong>MIC (Planktonic):</strong> يمثل منع نمو الخلايا الجرثومية الحرة في المرق السائل.</li>
              <li><strong>MBEC / Biofilm:</strong> يمثل تركيز استئصال الغشاء الحيوي الراسخ على أسطح البوليستيرين (تم توثيقه حصراً لببتيد StigA6 و StigA16 في سجل مستقل لتمييزهما).</li>
              <li><strong>القيم المحدودة (Censored Values):</strong> القياسات المعبر عنها بحد أدنى مثل <code>&gt;100 µM</code> أو <code>&gt;64 µg/mL</code> تُسجل بعلاقة رقابية صريحة وتُمنع خوارزميات الترتيب من افتراض قيمة وهمية لها.</li>
            </ul>
          </div>
        </div>

        <div class="repro-cta-bar">
          <a href="#methods-evidence" class="button primary small">الانتقال إلى جدول القياسات ن=32 التفاعلي ➔</a>
          <button class="button secondary small btn-copy-manifest" data-copy-target="assay_evidence_schema">نسخ مخطط الفحوصات التجريبية (JSON) 📋</button>
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // SECTION 4: PHYSICOCHEMICAL DESCRIPTORS METHODOLOGY
  // -------------------------------------------------------------------------
  renderDescriptorsSection() {
    return `
      <div class="repro-section-block">
        <div class="repro-header-box">
          <span class="badge-repro">04 / منهجية الواصفات الفيزيوكيميائية</span>
          <h3>المعادلات الفيزيوكيميائية والواصفات التسلسلية (29 واصفاً)</h3>
          <p class="text-muted">الصيغ الرياضية المعتمدة لحساب الخصائص الهيكلية والفيزيوكيميائية للببتيدات بدون الاعتماد على استدلالات تخمينية.</p>
        </div>

        <div class="repro-card-grid">
          <div class="repro-feature-card">
            <h4>عزم التنافر المائي اللولبي (Hydrophobic Moment - μH)</h4>
            <p>يُحسب العزم التنافري المائي لولبياً (α-helix) بزاوية دوران قدرها 100° لكل ثمالة استناداً لمقياس آيزنبرغ (Eisenberg Consensus Hydrophobicity Scale):</p>
            <p class="mono text-sm bg-slate-900 p-2 rounded">$$\mu_H = \frac{1}{N} \sqrt{\left(\sum_{n=1}^N H_n \cos(n\delta)\right)^2 + \left(\sum_{n=1}^N H_n \sin(n\delta)\right)^2}$$</p>
            <small class="text-muted">حيث $\delta = 100^\circ$ و $H_n$ هي قيمة التنافر المائي للثمالة $n$.</small>
          </div>

          <div class="repro-feature-card">
            <h4>مؤشر عدم الاستقرار (Instability Index - II)</h4>
            <p>يُحسب وفق نموذج غوروبراساد (Guruprasad Benchmark) لتقييم ثبات الببتيد مخبرياً بناءً على تكرار أزواج الثمالات المتجاورة (dipeptides):</p>
            <p class="mono text-sm bg-slate-900 p-2 rounded">$$\text{II} = \frac{10}{L} \sum_{i=1}^{L-1} \text{DIWV}(x_i, x_{i+1})$$</p>
            <small class="text-muted">العتبة القياسية: القيم $\le 40$ تصنف الببتيد كمستقر مخبرياً؛ والقيم $>40$ كغير مستقر.</small>
          </div>

          <div class="repro-feature-card">
            <h4>الشحنة الكلية عند pH 7.4 الفسيولوجي</h4>
            <p>تُحسب باستخدام معادلة هندرسون-هاسلبالخ ومقياس ليهنينغر لثوابت التأين (pKa):</p>
            <ul class="repro-list">
              <li>سلاسل الكاتيونات الموجبة: Arg (pKa ~12.48)، Lys (pKa ~10.53)، His (pKa ~6.00).</li>
              <li>سلاسل الأنيونات السالبة: Asp (pKa ~3.65)، Glu (pKa ~4.25)، C-term (-COOH pKa ~2.18).</li>
              <li>النهاية الأميدية الطرفية (-CONH2) محايدة كهربائياً ولا تحمل شحنة سالبة عند pH 7.4.</li>
            </ul>
          </div>

          <div class="repro-feature-card">
            <h4>مؤشر بومان للتفاعل البروتيني (Boman Index)</h4>
            <p>يمثل متوسط طاقة الانتقال الحر للثمالات من الماء إلى الإيثانول، ويعبر عن احتمالية تفاعل الببتيد مع الأغشية الخلوية أو الارتباط التبادلي بالبروتينات الأخرى (عتبة الفاعلية >2.48 kcal/mol).</p>
          </div>
        </div>

        <div class="repro-cta-bar">
          <a href="#analytics" class="button primary small">استعراض تحليلات الواصفات التفاعلية (MOD-04) ➔</a>
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // SECTION 5: PREDICTION MODELS & VALIDATION PROTOCOL
  // -------------------------------------------------------------------------
  renderModelsValidationSection() {
    return `
      <div class="repro-section-block">
        <div class="repro-header-box">
          <span class="badge-repro">05 / نماذج التنبؤ والتحقق الإحصائي</span>
          <h3>إطار التعلم الإيجابي غير المعلم (PU Learning Framework)</h3>
          <p class="text-muted">الأساس النظري الرياضي لنموذج الانحدار اللوجستي المحكم وشروط التحقق بدون تسريب تسلسلي.</p>
        </div>

        <div class="repro-info-banner">
          <h4>التأهيل العلمي الإلزامي لدرجات نموذج PU:</h4>
          <p><strong>درجة نموذج PU (المخرج السيني Sigmoid) ليست احتمالاً حيوياً معايراً للفاعلية المضادة للبكتيريا.</strong> يميز النموذج تشابه الببتيد مع الأمثلة الإيجابية المعروفة (183 ببتيداً) مقارنة بالخلفية العامة غير المفحوصة (1,047 ببتيداً). وجود ببتيد في الخلفية غير المعلمة لا يثبت انعدام فاعليته، وغياب الفحص ليس دليلاً على السلبية.</p>
        </div>

        <div class="repro-card-grid">
          <div class="repro-feature-card">
            <h4>الصيغة الرياضية للانحدار اللوجستي (L2 Regularized)</h4>
            <p class="mono text-sm bg-slate-900 p-2 rounded">$$\text{logit}(x) = \beta_0 + \sum_{i=1}^{10} \beta_i \cdot \left(\frac{x_i - \mu_i}{\sigma_i}\right)$$</p>
            <p class="mono text-sm bg-slate-900 p-2 rounded">$$\text{PU Score} = \sigma(\text{logit}(x)) = \frac{1}{1 + e^{-\text{logit}(x)}}$$</p>
            <p>حيث تم تجميد الثابت $\beta_0 = -0.5784$، وتوحيد الواصفات الـ 10 بالمتوسطات والانحرافات المعيارية المحسوبة حصراً على مجموعة التدريب.</p>
          </div>

          <div class="repro-feature-card">
            <h4>التحقق المتقاطع ومنع التسريب (4-Fold Group-Aware CV)</h4>
            <ul class="repro-list">
              <li><strong>تقسيم العناقيد:</strong> تم تجميع التسلسلات في 568 عنقوداً عند عتبة تشابه 70%، وحظر وجود أي تسلسلين متشابهين عبر طيات التدريب والاختبار.</li>
              <li><strong>مجموعة الاختبار المستقلة (Holdout):</strong> تم استبعاد مرشحي BmKn2 و Kn2-7 وعناقيدهم بالكامل من التدريب، وتقييم أدائهم كاختبار أعمى مستقل.</li>
              <li><strong>بروتوكول ROC-AUC / PR-AUC:</strong> يُحسب بدقة وفق بروتوكول (Positive-vs-Unlabeled) فقط، ولا يجوز الادعاء بأنه يقيس الدقة ضد سلبيات تجريبية مؤكدة.</li>
            </ul>
          </div>
        </div>

        <div class="repro-cta-bar">
          <a href="#prediction" class="button primary small">محرك التنبؤ (MOD-06) ➔</a>
          <a href="#xai" class="button secondary small">لوحة التفسير وقابلية الشرح (MOD-10) ➔</a>
          <button class="button secondary small btn-copy-manifest" data-copy-target="model_methods">نسخ معاملات النموذج والميزات (JSON) 📋</button>
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // SECTION 6: CANDIDATE RANKING & EVIDENCE READINESS (ERI)
  // -------------------------------------------------------------------------
  renderRankingEriSection() {
    return `
      <div class="repro-section-block">
        <div class="repro-header-box">
          <span class="badge-repro">06 / خوارزمية الترتيب وجاهزية الأدلة</span>
          <h3>معادلة الترتيب الكانونية MOD-07-M1 وفصل جاهزية الأدلة (ERI)</h3>
          <p class="text-muted">الأوزان المعيارية للنموذج المعتمد، وسبب تصفير وزن التحلل الدموي، واستقلالية مؤشر الجاهزية.</p>
        </div>

        <div class="repro-feature-card">
          <h4>معادلة الترتيب المعتمدة MOD-07-M1 (Safety-Excluded Baseline):</h4>
          <p class="mono text-base bg-slate-900 p-3 rounded text-center">
            $$\text{Composite Score} = 0.50 \cdot S_{\text{MIC}} + 0.25 \cdot S_{\text{stability}} + 0.125 \cdot S_{\mu_H} + 0.125 \cdot S_{\text{charge}} + 0.00 \cdot S_{\text{hemo}}$$
          </p>
          <div class="repro-info-banner mt-3">
            <strong>تحذير منهجي صارم:</strong> وزن التحلل الدموي <code>w_hemo = 0.00</code> وُضع عمداً لتجنب معاقبة الببتيدات التي تفتقر لقياس HC50 أو تلفيق قيم اصطناعية لها. <strong>تصفير وزن الأمان لا يعني إطلاقاً أن الببتيد آمن أو غير سام!</strong>
          </div>
        </div>

        <div class="repro-card-grid mt-4">
          <div class="repro-feature-card">
            <h4>أوزان النموذج وتوزيع الأهمية</h4>
            <ul class="repro-list">
              <li><strong>الفاعلية الجرثومية (MIC) [50%]:</strong> المعيار الأثقل وزناً لضمان تقديم الببتيدات ذات التراكيز المثبطة النانو-مولية.</li>
              <li><strong>الثبات الهيكلي المخبري [25%]:</strong> تفضيل الببتيدات ذات مؤشر عدم استقرار $\le 40$.</li>
              <li><strong>عزم التنافر المائي (μH) [12.5%]:</strong> تعزيز القدرة على اختراق الغشاء الجرثومي.</li>
              <li><strong>الشحنة الفسيولوجية (+2 إلى +7) [12.5%]:</strong> توفير الجذب الكهروسكوني لغشاء البكتيريا السالب.</li>
            </ul>
          </div>

          <div class="repro-feature-card">
            <h4>استقلالية مؤشر جاهزية الأدلة (ERI Independence)</h4>
            <p>يقيس مؤشر جاهزية الأدلة (Evidence Readiness Index - MOD-08) اكتمال الأدلة التجريبية عبر 5 أبعاد مستقلة:</p>
            <ul class="repro-list">
              <li>اكتمال فحوصات التركيز المثبط الأدنى (MIC Completeness).</li>
              <li>توفر البنية الجزيئية ثلاثية الأبعاد (Structural Availability).</li>
              <li>قياس التحلل الدموي والسمية الخلوية (Toxicity Data).</li>
              <li>تحديد الهدف الجزيئي وآلية العمل (Target Specificity).</li>
              <li>التحقق في نماذج العدوى الحيوية (In Vivo Translation).</li>
            </ul>
            <small class="text-muted">مؤشر ERI مفصول تماماً عن درجة M1، ولا يرفع درجة ببتيد يفتقر للأدلة الحيوية.</small>
          </div>
        </div>

        <div class="repro-cta-bar">
          <a href="#prioritization" class="button primary small">استعراض لوحة الترتيب الكانونية (MOD-07) ➔</a>
          <button class="button secondary small btn-copy-manifest" data-copy-target="ranking_methodology">نسخ ميثاق الترتيب الكانوني (JSON) 📋</button>
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // SECTION 7: STRUCTURAL BIOLOGY & DOCKING PROVENANCE
  // -------------------------------------------------------------------------
  renderStructuresDockingSection() {
    return `
      <div class="repro-section-block">
        <div class="repro-header-box">
          <span class="badge-repro">07 / البنية الجزيئية والإرساء الحسابي</span>
          <h3>التدقيق البنيوي الشامل لملفات PDB ووضعيات الإرساء (Sprint 12 Audit)</h3>
          <p class="text-muted">فحص مباشر وموثق لهياكل PDB الخمسة، والكيانات المودعة، والمسافات الإقليدية، وإعادة تصنيف الوضعيات الاستعراضية.</p>
        </div>

        <div class="table-scroll-wrap">
          <table class="repro-table">
            <thead>
              <tr>
                <th>معرف الحالة</th>
                <th>رمز PDB</th>
                <th>طريقة التعيين والدقة</th>
                <th>الكيانات المودعة الدقيقة</th>
                <th>نوع النظام</th>
                <th>المسافات الإقليدية المحسوبة</th>
                <th>حالة ألفة الربط التجريبية</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="mono font-bold">DCS-001</td>
                <td class="mono font-bold">6NT4</td>
                <td>Cryo-EM (3.50 Å)</td>
                <td>سلسلة A: قناة NavPas/Nav1.7 الهجينة<br>سلسلتين B,C: سم AaH2</td>
                <td><span class="badge badge-natural">معقد تجريبي مودع</span></td>
                <td class="mono">Arg62-Asp669 (3.96 Å)<br>Thr13-Asp219 (2.95 Å)</td>
                <td>Kd = 1.0 - 3.2 nM ([¹²⁵I]-AaH2)</td>
              </tr>
              <tr>
                <td class="mono font-bold">DCS-002</td>
                <td class="mono font-bold">4JTA</td>
                <td>X-ray (2.50 Å)</td>
                <td>سلسلة Y: Charybdotoxin (ChTX)<br>سلاسل B,Q: قناة Kv1.2-2.1 الهجينة</td>
                <td><span class="badge badge-natural">معقد تجريبي مودع</span></td>
                <td class="mono">Lys27-Tyr373 (2.78 Å)</td>
                <td>Kd = 2.5 nM (ChTX pore plug)</td>
              </tr>
              <tr>
                <td class="mono font-bold">DCS-003</td>
                <td class="mono font-bold">6OFA</td>
                <td>Solution NMR (50 models)</td>
                <td>سلسلة A: سم WaTx منفرد (33 ثمالة)<br>لا توجد قناة TRPA1 في الإحداثيات</td>
                <td><span class="badge-free">ببتيد منفرد (Apo NMR)</span></td>
                <td class="mono">لا توجد واجهة بلورية</td>
                <td>Kd = null (تنشيط وظيفي EC50 = 12-16 µM)</td>
              </tr>
              <tr>
                <td class="mono font-bold">DCS-004</td>
                <td class="mono">N/A</td>
                <td>In Silico Model</td>
                <td>ببتيد Stigmurin ضد Lipid II</td>
                <td><span class="badge-engineered">فرضية حاسوبية نظرية</span></td>
                <td class="mono">نموذج محاكاة نظري</td>
                <td>Kd = null (MIC ضد البكتيريا = 12.5-25 µM)</td>
              </tr>
              <tr>
                <td class="mono font-bold">DCS-005</td>
                <td class="mono font-bold">6MRQ</td>
                <td>X-ray (1.29 Å)</td>
                <td>سلسلة A: تريبسين بقري (Trypsin)<br>سلسلة I: مثبط TOPI1</td>
                <td><span class="badge badge-natural">معقد تجريبي مودع</span></td>
                <td class="mono">Lys32-Asp189 (2.85 Å)</td>
                <td>Ki = 12.4 ± 1.8 nM (تثبيط نشط)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="repro-card-grid mt-4">
          <div class="repro-feature-card">
            <h4>إعادة تصنيف الوضعيات كوضعيات هيكلية تعليمية استعراضية:</h4>
            <p>امتثالاً لقواعد البوابة البنيوية لسبرنت 12، تم إعادة تصنيف وضعيات الإرساء المقارنة (الوضعية شبه الطبيعية بانحراف 1.78 Å والوضعية التضليلية بانحراف 8.14 Å) كوضعيات استعراضية مصممة لتعليم المستخدمين فروق دوال التقييم، وتنزيه المنصة عن الادعاء بحساب Vina غير مؤرشف.</p>
          </div>

          <div class="repro-feature-card">
            <h4>قاعدة حظر تحويل طاقة الإرساء إلى ألفة ربط:</h4>
            <p>يُحظر في ScorpionAI Atlas تحويل درجة الإرساء (Docking Score بوحدة kcal/mol) مباشرة إلى ألفة ربط (Kd أو ΔG تجريبية). طاقة الإرساء تقييم تقريبي للملاءمة الفراغية، بينما Kd تعكس توازناً ثرموديناميكياً ومساهمة المذيب وحركة الغشاء الدهني المفقودة في النمذجة الجافة.</p>
          </div>
        </div>

        <div class="repro-cta-bar">
          <a href="#docking-twin" class="button primary small">فتح التوأم الرقمي للإرساء (MOD-11) ➔</a>
          <a href="#venomlab" class="button secondary small">مختبر السموم ثلاثي الأبعاد (MOD-03) ➔</a>
          <button class="button secondary small btn-copy-manifest" data-copy-target="structural_provenance">نسخ جدول التوثيق البنيوي (JSON) 📋</button>
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // SECTION 8: TRANSLATIONAL PIPELINE & SAFETY EVIDENCE
  // -------------------------------------------------------------------------
  renderTranslationSafetySection() {
    return `
      <div class="repro-section-block">
        <div class="repro-header-box">
          <span class="badge-repro">08 / المسار الانتقالي وبيانات الأمان المخبري</span>
          <h3>المراحل الانتقالية الست وحقائق التحلل الدموي (HC50)</h3>
          <p class="text-muted">بيان تقدم المرشحين عبر مسار التطوير قبل السريري، وحقائق التحلل الدموي البشري، والحدود الفاصلة عن الاستخدام السريري.</p>
        </div>

        <div class="repro-kpi-grid">
          <div class="repro-kpi-card">
            <span class="kpi-num mono">53.96 µM</span>
            <span class="kpi-label">Kn2-7 (HC50 دم بشري)</span>
            <small>Cao et al. 2012 (PMID: 22792229)</small>
          </div>
          <div class="repro-kpi-card">
            <span class="kpi-num mono">146.5 µM</span>
            <span class="kpi-label">Hp1404 (HC50 دم بشري)</span>
            <small>Chen et al. 2014 (PMID: 24826994)</small>
          </div>
          <div class="repro-kpi-card">
            <span class="kpi-num mono">11.83 µM</span>
            <span class="kpi-label">BmKn2 (HC50 دم بشري)</span>
            <small>Cao et al. 2012 / Zeng et al. 2004</small>
          </div>
          <div class="repro-kpi-card">
            <span class="kpi-num mono text-rose-400">0</span>
            <span class="kpi-label">اعتماد سريري بشري</span>
            <small>صفر ببتيدات مرخصة علاجياً</small>
          </div>
        </div>

        <div class="repro-card-grid mt-4">
          <div class="repro-feature-card">
            <h4>الفصل بين مقاييس السمية المختلفة (Non-Interchangeable Endpoints)</h4>
            <ul class="repro-list">
              <li><strong>التحلل الدموي أحادي التركيز (% Lysis at 100 µM):</strong> فحص استكشافي أولي لا يمكن استخدامه لمقارنة الجرعات النصفية.</li>
              <li><strong>تركيز التحلل الدموي النصفي (HC50):</strong> التركيز الدوائي الذي يحلل 50% من كريات الدم الحمراء البشرية السليمة، وهو المعيار الكمي الصارم.</li>
              <li><strong>السمية الخلوية للأنوية (Nucleated Cytotoxicity):</strong> فحص البقاء الخلوي (MTT/LDH) على خلايا الكلى (Vero/HEK293)؛ تفتقر معظم الببتيدات لهذا القياس، ولا يجوز اعتبار ببتيد غير محلل للدم كببتيد آمن خلوياً.</li>
            </ul>
          </div>

          <div class="repro-feature-card">
            <h4>المراحل الانتقالية الست (MOD-09 Translational Stages)</h4>
            <ol class="repro-list">
              <li><strong>المرحلة 1:</strong> الفاعلية المخبرية وطيف النشاط (MIC In Vitro).</li>
              <li><strong>المرحلة 2:</strong> قياس التحلل الدموي والسمية الخلوية (HC50/Cytotoxicity).</li>
              <li><strong>المرحلة 3:</strong> الثبات الحيوي ضد إنزيمات المصل والبروتياز (Serum Stability).</li>
              <li><strong>المرحلة 4:</strong> التحمل والأمان في النماذج الحيوانية (In Vivo MTD).</li>
              <li><strong>المرحلة 5:</strong> الفاعلية العلاجية في نماذج العدوى الحيوانية (In Vivo Infection Efficacy).</li>
              <li><strong>المرحلة 6:</strong> دراسات الحرائك الدوائية والتركيب الصيدلاني (PK & Formulation).</li>
            </ol>
          </div>
        </div>

        <div class="repro-cta-bar">
          <a href="#translation-explorer" class="button primary small">مستكشف الجاهزية الانتقالية (MOD-09) ➔</a>
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // SECTION 9: GEOGRAPHY & PROVENANCE
  // -------------------------------------------------------------------------
  renderGeographySection() {
    return `
      <div class="repro-section-block">
        <div class="repro-header-box">
          <span class="badge-repro">09 / التوزيع الجغرافي ومصادر العينات</span>
          <h3>المستويات الخمسة لتحديد المواقع الجغرافية (Geocoding Tiers)</h3>
          <p class="text-muted">الشفافية في تمييز الإحداثيات الحقلية الدقيقة عن التقديرات الإقليمية وسلالات التربية المختبرية.</p>
        </div>

        <div class="repro-card-grid">
          <div class="repro-feature-card">
            <h4>فئات التحديد الجغرافي (5 Georeferencing Classes)</h4>
            <ul class="repro-list">
              <li><strong>الفئة 1 (Class 1 - Published Field GPS):</strong> إحداثيات حقلية دقيقة منشورة في الورقة البحثية الأصلية بواسطة أجهزة GPS أثناء جمع العينات الحية.</li>
              <li><strong>الفئة 2 (Class 2 - Type Locality / Georeferenced):</strong> إحداثيات مسترجعة استناداً لموقع الجمع الأصلي الموثق للنوع (Type Locality) مع دائرة عدم يقين محددة.</li>
              <li><strong>الفئة 3 (Class 3 - Regional Centroid):</strong> مركز إقليمي أو وطني (Country/Province Centroid) في حال ذكر الدولة دون موقع محدد (تمييز صريح لتجنب إيهام المستخدم بدقة زائفة).</li>
              <li><strong>الفئة 4 (Class 4 - Disputed Records):</strong> تسجيلات جغرافية متنازع عليها أو أنواع وافدة تم عزلها خارج نطاقها الحيوي الطبيعي.</li>
              <li><strong>الفئة 5 (Class 5 - Laboratory Strains / Unavailable):</strong> عينات مستخلصة من مستعمرات تربية مختبرية أو تجارية (مثل عينات <em>Mesobuthus martensii</em> التجارية) دون إحداثيات حقلية برية.</li>
            </ul>
          </div>

          <div class="repro-feature-card">
            <h4>مبدأ الحفاظ على عدم اليقين (Anti-Fabrication Policy)</h4>
            <p>تلتزم المنصة بعدم تلفيق أي إحداثيات GPS لعقارب جُمعت من أسواق أو مستعمرات مختبرية، ويتم توثيق دائرة الخطأ التقديري صراحة في الخريطة التفاعلية لمنع التفسير البيئي الخاطئ لتوزيع السموم.</p>
          </div>
        </div>

        <div class="repro-cta-bar">
          <a href="#geo-tracker" class="button primary small">فتح متتبع النطاق الجغرافي (MOD-05) ➔</a>
          <a href="#biogeography-explorer" class="button secondary small">مستكشف الجغرافيا الحيوية (MOD-08) ➔</a>
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // SECTION 10: LIMITATIONS DASHBOARD & REPRODUCIBILITY DOWNLOADS
  // -------------------------------------------------------------------------
  renderLimitationsDownloadsSection() {
    const limCards = this.limitations.map(lim => `
      <div class="repro-limit-card">
        <div class="limit-top">
          <span class="mono font-bold text-rose-400">${lim.id}</span>
          <span class="badge ${lim.severity.includes('Critical') ? 'badge-rose' : (lim.severity.includes('High') ? 'badge-amber' : 'badge-slate')}">${lim.severity}</span>
        </div>
        <h4>${this.currentLang === "ckb" ? (lim.title_ckb || lim.title_en) : (this.currentLang === "en" ? lim.title_en : lim.title_ar)}</h4>
        <p class="text-xs text-muted mb-2"><strong>الموديولات المتأثرة:</strong> ${lim.affected_modules.join(', ')}</p>
        <p class="text-sm mb-2">${this.currentLang === "ckb" ? (lim.description_ckb || lim.description_en) : (this.currentLang === "en" ? lim.description_en : (lim.description_ar || lim.description_en))}</p>
        <div class="repro-mitigation-box">
          <small><strong>إجراء التخفيف المعتمد:</strong> ${lim.mitigation_en}</small>
        </div>
      </div>
    `).join('');

    return `
      <div class="repro-section-block">
        <div class="repro-header-box">
          <span class="badge-repro">10 / لوحة الحدود المعرفية والتنزيلات المفتوحة</span>
          <h3>لوحة الحدود العلمية التسع (Scientific Limitations Dashboard)</h3>
          <p class="text-muted">الحدود الإبستمولوجية الحاكمة لتفسير مخرجات أطلس العقارب لمنع الاستنتاجات الطبية أو الصيدلانية غير المسندة.</p>
        </div>

        <div class="repro-limits-grid">
          ${limCards}
        </div>

        <div class="repro-downloads-hub mt-5">
          <div class="repro-header-box">
            <span class="badge-repro">مركز التنزيلات وقابلية التكرار الأكاديمية (Open Science Downloads Hub)</span>
            <h3>تنزيل البيانات المفتوحة والمخططات العلمية القابلة للتحقق الآلي</h3>
            <p class="text-muted">جميع الملفات مطابقة بدقة لبيانات المستودع المحكمة ومتاحة للتنزيل المباشر أو النسخ الفوري دون أي مسارات محلية خاصة.</p>
          </div>

          <div class="repro-dl-grid">
            <div class="repro-dl-item">
              <div>
                <h5>قاموس البيانات والمواصفات (Data Dictionary)</h5>
                <small class="text-muted">المجموعات الإحصائية الـ 11 وشروط الإدراج والاستبعاد</small>
              </div>
              <div class="dl-actions">
                <a href="data/reproducibility/data_dictionary.json" download class="btn-dl">JSON ⤓</a>
                <button class="btn-copy btn-copy-manifest" data-copy-target="data_dictionary">نسخ 📋</button>
              </div>
            </div>

            <div class="repro-dl-item">
              <div>
                <h5>سجل المطابقة الكانوني (Candidate Crosswalk)</h5>
                <small class="text-muted">المرشحون العشرون مع الكتل المعدلة للأميد والأرقام المعتمدة</small>
              </div>
              <div class="dl-actions">
                <a href="data/reproducibility/candidate_identity_crosswalk.json" download class="btn-dl">JSON ⤓</a>
                <a href="data/reproducibility/candidate_identity_crosswalk.csv" download class="btn-dl">CSV ⤓</a>
                <button class="btn-copy btn-copy-manifest" data-copy-target="candidate_identity_crosswalk">نسخ 📋</button>
              </div>
            </div>

            <div class="repro-dl-item">
              <div>
                <h5>مخطط الفحوصات التجريبية (Assay Evidence Schema)</h5>
                <small class="text-muted">32 قياس فحص تجريبي مع التراكيز والأوساط ومعرفات DOI</small>
              </div>
              <div class="dl-actions">
                <a href="data/reproducibility/assay_evidence_schema.json" download class="btn-dl">JSON ⤓</a>
                <a href="data/reproducibility/assay_evidence_schema.csv" download class="btn-dl">CSV ⤓</a>
                <button class="btn-copy btn-copy-manifest" data-copy-target="assay_evidence_schema">نسخ 📋</button>
              </div>
            </div>

            <div class="repro-dl-item">
              <div>
                <h5>معاملات نموذج التنبؤ (Model Parameters & Methods)</h5>
                <small class="text-muted">أوزان ميزات PU اللوجستية، الانحرافات، الثابت، ومعايير التدريب</small>
              </div>
              <div class="dl-actions">
                <a href="data/reproducibility/model_methods_definitions.json" download class="btn-dl">JSON ⤓</a>
                <button class="btn-copy btn-copy-manifest" data-copy-target="model_methods">نسخ 📋</button>
              </div>
            </div>

            <div class="repro-dl-item">
              <div>
                <h5>ميثاق خوارزمية الترتيب (Ranking Methodology)</h5>
                <small class="text-muted">أوزان نموذج M1 ودوال التطبيع وتبرير تصفير وزن الأمان</small>
              </div>
              <div class="dl-actions">
                <a href="data/reproducibility/ranking_methodology.json" download class="btn-dl">JSON ⤓</a>
                <button class="btn-copy btn-copy-manifest" data-copy-target="ranking_methodology">نسخ 📋</button>
              </div>
            </div>

            <div class="repro-dl-item">
              <div>
                <h5>جدول التوثيق البنيوي (Structural Provenance)</h5>
                <small class="text-muted">حالات الإرساء الخمس مع الكيانات المودعة والمسافات و RMSD</small>
              </div>
              <div class="dl-actions">
                <a href="data/reproducibility/structural_provenance_table.json" download class="btn-dl">JSON ⤓</a>
                <a href="data/reproducibility/structural_provenance_table.csv" download class="btn-dl">CSV ⤓</a>
                <button class="btn-copy btn-copy-manifest" data-copy-target="structural_provenance">نسخ 📋</button>
              </div>
            </div>

            <div class="repro-dl-item">
              <div>
                <h5>سجل الحدود المعرفية (Scientific Limitations)</h5>
                <small class="text-muted">الحدود الإبستمولوجية التسع مع مستويات الخطورة وإجراءات التخفيف</small>
              </div>
              <div class="dl-actions">
                <a href="data/reproducibility/scientific_limitations_registry.json" download class="btn-dl">JSON ⤓</a>
                <a href="data/reproducibility/scientific_limitations_registry.csv" download class="btn-dl">CSV ⤓</a>
                <button class="btn-copy btn-copy-manifest" data-copy-target="scientific_limitations">نسخ 📋</button>
              </div>
            </div>

            <div class="repro-dl-item">
              <div>
                <h5>وثيقة الإصدار والبيئة البرمجية (Version Manifest)</h5>
                <small class="text-muted">إصدار الأطلس v1.5.0، هاشات Git، ومكتبات بيئة التشغيل</small>
              </div>
              <div class="dl-actions">
                <a href="data/reproducibility/version_manifest.json" download class="btn-dl">JSON ⤓</a>
                <button class="btn-copy btn-copy-manifest" data-copy-target="version_manifest">نسخ 📋</button>
              </div>
            </div>

            <div class="repro-dl-item">
              <div>
                <h5>تصدير الاستشهادات الأكاديمية (BibTeX / JSON Citations)</h5>
                <small class="text-muted">المراجع البحثية الأساسية بصيغة BibTeX القياسية للمراجعة الأكاديمية</small>
              </div>
              <div class="dl-actions">
                <a href="data/reproducibility/citations_export.bib" download class="btn-dl">BibTeX ⤓</a>
                <a href="data/reproducibility/citations_export.json" download class="btn-dl">JSON ⤓</a>
                <button class="btn-copy btn-copy-manifest" data-copy-target="citations_export">نسخ 📋</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Helper method for clipboard copying
  async copyManifestToClipboard(targetType, btnElement) {
    let contentToCopy = '';
    switch (targetType) {
      case 'data_dictionary':
        contentToCopy = JSON.stringify(this.dataDictionary, null, 2);
        break;
      case 'candidate_identity_crosswalk':
        contentToCopy = JSON.stringify(this.candidateCrosswalk, null, 2);
        break;
      case 'assay_evidence_schema':
        contentToCopy = JSON.stringify(this.assayEvidence, null, 2);
        break;
      case 'model_methods':
        contentToCopy = JSON.stringify(this.modelMethods, null, 2);
        break;
      case 'ranking_methodology':
        contentToCopy = JSON.stringify(this.rankingMethodology, null, 2);
        break;
      case 'structural_provenance':
        contentToCopy = JSON.stringify(this.structuralProvenance, null, 2);
        break;
      case 'scientific_limitations':
        contentToCopy = JSON.stringify(this.limitations, null, 2);
        break;
      case 'version_manifest':
        contentToCopy = JSON.stringify(this.versionManifest, null, 2);
        break;
      case 'citations_export':
        contentToCopy = JSON.stringify(this.citations, null, 2);
        break;
      default:
        contentToCopy = 'No content found.';
    }

    try {
      await navigator.clipboard.writeText(contentToCopy);
      const originalText = btnElement.textContent;
      btnElement.textContent = 'تم النسخ! ✓';
      btnElement.classList.add('copied');
      setTimeout(() => {
        btnElement.textContent = originalText;
        btnElement.classList.remove('copied');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.reproCenterManager = new ReproducibilityCenterManager();
});
