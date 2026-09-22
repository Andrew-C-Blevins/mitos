export function SaveFeedback({ message, error = false }: { message: string; error?: boolean }) {
  if (!message) return null;
  return (
    <p className={`save-feedback ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>
      {message}
    </p>
  );
}
