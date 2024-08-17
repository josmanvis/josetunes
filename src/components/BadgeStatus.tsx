import "./BadgeStatus.scss";
// Icon Components
import { ClockIcon } from "../icons/ClockIcon";
import { CheckIcon } from "../icons/CheckIcon";
import { WarningIcon } from "../icons/WarningIcon";
import { DownloadIcon } from "../icons/DownloadIcon";

const BadgeStatus = ({ status }: { status: string }) => {
  const statusMap = {
    pending: {
      label: "queued",
      icon: <ClockIcon color="white" />,
    },
    downloading: {
      label: "downloading",
      icon: <DownloadIcon color="white" />,
    },
    completed: {
      label: "completed",
      icon: <CheckIcon color="white" />,
    },
    failed: {
      label: "failed",
      icon: <WarningIcon color="white" />,
    },
  };
  const Icon = () => statusMap[status].icon;
  return (
    <div class={`badge-status ${status}`}>
      <Icon />
      <span class="status-text">{statusMap[status].label}</span>
    </div>
  );
};

export default BadgeStatus;
