import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker for browser environment
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface ParsedDocument {
  name: string;
  type: 'pdf' | 'image' | 'presentation';
  totalPages: number;
  dataUrl?: string;
  pagesDataUrls?: string[];
}

export async function processUploadedFile(file: File): Promise<ParsedDocument> {
  const fileName = file.name;
  const fileType = file.type;

  // Handle Images
  if (fileType.startsWith('image/')) {
    const dataUrl = await fileToDataURL(file);
    return {
      name: fileName,
      type: 'image',
      totalPages: 1,
      dataUrl,
      pagesDataUrls: [dataUrl],
    };
  }

  // Handle PDFs
  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      const pageImages: string[] = [];

      // Render each page into a compressed JPEG dataUrl for lightweight real-time page flipping
      const maxPagesToRender = Math.min(numPages, 50); // limit to 50 pages for performance
      for (let pageNum = 1; pageNum <= maxPagesToRender; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 }); // Good quality render scale

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          // Compress to JPEG 0.85
          const pageDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          pageImages.push(pageDataUrl);
        }
      }

      return {
        name: fileName,
        type: 'pdf',
        totalPages: pageImages.length,
        pagesDataUrls: pageImages,
      };
    } catch (err) {
      console.warn('PDF parsing error, falling back to arrayBuffer dataUrl:', err);
      const dataUrl = await fileToDataURL(file);
      return {
        name: fileName,
        type: 'pdf',
        totalPages: 1,
        dataUrl,
        pagesDataUrls: [dataUrl],
      };
    }
  }

  // Handle Presentations / Other supported slide/doc formats
  const dataUrl = await fileToDataURL(file);
  return {
    name: fileName,
    type: 'presentation',
    totalPages: 1,
    dataUrl,
    pagesDataUrls: [dataUrl],
  };
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
