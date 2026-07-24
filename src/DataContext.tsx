import { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useData } from '../context/DataContext';

export default function UploadStatusBanner() {
  const { uploadStatus, clearUploadStatus } = useData();

  useEffect(() => {
    if (uploadStatus?.stage === 'success') {
      const t = setTimeout(clearUploadStatus, 4000);
      return () => clearTimeout(t);
    }
  }, [uploadStatus, clearUploadStatus]);

  if (!uploadStatus) return null;

  const styles = {
    uploading: { bg: 'bg-purple', icon: <Loader2 size={16} className="animate-spin" /> },
    success: { bg: 'bg-green-600', icon: <CheckCircle2 size={16} /> },
    error: { bg: 'bg-red-600', icon: <AlertCircle size={16} /> },
  }[uploadStatus.stage];

  return (
    <div className="fixed left-0 right-0 top-0 z-[60] flex justify-center px-4 pt-3">
      <div
        className={`flex max-w-md items-center gap-2 rounded-full ${styles.bg} px-4 py-2 text-xs font-semibold text-white shadow-lg`}
      >
        {styles.icon}
        <span className="truncate">{uploadStatus.message}</span>
        {uploadStatus.stage !== 'uploading' && (
          <button onClick={clearUploadStatus} className="ml-1 text-white/80">
            ×
          </button>
        )}
      </div>
    </div>
  );
}
