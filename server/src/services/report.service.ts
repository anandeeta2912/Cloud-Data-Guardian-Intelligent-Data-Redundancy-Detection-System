import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { DuplicateLog, Record, ValidationReport, Dataset } from '../models';
import { AuthRequest } from '../middleware/auth.middleware';
import { SystemLog } from '../models/SystemLog';

export class ReportService {
  static async generateCSV(req: AuthRequest, datasetId: string, type: 'duplicates' | 'records' | 'validation') {
    const tenantId = req.tenantId!;
    const dataset = await Dataset.findOne({ tenantId, datasetId });
    if (!dataset) throw new Error('DATASET_NOT_FOUND');

    let rows: any[] = [];
    let headers: string[] = [];
    let fieldMap: Record<string, string> = {};

    if (type === 'duplicates') {
      headers = ['Duplicate ID', 'Matched Record ID', 'Similarity Score', 'Match Type', 'Rejection Reason', 'Source', 'Ingested At'];
      fieldMap = { 'Duplicate ID': '_id', 'Matched Record ID': 'matchedRecordId', 'Similarity Score': 'similarityScore', 'Match Type': 'matchType', 'Rejection Reason': 'rejectionReason', 'Source': 'source', 'Ingested At': 'ingestedAt' };
      rows = await DuplicateLog.find({ tenantId, datasetId })
        .sort({ ingestedAt: -1 })
        .limit(10000)
        .lean();
    } else if (type === 'records') {
      headers = ['Record ID', 'Data', 'Source', 'Ingested At'];
      fieldMap = { 'Record ID': 'recordId', 'Data': 'data', 'Source': 'source', 'Ingested At': 'ingestedAt' };
      rows = await Record.find({ tenantId, datasetId }).sort({ ingestedAt: -1 }).limit(10000).lean();
    } else if (type === 'validation') {
      headers = ['Validation ID', 'Total Records', 'Passed', 'Failed', 'Status', 'Started At'];
      fieldMap = { 'Validation ID': '_id', 'Total Records': 'summary.total', 'Passed': 'summary.passed', 'Failed': 'summary.failed', 'Status': 'status', 'Started At': 'startedAt' };
      rows = await ValidationReport.find({ tenantId, datasetId }).sort({ createdAt: -1 }).limit(1000).lean();
    }

    const csvContent = [
      headers.join(','),
      ...rows.map((row: any) =>
        headers.map((h) => {
          const field = fieldMap[h];
          let val: any = field ? (field.split('.').reduce((o: any, k: string) => (o || {})[k], row) || '') : '';
          if (typeof val === 'object') val = JSON.stringify(val);
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(',')
      ),
    ].join('\n');

    await SystemLog.create({
      tenantId,
      level: 'info',
      service: 'reporting_service',
      action: 'report.generated',
      message: `CSV report generated for dataset ${datasetId}`,
      metadata: { datasetId, type, rowCount: rows.length },
    });

    return { content: csvContent, filename: `${datasetId}_${type}_report.csv` };
  }

  static async generateExcel(req: AuthRequest, datasetId: string) {
    const tenantId = req.tenantId!;
    const dataset = await Dataset.findOne({ tenantId, datasetId });
    if (!dataset) throw new Error('DATASET_NOT_FOUND');

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Records');

    const records = await Record.find({ tenantId, datasetId }).sort({ ingestedAt: -1 }).limit(10000).lean();

    sheet.columns = [
      { header: 'Record ID', key: 'recordId', width: 30 },
      { header: 'Source', key: 'source', width: 20 },
      { header: 'Ingested At', key: 'ingestedAt', width: 25 },
      { header: 'Data', key: 'data', width: 50 },
    ];

    records.forEach((record) => {
      sheet.addRow({
        recordId: record.recordId,
        source: record.source,
        ingestedAt: record.ingestedAt,
        data: JSON.stringify(record.data),
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    await SystemLog.create({
      tenantId,
      level: 'info',
      service: 'reporting_service',
      action: 'report.generated',
      message: `Excel report generated for dataset ${datasetId}`,
      metadata: { datasetId, type: 'excel', rowCount: records.length },
    });

    return { buffer, filename: `${datasetId}_records_report.xlsx` };
  }

  static async generatePDF(req: AuthRequest, datasetId: string) {
    const tenantId = req.tenantId!;
    const dataset = await Dataset.findOne({ tenantId, datasetId });
    if (!dataset) throw new Error('DATASET_NOT_FOUND');

    const [totalRecords, totalDuplicates, avgSimilarity] = await Promise.all([
      Record.countDocuments({ tenantId, datasetId }),
      DuplicateLog.countDocuments({ tenantId, datasetId }),
      DuplicateLog.aggregate([{ $match: { tenantId, datasetId } }, { $group: { _id: null, avg: { $avg: '$similarityScore' } } }]),
    ]);

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));

    await new Promise<void>((resolve) => {
      doc.on('end', resolve);

      doc.fontSize(20).text('CloudData Guardian', { align: 'center' });
      doc.moveDown();
      doc.fontSize(16).text(`Analytics Report: ${dataset.name}`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(14).text('Summary', { underline: true });
      doc.moveDown();
      doc.fontSize(12).text(`Total Unique Records: ${totalRecords}`);
      doc.text(`Total Duplicates: ${totalDuplicates}`);
      doc.text(`Duplicate Percentage: ${totalRecords + totalDuplicates > 0 ? ((totalDuplicates / (totalRecords + totalDuplicates)) * 100).toFixed(2) : '0.00'}%`);
      doc.text(`Average Similarity Score: ${avgSimilarity.length > 0 ? (avgSimilarity[0].avg * 100).toFixed(2) + '%' : 'N/A'}`);
    });

    const buffer = Buffer.concat(chunks);

    await SystemLog.create({
      tenantId,
      level: 'info',
      service: 'reporting_service',
      action: 'report.generated',
      message: `PDF report generated for dataset ${datasetId}`,
      metadata: { datasetId, type: 'pdf' },
    });

    return { buffer, filename: `${datasetId}_analytics_report.pdf` };
  }
}
