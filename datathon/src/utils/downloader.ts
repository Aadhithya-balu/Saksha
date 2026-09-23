import { API_BASE_URL, getStoredTokens } from '../services/api';

export const downloadSecureDossier = async (title: string, data: Record<string, any>, watermark: string, format: 'pdf' | 'docx' | 'txt' | 'csv' | 'xlsx' = 'pdf') => {
  try {
    const tokens = getStoredTokens();
    const response = await fetch(`${API_BASE_URL}/reports/dossier/export/${format}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {})
      },
      body: JSON.stringify({
        title,
        data,
        watermark
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to generate ${format.toUpperCase()}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const element = document.createElement('a');
    element.href = url;
    element.download = `ksp_${title.toLowerCase().replace(/\s+/g, '_')}.${format}`;
    document.body.appendChild(element);
    element.click();
    setTimeout(() => {
      document.body.removeChild(element);
      URL.revokeObjectURL(url);
    }, 300);
  } catch (error) {
    console.error('Download error:', error);
    alert(`Failed to download ${format.toUpperCase()} dossier`);
  }
};

const extractErrorMessage = (raw: string, fallback: string): string => {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed.message || parsed.detail || parsed.error?.message || raw;
  } catch {
    return raw;
  }
};

export const downloadReportFile = async (
  reportType: string,
  format: 'pdf' | 'docx' | 'txt' | 'csv' | 'xlsx',
  queryParams: Record<string, string>,
  customFilename?: string
) => {
  const tokens = getStoredTokens();
  const searchParams = new URLSearchParams(queryParams);
  const response = await fetch(`${API_BASE_URL}/reports/${reportType}/export/${format}?${searchParams.toString()}`, {
    headers: {
      ...(tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {})
    }
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(extractErrorMessage(errorText, `Failed to export ${format.toUpperCase()}`));
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const element = document.createElement('a');
  element.href = url;
  element.download = customFilename || `saksha_${reportType}_report_${new Date().toISOString().slice(0, 10)}.${format}`;
  document.body.appendChild(element);
  element.click();
  setTimeout(() => {
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
  }, 300);
};

export const downloadExistingManagedReport = async (
  reportId: string,
  format: 'pdf' | 'docx' | 'txt' | 'csv' | 'xlsx',
  filename?: string
) => {
  const tokens = getStoredTokens();
  const response = await fetch(`${API_BASE_URL}/reports/${reportId}/download?export_format=${format}`, {
    headers: {
      ...(tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {})
    }
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(extractErrorMessage(errorText, `Failed to download ${format.toUpperCase()}`));
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const element = document.createElement('a');
  element.href = url;
  element.download = filename || `saksha_report_${reportId.slice(0, 8)}.${format}`;
  document.body.appendChild(element);
  element.click();
  setTimeout(() => {
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
  }, 300);
};
