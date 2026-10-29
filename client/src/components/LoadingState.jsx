export default function LoadingState({ label = "Loading" }) {
  return (
    <div className="flex min-h-40 items-center justify-center" role="status" aria-live="polite">
      <span className="loading loading-spinner loading-md text-primary" aria-label={label} />
    </div>
  );
}
