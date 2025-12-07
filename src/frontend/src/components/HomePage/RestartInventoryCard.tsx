/**
 * Wrapper component for triggering inventory process restart.
 * Renders RestartProcess component with page reload callback for dashboard refresh.
 */
import RestartProcess from './RestartProcess';

interface RestartInventoryProcessProps {
  teamId: string;
}

export default function RestartInventoryProcess({ teamId }: RestartInventoryProcessProps) {
  return <RestartProcess teamId={teamId} onRestart={() => window.location.reload()} />;
}
