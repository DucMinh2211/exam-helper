import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, HeadingLevel } from 'docx';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import type { Exam } from '../entities/Exam';
import type { Question, MCQuestion, TFQuestion } from '../entities/Question';

export const ExportService = {
  // 1. Export JSON
  exportToJson(exam: Exam, questions: Question[]) {
    const data = {
      exam,
      questions,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    saveAs(blob, `${exam.name}.json`);
  },

  // 2. Export PDF (via HTML Capture)
  async exportToPdf(examName: string, elementId: string) {
    const element = document.getElementById(elementId);
    if (!element) return;

    try {
      // Use html-to-image instead of html2canvas for better CSS support (oklch, modern features)
      const imgData = await toPng(element, { 
        cacheBust: true,
        style: {
           background: 'white' // Ensure white background
        }
      });
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Load image to get dimensions
      const img = new Image();
      img.src = imgData;
      await new Promise(resolve => { img.onload = resolve; });

      const imgWidth = img.width;
      const imgHeight = img.height;
      
      const imgFinalWidth = pdfWidth; 
      const imgFinalHeight = (imgHeight * pdfWidth) / imgWidth;

      let heightLeft = imgFinalHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgFinalWidth, imgFinalHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgFinalHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgFinalWidth, imgFinalHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`${examName}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Có lỗi khi xuất PDF.');
    }
  },

  // 3. Export DOCX
  async exportToDocx(exam: Exam, questions: Question[]) {
    const docChildren: any[] = [];

    // Title
    docChildren.push(
      new Paragraph({
        text: exam.name,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
      })
    );
    
    docChildren.push(
      new Paragraph({
        text: `Mã đề: ${exam.id.slice(0, 8)} - Ngày tạo: ${new Date(exam.createdAt).toLocaleDateString('vi-VN')}`,
        alignment: AlignmentType.CENTER,
        spacing: { after: 500 },
      })
    );

    // Questions
    questions.forEach((q, index) => {
      // Question Title & Content
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Câu ${index + 1}: `,
              bold: true,
              color: '2563EB', // Blue color like UI
            }),
            new TextRun({
              text: q.content,
            }),
          ],
          spacing: { before: 200, after: 100 },
        })
      );

      // Multiple Choice
      if (q.type === 'MULTIPLE_CHOICE') {
        const mcQ = q as MCQuestion;
        if (mcQ.choices) {
          mcQ.choices.forEach((choice, i) => {
            docChildren.push(
              new Paragraph({
                text: `${String.fromCharCode(65 + i)}. ${choice}`,
                indent: { left: 720 }, // Indent ~0.5 inch
                spacing: { after: 50 },
              })
            );
          });
        }
      }

      // True/False (Table)
      if (q.type === 'TRUE_FALSE') {
        const tfQ = q as TFQuestion;
        if (tfQ.choices) {
          const tableRows = [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "Ý", bold: true, alignment: AlignmentType.CENTER })], width: { size: 10, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ text: "Nội dung", bold: true })], width: { size: 60, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ text: "Đúng", bold: true, alignment: AlignmentType.CENTER })], width: { size: 15, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ text: "Sai", bold: true, alignment: AlignmentType.CENTER })], width: { size: 15, type: WidthType.PERCENTAGE } }),
              ],
            }),
            ...tfQ.choices.map((choice, i) => 
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: (i + 1).toString(), alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph(choice)] }),
                  new TableCell({ children: [] }), // Checkbox placeholder
                  new TableCell({ children: [] }), // Checkbox placeholder
                ],
              })
            )
          ];

          docChildren.push(
            new Table({
              rows: tableRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
              },
            })
          );
          // Add spacing after table
          docChildren.push(new Paragraph({ text: "", spacing: { after: 100 } })); 
        }
      }

      // Essay
      if (q.type === 'ESSAY') {
        docChildren.push(
          new Paragraph({
            text: "...................................................................................................................................................................................",
            spacing: { after: 200 },
          })
        );
         docChildren.push(
          new Paragraph({
            text: "...................................................................................................................................................................................",
            spacing: { after: 200 },
          })
        );
      }
    });

    docChildren.push(
        new Paragraph({
            text: "--- HẾT ---",
            alignment: AlignmentType.CENTER,
            spacing: { before: 500 }
        })
    );

    const doc = new Document({
      sections: [{
        properties: {},
        children: docChildren,
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${exam.name}.docx`);
  }
};