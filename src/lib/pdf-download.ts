type DownloadLink = Pick<HTMLAnchorElement, 'href' | 'download' | 'click' | 'remove'>;

export type PdfDownloadResult = 'downloaded' | 'forbidden' | 'failed' | 'in-flight';

export type PdfDownloadOptions = {
  url: string;
  /** Omit to retain the server's download filename. */
  filename?: string;
  onDownloaded?: () => void;
  onForbidden?: () => void;
};

export type PdfDownloadDependencies = {
  fetch: (url: string) => Promise<Response>;
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  createLink: () => DownloadLink;
  appendLink: (link: DownloadLink) => void;
};

function isPdfType(contentType: string | null) {
  return contentType?.split(';')[0].trim().toLowerCase() === 'application/pdf';
}

function responseFilename(response: Response) {
  const disposition = response.headers.get('content-disposition') || '';
  const encoded = disposition.match(/(?:^|;)\s*filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      const filename = decodeURIComponent(encoded.trim());
      if (filename) return filename;
    } catch {
      // Fall back to the ordinary filename when the encoded value is invalid.
    }
  }
  return disposition.match(/(?:^|;)\s*filename="([^"]+)"/i)?.[1] || 'CV.pdf';
}

/** Reports success only after a nonempty PDF has started downloading in the browser. */
export function createPdfDownloader(dependencies: PdfDownloadDependencies) {
  const inFlight = new Set<string>();

  return async function download(options: PdfDownloadOptions): Promise<PdfDownloadResult> {
    if (inFlight.has(options.url)) return 'in-flight';
    inFlight.add(options.url);

    try {
      const response = await dependencies.fetch(options.url);
      if (response.status === 403) {
        options.onForbidden?.();
        return 'forbidden';
      }
      if (!response.ok || !isPdfType(response.headers.get('content-type'))) return 'failed';

      const blob = await response.blob();
      if (!blob.size || !isPdfType(blob.type)) return 'failed';

      const objectUrl = dependencies.createObjectURL(blob);
      let link: DownloadLink | undefined;
      try {
        link = dependencies.createLink();
        link.href = objectUrl;
        link.download = options.filename ?? responseFilename(response);
        dependencies.appendLink(link);
        link.click();
      } finally {
        try {
          link?.remove();
        } finally {
          dependencies.revokeObjectURL(objectUrl);
        }
      }

      options.onDownloaded?.();
      return 'downloaded';
    } catch {
      return 'failed';
    } finally {
      inFlight.delete(options.url);
    }
  };
}

export const downloadPdf = createPdfDownloader({
  fetch: (url) => fetch(url),
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
  createLink: () => document.createElement('a'),
  appendLink: (link) => document.body.appendChild(link as HTMLAnchorElement),
});
