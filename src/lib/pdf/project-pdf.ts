// ALOKHANDWALA - Professional Project PDF Generator
// Generates official Confirmation PDF and Installation Certificate PDF

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Project, Customer, Site } from '@/lib/schema';
import { formatDate } from '@/lib/formatters';
import { OFFICIAL_TERMS_AND_CONDITIONS, BusinessTerm } from '@/lib/constants/terms-and-conditions';

export type ProjectWithRelations = Project & {
  customer?: Customer;
  site?: Site;
};

// Company Constants
const COMPANY = {
  name: 'ALOKHANDWALA',
  division: 'Scaffolding & Heavy Shoring Solutions Division',
  office: '4th Floor, Office No. 401 Sapphire Square Tower, Square Indore, MP, India',
  yard: 'Taloja Central Scaffolding Yard, Navi Mumbai / Maharashtra',
  phone: '+91 8818852722',
  email: 'alokhandwala.sh@gmail.com',
  gstin: '23AABCA1234F1Z5',
  pan: 'AABCA1234F',
};

// Premium Corporate Color Palette
const COLORS = {
  primary: [36, 22, 12] as [number, number, number],        // Deep Corporate Brown #24160c
  secondary: [89, 55, 29] as [number, number, number],      // Warm Brown #59371d
  accent: [199, 158, 124] as [number, number, number],      // Golden Tan #c79e7c
  accentLight: [245, 240, 232] as [number, number, number], // Warm Sand
  tableHeader: [36, 22, 12] as [number, number, number],    // Dark Brown Header
  tableAlt: [253, 250, 245] as [number, number, number],    // Cream Alternate Row
  cardBg: [252, 251, 249] as [number, number, number],      // Cream Card Background
  cardHeaderBg: [244, 238, 230] as [number, number, number],// Light Golden-Cream Header
  cardBorder: [226, 218, 206] as [number, number, number],  // Warm Border
  textDark: [30, 41, 59] as [number, number, number],       // Slate 800
  textMuted: [100, 116, 139] as [number, number, number],   // Slate 500
  success: [22, 101, 52] as [number, number, number],       // Emerald 700
  successBg: [240, 253, 244] as [number, number, number],   // Emerald 50
  successBorder: [187, 247, 208] as [number, number, number],// Emerald 200
  warning: [180, 83, 9] as [number, number, number],        // Amber 700
};

// Helper: Format currency in Indian Rupees
function formatINR(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return 'Rs. 0.00';
  return `Rs. ${new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

// Helper: Convert image URL or path to Base64 safely (Supports Browser & Node.js environments)
async function loadImageAsBase64(url?: string | null): Promise<string | null> {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:image/')) return trimmed;

  // Node.js test environment: attempt to load from local public/ directory
  if (typeof window === 'undefined') {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const cleanRelative = trimmed.replace(/^\//, '');
      const localFilePath = path.join(process.cwd(), 'public', cleanRelative);
      if (fs.existsSync(localFilePath)) {
        const buffer = fs.readFileSync(localFilePath);
        const ext = path.extname(localFilePath).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
        return `data:${mime};base64,${buffer.toString('base64')}`;
      }
    } catch {
      // Fallback
    }
  }

  // Browser environment
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(trimmed);
      if (res.ok) {
        const blob = await res.blob();
        return new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
            } else {
              resolve(null);
            }
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      }
    } catch {
      // fetch failed, try HTML Image element fallback
    }

    try {
      return new Promise<string | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width || 400;
            canvas.height = img.naturalHeight || img.height || 300;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(null);
              return;
            }
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = trimmed;
      });
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Draws the master corporate letterhead and document title on the PDF
 * Returns the Y coordinate where the next content block should begin.
 */
async function drawCorporateHeader(
  doc: jsPDF,
  logoBase64: string | null,
  documentTitle: string,
  badgeText: string,
  docNumber: string,
  docDate: string
): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Top Accent Stripes (Deep Corporate Brown + Golden Tan)
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 4.5, 'F');
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 4.5, pageWidth, 1.2, 'F');

  const headerStartY = 10;

  // Left: Corporate Brand & Details
  if (logoBase64) {
    try {
      // 32mm width x 16mm height preserves the 2:1 ratio of the official ALOKHANDWALA logo
      doc.addImage(logoBase64, 'PNG', 14, headerStartY, 32, 16, undefined, 'FAST');
    } catch {
      // Fallback if image rendering fails
      renderLogoFallback(doc, 14, headerStartY);
    }
  } else {
    renderLogoFallback(doc, 14, headerStartY);
  }

  // Company Contact & Identification (Positioned at X=50 to give logo full clearance)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.primary);
  doc.text('ALOKHANDWALA', 50, headerStartY + 3.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.secondary);
  doc.text(COMPANY.division.toUpperCase(), 50, headerStartY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...COLORS.textMuted);
  doc.text(COMPANY.office, 50, headerStartY + 10.5);
  doc.text(`Yard: ${COMPANY.yard}  |  Ph: ${COMPANY.phone}  |  ${COMPANY.email}`, 50, headerStartY + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.secondary);
  doc.text(`GSTIN: ${COMPANY.gstin}   |   PAN: ${COMPANY.pan}`, 50, headerStartY + 17.5);

  // Right: Document Badge & Reference Numbers
  const badgeWidth = 62;
  const badgeX = pageWidth - 14 - badgeWidth;

  // Status Badge Capsule
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(badgeX, headerStartY, badgeWidth, 6, 1.2, 1.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(badgeText.toUpperCase(), badgeX + badgeWidth / 2, headerStartY + 4.2, { align: 'center' });

  // Document Reference Number
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...COLORS.primary);
  doc.text(docNumber, pageWidth - 14, headerStartY + 12.5, { align: 'right' });

  // Document Issue Date
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.textMuted);
  doc.text(`Date of Issue: ${docDate}`, pageWidth - 14, headerStartY + 16.5, { align: 'right' });

  // Full-Width Separator Line
  const dividerY = headerStartY + 19.5;
  doc.setDrawColor(...COLORS.cardBorder);
  doc.setLineWidth(0.4);
  doc.line(14, dividerY, pageWidth - 14, dividerY);

  // Document Title Banner Strip
  const titleBannerY = dividerY + 3;
  const bannerHeight = 8;
  doc.setFillColor(...COLORS.accentLight);
  doc.roundedRect(14, titleBannerY, pageWidth - 28, bannerHeight, 1.2, 1.2, 'F');

  // Left golden accent indicator on title banner
  doc.setFillColor(...COLORS.accent);
  doc.roundedRect(14, titleBannerY, 3, bannerHeight, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.primary);
  doc.text(documentTitle, 20, titleBannerY + 5.5);

  return titleBannerY + bannerHeight + 4;
}

/**
 * Fallback corporate monogram when logo image file is unavailable
 */
function renderLogoFallback(doc: jsPDF, x: number, y: number) {
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(x, y, 14, 14, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('AW', x + 3.5, y + 9.5);
}

/**
 * Draws Two-Column Customer & Site Information Card
 * Accurately calculates line spacing and wraps strings to prevent overlap
 */
function drawPartyDetailsCard(
  doc: jsPDF,
  startY: number,
  project: ProjectWithRelations
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const cardWidth = (pageWidth - 28 - 6) / 2; // 88mm each
  const leftX = 14;
  const rightX = leftX + cardWidth + 6;
  const cardHeight = 40;

  // --- 1. Customer Card (Left) ---
  doc.setFillColor(...COLORS.cardBg);
  doc.setDrawColor(...COLORS.cardBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(leftX, startY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

  // Card Header Band
  doc.setFillColor(...COLORS.cardHeaderBg);
  doc.roundedRect(leftX, startY, cardWidth, 6, 1.5, 1.5, 'F');
  doc.setDrawColor(...COLORS.cardBorder);
  doc.line(leftX, startY + 6, leftX + cardWidth, startY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.secondary);
  doc.text('CUSTOMER / CLIENT INFORMATION', leftX + 4, startY + 4.2);

  // Customer Name (Wrapped if long)
  const custName = project.customer?.companyName || project.customerName || 'N/A';
  const splitCustName = doc.splitTextToSize(custName, cardWidth - 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.textDark);
  doc.text(splitCustName[0], leftX + 4, startY + 10.5);

  // Customer Contact Person & Phone
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...COLORS.textMuted);
  const contactPerson = project.customer?.contactPerson || 'Authorized Representative';
  const phone = project.customer?.phone || 'N/A';
  doc.text(`Contact: ${contactPerson}  |  ${phone}`, leftX + 4, startY + 15);

  // Email
  const email = project.customer?.email || 'N/A';
  doc.text(`Email: ${email}`, leftX + 4, startY + 19);

  // Billing Address (Auto-wrapped, 2 lines max)
  const rawAddress = project.customer?.billingAddress || project.siteAddress || 'N/A';
  const splitAddress = doc.splitTextToSize(`Address: ${rawAddress}`, cardWidth - 8);
  doc.text(splitAddress.slice(0, 2), leftX + 4, startY + 23);

  // Bottom Border Line inside card
  doc.setDrawColor(...COLORS.cardBorder);
  doc.setLineWidth(0.2);
  doc.line(leftX + 4, startY + 31.5, leftX + cardWidth - 4, startY + 31.5);

  // GSTIN & Customer Code
  const gstin = project.customer?.gstin ? `GSTIN: ${project.customer.gstin}` : 'GSTIN: Unregistered / N/A';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.primary);
  doc.text(gstin, leftX + 4, startY + 36.5);

  if (project.customer?.customerCode) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(project.customer.customerCode, leftX + cardWidth - 4, startY + 36.5, { align: 'right' });
  }

  // --- 2. Site Details Card (Right) ---
  doc.setFillColor(...COLORS.cardBg);
  doc.setDrawColor(...COLORS.cardBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(rightX, startY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

  // Card Header Band
  doc.setFillColor(...COLORS.cardHeaderBg);
  doc.roundedRect(rightX, startY, cardWidth, 6, 1.5, 1.5, 'F');
  doc.setDrawColor(...COLORS.cardBorder);
  doc.line(rightX, startY + 6, rightX + cardWidth, startY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.secondary);
  doc.text('PROJECT SITE & EXECUTION LOCATION', rightX + 4, startY + 4.2);

  // Site Name
  const siteName = project.siteName || 'Project Execution Site';
  const splitSiteName = doc.splitTextToSize(siteName, cardWidth - 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.textDark);
  doc.text(splitSiteName[0], rightX + 4, startY + 10.5);

  // Site Address (Wrapped, 2 lines)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...COLORS.textMuted);
  const siteAddress = project.siteAddress || 'Site Location';
  const splitSiteAddr = doc.splitTextToSize(`Location: ${siteAddress}`, cardWidth - 8);
  doc.text(splitSiteAddr.slice(0, 2), rightX + 4, startY + 15);

  // Assigned Supervisor
  const supervisor = project.supervisorName || 'Mustafa Alokhandwala';
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.textDark);
  doc.text(`Assigned Supervisor: `, rightX + 4, startY + 23);
  doc.setFont('helvetica', 'bold');
  doc.text(supervisor, rightX + 33, startY + 23);

  // Landmark / Referral
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.textMuted);
  const referral = project.referralName ? `Referral: ${project.referralName}` : (project.site?.landmark ? `Landmark: ${project.site.landmark}` : `Site ID: ${project.siteId || 'N/A'}`);
  doc.text(referral, rightX + 4, startY + 27);

  // Bottom Border Line inside card
  doc.setDrawColor(...COLORS.cardBorder);
  doc.setLineWidth(0.2);
  doc.line(rightX + 4, startY + 31.5, rightX + cardWidth - 4, startY + 31.5);

  // Project Code
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.primary);
  doc.text(`Project Code: ${project.projectCode}`, rightX + 4, startY + 36.5);

  if (project.site?.siteCode) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(project.site.siteCode, rightX + cardWidth - 4, startY + 36.5, { align: 'right' });
  }

  return startY + cardHeight + 4.5;
}

/**
 * Draws Document Running Footers and Page Numbers on all pages
 */
function applyFooters(doc: jsPDF, docCode: string, docType: string) {
  const totalPages = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Subtle bottom border line
    doc.setDrawColor(...COLORS.cardBorder);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 11, pageWidth - 14, pageHeight - 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...COLORS.textMuted);

    const leftText = `ALOKHANDWALA ERP  •  ${docType}  •  Ref: ${docCode}  •  Official Record`;
    doc.text(leftText, 14, pageHeight - 7);

    const rightText = `Page ${i} of ${totalPages}`;
    doc.text(rightText, pageWidth - 14, pageHeight - 7, { align: 'right' });
  }
}

/**
 * -----------------------------------------------------------------------------
 * 1. GENERATE PROJECT CONFIRMATION PDF
 * -----------------------------------------------------------------------------
 */
export async function generateConfirmationPdf(project: ProjectWithRelations): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const logoBase64 = await loadImageAsBase64('/logo.png');

  const confDate = formatDate(project.quotationDate || project.updatedAt || project.createdAt);
  let currentY = await drawCorporateHeader(
    doc,
    logoBase64,
    'PROJECT CONFIRMATION & MATERIAL RESERVATION RECORD',
    'Official Project Confirmation',
    `CONF-${project.projectCode}`,
    confDate
  );

  // Party Details Card
  currentY = drawPartyDetailsCard(doc, currentY, project);

  // Specifications Banner (Aligned 2-Column Grid)
  const specBannerHeight = 18;
  doc.setFillColor(...COLORS.cardBg);
  doc.setDrawColor(...COLORS.cardBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, currentY, pageWidth - 28, specBannerHeight, 1.5, 1.5, 'FD');

  // Banner Header Strip
  doc.setFillColor(...COLORS.cardHeaderBg);
  doc.roundedRect(14, currentY, pageWidth - 28, 5.5, 1.5, 1.5, 'F');
  doc.setDrawColor(...COLORS.cardBorder);
  doc.line(14, currentY + 5.5, pageWidth - 14, currentY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.secondary);
  doc.text('PROJECT SPECIFICATIONS & SCOPE OF RESERVATION', 18, currentY + 4);

  const dims = project.siteDimensions || project.measurements || { length: 0, width: 0, height: 0, unit: 'METERS' };
  const dimText = `${dims.length || 0}m (L) × ${dims.width || 0}m (W) × ${dims.height || 0}m (H)`;
  const scafType = project.siteDimensions?.configurationType 
    ? project.siteDimensions.configurationType.replace(/_/g, ' ')
    : (project.measurements?.measurementType ? project.measurements.measurementType.replace(/_/g, ' ') : 'Cup-Lock Façade Scaffold');

  // Left Column Specifications
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Quotation Ref:', 18, currentY + 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.textDark);
  doc.text(`${project.quotationNumber || 'N/A'} (Dated: ${formatDate(project.quotationDate)})`, 46, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Planned Installation:', 18, currentY + 14.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.textDark);
  doc.text(`${formatDate(project.plannedInstallationDate)}`, 46, currentY + 14.5);

  // Right Column Specifications
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Site Dimensions:', 108, currentY + 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.textDark);
  doc.text(dimText, 136, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Scaffolding System:', 108, currentY + 14.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.textDark);
  doc.text(scafType, 136, currentY + 14.5);

  currentY += specBannerHeight + 4.5;

  // Material Requirements Table
  const materials = project.materials || [];
  const tableRows = materials.map((m, index) => {
    const qty = m.reservedQuantity || m.requiredQuantity || 0;
    const rate = m.monthlyRentalRate || 0;
    const total = qty * rate;
    return [
      (index + 1).toString(),
      m.itemCode || '-',
      m.materialName || 'Scaffolding Component',
      m.unit || 'Nos',
      qty.toLocaleString('en-IN'),
      formatINR(rate),
      formatINR(total),
    ];
  });

  const totalMonthlyRental = materials.reduce((acc, m) => {
    const q = m.reservedQuantity || m.requiredQuantity || 0;
    return acc + (q * (m.monthlyRentalRate || 0));
  }, 0);

  autoTable(doc, {
    startY: currentY,
    margin: { left: 14, right: 14, top: 20, bottom: 20 },
    showHead: 'everyPage',
    showFoot: 'lastPage',
    pageBreak: 'auto',
    head: [['#', 'Item Code', 'Component Description', 'Unit', 'Reserved Qty', 'Monthly Rate', 'Monthly Total']],
    body: tableRows.length > 0 ? tableRows : [['-', '-', 'Standard Cup-Lock System Scaffolding Lot', 'Lot', '1', formatINR(project.monthlyRentalRate), formatINR(project.monthlyRentalRate)]],
    foot: [[
      '',
      '',
      'Total Confirmed Materials',
      '',
      materials.reduce((acc, m) => acc + (m.reservedQuantity || m.requiredQuantity || 0), 0).toLocaleString('en-IN'),
      '',
      formatINR(totalMonthlyRental || project.monthlyRentalRate || 0)
    ]],
    headStyles: {
      fillColor: COLORS.tableHeader,
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 2.2,
    },
    footStyles: {
      fillColor: COLORS.cardHeaderBg,
      textColor: COLORS.primary,
      fontSize: 7.5,
      fontStyle: 'bold',
      cellPadding: 2.2,
    },
    styles: {
      fontSize: 7.2,
      cellPadding: 2.0,
      textColor: COLORS.textDark,
      lineColor: COLORS.cardBorder,
      lineWidth: 0.2,
    },
    alternateRowStyles: {
      fillColor: COLORS.tableAlt,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { fontStyle: 'bold', cellWidth: 26 },
      2: { cellWidth: 'auto' }, // automatically expands to fill remainder of 182mm
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'right', cellWidth: 24, fontStyle: 'bold' },
      5: { halign: 'right', cellWidth: 28 },
      6: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // Space check: Commercial Breakdown (44mm) + Signatures (32mm) + Spacing (5mm) = 81mm
  // If remaining space on the page is less than 82mm (i.e. currentY > 188mm), break to a clean new page
  if (currentY + 82 > 270) {
    doc.addPage();
    currentY = 20;
  }

  // Commercial Breakdown & Billing Terms (Side-by-Side Cards)
  const blockWidth = (pageWidth - 28 - 6) / 2; // 88mm
  const cardHeight = 48;

  // Left: Financial Breakdown Card
  doc.setFillColor(...COLORS.cardBg);
  doc.setDrawColor(...COLORS.cardBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, currentY, blockWidth, cardHeight, 1.5, 1.5, 'FD');

  doc.setFillColor(...COLORS.cardHeaderBg);
  doc.roundedRect(14, currentY, blockWidth, 5.5, 1.5, 1.5, 'F');
  doc.setDrawColor(...COLORS.cardBorder);
  doc.line(14, currentY + 5.5, 14 + blockWidth, currentY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.secondary);
  doc.text('COMMERCIAL & BILLING BREAKDOWN', 18, currentY + 4);

  const advanceReq = (project.agreedProjectPrice || 0) * 0.75;
  const balanceDue = (project.agreedProjectPrice || 0) * 0.25;

  const charges = [
    { label: 'Monthly Rental Rate:', value: formatINR(project.monthlyRentalRate) },
    { label: 'Rental Duration (28 Days / Month):', value: `${project.durationMonths || 1} Period(s) [28 Days]` },
    { label: '75% Advance (Pre-Installation):', value: formatINR(advanceReq) },
    { label: '25% Balance (Post-Installation):', value: formatINR(balanceDue) },
    { label: 'Refundable Security Deposit:', value: formatINR(project.depositAmount) },
    { label: '2-Way Transportation (To & Fro):', value: formatINR(project.transportCharges) },
    { label: 'Installation & Erection Labour:', value: formatINR(project.installationLabourCharges) },
    { label: `Applicable GST (${project.gstPercentage || 18}%):`, value: formatINR((project.agreedProjectPrice || 0) * ((project.gstPercentage || 18) / 100)) },
  ];

  let chargeY = currentY + 9.5;
  doc.setFontSize(6.8);
  for (const c of charges) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.textMuted);
    doc.text(c.label, 18, chargeY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.textDark);
    doc.text(c.value, 14 + blockWidth - 4, chargeY, { align: 'right' });
    chargeY += 3.8;
  }

  // Highlight Total Value Box
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(18, currentY + 41, blockWidth - 8, 5.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL AGREED VALUE:', 21, currentY + 44.7);
  doc.text(formatINR(project.agreedProjectPrice), 14 + blockWidth - 7, currentY + 44.7, { align: 'right' });

  // Right: Key Commercial Rules Summary Card
  const rightX = 14 + blockWidth + 6;
  doc.setFillColor(...COLORS.cardBg);
  doc.setDrawColor(...COLORS.cardBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(rightX, currentY, blockWidth, cardHeight, 1.5, 1.5, 'FD');

  doc.setFillColor(...COLORS.cardHeaderBg);
  doc.roundedRect(rightX, currentY, blockWidth, 5.5, 1.5, 1.5, 'F');
  doc.setDrawColor(...COLORS.cardBorder);
  doc.line(rightX, currentY + 5.5, rightX + blockWidth, currentY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.secondary);
  doc.text('KEY COMMERCIAL POLICIES', rightX + 4, currentY + 4);

  const policyItems = [
    { label: 'Pricing Basis:', desc: 'Calculated on per-sq.-ft. surface area basis.' },
    { label: 'Rental Period:', desc: '28 days per cycle. 1 extra day incurs full month.' },
    { label: 'Payment Terms:', desc: '75% advance before installation, 25% post-install.' },
    { label: 'Walkway Jali:', desc: '1 included per unit; extra charged at Rs. 200/pc.' },
    { label: 'Shifting Charges:', desc: 'Rs. 6 per sq. ft. or 60% per unit amount.' },
    { label: 'Cancellation:', desc: 'Confirmed orders cannot be cancelled.' },
  ];

  let polY = currentY + 9.5;
  for (const pol of policyItems) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...COLORS.primary);
    doc.text(pol.label, rightX + 4, polY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.textDark);
    doc.text(pol.desc, rightX + 27, polY);
    polY += 5.2;
  }

  currentY += cardHeight + 5;

  // --- Site Inspection & Customer Premises Photographs ---
  const confirmationPhotos = await loadAndPreparePhotos(project.photos || [], 'CONFIRMATION');
  currentY = drawPhotoSection(
    doc,
    currentY,
    pageWidth,
    'SITE INSPECTION & CUSTOMER PREMISES PHOTOGRAPHS',
    'No site inspection images uploaded for this project.',
    confirmationPhotos,
    'Site Photo'
  );

  // --- Official Business Terms & Conditions (All 11 Clauses) ---
  // Ensure the 11 legal terms start on a clean, dedicated section or page
  if (currentY + 110 > 270) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFillColor(...COLORS.cardHeaderBg);
  doc.roundedRect(14, currentY, pageWidth - 28, 6.5, 1.2, 1.2, 'F');
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(0.4);
  doc.line(14, currentY + 6.5, pageWidth - 14, currentY + 6.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.primary);
  doc.text('OFFICIAL BUSINESS TERMS & CONDITIONS (CONTRACTUAL CLAUSES 1 TO 11)', 18, currentY + 4.5);

  currentY += 10;

  // Retrieve project-specific snapshot or standard terms
  const termsList: BusinessTerm[] = project.termsSnapshot || OFFICIAL_TERMS_AND_CONDITIONS;

  for (let idx = 0; idx < termsList.length; idx++) {
    const t = termsList[idx];
    const prefix = `${t.id || (idx + 1)}. ${t.title}: `;
    const fullClause = `${prefix}${t.fullText}`;

    // Split clause across card width
    const splitClause = doc.splitTextToSize(fullClause, pageWidth - 28 - 12);
    const clauseHeight = splitClause.length * 3.4 + 2;

    if (currentY + clauseHeight > 268) {
      doc.addPage();
      currentY = 20;
    }

    // Number Bullet
    doc.setFillColor(...COLORS.primary);
    doc.roundedRect(14, currentY - 0.5, 4.5, 4.5, 0.8, 0.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`${t.id || (idx + 1)}`, 16.25, currentY + 2.8, { align: 'center' });

    // Heading + Full Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.primary);
    doc.text(`${t.title}: `, 21, currentY + 3);

    const titleWidth = doc.getTextWidth(`${t.title}: `);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...COLORS.textDark);

    // Print text wrapping neatly
    const remainingText = doc.splitTextToSize(t.fullText, pageWidth - 28 - 7 - titleWidth);
    doc.text(remainingText[0] || '', 21 + titleWidth, currentY + 3);

    if (remainingText.length > 1) {
      const restLines = doc.splitTextToSize(
        t.fullText.substring((remainingText[0] || '').length).trim(),
        pageWidth - 28 - 7
      );
      doc.text(restLines, 21, currentY + 6.5);
      currentY += (restLines.length * 3.4);
    }

    currentY += 5.5;
  }

  currentY += 3;

  // Authorization & Signatures (Clean, Professional Bordered Cards)
  if (currentY + 34 > 270) {
    doc.addPage();
    currentY = 20;
  }

  const sigHeight = 30;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...COLORS.cardBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, currentY, blockWidth, sigHeight, 1.5, 1.5, 'FD');
  doc.roundedRect(rightX, currentY, blockWidth, sigHeight, 1.5, 1.5, 'FD');

  // Customer Signature Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...COLORS.secondary);
  doc.text('CUSTOMER ACCEPTANCE & AUTHORIZATION', 18, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Accepted all 11 Terms & Conditions, agreed quantities & rates:', 18, currentY + 9);

  doc.setDrawColor(...COLORS.cardBorder);
  doc.line(18, currentY + 22, 14 + blockWidth - 8, currentY + 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text('Authorized Signatory & Seal (With Date)', 18, currentY + 26);

  // ALOKHANDWALA Signature Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...COLORS.secondary);
  doc.text('FOR ALOKHANDWALA (AUTHORIZED SIGNATORY)', rightX + 4, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Commercial Division & Central Yard Operations:', rightX + 4, currentY + 9);

  doc.setDrawColor(...COLORS.cardBorder);
  doc.line(rightX + 4, currentY + 22, rightX + blockWidth - 8, currentY + 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text('Authorized Officer Signature & Company Stamp', rightX + 4, currentY + 26);

  // Apply Document Running Footers across all pages
  applyFooters(doc, project.projectCode, 'Project Confirmation');

  // Direct download to user device
  doc.save(`${project.projectCode}-Confirmation.pdf`);
}

/**
 * -----------------------------------------------------------------------------
 * 2. GENERATE PROJECT INSTALLATION CERTIFICATE PDF
 * -----------------------------------------------------------------------------
 */
export async function generateInstallationPdf(project: ProjectWithRelations): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const logoBase64 = await loadImageAsBase64('/logo.png');

  const installDate = formatDate(project.actualInstallationDate || project.rentalStartDate || project.updatedAt);
  let currentY = await drawCorporateHeader(
    doc,
    logoBase64,
    'SCAFFOLDING INSTALLATION & HANDOVER CERTIFICATE',
    'Installation Handover',
    `INST-${project.projectCode}`,
    installDate
  );

  // Party Details Card
  currentY = drawPartyDetailsCard(doc, currentY, project);

  // Installation Supervision & Crew Info Banner (Aligned 2-Column Card)
  const bannerHeight = 24;
  doc.setFillColor(...COLORS.cardBg);
  doc.setDrawColor(...COLORS.cardBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, currentY, pageWidth - 28, bannerHeight, 1.5, 1.5, 'FD');

  doc.setFillColor(...COLORS.cardHeaderBg);
  doc.roundedRect(14, currentY, pageWidth - 28, 5.5, 1.5, 1.5, 'F');
  doc.setDrawColor(...COLORS.cardBorder);
  doc.line(14, currentY + 5.5, pageWidth - 14, currentY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.secondary);
  doc.text('SITE EXECUTION & SUPERVISORY RECORD', 18, currentY + 4);

  const supervisorAssigned = project.installationSupervisor?.assignedSupervisorName || project.supervisorName || 'Mustafa Alokhandwala';
  const supervisorExecuting = project.installationSupervisor?.executingSupervisorName || supervisorAssigned;
  const isSubstitute = project.installationSupervisor && !project.installationSupervisor.isSameSupervisor;

  // Left Column: Supervision Record
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Assigned Supervisor:', 18, currentY + 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.textDark);
  doc.text(supervisorAssigned, 48, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Executing Supervisor:', 18, currentY + 14.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.textDark);
  doc.text(supervisorExecuting + (isSubstitute ? ' (Substitute)' : ' (Lead)'), 48, currentY + 14.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Active Rental Period:', 18, currentY + 19);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.success);
  doc.text(`${formatDate(project.rentalStartDate)} to ${formatDate(project.rentalEndDate)}`, 48, currentY + 19);

  // Right Column: Erection Crew Summary
  const workers = project.installationWorkers || [];
  const crewText = workers.length > 0 
    ? workers.map(w => `${w.name} (${w.role || 'Scaffolder'})`).join(', ')
    : 'Certified Riggers & Erections Crew';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...COLORS.secondary);
  doc.text('Erection Crew & Certified Riggers:', 108, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.textDark);
  const splitCrew = doc.splitTextToSize(crewText, pageWidth - 14 - 108 - 4);
  doc.text(splitCrew.slice(0, 3), 108, currentY + 14);

  currentY += bannerHeight + 4.5;

  // Dimensional Verification (Confirmed vs Actual Installed)
  const dimBannerHeight = 18;
  doc.setFillColor(...COLORS.cardBg);
  doc.setDrawColor(...COLORS.cardBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, currentY, pageWidth - 28, dimBannerHeight, 1.5, 1.5, 'FD');

  doc.setFillColor(...COLORS.cardHeaderBg);
  doc.roundedRect(14, currentY, pageWidth - 28, 5.5, 1.5, 1.5, 'F');
  doc.setDrawColor(...COLORS.cardBorder);
  doc.line(14, currentY + 5.5, pageWidth - 14, currentY + 5.5);

  const confDims = project.siteDimensions || project.measurements || { length: 0, width: 0, height: 0 };
  const actDims = project.actualMeasurements || {
    length: confDims.length,
    width: confDims.width,
    height: confDims.height,
    isCorrect: true,
    variancePercentage: 0,
    remarks: 'Verified conforming to structural inspection',
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.secondary);
  doc.text('DIMENSIONAL COMPLIANCE & MEASUREMENT VERIFICATION', 18, currentY + 4);

  // Left Column
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Confirmed Dimensions:', 18, currentY + 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.textDark);
  doc.text(`${confDims.length || 0}m (L) × ${confDims.width || 0}m (W) × ${confDims.height || 0}m (H)`, 52, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Actual Installed:', 18, currentY + 14.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.textDark);
  doc.text(`${actDims.length || confDims.length || 0}m (L) × ${actDims.width || confDims.width || 0}m (W) × ${actDims.height || confDims.height || 0}m (H)`, 52, currentY + 14.5);

  // Right Column
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Verification Status:', 108, currentY + 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(actDims.isCorrect ? COLORS.success[0] : 180, actDims.isCorrect ? COLORS.success[1] : 40, actDims.isCorrect ? COLORS.success[2] : 40);
  doc.text(actDims.isCorrect ? 'Fully Compliant (0% Variance)' : `Variance: ${actDims.variancePercentage || 0}%`, 138, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Inspection Remarks:', 108, currentY + 14.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.textDark);
  const remarks = actDims.remarks || 'Installed per structural safety specifications';
  const splitRemarks = doc.splitTextToSize(remarks, pageWidth - 14 - 138 - 4);
  doc.text(splitRemarks[0], 138, currentY + 14.5);

  currentY += dimBannerHeight + 4.5;

  // Actual Installed Materials Table (Planned vs Installed Reconciliation)
  const materials = project.materials || [];
  const tableRows = materials.map((m, index) => {
    const planned = m.requiredQuantity || m.reservedQuantity || 0;
    const installed = m.installedQuantity || planned;
    const diff = installed - planned;
    const diffText = diff === 0 ? '0' : (diff > 0 ? `+${diff}` : `${diff}`);

    return [
      (index + 1).toString(),
      m.itemCode || '-',
      m.materialName || 'Component',
      m.unit || 'Nos',
      planned.toLocaleString('en-IN'),
      installed.toLocaleString('en-IN'),
      diffText,
      'Installed & Secured',
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: 14, right: 14, top: 20, bottom: 20 },
    showHead: 'everyPage',
    showFoot: 'lastPage',
    pageBreak: 'auto',
    head: [['#', 'Item Code', 'Scaffolding Component', 'Unit', 'Planned', 'Installed', 'Variance', 'Status']],
    body: tableRows.length > 0 ? tableRows : [['-', '-', 'Full Scaffolding System Erection', 'Lot', '1', '1', '0', 'Installed & Verified']],
    headStyles: {
      fillColor: COLORS.tableHeader,
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 2.2,
    },
    styles: {
      fontSize: 7.2,
      cellPadding: 2.0,
      textColor: COLORS.textDark,
      lineColor: COLORS.cardBorder,
      lineWidth: 0.2,
    },
    alternateRowStyles: {
      fillColor: COLORS.tableAlt,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { fontStyle: 'bold', cellWidth: 26 },
      2: { cellWidth: 'auto' }, // expands to fill remaining space
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'right', cellWidth: 18 },
      5: { halign: 'right', cellWidth: 18, fontStyle: 'bold' },
      6: { halign: 'center', cellWidth: 16 },
      7: { halign: 'center', cellWidth: 28, textColor: COLORS.success, fontStyle: 'bold' },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // Site Photographs (Proof of Installation)
  const installationPhotos = await loadAndPreparePhotos(project.photos || [], 'INSTALLATION');
  currentY = drawPhotoSection(
    doc,
    currentY,
    pageWidth,
    'SITE PHOTOGRAPHS & ERECTION EVIDENCE',
    'No installation images uploaded for this project.',
    installationPhotos,
    'Installation Photo'
  );

  // Check room for Handover Terms (26mm) + Safety Declaration (16mm) + Signatures (30mm) = 72mm
  if (currentY + 76 > 270) {
    doc.addPage();
    currentY = 20;
  }

  // Site Handover, Challan Approval & Custody Terms Card (Clauses 11, 9, 10, 2 & 8)
  const custodyHeight = 27;
  doc.setFillColor(...COLORS.cardBg);
  doc.setDrawColor(...COLORS.cardBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, currentY, pageWidth - 28, custodyHeight, 1.5, 1.5, 'FD');

  doc.setFillColor(...COLORS.cardHeaderBg);
  doc.roundedRect(14, currentY, pageWidth - 28, 5.5, 1.5, 1.5, 'F');
  doc.setDrawColor(...COLORS.cardBorder);
  doc.line(14, currentY + 5.5, pageWidth - 14, currentY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.secondary);
  doc.text('SITE HANDOVER, CHALLAN APPROVAL & MATERIAL RESPONSIBILITY TERMS', 18, currentY + 4);

  const handoverTerms = [
    { num: '11', title: 'Challan & Custody:', text: 'Customer must verify and approve the delivery challan of all materials supplied. Safekeeping of materials during rental is customer responsibility; uninstallation reconciled against approved delivery challan with shortage/damage charged at prevailing value.' },
    { num: '9', title: 'Damage / Loss:', text: 'Customer is liable for any damage, loss, or misplacement of scaffolding materials at prevailing replacement value on assessment date.' },
    { num: '10', title: 'Post-Install Visits:', text: 'Any site visits requested after completion of installation will be chargeable based on location and scope.' },
    { num: '2/8', title: '28-Day Cycle:', text: 'Rentals run on a 28-day cycle. Exceeding 28 days by even 1 day incurs applicable monthly charge, payable on next day after 28 days.' },
  ];

  let hY = currentY + 9;
  for (const ht of handoverTerms) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.primary);
    doc.text(`[${ht.num}] ${ht.title}`, 18, hY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(...COLORS.textDark);
    const splitHT = doc.splitTextToSize(ht.text, pageWidth - 28 - 42);
    doc.text(splitHT[0], 52, hY);
    hY += 4.2;
  }

  currentY += custodyHeight + 4.5;

  // Check room for Safety Declaration (16mm) + Signatures (30mm)
  if (currentY + 50 > 270) {
    doc.addPage();
    currentY = 20;
  }

  // Safety & Handover Statement Card
  const declHeight = 16;
  doc.setFillColor(...COLORS.successBg);
  doc.setDrawColor(...COLORS.successBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, currentY, pageWidth - 28, declHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.success);
  doc.text('STRUCTURAL SAFETY INSPECTION & HANDOVER DECLARATION', 18, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.textDark);
  const certText = 'This certifies that the scaffolding structure described above has been erected, plumbed, leveled, and tied in sound structural condition according to IS 2750/IS 4014 scaffolding standards. All cup-lock joints, base plates, and ledgers have been verified.';
  const splitCert = doc.splitTextToSize(certText, pageWidth - 28 - 8);
  doc.text(splitCert, 18, currentY + 9);

  currentY += declHeight + 5;

  // Dual Acceptance & Handover Signatures
  const sigWidth = (pageWidth - 28 - 6) / 2; // 88mm
  const rightSigX = 14 + sigWidth + 6;
  const sigBoxHeight = 30;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...COLORS.cardBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, currentY, sigWidth, sigBoxHeight, 1.5, 1.5, 'FD');
  doc.roundedRect(rightSigX, currentY, sigWidth, sigBoxHeight, 1.5, 1.5, 'FD');

  // Customer Site Acceptance Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...COLORS.secondary);
  doc.text('CUSTOMER SITE INSPECTION & ACCEPTANCE', 18, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('I confirm structural handover and acceptance of installed scaffolding:', 18, currentY + 9);

  doc.setDrawColor(...COLORS.cardBorder);
  doc.line(18, currentY + 22, 14 + sigWidth - 8, currentY + 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text('Client Site Engineer / Authorized Name, Signature & Stamp', 18, currentY + 26);

  // ALOKHANDWALA Site Supervisor Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...COLORS.secondary);
  doc.text('ALOKHANDWALA SUPERVISOR & ERECTION LEAD', rightSigX + 4, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...COLORS.textMuted);
  doc.text(`Inspected by: ${supervisorExecuting}`, rightSigX + 4, currentY + 9);

  doc.setDrawColor(...COLORS.cardBorder);
  doc.line(rightSigX + 4, currentY + 22, rightSigX + sigWidth - 8, currentY + 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text('Certified Site Supervisor Signature & Company Stamp', rightSigX + 4, currentY + 26);

  // Apply Document Running Footers across all pages
  applyFooters(doc, project.projectCode, 'Installation Handover Certificate');

  // Direct download to user device
  doc.save(`${project.projectCode}-Installation.pdf`);
}

interface ValidatedPdfPhoto {
  base64: string;
  format: 'JPEG' | 'PNG';
  label: string;
}

/**
 * Filters and validates photos specifically for Confirmation or Installation PDFs.
 * Enforces strict separation:
 * - CONFIRMATION: Includes only customer/site inspection photos. Never includes installation photos.
 * - INSTALLATION: Includes only actual installation photos. Never includes confirmation/site inspection photos.
 * Never inserts dummy, sample, or placeholder images.
 */
async function loadAndPreparePhotos(
  rawPhotos: any[],
  type: 'CONFIRMATION' | 'INSTALLATION'
): Promise<ValidatedPdfPhoto[]> {
  const isInstallTarget = type === 'INSTALLATION';
  const prepared: ValidatedPdfPhoto[] = [];

  for (const p of rawPhotos) {
    if (!p) continue;
    const url = typeof p === 'string' ? p : (p.fileUrl || p.url || '');
    if (!url || typeof url !== 'string' || !url.trim()) continue;

    const stage = String(p.stageLabel || '').toUpperCase();
    const entity = String(p.entityType || '').toUpperCase();
    const name = String(p.fileName || p.name || '').toLowerCase();
    const u = url.toLowerCase();

    const isInstallPhoto =
      stage === 'AFTER_INSTALLATION' ||
      entity === 'INSTALLATION' ||
      name.includes('installation') ||
      name.includes('after_install') ||
      name.includes('after-install') ||
      name.includes('installed') ||
      u.includes('installation') ||
      u.includes('after_install') ||
      u.includes('after-install');

    // Strict separation:
    // Confirmation PDF must NEVER include installation photos.
    // Installation PDF must NEVER include confirmation/site inspection photos.
    if (isInstallTarget !== isInstallPhoto) {
      continue;
    }

    const base64 = await loadImageAsBase64(url);
    if (!base64) {
      // Do not use dummy, sample, or placeholder images if URL fails to load
      continue;
    }

    const format: 'JPEG' | 'PNG' = base64.toLowerCase().startsWith('data:image/png') ? 'PNG' : 'JPEG';
    const rawFileName = (typeof p === 'object' && (p.fileName || p.name)) ? (p.fileName || p.name) : '';
    const fallbackLabel = isInstallTarget ? 'Handover Completion Record' : 'Site Inspection Record';
    const cleanLabel = rawFileName
      ? rawFileName.replace(/[_-]/g, ' ').replace(/\.[a-zA-Z0-9]+$/, '').trim()
      : fallbackLabel;

    prepared.push({
      base64,
      format,
      label: cleanLabel || fallbackLabel,
    });

    if (prepared.length >= 4) break; // Display top 4 photos for clean A4 layout
  }

  return prepared;
}

/**
 * Draws the professional photo evidence section on A4 PDF.
 * If no images are available, renders a clean, styled message box instead of dummy placeholders.
 */
function drawPhotoSection(
  doc: jsPDF,
  startY: number,
  pageWidth: number,
  title: string,
  emptyMessage: string,
  photos: ValidatedPdfPhoto[],
  prefix: string
): number {
  let y = startY;

  // Space check: Section Header (10mm) + Photo Row (50mm) or Empty Notice Banner (18mm)
  const neededSpace = photos.length > 0 ? 58 : 26;
  if (y + neededSpace > 270) {
    doc.addPage();
    y = 20;
  }

  // Section Header Banner
  doc.setFillColor(...COLORS.cardHeaderBg);
  doc.roundedRect(14, y, pageWidth - 28, 6.5, 1.2, 1.2, 'F');
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(0.4);
  doc.line(14, y + 6.5, pageWidth - 14, y + 6.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(...COLORS.primary);
  doc.text(title, 18, y + 4.5);

  y += 9.5;

  // If no photos uploaded or loaded, render a clear, professional fallback notice
  if (photos.length === 0) {
    doc.setFillColor(...COLORS.cardBg);
    doc.setDrawColor(...COLORS.cardBorder);
    doc.setLineWidth(0.3);
    doc.roundedRect(14, y, pageWidth - 28, 14, 1.2, 1.2, 'FD');

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(emptyMessage, pageWidth / 2, y + 8.5, { align: 'center' });

    return y + 18;
  }

  // Render photos in 2-column grid
  const colWidth = (pageWidth - 28 - 6) / 2; // 88mm
  const imageHeight = 40; // 40mm image area
  const captionHeight = 6; // 6mm caption strip
  const cardHeight = imageHeight + captionHeight; // 46mm total card height

  for (let i = 0; i < photos.length; i += 2) {
    if (y + cardHeight + 4 > 270) {
      doc.addPage();
      y = 20;
    }

    // Left photo
    const p1 = photos[i];
    renderSinglePhotoCard(doc, 14, y, colWidth, imageHeight, captionHeight, p1, `${prefix} ${i + 1}`);

    // Right photo (if available)
    if (i + 1 < photos.length) {
      const p2 = photos[i + 1];
      const p2X = 14 + colWidth + 6; // 108mm
      renderSinglePhotoCard(doc, p2X, y, colWidth, imageHeight, captionHeight, p2, `${prefix} ${i + 2}`);
    }

    y += cardHeight + 4.5;
  }

  return y;
}

/**
 * Draws an individual photo card with clean border, image area, and caption strip
 */
function renderSinglePhotoCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  imgH: number,
  capH: number,
  photo: ValidatedPdfPhoto,
  numberLabel: string
) {
  // Draw Image
  try {
    doc.addImage(photo.base64, photo.format, x, y, w, imgH, undefined, 'FAST');
  } catch {
    doc.setFillColor(...COLORS.cardBg);
    doc.rect(x, y, w, imgH, 'F');
  }

  // Card Outer Border
  doc.setDrawColor(...COLORS.cardBorder);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, imgH + capH, 'D');

  // Caption Banner
  doc.setFillColor(...COLORS.cardHeaderBg);
  doc.rect(x, y + imgH, w, capH, 'FD');
  doc.setDrawColor(...COLORS.cardBorder);
  doc.setLineWidth(0.2);
  doc.line(x, y + imgH, x + w, y + imgH);

  // Caption Text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...COLORS.textDark);
  const truncatedLabel = doc.splitTextToSize(`${numberLabel}: ${photo.label}`, w - 6)[0] || `${numberLabel}`;
  doc.text(truncatedLabel, x + 3, y + imgH + 4.2);
}
