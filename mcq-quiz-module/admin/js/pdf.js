/**
 * pdf.js
 * Centralized PDF generation with watermark support
 */

const PDF = {
  getWatermarkSettings() {
    const s = Storage.getSettings();
    return {
      mode: s.watermarkMode || 'default',       // 'default' | 'custom'
      customText: s.watermarkCustom || 'MCQ Quiz Module'
    };
  },

  /**
   * Resolve the actual watermark text
   * @param {string} purposeTitle - descriptive title for "Default Name" mode
   */
  resolveWatermark(purposeTitle = '') {
    const { mode, customText } = this.getWatermarkSettings();
    if (mode === 'custom' && customText.trim()) {
      return customText.trim();
    }
    // Default Name mode
    if (purposeTitle && purposeTitle.trim()) {
      return purposeTitle.trim();
    }
    return 'MCQ Quiz Module';
  },

  /**
   * Create a new jsPDF instance and apply watermark on every page
   */
  create(purposeTitle = '') {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const watermark = this.resolveWatermark(purposeTitle);

    // Store for use in addWatermark
    doc.__watermarkText = watermark;
    doc.__purposeTitle = purposeTitle;

    return doc;
  },

  /**
   * Add diagonal watermark to current page
   */
  addWatermark(doc) {
    const text = doc.__watermarkText || 'MCQ Quiz Module';
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.16 }));
    doc.setFontSize(72); // centered diagonal watermark
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'bold');

    // Diagonal center watermark
    doc.text(text, pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: 45
    });

    doc.restoreGraphicsState();
  },

  /**
   * Add header + footer on a page
   */
  addHeaderFooter(doc, pageTitle, pageNumber, totalPages) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Header line
    doc.setDrawColor(30, 64, 175);
    doc.setLineWidth(0.5);
    doc.line(14, 18, pageWidth - 14, 18);

    doc.setFontSize(9);
    doc.setTextColor(30, 64, 175);
    doc.setFont('helvetica', 'bold');
    doc.text('MCQ Quiz Module', 14, 14);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(pageTitle, pageWidth - 14, 14, { align: 'right' });

    // Footer
    doc.setDrawColor(200);
    doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, pageHeight - 9);
    doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - 14, pageHeight - 9, { align: 'right' });
  },

  /**
   * Finalize: add watermark + header/footer to all pages, then save
   */
  finalize(doc, filename, pageTitle) {
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      this.addWatermark(doc);
      this.addHeaderFooter(doc, pageTitle, i, totalPages);
    }
    doc.save(filename);
  },

  // ---------- Specific Report Generators ----------

  /**
   * Student Performance Report PDF
   */
  exportUserReport(detail) {
    const { user, attempts, byCategory } = detail;
    const totalCorrect = attempts.reduce((s, a) => s + (a.correct || 0), 0);
    const totalQ = attempts.reduce((s, a) => s + (a.total || 0), 0);
    const overallAvg = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0;

    const purpose = `Student Report – ${user.name || user.email}`;
    const doc = this.create(purpose);

    let y = 28;

    // Title
    doc.setFontSize(16);
    doc.setTextColor(30, 64, 175);
    doc.setFont('helvetica', 'bold');
    doc.text('Student Performance Report', 105, y, { align: 'center' });
    y += 10;

    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, 105, y, { align: 'center' });
    y += 12;

    // Student Info
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Student Information', 14, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(40);
    doc.setFont('helvetica', 'normal');
    const info = [
      [`Name: ${user.name || '—'}`, `Email: ${user.email}`],
      [`Mobile: ${user.mobile || '—'}`, `Status: ${user.isLocked ? 'Locked' : 'Active'}`],
      [`Registered: ${user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN') : '—'}`,
       `Last Login: ${user.lastLogin ? new Date(user.lastLogin).toLocaleString('en-IN') : 'Never'}`]
    ];
    info.forEach(row => {
      doc.text(row[0], 14, y);
      doc.text(row[1], 110, y);
      y += 6;
    });
    y += 6;

    // Summary
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Overall Performance Summary', 14, y);
    y += 8;

    doc.autoTable({
      startY: y,
      head: [['Total Quizzes', 'Questions Attempted', 'Correct Answers', 'Overall Average']],
      body: [[attempts.length, totalQ, totalCorrect, overallAvg + '%']],
      theme: 'grid',
      headStyles: { fillColor: [30, 64, 175] },
      margin: { left: 14, right: 14 }
    });
    y = doc.lastAutoTable.finalY + 10;

    // Category-wise
    if (Object.keys(byCategory).length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(30, 64, 175);
      doc.setFont('helvetica', 'bold');
      doc.text('3. Subject / Category-wise Performance', 14, y);
      y += 6;

      const catRows = Object.entries(byCategory).map(([cat, d]) => [
        cat, d.attempts, d.total, d.correct,
        (d.total ? Math.round((d.correct / d.total) * 100) : 0) + '%'
      ]);

      doc.autoTable({
        startY: y,
        head: [['Category', 'Quizzes', 'Questions', 'Correct', 'Accuracy']],
        body: catRows,
        theme: 'grid',
        headStyles: { fillColor: [30, 64, 175] },
        margin: { left: 14, right: 14 }
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    // Attempt Log
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.setFont('helvetica', 'bold');
    doc.text('4. Detailed Quiz Attempt Log', 14, y);
    y += 6;

    if (attempts.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('No quiz attempts recorded.', 14, y);
    } else {
      const rows = attempts.map((a, i) => [
        i + 1,
        `${a.date || ''} ${a.time || ''}`,
        a.category || '—',
        a.session || '—',
        `${a.correct}/${a.total}`,
        a.percentage + '%',
        a.durationSec ? `${Math.floor(a.durationSec/60)}m ${a.durationSec%60}s` : '—'
      ]);

      doc.autoTable({
        startY: y,
        head: [['#', 'Date & Time', 'Category', 'Session', 'Score', '%', 'Duration']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [30, 64, 175], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 }
      });
    }

    const safeName = (user.name || user.email).replace(/[^a-z0-9]/gi, '_');
    this.finalize(doc, `Student_Report_${safeName}.pdf`, purpose);
  },

  /**
   * Question Bank Export PDF
   */
  exportQuestionBank(questions, filters = {}) {
    const { category, session, difficulty } = filters;

    let titleParts = [];
    if (category) titleParts.push(category);
    if (session) titleParts.push(session);
    if (difficulty && difficulty !== 'All') titleParts.push(`(${difficulty} Questions)`);
    if (titleParts.length === 0) titleParts.push('Full Question Bank');

    const purpose = titleParts.join(' – ') + ' – Question Bank';
    const doc = this.create(purpose);

    let y = 28;

    doc.setFontSize(16);
    doc.setTextColor(30, 64, 175);
    doc.setFont('helvetica', 'bold');
    doc.text('Question Bank Export', 105, y, { align: 'center' });
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.setFont('helvetica', 'normal');
    doc.text(purpose, 105, y, { align: 'center' });
    y += 6;
    doc.text(`Total Questions: ${questions.length}  |  Generated: ${new Date().toLocaleString('en-IN')}`, 105, y, { align: 'center' });
    y += 12;

    if (questions.length === 0) {
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text('No questions match the selected filters.', 105, y, { align: 'center' });
      this.finalize(doc, 'Question_Bank_Empty.pdf', purpose);
      return;
    }

    questions.forEach((q, idx) => {
      // Check if we need a new page
      if (y > 250) {
        doc.addPage();
        y = 28;
      }

      // Question header
      doc.setFontSize(10);
      doc.setTextColor(30, 64, 175);
      doc.setFont('helvetica', 'bold');
      doc.text(`Q${q.qNo}. [${q.difficulty}] ${q.category} | ${q.relevantSession || ''}`, 14, y);
      y += 6;

      // Question text
      doc.setFontSize(10);
      doc.setTextColor(30);
      doc.setFont('helvetica', 'normal');
      const qLines = doc.splitTextToSize(q.question, 180);
      doc.text(qLines, 14, y);
      y += qLines.length * 5 + 3;

      // Options
      ['A', 'B', 'C', 'D'].forEach(letter => {
        const opt = q[`option${letter}`];
        const isCorrect = q.rightAnswer === letter;
        doc.setFont('helvetica', isCorrect ? 'bold' : 'normal');
        doc.setTextColor(isCorrect ? 22 : 40, isCorrect ? 163 : 40, isCorrect ? 74 : 40);
        const optLines = doc.splitTextToSize(`${letter}. ${opt}`, 175);
        doc.text(optLines, 18, y);
        y += optLines.length * 4.5 + 1;
      });

      // Answer + Explanation
      doc.setFontSize(9);
      doc.setTextColor(30, 64, 175);
      doc.setFont('helvetica', 'bold');
      doc.text(`Answer: ${q.rightAnswer}`, 14, y);
      y += 5;

      if (q.explanation) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80);
        const expLines = doc.splitTextToSize(`Explanation: ${q.explanation}`, 180);
        doc.text(expLines, 14, y);
        y += expLines.length * 4.5 + 2;
      }

      // Separator
      doc.setDrawColor(220);
      doc.line(14, y, 196, y);
      y += 8;
    });

    const fname = `QuestionBank_${(category || 'All').replace(/\s+/g, '_')}_${(difficulty || 'All')}.pdf`;
    this.finalize(doc, fname, purpose);
  },

  /**
   * General Attempts Report PDF
   */
  exportAttemptsReport(attempts, filterLabel = 'All Attempts') {
    const purpose = `Attempts Report – ${filterLabel}`;
    const doc = this.create(purpose);

    let y = 28;
    doc.setFontSize(16);
    doc.setTextColor(30, 64, 175);
    doc.setFont('helvetica', 'bold');
    doc.text('Quiz Attempts Report', 105, y, { align: 'center' });
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.setFont('helvetica', 'normal');
    doc.text(`${filterLabel}  |  Total: ${attempts.length}  |  ${new Date().toLocaleString('en-IN')}`, 105, y, { align: 'center' });
    y += 12;

    if (attempts.length === 0) {
      doc.text('No attempts found.', 105, y, { align: 'center' });
    } else {
      const rows = attempts.map(a => [
        a.email,
        `${a.date || ''} ${a.time || ''}`,
        a.category || '—',
        a.session || '—',
        `${a.correct}/${a.total}`,
        a.percentage + '%'
      ]);

      doc.autoTable({
        startY: y,
        head: [['Student', 'Date & Time', 'Category', 'Session', 'Score', '%']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [30, 64, 175], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 }
      });
    }

    this.finalize(doc, `Attempts_Report_${Date.now()}.pdf`, purpose);
  }
};

window.PDF = PDF;
