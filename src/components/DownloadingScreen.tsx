import { useContext } from "solid-js";
import "./DownloadingScreen.scss";
import { AppStateContext } from "../contexts/app-state";

const DownloadingScreen = () => {
  const { downloadList } = useContext<any>(AppStateContext);
  return (
    <div class="downloading-screen">
      <h3>Downloading...</h3>
      {downloadList().map((item: any) => (
        <div class="downloading-screen__item">
          <div class="downloading-screen__item__name">
            {item.url} - {item.status}
          </div>
        </div>
      ))}
    </div>
  );
};

export default DownloadingScreen;
