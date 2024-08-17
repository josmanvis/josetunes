import { useContext } from "solid-js";
import "./ListItem.scss";
import { AppStateContext } from "../contexts/app-state";
import { downloadTask } from "../types";
import BadgeStatus from "./BadgeStatus";
import { DeleteIcon } from "../icons/DeleteIcon";
import YouTubeThumbnail from "./YouTubeThumbnail";
import SoundCloudThumbnail from "./SoundCloudThumbnail";
import { DownloadIcon } from "../icons/DownloadIcon";

const ListItem = ({ task }: { task: downloadTask }) => {
  const { removeFromDownloadList, startDownloadTask } =
    useContext<any>(AppStateContext);
  const { url, format, id, status, youtubeId, soundcloudId } = task;
  return (
    <li class="list-item" title={`${format} - ${id} - ${status}`}>
      <button class="item-download-btn" onClick={() => startDownloadTask(task)}>
        <DownloadIcon />
      </button>
      {youtubeId && <YouTubeThumbnail id={youtubeId} />}
      {soundcloudId && <SoundCloudThumbnail url={url} />}
      <b>{format}</b>
      <div class="url">{url}</div>
      <div class="task-options">
        <BadgeStatus status={status} />
        <button class="delete" onClick={() => removeFromDownloadList(task)}>
          <DeleteIcon color="orange" />
        </button>
      </div>
    </li>
  );
};

export default ListItem;
