import { useEffect, useState } from 'react';
import { getAIJobs, retryAIJob, type AIProcessingJob } from '../../services/api';
import { Play, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function ProcessingCenter() {
  const [jobs, setJobs] = useState<AIProcessingJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const data = await getAIJobs();
      setJobs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (jobId: string) => {
    await retryAIJob(jobId);
    fetchJobs();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">AI Processing Center</h1>
      {loading ? (
        <p>Loading jobs...</p>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{job.job_type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {job.status === 'COMPLETED' && <span className="text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4"/> Completed</span>}
                    {job.status === 'FAILED' && <span className="text-red-600 flex items-center gap-1" title={job.error_details || ''}><XCircle className="w-4 h-4"/> Failed</span>}
                    {job.status === 'QUEUED' && <span className="text-gray-500 flex items-center gap-1"><Clock className="w-4 h-4"/> Queued</span>}
                    {job.status === 'PROCESSING' && <span className="text-blue-500 flex items-center gap-1">Processing...</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{job.target_entity_type}: {job.target_entity_id.substring(0,8)}...</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(job.created_at).toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {(job.status === 'FAILED' || job.status === 'QUEUED') && (
                      <button onClick={() => handleRetry(job.id)} className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1 ml-auto">
                        <Play className="w-4 h-4" /> Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">No AI jobs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
